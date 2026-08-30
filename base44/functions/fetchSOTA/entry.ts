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
const PARALLEL_BATCHES = 3; // PUNKT 7: 3 concurrent — 5 verursacht Rate-Limit bei 125k Records

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

    // PUNKT 7: Sichere Refresh-Strategie — neue Records ERST erstellen, dann alte löschen.
    // Verhindert Datenverlust bei Timeout während bulkCreate.
    // Timestamp markiert den Start — alte Records werden erst am Ende gelöscht.
    const syncStartTime = new Date().toISOString();

    // Process from offset with time budget — PARALLEL batches (5 concurrent)
    const startTime = Date.now();
    let processed = 0;
    let currentOffset = offset;
    let lastError: string | undefined;

    while (currentOffset < total && (Date.now() - startTime) < TIME_BUDGET_MS) {
      // Prepare up to PARALLEL_BATCHES batches at once
      const batchGroup: any[][] = [];
      const batchOffsets: number[] = [];
      for (let p = 0; p < PARALLEL_BATCHES && currentOffset + p * BATCH_SIZE < total; p++) {
        const start = currentOffset + p * BATCH_SIZE;
        const batchLen = Math.min(BATCH_SIZE, total - start);
        const batch = allSummits.slice(start, start + batchLen).map(s => ({
          code: s.code,
          name: s.name || s.code,
          lat: s.lat,
          lng: s.lng,
          altitude_m: s.alt || 0,
          points: s.points || 0,
        }));
        batchGroup.push(batch);
        batchOffsets.push(start);
      }

      if (batchGroup.length === 0) break;

      // Fire parallel bulkCreate
      const results = await Promise.allSettled(
        batchGroup.map(batch => base44.asServiceRole.entities.SotaPoint.bulkCreate(batch))
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled') {
          processed += batchGroup[j].length;
        } else {
          lastError = (results[j] as any).reason?.message || String((results[j] as any).reason);
        }
      }

      currentOffset += batchGroup.reduce((sum, b) => sum + b.length, 0);

      // PUNKT 7: Kurze Pause zwischen Parallel-Gruppen um Rate-Limit zu vermeiden
      await new Promise(r => setTimeout(r, 200));

      // Check time budget after each parallel group
      if (Date.now() - startTime >= TIME_BUDGET_MS) break;
    }

    // PUNKT 7: Lösche alte Records erst wenn Sync KOMPLETT (sichere Refresh-Strategie)
    const hasMore = currentOffset < total;
    const newOffset = hasMore ? currentOffset : 0;

    if (!hasMore) {
      try {
        await base44.asServiceRole.entities.SotaPoint.deleteMany({
          created_date: { $lt: syncStartTime }
        });
      } catch {}
    }

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