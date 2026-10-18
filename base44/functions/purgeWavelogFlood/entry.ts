// purgeWavelogFlood — MASSEN-DEDUP 18.10.2026
// Deletes ALL Log records created by the defective Wavelog service-role sync.
//
// ROOT CAUSE: The permanent_sync ran every ~15-30 min from 07.10 09:03 UTC to 17.10 04:47 UTC
// and re-imported the ENTIRE Wavelog history each run (wavelog_last_fetch_id stayed 0).
// This created >200'000 pure duplicate records, all with created_by_id = service role.
//
// SAFETY (verified 18.10. — NOT re-verify, deletion is safe):
//   - Every flood record's upsert-key has an original from ANOTHER importer (private HB3YNF
//     history imported 19./25./26.09 by service+9a93ef71; club originals 15.09 by
//     thueler.daniel@gmail.com). No real QSO is lost.
//
// ACTIONS:
//   action=purge       — delete flood records in chunks of 5000 (id-cursor), returns progress
//   action=status      — count flood + total (no deletion)
//   action=verify      — post-deletion verification: flood=0, spot-check callsigns, club-import dupes
//   action=check_club  — check the 15.10 club-import for internal duplicates (no deletion)
//
// Admin-only. Uses service role (bypasses RLS).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { upsertKey } from '../../shared/logUpsert.ts';

const FLOOD_CREATED_BY_ID = 'service_c20cabae-d8e2-43de-aefc-46347b3c5aea';
const CLUB_SERVICE_CREATED_BY_PREFIX = 'service_9a93ef71';
const TIME_LIMIT_MS = 22000;
const BATCH = 5000;
const MAX_CHUNKS = 60;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if ((user as any).role !== 'admin') {
      return Response.json({ error: 'Nur Admins' }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = body.action || 'purge';
    const sr = base44.asServiceRole;

    // ── STATUS: count flood + total ──────────────────────────────────────
    if (action === 'status') {
      const floodCount = await safeCount(sr, 'Log', { created_by_id: FLOOD_CREATED_BY_ID });
      const totalCount = await safeCount(sr, 'Log', {});
      return Response.json({
        success: true,
        flood: floodCount,
        total: totalCount,
        non_flood: totalCount - floodCount,
        message: `Flut: ${floodCount}, Gesamt: ${totalCount}, Nicht-Flut: ${totalCount - floodCount}`,
      });
    }

    // ── VERIFY: post-deletion spot-checks ─────────────────────────────────
    if (action === 'verify') {
      const floodAfter = await safeCount(sr, 'Log', { created_by_id: FLOOD_CREATED_BY_ID });
      const totalAfter = await safeCount(sr, 'Log', {});

      // Spot-check callsigns — each should be exactly 1 after cleanup
      const spotChecks: any = {};
      const spotCallSigns = ['R4ZZ', 'ZS3JDL', 'EA4GA', 'HB8TEST', 'HB9HXD', 'HB3YQT'];
      for (const call of spotCallSigns) {
        spotChecks[call] = await safeCount(sr, 'Log', { callsign: call, operator_callsign: 'HB3YNF' });
      }

      // Club-import internal-duplicate check
      const clubDupes = await checkClubImportDupes(sr);

      return Response.json({
        success: true,
        flood_after: floodAfter,
        total_after: totalAfter,
        spot_checks: spotChecks,
        club_import_dupes: clubDupes,
        flood_clean: floodAfter === 0,
        message: `Flut nachher: ${floodAfter} (soll 0), Gesamt: ${totalAfter}`,
      });
    }

    // ── CHECK_CLUB: inspect 15.10 club-import for internal duplicates ─────
    if (action === 'check_club') {
      const clubDupes = await checkClubImportDupes(sr);
      return Response.json({
        success: true,
        ...clubDupes,
        message: `Club-Import: ${clubDupes.total_records} Records, ${clubDupes.unique_keys} eindeutige Keys, ${clubDupes.duplicate_records} Duplikate in ${clubDupes.duplicate_groups} Gruppen`,
      });
    }

    // ── PURGE: delete flood records in chunks ─────────────────────────────
    if (action === 'purge') {
      const startTime = Date.now();
      let totalDeleted = 0;
      let lastId: string | null = null;
      let chunks = 0;

      for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
        if (Date.now() - startTime > TIME_LIMIT_MS) break;

        const query: any = { created_by_id: FLOOD_CREATED_BY_ID };
        if (lastId) query.id = { $gt: lastId };

        const batch = await sr.entities.Log.filter(query, 'id', BATCH, 0);
        if (!Array.isArray(batch) || batch.length === 0) break;

        const ids = batch.map((r: any) => r.id);
        try {
          await sr.entities.Log.deleteMany({ id: { $in: ids } });
          totalDeleted += ids.length;
        } catch {
          // Fallback: individual deletes
          for (const id of ids) {
            try { await sr.entities.Log.delete(id); totalDeleted++; } catch {}
          }
        }
        lastId = batch[batch.length - 1].id;
        chunks++;
        if (batch.length < BATCH) break;
      }

      const remaining = await safeCount(sr, 'Log', { created_by_id: FLOOD_CREATED_BY_ID });

      return Response.json({
        success: true,
        action: 'purge',
        deleted_this_call: totalDeleted,
        chunks,
        remaining,
        done: remaining === 0,
        elapsed_ms: Date.now() - startTime,
        message: remaining === 0
          ? `FERTIG: ${totalDeleted} gelöscht, 0 verbleibend`
          : `${totalDeleted} gelöscht (${chunks} Chunks), ${remaining} verbleibend — erneut aufrufen`,
      });
    }

    return Response.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function safeCount(sr: any, entity: string, query: any): Promise<number> {
  try {
    return await sr.entities[entity].count(query);
  } catch {
    return -1;
  }
}

/**
 * Check the 15.10 club-import (service+9a93ef71) for internal duplicates.
 * Loads club records (log_type=club) created by the 9a93ef71 service account,
 * groups by upsert key, and reports any keys with >1 record.
 */
async function checkClubImportDupes(sr: any): Promise<{
  total_records: number;
  unique_keys: number;
  duplicate_records: number;
  duplicate_groups: number;
  duplicate_samples: any[];
}> {
  // Find the created_by_id for the 9a93ef71 service account by probing club records
  let clubCreatedById: string | null = null;
  try {
    const probe = await sr.entities.Log.filter(
      { log_type: 'club' }, '-created_date', 20
    );
    for (const r of probe) {
      if (r.created_by_id && r.created_by_id.startsWith(CLUB_SERVICE_CREATED_BY_PREFIX)) {
        clubCreatedById = r.created_by_id;
        break;
      }
    }
  } catch {}

  if (!clubCreatedById) {
    return {
      total_records: 0, unique_keys: 0, duplicate_records: 0,
      duplicate_groups: 0, duplicate_samples: [],
    };
  }

  // Load all club records from this importer (should be a few hundred at most)
  const records: any[] = [];
  let offset = 0;
  const LIMIT = 5000;
  for (let p = 0; p < 20; p++) {
    const batch = await sr.entities.Log.filter(
      { created_by_id: clubCreatedById, log_type: 'club' },
      'created_date', LIMIT, offset
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    records.push(...batch);
    offset += LIMIT;
    if (batch.length < LIMIT) break;
  }

  // Group by upsert key
  const groups = new Map<string, any[]>();
  for (const r of records) {
    const key = upsertKey(r.operator_callsign, r.callsign, r.qso_date, r.time_start, r.log_type, r.club_callsign);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  let duplicateRecords = 0;
  let duplicateGroups = 0;
  const duplicateSamples: any[] = [];
  for (const [key, group] of groups) {
    if (group.length > 1) {
      duplicateGroups++;
      duplicateRecords += group.length - 1;
      if (duplicateSamples.length < 10) {
        duplicateSamples.push({
          key,
          count: group.length,
          ids: group.map(g => g.id),
          callsign: group[0].callsign,
          qso_date: group[0].qso_date,
          time_start: group[0].time_start,
        });
      }
    }
  }

  return {
    total_records: records.length,
    unique_keys: groups.size,
    duplicate_records: duplicateRecords,
    duplicate_groups: duplicateGroups,
    duplicate_samples: duplicateSamples,
  };
}