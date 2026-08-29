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
  entityName: 'SotaPoint' | 'PotaPoint' | 'WwffPoint' | 'TotaPoint' | 'PrivateNode'
): Promise<any[]> {
  const entity = base44.asServiceRole?.entities?.[entityName];
  if (!entity) {
    console.error(`[loadAllPoints] entity not found: ${entityName}, asServiceRole=${!!base44.asServiceRole}`);
    return [];
  }
  // Skip-based pagination: list(sort, limit, skip) — the SDK's 3rd arg is skip.
  // Cursor-based pagination on created_date/id doesn't work ($lt not supported by SDK filter).
  const LIMIT = 5000;
  const MAX_PAGES = 60; // 60 * 5000 = 300k records max
  const allPoints: any[] = [];

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const result: any[] = await entity.list('-created_date', LIMIT, page * LIMIT);
      if (!Array.isArray(result) || result.length === 0) break;
      allPoints.push(...result);
      if (result.length < LIMIT) break;
    }
  } catch (e: any) {
    console.error(`[loadAllPoints] pagination error for ${entityName}:`, e?.message || String(e));
  }
  return allPoints;
}

/**
 * Load points within geographic bounds using database-level filtering.
 * Uses $gte/$lte operators on lat/lng to avoid loading ALL records (which exceeds
 * the app entity read traffic volume limit for large datasets like 181k SotaPoint).
 *
 * @param base44 - The Base44 SDK client (with asServiceRole)
 * @param entityName - Entity name: 'SotaPoint' | 'PotaPoint' | 'WwffPoint'
 * @param bounds - { north, south, east, west } geographic bounds
 * @returns Array of point records within bounds
 */
export async function loadPointsInBounds(
  base44: any,
  entityName: 'SotaPoint' | 'PotaPoint' | 'WwffPoint' | 'TotaPoint' | 'IotaPoint' | 'Repeater' | 'PrivateNode',
  bounds: { north: number; south: number; east: number; west: number }
): Promise<any[]> {
  const entity = base44.asServiceRole?.entities?.[entityName];
  if (!entity) {
    console.error(`[loadPointsInBounds] entity not found: ${entityName}`);
    return [];
  }

  const query: any = {
    lat: { $gte: bounds.south, $lte: bounds.north },
    lng: { $gte: bounds.west, $lte: bounds.east },
  };

  const LIMIT = 5000;
  const MAX_PAGES = 20; // 20 pages = 100k records — WwffPoint has 40k+ with duplicates; need deep scan to reach all countries
  const allPoints: any[] = [];
  const seenCodes = new Set<string>();
  let noNewCodesStreak = 0;

  // Strategy: Try bounds filter with NO sort first (sort causes MongoDB timeout on large
  // collections like SotaPoint with 140k+ records and no lat/lng index).
  // Early stopping: if 3 consecutive batches yield no new unique codes, we've seen all records.
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      // NO sort — sorting by 'code' causes MongoDB timeout on large collections
      const result: any[] = await entity.filter(query, undefined, LIMIT, page * LIMIT);
      if (!Array.isArray(result) || result.length === 0) break;
      let newCodesInBatch = 0;
      for (const r of result) {
        if (r.code) {
          if (!seenCodes.has(r.code)) {
            seenCodes.add(r.code);
            newCodesInBatch++;
          }
        }
      }
      allPoints.push(...result);
      // Early stopping: 3 consecutive batches with no new unique codes = we've seen all
      if (newCodesInBatch === 0) {
        noNewCodesStreak++;
        if (noNewCodesStreak >= 3) break;
      } else {
        noNewCodesStreak = 0;
      }
      if (result.length < LIMIT) break;
    }
    if (allPoints.length > 0) {
      console.log(`[loadPointsInBounds] ${entityName}: loaded ${allPoints.length} points in bounds (${seenCodes.size} unique codes)`);
      return allPoints;
    }
  } catch (e: any) {
    console.error(`[loadPointsInBounds] bounds filter error for ${entityName}: ${e?.message || String(e)} — trying fallback`);
  }

  // Fallback: paginated full scan with in-memory bounds filtering.
  // Used when the bounds query times out (e.g. PotaPoint with 89k records, no lat/lng index).
  // Strategy: load records in sequential pages (skip=0, 500, 1000, ...) and filter in-memory.
  // This is slower but reliable — we scan the entire collection in 500-record batches.
  try {
    const BATCH_SIZE = 500;
    const MAX_BATCHES = 80; // 80 * 500 = 40000 records max (within 25s timeout)
    let totalScanned = 0;

    for (let page = 0; page < MAX_BATCHES; page++) {
      try {
        const batch = await entity.filter({}, undefined, BATCH_SIZE, page * BATCH_SIZE);
        if (!Array.isArray(batch) || batch.length === 0) break;
        totalScanned += batch.length;
        // Filter in-memory by bounds
        const inBounds = batch.filter(r =>
          r.lat != null && r.lng != null &&
          r.lat >= bounds.south && r.lat <= bounds.north &&
          r.lng >= bounds.west && r.lng <= bounds.east
        );
        allPoints.push(...inBounds);
        if (batch.length < BATCH_SIZE) break; // End of collection
      } catch (e: any) {
        // Continue with next batch — partial data is better than none
      }
    }
    console.log(`[loadPointsInBounds] ${entityName} fallback: scanned ${totalScanned} records, found ${allPoints.length} in bounds`);
  } catch (e: any) {
    console.error(`[loadPointsInBounds] fallback error for ${entityName}:`, e?.message || String(e));
  }
  return allPoints;
}