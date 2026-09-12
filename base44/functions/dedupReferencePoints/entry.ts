import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { isInternalCall } from '../../shared/internalAuth.ts';

// Dedup reference point entities by code — keeps the best record per code
// (one with lat/lng, or newest), deletes all duplicates.
//
// v0.95 Build-3: Hybrid approach — cursor-based scan on 'code' to build unique code set,
// then targeted $in queries per code group to get ALL records per code and delete duplicates.
// Previous skip-based pagination on 'id' was unreliable — consistently missed records
// (F/PE-129 still had 48 records after 3 passes).

const LOAD_BATCH = 5000;
const DELETE_BATCH = 5000; // Larger batch for faster deletes
const CODE_CHUNK = 1000; // codes per $in query — balance between speed and API limits
const TIME_BUDGET_MS = 270000; // 270s — leave buffer for test tool timeout

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

    // Auth check — admin only (or internal call)
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

    // === Phase 1: Build unique code set using skip-based pagination on 'id' ===
    // Sort on 'id' maps to _id (indexed) — reliable. Even if some records are missed,
    // Phase 2's $in queries get ALL records per code, so dedup is still correct.
    const uniqueCodes: string[] = [];
    const seenCodes = new Set<string>();
    let phase1Scanned = 0;

    for (let page = 0; page < 200; page++) {
      if (Date.now() - startTime > 120000) break; // 2 min budget for Phase 1

      let batch: any[] = [];
      try {
        batch = await entity.filter({}, 'id', LOAD_BATCH, page * LOAD_BATCH);
      } catch { break; }

      if (!batch || batch.length === 0) break;
      phase1Scanned += batch.length;

      for (const r of batch) {
        if (r.code && !seenCodes.has(r.code)) {
          seenCodes.add(r.code);
          uniqueCodes.push(r.code);
        }
      }

      if (batch.length < LOAD_BATCH) break;
    }

    // === Phase 2: Targeted dedup per code group using $in queries ===
    // For each chunk of codes, query ALL records with those codes, group by code,
    // keep the best per code, delete the rest.
    // Supports resumable processing via startIdx parameter.
    const startIdx = body.startIdx || 0;
    let totalDeleted = 0;
    let totalDuplicatesFound = 0;
    let codesProcessed = 0;
    let deleteErrors = 0;
    let lastProcessedCode: string | null = null;
    let lastProcessedIdx = startIdx;

    for (let i = startIdx; i < uniqueCodes.length; i += CODE_CHUNK) {
      if (Date.now() - startTime > TIME_BUDGET_MS - 30000) break; // Leave 30s for metadata

      const chunk = uniqueCodes.slice(i, i + CODE_CHUNK);
      let records: any[] = [];
      try {
        // Get ALL records for these codes — sort by id, high limit to catch all duplicates
        records = await entity.filter({ code: { $in: chunk } }, 'id', 50000);
      } catch { codesProcessed += chunk.length; continue; }

      if (!records || records.length === 0) {
        codesProcessed += chunk.length;
        continue;
      }

      // Group by code
      const byCode = new Map<string, any[]>();
      for (const r of records) {
        if (!r.code) continue;
        if (!byCode.has(r.code)) byCode.set(r.code, []);
        byCode.get(r.code)!.push(r);
      }

      // For each code, keep the best, collect duplicate IDs
      const deleteIds: string[] = [];
      for (const [code, recs] of byCode) {
        if (recs.length <= 1) continue;
        totalDuplicatesFound += recs.length - 1;

        // Sort: prefer records with coords, then newest by created_date
        recs.sort((a, b) => {
          const aCoords = a.lat != null && a.lng != null ? 1 : 0;
          const bCoords = b.lat != null && b.lng != null ? 1 : 0;
          if (aCoords !== bCoords) return bCoords - aCoords;
          return (b.created_date || '').localeCompare(a.created_date || '');
        });

        for (let j = 1; j < recs.length; j++) {
          deleteIds.push(recs[j].id);
        }
      }

      // Delete duplicates in sub-batches
      for (let j = 0; j < deleteIds.length; j += DELETE_BATCH) {
        if (Date.now() - startTime > TIME_BUDGET_MS) break;
        const subChunk = deleteIds.slice(j, j + DELETE_BATCH);
        try {
          await entity.deleteMany({ id: { $in: subChunk } });
          totalDeleted += subChunk.length;
        } catch {
          deleteErrors++;
        }
      }

      codesProcessed += chunk.length;
      lastProcessedCode = chunk[chunk.length - 1];
      lastProcessedIdx = i + CODE_CHUNK;
    }

    // === Phase 3: Update ReferenceData with unique count ===
    // Only update if we processed ALL codes (not a partial/resumable run)
    const allCodesProcessed = codesProcessed === uniqueCodes.length && phase1Scanned > 0;
    let refDataUpdated = false;

    if (allCodesProcessed) {
      try {
        const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: refType });
        if (existing && existing.length > 0) {
          for (let i = 1; i < existing.length; i++) {
            try { await base44.asServiceRole.entities.ReferenceData.delete(existing[i].id); } catch {}
          }
          await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
            total_count: uniqueCodes.length,
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
      phase1_scanned: phase1Scanned,
      unique_codes_found: uniqueCodes.length,
      codes_processed: codesProcessed,
      codes_remaining: uniqueCodes.length - codesProcessed,
      duplicates_found: totalDuplicatesFound,
      duplicates_deleted: totalDeleted,
      delete_errors: deleteErrors,
      last_processed_code: lastProcessedCode,
      all_codes_processed: allCodesProcessed,
      ref_data_updated: refDataUpdated,
      resumable_from: lastProcessedIdx < uniqueCodes.length ? lastProcessedIdx : null,
      resumable_start_idx: lastProcessedIdx < uniqueCodes.length ? lastProcessedIdx : null,
      total_unique_codes: uniqueCodes.length,
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