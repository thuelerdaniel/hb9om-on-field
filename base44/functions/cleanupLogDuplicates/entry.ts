import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { normalizeCallsign, normalizeTime } from '../../shared/logDedup.ts';

// cleanupLogDuplicates — v0.958
// Loads ALL Log records (service-role, paginated), deduplicates by ID (pagination
// artifacts), then groups by SEMANTIC key (callsign + qso_date + time_start) to
// catch real duplicates even when metadata differs (operator_callsign, log_type,
// club_callsign set differently by older import paths).
//
// v0.958 FIX: Previously used dedupKey (with frequency) then upsertKey (with
// operator_callsign+log_type) — both missed "semantic" duplicates where the
// same QSO was imported with different metadata (e.g. operator_callsign=null
// vs HB3YNF). Now uses semantic key: normalizeCallsign(callsign)|qso_date|HH:MM
// — same QSO = same key regardless of metadata fields.
//
// "Best" record priority:
//   1. Has operator_callsign set (correct metadata)
//   2. Has log_type set (correct metadata)
//   3. wavelog_imported=true (has more data from Wavelog)
//   4. is_clubstation=true (club records are communal)
//   5. Oldest created_date (first-seen wins)
//
// Admin-only. Supports dry_run=true to count without deleting.

function semanticKey(callsign: string, qsoDate: string, timeStart: string): string {
  return `${normalizeCallsign(callsign)}|${qsoDate || ''}|${normalizeTime(timeStart)}`;
}

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

    const sr = base44.asServiceRole;

    // 1. Load ALL Log records (paginated)
    const allLogs: any[] = [];
    const LIMIT = 5000;
    const MAX_PAGES = 40;
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await sr.entities.Log.list('-created_date', LIMIT, page * LIMIT);
      if (!Array.isArray(batch) || batch.length === 0) break;
      allLogs.push(...batch);
      if (batch.length < LIMIT) break;
    }

    if (allLogs.length === 0) {
      return Response.json({ success: true, duplicates_found: 0, deleted: 0, remaining: 0, total_loaded: 0, dry_run: dryRun });
    }

    // 2. Deduplicate by ID (pagination may return same record on multiple pages)
    const idMap = new Map<string, any>();
    for (const log of allLogs) {
      if (!idMap.has(log.id)) idMap.set(log.id, log);
    }
    const uniqueLogs = Array.from(idMap.values());
    const paginationDuplicates = allLogs.length - uniqueLogs.length;

    // 3. Group by semantic key (callsign + qso_date + time_start)
    const groups = new Map<string, any[]>();
    for (const log of uniqueLogs) {
      const key = semanticKey(log.callsign, log.qso_date, log.time_start);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }

    // 4. For each group with >1 records: find the best, delete the rest
    let duplicatesFound = 0;
    let deleted = 0;
    const toDelete: string[] = [];
    const duplicateDetails: any[] = [];

    for (const [key, records] of groups) {
      if (records.length <= 1) continue;
      duplicatesFound += records.length - 1;

      // Sort: best record first
      records.sort((a, b) => {
        // Has operator_callsign set → first
        const aOp = a.operator_callsign ? 1 : 0;
        const bOp = b.operator_callsign ? 1 : 0;
        if (aOp !== bOp) return bOp - aOp;
        // Has log_type set → first
        const aLt = a.log_type ? 1 : 0;
        const bLt = b.log_type ? 1 : 0;
        if (aLt !== bLt) return bLt - aLt;
        // wavelog_imported=true → first
        const aWi = a.wavelog_imported ? 1 : 0;
        const bWi = b.wavelog_imported ? 1 : 0;
        if (aWi !== bWi) return bWi - aWi;
        // is_clubstation=true → first
        const aClub = a.is_clubstation ? 1 : 0;
        const bClub = b.is_clubstation ? 1 : 0;
        if (aClub !== bClub) return bClub - aClub;
        // Oldest created_date → first
        const aDate = a.created_date || '';
        const bDate = b.created_date || '';
        return aDate.localeCompare(bDate);
      });

      // Keep records[0], delete the rest
      for (let i = 1; i < records.length; i++) {
        toDelete.push(records[i].id);
      }

      // Collect details for response (first 10 groups)
      if (duplicateDetails.length < 10) {
        duplicateDetails.push({
          key: key.substring(0, 80),
          count: records.length,
          callsign: records[0].callsign,
          qso_date: records[0].qso_date,
          time_start: records[0].time_start,
          kept: {
            id: records[0].id.substring(0, 8),
            operator_callsign: records[0].operator_callsign,
            log_type: records[0].log_type,
            club_callsign: records[0].club_callsign,
            created: records[0].created_date?.substring(0, 10),
          },
          delete: records.slice(1).map(r => ({
            id: r.id.substring(0, 8),
            operator_callsign: r.operator_callsign,
            log_type: r.log_type,
            club_callsign: r.club_callsign,
            created: r.created_date?.substring(0, 10),
          })),
        });
      }
    }

    // 5. Dry run — return counts without deleting
    if (dryRun) {
      return Response.json({
        success: true,
        dry_run: true,
        total_loaded: allLogs.length,
        pagination_duplicates: paginationDuplicates,
        unique_records: uniqueLogs.length,
        duplicates_found: duplicatesFound,
        would_delete: toDelete.length,
        groups_total: groups.size,
        groups_with_duplicates: Array.from(groups.values()).filter(g => g.length > 1).length,
        remaining_after_cleanup: uniqueLogs.length - toDelete.length,
        duplicate_examples: duplicateDetails,
        message: `Dry-Run: ${duplicatesFound} Duplikate gefunden, ${toDelete.length} würden gelöscht werden`,
      });
    }

    // 6. Delete duplicates in batches of 500
    for (let i = 0; i < toDelete.length; i += 500) {
      const batch = toDelete.slice(i, i + 500);
      try {
        await sr.entities.Log.deleteMany({ id: { $in: batch } });
        deleted += batch.length;
      } catch (e: any) {
        // Fallback: delete individually
        for (const id of batch) {
          try { await sr.entities.Log.delete(id); deleted++; }
          catch {}
        }
      }
    }

    return Response.json({
      success: true,
      dry_run: false,
      total_loaded: allLogs.length,
      pagination_duplicates: paginationDuplicates,
      unique_records: uniqueLogs.length,
      duplicates_found: duplicatesFound,
      deleted,
      remaining: uniqueLogs.length - deleted,
      groups_total: groups.size,
      groups_with_duplicates: Array.from(groups.values()).filter(g => g.length > 1).length,
      duplicate_examples: duplicateDetails,
      message: `Bereinigt: ${deleted} Duplikate gelöscht, ${uniqueLogs.length - deleted} Einträge verbleiben`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}