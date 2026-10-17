// cleanupLogFlood — FLOOD-FIX 2026-10-17
// Deduplicates the Log entity flooded by a broken Wavelog auto-sync (985k+ records).
//
// Strategy: Load records sorted by qso_date. The first batch contains the oldest
// date's records. Process that ONE date per call (dedup + normalize + delete),
// then return. Admin calls repeatedly until all dates are processed.
//
// Per date:
//   1. Load ALL records for that date (sorted by created_date — oldest first)
//   2. Group by upsert key (operator_callsign + callsign + qso_date + time_start + log_type + club_callsign)
//   3. Keep the OLDEST record per key, normalize its time_start to "HH:MM"
//   4. Delete all duplicates
//
// Admin-only. Supports dry_run=true to count without deleting.
// Pass {date: "2026-04-09"} to process a specific date.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { normalizeTime } from '../../shared/logDedup.ts';
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
    const forceDate = body.date || null;

    const sr = base44.asServiceRole;

    // Determine which date to process
    let dateStr: string | null = forceDate;

    if (!dateStr) {
      // Load progress from AppSetting — skip already-processed dates
      let processedDates: string[] = [];
      try {
        const progress = await sr.entities.AppSetting.filter({ key: 'cleanup_log_flood_progress' });
        if (progress && progress.length > 0) {
          processedDates = JSON.parse(progress[0].value || '[]');
        }
      } catch {}

      // Find the next unprocessed date: load records sorted by created_date (indexed, fast).
      // Sorting by qso_date times out on 985k+ records (no index on qso_date).
      let searchOffset = 0;
      const SEARCH_LIMIT = 500;
      let foundDate = null;
      for (let attempt = 0; attempt < 100; attempt++) {
        const batch = await sr.entities.Log.filter({}, 'created_date', SEARCH_LIMIT, searchOffset);
        if (!Array.isArray(batch) || batch.length === 0) break;
        for (const r of batch) {
          if (r.qso_date && !processedDates.includes(r.qso_date)) {
            foundDate = r.qso_date;
            break;
          }
        }
        if (foundDate) break;
        searchOffset += SEARCH_LIMIT;
      }

      if (!foundDate) {
        return Response.json({
          success: true,
          message: 'Alle Daten bereinigt — keine weiteren Duplikate gefunden',
          processed_dates: processedDates.length,
          all_dates_processed: true,
        });
      }
      dateStr = foundDate;
    }

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
      // Mark this date as processed (it has no records)
      if (!dryRun && !forceDate) {
        await markDateProcessed(sr, dateStr);
      }
      return Response.json({
        success: true,
        date: dateStr,
        loaded: 0,
        message: `Keine Records für ${dateStr}`,
      });
    }

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
    const backupRecords: any[] = [];

    for (const [key, group] of groups) {
      const kept = group[0];
      const normalizedTime = normalizeTime(kept.time_start || '');
      if (kept.time_start !== normalizedTime && normalizedTime) {
        toNormalize.push({ id: kept.id, time_start: normalizedTime });
      }

      for (let i = 1; i < group.length; i++) {
        toDelete.push(group[i].id);
        if (backupRecords.length < 5000) {
          backupRecords.push({
            id: group[i].id,
            callsign: group[i].callsign,
            qso_date: group[i].qso_date,
            time_start: group[i].time_start,
            operator_callsign: group[i].operator_callsign,
            log_type: group[i].log_type,
            created_date: group[i].created_date,
          });
        }
      }
    }

    const stats = {
      date: dateStr,
      loaded: records.length,
      groups: groups.size,
      kept: groups.size,
      duplicates: toDelete.length,
      to_normalize: toNormalize.length,
    };

    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        ...stats,
        message: `Dry-Run ${dateStr}: ${records.length} Records, ${groups.size} eindeutige QSOs, ${toDelete.length} Duplikate würden gelöscht`,
      });
    }

    // Delete duplicates in batches of 500
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = toDelete.slice(i, i + 500);
      try {
        await sr.entities.Log.deleteMany({ id: { $in: batch } });
        deleted += batch.length;
      } catch {
        for (const id of batch) {
          try { await sr.entities.Log.delete(id); deleted++; } catch {}
        }
      }
    }

    // Normalize time_start for kept records
    let normalized = 0;
    for (let i = 0; i < toNormalize.length; i += 100) {
      const batch = toNormalize.slice(i, i + 100);
      try {
        await sr.entities.Log.bulkUpdate(batch.map(n => ({ id: n.id, time_start: n.time_start })));
        normalized += batch.length;
      } catch (e: any) {
        console.log(`[cleanupLogFlood] Normalize failed for ${dateStr}: ${e.message}`);
      }
    }

    // Mark date as processed
    if (!forceDate) {
      await markDateProcessed(sr, dateStr);
    }

    // Save backup of deleted records
    let backupFileUri: string | null = null;
    if (backupRecords.length > 0) {
      try {
        const backupJson = JSON.stringify({
          cleanup_date: new Date().toISOString(),
          date_processed: dateStr,
          records_deleted: deleted,
          deleted_records_sample: backupRecords,
        });
        const backupBlob = new Blob([backupJson], { type: 'application/json' });
        const backupFile = new File([backupBlob], `log_flood_backup_${dateStr}.json`, { type: 'application/json' });
        const uploadResult = await base44.integrations.Core.UploadPrivateFile({ file: backupFile });
        backupFileUri = uploadResult.file_uri || null;
      } catch (e: any) {
        console.log(`[cleanupLogFlood] Backup upload failed: ${e.message}`);
      }
    }

    return Response.json({
      success: true,
      dry_run: false,
      ...stats,
      deleted,
      normalized,
      backup_file_uri: backupFileUri,
      message: `${dateStr}: ${deleted} Duplikate gelöscht, ${groups.size} behalten, ${normalized} normalisiert`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}

async function markDateProcessed(sr: any, dateStr: string) {
  try {
    let processedDates: string[] = [];
    const progress = await sr.entities.AppSetting.filter({ key: 'cleanup_log_flood_progress' });
    if (progress && progress.length > 0) {
      processedDates = JSON.parse(progress[0].value || '[]');
    }
    if (!processedDates.includes(dateStr)) {
      processedDates.push(dateStr);
      const progressValue = JSON.stringify(processedDates);
      if (progress && progress.length > 0) {
        await sr.entities.AppSetting.update(progress[0].id, { value: progressValue });
      } else {
        await sr.entities.AppSetting.create({ key: 'cleanup_log_flood_progress', value: progressValue });
      }
    }
  } catch (e: any) {
    console.log(`[cleanupLogFlood] Could not save progress: ${e.message}`);
  }
}