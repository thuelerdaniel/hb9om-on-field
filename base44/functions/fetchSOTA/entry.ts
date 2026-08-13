import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { fetchSotaSummits } from '../../shared/sotaFetcher.ts';

// ─── Chunked SOTA CSV Import ───
// SOTA has ~125k summits worldwide. The old approach (delete-all + bulkCreate 250 batches)
// exceeded the 300s platform timeout. This chunked version:
// 1. Downloads the CSV once per call (~10s)
// 2. Processes a chunk of records within a 100s time budget
// 3. Saves progress (offset) in AppSettings
// 4. Returns hasMore=true if more records remain
// The scheduler (runDailySyncBatch) sees hasMore=true and calls fetchSOTA again
// next tick, resuming from the saved offset. Typically 2-3 calls to complete all 125k.

const TIME_BUDGET_MS = 100000; // 100s processing budget per call
const BATCH_SIZE = 500; // SDK bulkCreate max is 500 records per call

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Get current offset from AppSettings
    const offsetKey = 'sota_csv_offset';
    let offset = 0;
    try {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: offsetKey });
      if (settings.length > 0 && settings[0].value) {
        offset = parseInt(settings[0].value) || 0;
      }
    } catch {}

    // Download CSV and parse all summits (single HTTP request)
    const result = await fetchSotaSummits('all');
    const allSummits = result.summits;
    const total = allSummits.length;

    if (total === 0) {
      return Response.json({
        saved: true,
        count: 0,
        error: 'CSV leer oder nicht erreichbar',
        has_more: false,
      });
    }

    // If offset=0, delete all existing records (fresh start of a new full-sync cycle)
    if (offset === 0) {
      try {
        await base44.asServiceRole.entities.SotaPoint.deleteMany({});
      } catch {}
    }

    // Process from offset with time budget
    const startTime = Date.now();
    let processed = 0;
    let currentOffset = offset;
    let lastError: string | undefined;

    while (currentOffset < total && (Date.now() - startTime) < TIME_BUDGET_MS) {
      const remaining = total - currentOffset;
      const batchLen = Math.min(BATCH_SIZE, remaining);
      const batch = allSummits.slice(currentOffset, currentOffset + batchLen);

      const points = batch.map(s => ({
        code: s.code,
        name: s.name || s.code,
        lat: s.lat,
        lng: s.lng,
        altitude_m: s.alt || 0,
        points: s.points || 0,
      }));

      try {
        await base44.asServiceRole.entities.SotaPoint.bulkCreate(points);
        processed += batch.length;
      } catch (e: any) {
        lastError = e?.message || String(e);
        // Continue with next batch — partial data is better than no data
      }

      currentOffset += batch.length;
    }

    // Save new offset (reset to 0 when fully done, so next cycle starts fresh)
    const hasMore = currentOffset < total;
    const newOffset = hasMore ? currentOffset : 0;

    try {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: offsetKey });
      if (settings.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(settings[0].id, { value: String(newOffset) });
      } else {
        await base44.asServiceRole.entities.AppSetting.create({ key: offsetKey, value: String(newOffset) });
      }
    } catch {}

    // Update ReferenceData metadata when fully done
    if (!hasMore) {
      try {
        const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'sota' });
        const now = new Date().toISOString();
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
            references: [],
            total_count: total,
            source: 'sotadata.org.uk CSV (chunked)',
            last_updated: now,
          });
        } else {
          await base44.asServiceRole.entities.ReferenceData.create({
            type: 'sota',
            references: [],
            total_count: total,
            source: 'sotadata.org.uk CSV (chunked)',
            last_updated: now,
          });
        }
      } catch {}
    }

    return Response.json({
      saved: true,
      count: processed,
      total,
      offset,
      processed_so_far: currentOffset,
      has_more: hasMore,
      progress_pct: Math.round((currentOffset / total) * 100),
      duration_ms: Date.now() - startTime,
      error: lastError,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});