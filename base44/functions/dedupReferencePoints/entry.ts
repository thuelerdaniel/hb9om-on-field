import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { isInternalCall } from '../../shared/internalAuth.ts';

// Dedup reference point entities by code — keeps the best record per code
// (one with lat/lng, or newest), deletes all duplicates.
// Memory-efficient: only stores code→bestId map + duplicate ID list, not full records.

const LOAD_BATCH = 5000;
const DELETE_BATCH = 5000;
const TIME_BUDGET_MS = 280000; // 280s — leave 20s buffer for metadata

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

    // 1. Load all records in pages — build code → bestId map + collect duplicate IDs
    //    "Best" = has lat/lng, or newest by created_date
    const bestMap = new Map<string, { id: string; hasCoords: boolean; created: string }>();
    const duplicateIds: string[] = [];
    let totalScanned = 0;
    let noNewCodesStreak = 0;
    const seenCodes = new Set<string>();

    for (let page = 0; page < 300; page++) {
      // Leave 60s for delete phase + metadata
      if (Date.now() - startTime > TIME_BUDGET_MS - 60000) break;

      let batch: any[] = [];
      try {
        batch = await entity.filter({}, '-created_date', LOAD_BATCH, page * LOAD_BATCH);
      } catch { break; }

      if (!batch || batch.length === 0) break;
      totalScanned += batch.length;
      let newCodesInBatch = 0;

      for (const r of batch) {
        if (!r.code) continue;
        const hasCoords = r.lat != null && r.lng != null;
        const created = r.created_date || '';

        if (!seenCodes.has(r.code)) {
          seenCodes.add(r.code);
          newCodesInBatch++;
        }

        if (!bestMap.has(r.code)) {
          bestMap.set(r.code, { id: r.id, hasCoords, created });
        } else {
          const best = bestMap.get(r.code)!;
          // Keep record with coords over one without; among same, keep newer
          if ((hasCoords && !best.hasCoords) ||
              (hasCoords === best.hasCoords && created > best.created)) {
            duplicateIds.push(best.id);
            bestMap.set(r.code, { id: r.id, hasCoords, created });
          } else {
            duplicateIds.push(r.id);
          }
        }
      }

      // v0.95: No early stopping for dedup — must scan ALL records to find all duplicates
      // The 280s time budget is the real limit

      if (batch.length < LOAD_BATCH) break;
    }

    // 2. Delete duplicates in batches
    let deletedCount = 0;
    let deleteErrors = 0;
    for (let i = 0; i < duplicateIds.length; i += DELETE_BATCH) {
      if (Date.now() - startTime > TIME_BUDGET_MS) break;
      const chunk = duplicateIds.slice(i, i + DELETE_BATCH);
      try {
        await entity.deleteMany({ id: { $in: chunk } });
        deletedCount += chunk.length;
      } catch {
        deleteErrors++;
      }
    }

    // 3. Update ReferenceData with unique count
    const uniqueCount = bestMap.size;
    try {
      const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: refType });
      if (existing && existing.length > 0) {
        // Delete any duplicate ReferenceData records (keep only one per type)
        for (let i = 1; i < existing.length; i++) {
          try { await base44.asServiceRole.entities.ReferenceData.delete(existing[i].id); } catch {}
        }
        await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
          total_count: uniqueCount,
          references: [],
          last_updated: new Date().toISOString(),
        });
      }
    } catch {}

    return Response.json({
      status: 'success',
      entityName,
      refType,
      total_scanned: totalScanned,
      unique_codes: uniqueCount,
      duplicates_found: duplicateIds.length,
      duplicates_deleted: deletedCount,
      duplicates_remaining: duplicateIds.length - deletedCount,
      delete_errors: deleteErrors,
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