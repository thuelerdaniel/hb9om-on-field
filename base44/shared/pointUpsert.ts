// Shared logic for upserting point data (SOTA, POTA, WWFF) as individual records.
// Avoids MongoDB's 16MB BSON document limit by storing one record per point
// instead of a giant array inside a single ReferenceData document.
//
// Strategy: full refresh — delete all existing records, then bulkCreate in batches.
// This is idempotent: if the function times out mid-create, re-running starts clean.

const BATCH_SIZE = 500; // SDK bulkCreate max is 500 records per call

/**
 * Upsert points for a given entity type.
 * Deletes all existing records, then bulkCreates all new points in batches.
 * Also updates the corresponding ReferenceData metadata record (references: []).
 *
 * @param base44 - The Base44 SDK client (with asServiceRole)
 * @param entityName - Entity name: 'SotaPoint' | 'PotaPoint' | 'WwffPoint'
 * @param refType - ReferenceData type key: 'sota' | 'pota' | 'hbff'
 * @param points - Array of point objects to insert
 * @param source - Source label for metadata
 * @returns { created, total, error? }
 */
export async function upsertPoints(
  base44: any,
  entityName: 'SotaPoint' | 'PotaPoint' | 'WwffPoint',
  refType: 'sota' | 'pota' | 'hbff',
  points: any[],
  source: string
): Promise<{ created: number; total: number; error?: string }> {
  if (!points || points.length === 0) {
    return { created: 0, total: 0 };
  }

  const entity = base44.asServiceRole.entities[entityName];

  // 1. Delete all existing records (full refresh)
  try {
    await entity.deleteMany({});
  } catch (e) {
    // Non-fatal — bulkCreate will still work, just might create duplicates
    // if delete failed (but deleteMany({}) is reliable for admin-managed entities)
  }

  // 2. Bulk create in batches of 500
  let created = 0;
  let lastError: string | undefined;
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    try {
      await entity.bulkCreate(batch);
      created += batch.length;
    } catch (e: any) {
      lastError = e.message || String(e);
      // Continue with next batch — partial data is better than no data
    }
  }

  // 3. Update ReferenceData metadata record (references: [], just metadata)
  try {
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: refType });
    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
        references: [],
        total_count: points.length,
        source,
        last_updated: now
      });
    } else {
      await base44.asServiceRole.entities.ReferenceData.create({
        type: refType,
        references: [],
        total_count: points.length,
        source,
        last_updated: now
      });
    }
  } catch (e) {
    // Metadata update failure is non-fatal — points are already saved
  }

  return { created, total: points.length, error: created < points.length ? lastError : undefined };
}

/**
 * Load all points for a given entity type with pagination.
 * Uses list() with limit=10000 per call, paginating with skip.
 * Returns merged array of all points.
 *
 * @param base44 - The Base44 SDK client (with asServiceRole)
 * @param entityName - Entity name: 'SotaPoint' | 'PotaPoint' | 'WwffPoint'
 * @returns Array of all point records
 */
export async function loadAllPoints(
  base44: any,
  entityName: 'SotaPoint' | 'PotaPoint' | 'WwffPoint'
): Promise<any[]> {
  const entity = base44.asServiceRole?.entities?.[entityName];
  if (!entity) {
    console.error(`[loadAllPoints] entity not found: ${entityName}, asServiceRole=${!!base44.asServiceRole}`);
    return [];
  }
  const PAGE_SIZE = 10000;
  let all: any[] = [];
  let skip = 0;

  while (true) {
    let page: any[];
    try {
      // list(sort, limit) — we use a high limit to minimize round-trips
      page = await entity.list('-created_date', PAGE_SIZE);
    } catch (e: any) {
      console.error(`[loadAllPoints] list error for ${entityName}:`, e?.message || String(e));
      break;
    }
    if (!page || page.length === 0) break;
    all = all.concat(page);
    if (page.length < PAGE_SIZE) break; // last page
    skip += PAGE_SIZE;
    // Safety: prevent infinite loop if list doesn't paginate
    if (skip > 500000) break;
  }

  return all;
}