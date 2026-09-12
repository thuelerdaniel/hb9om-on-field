import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { isInternalCall } from '../../shared/internalAuth.ts';

// Dedup reference point entities by code — keeps the best record per code
// (one with lat/lng, or newest), deletes all duplicates.
//
// v0.95 Build-5: Cursor-based pagination on 'id' field — no skip, no overlap.
// Previous no-sort skip-scan returned overlapping pages, causing the function to
// re-scan the same records and inflate duplicate counts. Cursor-based pagination
// uses { id: { $gt: lastId } } to get stable, non-overlapping batches.

const LOAD_BATCH = 5000;
const DELETE_BATCH = 5000;
const TIME_BUDGET_MS = 270000;

const VALID_ENTITIES: Record<string, string> = {
  SotaPoint: 'sota',
  PotaPoint: 'pota',
  WwffPoint: 'hbff',
  TotaPoint: 'tota',
  IotaPoint: 'iota',
  LlotaRef: 'llota',
};

export default async function(req: any) {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      let user: any = null;
      try { user = await base44.auth.me(); } catch {}
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden — Admin only' }, { status: 403 });
    }

    const entityName = body.entityName || body.entity;
    if (!entityName || !VALID_ENTITIES[entityName]) {
      return Response.json({
        error: `Invalid entityName. Valid: ${Object.keys(VALID_ENTITIES).join(', ')}`,
      }, { status: 400 });
    }

    const refType = body.refType || VALID_ENTITIES[entityName];
    const entity = base44.asServiceRole.entities[entityName];

    // === Cursor-based scan: group ALL records by code in memory ===
    const byCode = new Map<string, Array<{id: string, lat: any, lng: any, created_date: string}>>();
    let totalScanned = 0;
    let recordsWithoutCode = 0;
    let lastId: string | null = null;
    let pages = 0;

    while (Date.now() - startTime < 180000) { // 3 min budget for scanning
      let batch: any[] = [];
      try {
        const query = lastId ? { id: { $gt: lastId } } : {};
        batch = await entity.filter(query, 'id', LOAD_BATCH);
      } catch { break; }

      if (!batch || batch.length === 0) break;
      totalScanned += batch.length;
      pages++;

      for (const r of batch) {
        if (!r.code) { recordsWithoutCode++; continue; }
        if (!byCode.has(r.code)) byCode.set(r.code, []);
        byCode.get(r.code)!.push({
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          created_date: r.created_date || '',
        });
      }

      // Advance cursor to last record's id
      lastId = batch[batch.length - 1].id;

      if (batch.length < LOAD_BATCH) break; // Last page
    }

    // === Collect duplicate IDs ===
    const deleteIds: string[] = [];
    let codesWithDuplicates = 0;
    let totalDuplicates = 0;

    for (const [code, recs] of byCode) {
      if (recs.length <= 1) continue;
      codesWithDuplicates++;
      totalDuplicates += recs.length - 1;

      recs.sort((a, b) => {
        const aCoords = a.lat != null && a.lng != null ? 1 : 0;
        const bCoords = b.lat != null && b.lng != null ? 1 : 0;
        if (aCoords !== bCoords) return bCoords - aCoords;
        return b.created_date.localeCompare(a.created_date);
      });

      for (let j = 1; j < recs.length; j++) {
        deleteIds.push(recs[j].id);
      }
    }

    // === Delete duplicates in batches ===
    let totalDeleted = 0;
    let deleteErrors = 0;

    for (let j = 0; j < deleteIds.length; j += DELETE_BATCH) {
      if (Date.now() - startTime > TIME_BUDGET_MS - 30000) break;
      const subChunk = deleteIds.slice(j, j + DELETE_BATCH);
      try {
        await entity.deleteMany({ id: { $in: subChunk } });
        totalDeleted += subChunk.length;
      } catch {
        deleteErrors++;
      }
    }

    // === Update ReferenceData with unique count ===
    const uniqueCount = byCode.size;
    let refDataUpdated = false;

    if (Date.now() - startTime < TIME_BUDGET_MS - 10000) {
      try {
        const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: refType });
        if (existing && existing.length > 0) {
          for (let i = 1; i < existing.length; i++) {
            try { await base44.asServiceRole.entities.ReferenceData.delete(existing[i].id); } catch {}
          }
          await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
            total_count: uniqueCount,
            references: [],
            last_updated: new Date().toISOString(),
          });
          refDataUpdated = true;
        }
      } catch {}
    }

    return Response.json({
      status: 'success',
      entityName,
      refType,
      total_scanned: totalScanned,
      pages_scanned: pages,
      unique_codes: uniqueCount,
      records_without_code: recordsWithoutCode,
      codes_with_duplicates: codesWithDuplicates,
      duplicates_found: totalDuplicates,
      duplicates_deleted: totalDeleted,
      duplicates_remaining: deleteIds.length - totalDeleted,
      delete_errors: deleteErrors,
      ref_data_updated: refDataUpdated,
      duration_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    return Response.json({
      status: 'failed',
      error: error.message || String(error),
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}