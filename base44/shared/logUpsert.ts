// Shared log upsert utilities — v0.954
// True upsert for Log records — prevents duplicates on repeated imports.
// Key: (operator_callsign, callsign, qso_date, time_start, log_type, club_callsign)
// If key exists → UPDATE existing record; if not → CREATE new.
// Used by wavelogApi (import, full_import, permanent_sync) and fetchQrzClubLog.

import { normalizeCallsign, normalizeTime } from './logDedup.ts';

/**
 * Build the upsert key for a Log record.
 * Normalizes callsign (strips /P, /M suffixes) and time (truncates to HH:MM)
 * so QSOs from different sources with format differences still match.
 */
export function upsertKey(
  operatorCallsign: string | undefined,
  callsign: string | undefined,
  qsoDate: string | undefined,
  timeStart: string | undefined,
  logType: string | undefined,
  clubCallsign: string | undefined,
): string {
  const op = normalizeCallsign(operatorCallsign || '');
  const call = normalizeCallsign(callsign || '');
  const time = normalizeTime(timeStart || '');
  const club = clubCallsign ? normalizeCallsign(clubCallsign) : '';
  return `${op}|${call}|${qsoDate || ''}|${time}|${logType || ''}|${club}`;
}

// Built-in fields that must NOT be overwritten on update
const BUILTIN_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by_id']);

function stripBuiltins(data: any): any {
  const clean: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (!BUILTIN_FIELDS.has(k)) clean[k] = v;
  }
  return clean;
}

/**
 * Load existing Log records into a Map of upsertKey → record.
 * Uses service role to bypass RLS (sees ALL records, not just user's own).
 * Optional filter to narrow the search space (e.g. { created_by_id: userId }).
 * Paginated to handle large datasets (up to 200k records).
 */
export async function loadExistingLogMap(sr: any, filter?: any): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  const LIMIT = 5000;
  const MAX_PAGES = 40; // 40 * 5000 = 200k max
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = filter
      ? await sr.entities.Log.filter(filter, '-created_date', LIMIT, page * LIMIT)
      : await sr.entities.Log.list('-created_date', LIMIT, page * LIMIT);
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const l of batch) {
      const key = upsertKey(l.operator_callsign, l.callsign, l.qso_date, l.time_start, l.log_type, l.club_callsign);
      if (!map.has(key)) map.set(key, l); // keep first (oldest) record per key
    }
    if (batch.length < LIMIT) break;
  }
  return map;
}

/**
 * Upsert an array of QSO objects against existing Log records.
 * For each QSO: if upsert key exists in existingMap → UPDATE existing record; if not → CREATE new.
 * Within-batch dedup: if multiple QSOs share the same key, only the first is processed.
 *
 * Returns { created, updated, errors, errorDetails }.
 */
export async function upsertLogs(
  sr: any,
  qsos: any[],
  existingMap: Map<string, any>,
): Promise<{ created: number; updated: number; errors: number; errorDetails: string[] }> {
  let created = 0;
  let updated = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  const toCreate: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];
  const batchKeys = new Set<string>();

  for (const qso of qsos) {
    const key = upsertKey(qso.operator_callsign, qso.callsign, qso.qso_date, qso.time_start, qso.log_type, qso.club_callsign);
    // Within-batch dedup: skip if we already saw this key in this batch
    if (batchKeys.has(key)) continue;
    batchKeys.add(key);

    const existing = existingMap.get(key);
    if (existing && existing.id && existing.id !== '__pending__') {
      // UPDATE: merge QSO data into existing record (strip builtins to not overwrite id/created_*)
      toUpdate.push({ id: existing.id, data: stripBuiltins(qso) });
    } else {
      // CREATE: new record
      toCreate.push(qso);
      existingMap.set(key, { id: '__pending__' }); // mark as seen for subsequent QSOs in this batch
    }
  }

  console.log(`[Upsert] ${toCreate.length} new, ${toUpdate.length} updates, processing...`);

  // Bulk create new records (500 per batch)
  const CREATE_BATCH = 500;
  for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
    const batch = toCreate.slice(i, i + CREATE_BATCH);
    try {
      await sr.entities.Log.bulkCreate(batch);
      created += batch.length;
    } catch {
      // Fallback: create individually
      for (const qso of batch) {
        try {
          await sr.entities.Log.create(qso);
          created++;
        } catch (e: any) {
          errors++;
          if (errorDetails.length < 10) errorDetails.push(`${qso.callsign} ${qso.qso_date}: ${e.message || 'create error'}`);
        }
      }
    }
  }

  // Bulk update existing records (100 per batch — bulkUpdate has smaller limits)
  const UPDATE_BATCH = 100;
  for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
    const batch = toUpdate.slice(i, i + UPDATE_BATCH);
    try {
      const updateBatch = batch.map(u => ({ id: u.id, ...u.data }));
      await sr.entities.Log.bulkUpdate(updateBatch);
      updated += batch.length;
    } catch {
      // Fallback: update individually
      for (const u of batch) {
        try {
          await sr.entities.Log.update(u.id, u.data);
          updated++;
        } catch (e: any) {
          errors++;
          if (errorDetails.length < 10) errorDetails.push(`Update ${u.id}: ${e.message || 'update error'}`);
        }
      }
    }
  }

  return { created, updated, errors, errorDetails };
}