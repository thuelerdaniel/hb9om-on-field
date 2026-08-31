import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { dedupKey } from '../../shared/logDedup.ts';

// cleanupLogDuplicates — v0.9004 BUG 3
// Loads ALL Log records (service-role, paginated), groups by normalized dedup key,
// and deletes duplicates — keeping the best record per group.
//
// "Best" record priority:
//   1. wavelog_imported=true (has more data from Wavelog)
//   2. is_clubstation=true (club records are communal, harder to recreate)
//   3. Oldest created_date (first-seen wins)
//
// Admin-only — this is a destructive batch operation.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if ((user as any).role !== 'admin') {
      return Response.json({ error: 'Nur Admins können Duplikate bereinigen' }, { status: 403 });
    }

    const sr = base44.asServiceRole;

    // 1. Load ALL Log records (paginated — no 5000 limit)
    const allLogs: any[] = [];
    const LIMIT = 5000;
    const MAX_PAGES = 40; // 40 * 5000 = 200k max
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await sr.entities.Log.list('-created_date', LIMIT, page * LIMIT);
      if (!Array.isArray(batch) || batch.length === 0) break;
      allLogs.push(...batch);
      if (batch.length < LIMIT) break;
    }

    if (allLogs.length === 0) {
      return Response.json({ success: true, duplicates_found: 0, deleted: 0, remaining: 0, total_loaded: 0 });
    }

    // 2. Group by normalized dedup key
    const groups = new Map<string, any[]>();
    for (const log of allLogs) {
      const key = dedupKey(log.callsign, log.qso_date, log.time_start, log.frequency, log.club_callsign);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }

    // 3. For each group with >1 records: find the best, delete the rest
    let duplicatesFound = 0;
    let deleted = 0;
    const toDelete: string[] = [];

    for (const [key, records] of groups) {
      if (records.length <= 1) continue;
      duplicatesFound += records.length - 1;

      // Sort: best record first
      // Priority: wavelog_imported=true > is_clubstation=true > oldest created_date
      records.sort((a, b) => {
        // wavelog_imported=true first
        const aWi = a.wavelog_imported ? 1 : 0;
        const bWi = b.wavelog_imported ? 1 : 0;
        if (aWi !== bWi) return bWi - aWi;
        // is_clubstation=true first
        const aClub = a.is_clubstation ? 1 : 0;
        const bClub = b.is_clubstation ? 1 : 0;
        if (aClub !== bClub) return bClub - aClub;
        // Oldest created_date first
        const aDate = a.created_date || '';
        const bDate = b.created_date || '';
        return aDate.localeCompare(bDate);
      });

      // Keep records[0], delete the rest
      for (let i = 1; i < records.length; i++) {
        toDelete.push(records[i].id);
      }
    }

    // 4. Delete duplicates in batches of 500
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
      duplicates_found: duplicatesFound,
      deleted,
      remaining: allLogs.length - deleted,
      total_loaded: allLogs.length,
      groups_total: groups.size,
      groups_with_duplicates: Array.from(groups.values()).filter(g => g.length > 1).length,
      message: `Bereinigt: ${deleted} Duplikate gelöscht, ${allLogs.length - deleted} Einträge verbleiben`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}