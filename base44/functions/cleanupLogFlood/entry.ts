// cleanupLogFlood — FLOOD-FIX 2026-10-17
// Deduplicates the Log entity which was flooded by a broken Wavelog auto-sync.
//
// Root cause: wavelog_last_fetch_id was never set (stayed 0) → every 15-min sync
// re-imported ALL QSOs from Wavelog. loadExistingLogMap couldn't load 985k+ records
// → incomplete map → every QSO treated as new → 985k duplicates created.
//
// This function:
//   1. Processes records by qso_date (one date at a time — bounded memory)
//   2. Groups by upsert key (operator_callsign + callsign + qso_date + time_start + log_type + club_callsign)
//   3. Keeps the OLDEST record per key (original > service-import)
//   4. Normalizes time_start to "HH:MM" for kept records (enables SDK upsert going forward)
//   5. Deletes all duplicates
//
// Resumable: processes up to max_dates dates per call. Saves progress in AppSetting.
// Call repeatedly until all dates are processed.
//
// Admin-only. Supports dry_run=true to count without deleting.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { normalizeCallsign, normalizeTime } from '../../shared/logDedup.ts';
import { upsertKey } from '../../shared/logUpsert.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if ((user as any).role !== 'admin') {
      return Response.json({ error: 'Nur Admins können Duplikate bereinigen' }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const dryRun = body.dry_run === true;
    const maxDates = body.max_dates || 5; // process 5 dates per call
    const forceDate = body.date || null; // process a specific date only

    const sr = base44.asServiceRole;

    // Get total count for reporting
    const totalBefore = await sr.entities.Log.count({});

    // Determine which dates to process
    let datesToProcess: string[] = [];

    if (forceDate) {
      datesToProcess = [forceDate];
    } else {
      // Load progress from AppSetting
      let processedDates: string[] = [];
      try {
        const progress = await sr.entities.AppSetting.filter({ key: 'cleanup_log_flood_progress' });
        if (progress && progress.length > 0) {
          processedDates = JSON.parse(progress[0].value || '[]');
        }
      } catch {}

      // Get all unique qso_dates by loading records sorted by qso_date
      // We iterate through all records just to find unique dates — but we do it
      // efficiently by loading only the qso_date field
      const allDates = new Set<string>();
      let offset = 0;
      const LIMIT = 5000;
      const MAX_PAGES = 200; // safety: 1M records
      for (let p = 0; p < MAX_PAGES; p++) {
        const batch = await sr.entities.Log.filter({}, 'qso_date', LIMIT, offset);
        if (!Array.isArray(batch) || batch.length === 0) break;
        for (const r of batch) {
          if (r.qso_date) allDates.add(r.qso_date);
        }
        offset += LIMIT;
        if (batch.length < LIMIT) break;
      }

      // Filter out already-processed dates, sort, take max_dates
      const sortedDates = [...allDates].filter(d => !processedDates.includes(d)).sort();
      datesToProcess = sortedDates.slice(0, maxDates);
    }

    if (datesToProcess.length === 0) {
      // All dates processed — return final summary
      const totalAfter = await sr.entities.Log.count({});
      return Response.json({
        success: true,
        message: 'Alle Daten bereinigt — keine weiteren Duplikate',
        total_before: totalBefore,
        total_after: totalAfter,
        duplicates_deleted: totalBefore - totalAfter,
        all_dates_processed: true,
      });
    }

    let totalLoaded = 0;
    let totalDeleted = 0;
    let totalKept = 0;
    let totalNormalized = 0;
    const dateStats: any[] = [];
    const backupRecords: any[] = []; // backup of deleted records (key info only)

    for (const dateStr of datesToProcess) {
      // Load ALL records for this date (sorted by created_date — oldest first)
      const records: any[] = [];
      let offset = 0;
      const LIMIT = 5000;
      while (true) {
        const batch = await sr.entities.Log.filter({ qso_date: dateStr }, 'created_date', LIMIT, offset);
        if (!Array.isArray(batch) || batch.length === 0) break;
        records.push(...batch);
        offset += LIMIT;
        if (batch.length < LIMIT) break;
      }

      if (records.length === 0) {
        dateStats.push({ date: dateStr, loaded: 0, kept: 0, deleted: 0 });
        continue;
      }

      totalLoaded += records.length;

      // Group by upsert key
      const groups = new Map<string, any[]>();
      for (const r of records) {
        const key = upsertKey(r.operator_callsign, r.callsign, r.qso_date, r.time_start, r.log_type, r.club_callsign);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      // For each group: keep oldest (first, since sorted by created_date), delete rest
      const toDelete: string[] = [];
      const toNormalize: { id: string; time_start: string }[] = [];

      for (const [key, group] of groups) {
        if (group.length <= 1) {
          // Single record — just normalize time_start
          const r = group[0];
          const normalizedTime = normalizeTime(r.time_start || '');
          if (r.time_start !== normalizedTime && normalizedTime) {
            toNormalize.push({ id: r.id, time_start: normalizedTime });
          }
          totalKept++;
          continue;
        }

        // Keep group[0] (oldest, since sorted by created_date), delete rest
        const kept = group[0];
        const normalizedTime = normalizeTime(kept.time_start || '');
        if (kept.time_start !== normalizedTime && normalizedTime) {
          toNormalize.push({ id: kept.id, time_start: normalizedTime });
        }
        totalKept++;

        for (let i = 1; i < group.length; i++) {
          toDelete.push(group[i].id);
          // Backup: save key info of deleted records (first 50 per group for sample)
          if (backupRecords.length < 5000) {
            backupRecords.push({
              id: group[i].id,
              callsign: group[i].callsign,
              qso_date: group[i].qso_date,
              time_start: group[i].time_start,
              operator_callsign: group[i].operator_callsign,
              log_type: group[i].log_type,
              club_callsign: group[i].club_callsign,
              created_date: group[i].created_date,
              wavelog_imported: group[i].wavelog_imported,
            });
          }
        }
      }

      dateStats.push({
        date: dateStr,
        loaded: records.length,
        groups: groups.size,
        kept: groups.size,
        deleted: toDelete.length,
        normalized: toNormalize.length,
      });

      if (dryRun) {
        totalDeleted += toDelete.length;
        totalNormalized += toNormalize.length;
        continue;
      }

      // Delete duplicates in batches of 500
      for (let i = 0; i < toDelete.length; i += 500) {
        const batch = toDelete.slice(i, i + 500);
        try {
          await sr.entities.Log.deleteMany({ id: { $in: batch } });
          totalDeleted += batch.length;
        } catch (e: any) {
          // Fallback: delete individually
          for (const id of batch) {
            try { await sr.entities.Log.delete(id); totalDeleted++; }
            catch {}
          }
        }
      }

      // Normalize time_start for kept records (bulkUpdate, 100 per batch)
      for (let i = 0; i < toNormalize.length; i += 100) {
        const batch = toNormalize.slice(i, i + 100);
        try {
          await sr.entities.Log.bulkUpdate(batch.map(n => ({ id: n.id, time_start: n.time_start })));
          totalNormalized += batch.length;
        } catch (e: any) {
          console.log(`[cleanupLogFlood] Normalize failed for ${dateStr}: ${e.message}`);
        }
      }
    }

    // Save progress (unless dry_run or single-date mode)
    if (!dryRun && !forceDate) {
      try {
        let processedDates: string[] = [];
        const progress = await sr.entities.AppSetting.filter({ key: 'cleanup_log_flood_progress' });
        if (progress && progress.length > 0) {
          processedDates = JSON.parse(progress[0].value || '[]');
        }
        processedDates.push(...datesToProcess);
        const progressValue = JSON.stringify(processedDates);
        if (progress && progress.length > 0) {
          await sr.entities.AppSetting.update(progress[0].id, { value: progressValue });
        } else {
          await sr.entities.AppSetting.create({ key: 'cleanup_log_flood_progress', value: progressValue });
        }
      } catch (e: any) {
        console.log(`[cleanupLogFlood] Could not save progress: ${e.message}`);
      }
    }

    // Save backup of deleted records as a private file (if not dry_run and we have records)
    let backupFileUri: string | null = null;
    if (!dryRun && backupRecords.length > 0) {
      try {
        const backupJson = JSON.stringify({
          cleanup_date: new Date().toISOString(),
          dates_processed: datesToProcess,
          records_to_delete_sample: backupRecords,
          total_deleted_this_run: totalDeleted,
        });
        const backupBlob = new Blob([backupJson], { type: 'application/json' });
        const backupFile = new File([backupBlob], `log_flood_backup_${Date.now()}.json`, { type: 'application/json' });
        const uploadResult = await base44.integrations.Core.UploadPrivateFile({ file: backupFile });
        backupFileUri = uploadResult.file_uri || null;
      } catch (e: any) {
        console.log(`[cleanupLogFlood] Backup upload failed: ${e.message}`);
      }
    }

    const totalAfter = dryRun ? totalBefore : await sr.entities.Log.count({});

    return Response.json({
      success: true,
      dry_run: dryRun,
      dates_processed: datesToProcess,
      date_stats: dateStats,
      total_loaded: totalLoaded,
      total_kept: totalKept,
      total_deleted: totalDeleted,
      total_normalized: totalNormalized,
      total_before: totalBefore,
      total_after: totalAfter,
      backup_file_uri: backupFileUri,
      message: dryRun
        ? `Dry-Run: ${datesToProcess.length} Daten, ${totalLoaded} Records, ${totalDeleted} Duplikate würden gelöscht`
        : `${datesToProcess.length} Daten bereinigt: ${totalDeleted} Duplikate gelöscht, ${totalKept} behalten, ${totalNormalized} normalisiert. Total: ${totalBefore} → ${totalAfter}`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}