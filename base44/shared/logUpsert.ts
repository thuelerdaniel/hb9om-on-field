// Shared log upsert utilities — v0.954 / FLOOD-FIX 2026-10-17
// True upsert for Log records — prevents duplicates on repeated imports.
//
// FLOOD-FIX: The old loadExistingLogMap loaded ALL records (40 pages × 5000 = 200k max)
// to build an in-memory map. With 985k+ records this is impossible within the function
// timeout → the map was incomplete → every QSO was treated as NEW → duplicate flood.
//
// New approach: upsertLogsNative uses the SDK's native upsert() method with normalized
// key fields. The SDK handles the dedup server-side — no need to load existing records.
// Fallback: loadExistingLogMapTargeted queries only the callsigns being imported.

import { normalizeCallsign, normalizeTime } from './logDedup.ts';

/**
 * Build the upsert key for a Log record.
 * DUPLIKAT-FIX 2026-11-21: reiner QSO-Schlüssel (Rufzeichen + Datum + HH:MM).
 * Früher enthielten operator_callsign/log_type/club_callsign den Schlüssel —
 * dadurch galten dieselben QSOs als verschieden, sobald ein Importweg diese
 * Metadaten anders setzte (z. B. club_callsign null statt ""). Entspricht der
 * semantischen Gruppierung von cleanupLogDuplicates.
 */
export function upsertKey(
  _operatorCallsign: string | undefined,
  callsign: string | undefined,
  qsoDate: string | undefined,
  timeStart: string | undefined,
  _logType: string | undefined,
  _clubCallsign: string | undefined,
): string {
  return `${normalizeCallsign(callsign || '')}|${qsoDate || ''}|${normalizeTime(timeStart || '')}`;
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
 *
 * WARNING: With 985k+ records this function will TIME OUT. Use upsertLogsNative instead.
 * Kept for backward compatibility with import/full_import actions that have smaller batches.
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
 * FLOOD-FIX: Targeted existing-map loader — queries only the callsigns being imported.
 * Instead of loading ALL 985k+ records, this loads only records matching the callsigns
 * in the current batch. Much faster and won't time out.
 */
export async function loadExistingLogMapTargeted(sr: any, qsos: any[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (!qsos || qsos.length === 0) return map;

  const callsigns = [...new Set(qsos.map(q => q.callsign).filter(Boolean))];
  if (callsigns.length === 0) return map;

  const BATCH = 100; // grössere Rufzeichen-Blöcke → weniger DB-Abfragen beim Voll-Import
  for (let i = 0; i < callsigns.length; i += BATCH) {
    const batchCallsigns = callsigns.slice(i, i + BATCH);
    let offset = 0;
    const LIMIT = 500;
    const MAX_PAGES = 20;
    for (let p = 0; p < MAX_PAGES; p++) {
      const records = await sr.entities.Log.filter(
        { callsign: { $in: batchCallsigns } },
        'created_date', LIMIT, offset
      );
      if (!Array.isArray(records) || records.length === 0) break;
      for (const l of records) {
        const key = upsertKey(l.operator_callsign, l.callsign, l.qso_date, l.time_start, l.log_type, l.club_callsign);
        if (!map.has(key)) map.set(key, l);
      }
      offset += LIMIT;
      if (records.length < LIMIT) break;
    }
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
    if (batchKeys.has(key)) continue;
    batchKeys.add(key);

    const existing = existingMap.get(key);
    if (existing && existing.id && existing.id !== '__pending__') {
      toUpdate.push({ id: existing.id, data: stripBuiltins(qso) });
    } else {
      toCreate.push(qso);
      existingMap.set(key, { id: '__pending__' });
    }
  }

  console.log(`[Upsert] ${toCreate.length} new, ${toUpdate.length} updates, processing...`);

  const CREATE_BATCH = 500;
  for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
    const batch = toCreate.slice(i, i + CREATE_BATCH);
    try {
      await sr.entities.Log.bulkCreate(batch);
      created += batch.length;
    } catch {
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

  const UPDATE_BATCH = 100;
  for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
    const batch = toUpdate.slice(i, i + UPDATE_BATCH);
    try {
      const updateBatch = batch.map(u => ({ id: u.id, ...u.data }));
      await sr.entities.Log.bulkUpdate(updateBatch);
      updated += batch.length;
    } catch {
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

/**
 * DUPLIKAT-FIX 2026-11-21: Upsert mit in JS normalisierten Schlüsseln.
 *
 * Das frühere serverseitige Log.upsert() verglich die ROHWERTE der Schlüsselfelder:
 * gespeichert "22:24:00" gegen importiert "22:24", oder club_callsign null gegen "".
 * Beide galten als verschieden → jeder Importlauf legte dieselben QSOs erneut an.
 *
 * Jetzt werden vorhandene Einträge gezielt zu den betroffenen Rufzeichen geladen
 * und über den normalisierten Schlüssel (Rufzeichen | Datum | HH:MM) abgeglichen.
 * Gleiche QSOs werden aktualisiert statt neu angelegt.
 *
 * Returns { created, updated, errors, errorDetails, skipped }.
 */
export async function upsertLogsNative(
  sr: any,
  qsos: any[],
): Promise<{ created: number; updated: number; errors: number; errorDetails: string[]; skipped: number }> {
  if (!qsos || qsos.length === 0) return { created: 0, updated: 0, errors: 0, errorDetails: [], skipped: 0 };

  // Normalize key fields for consistent matching across runs
  const normalized = qsos.map(q => ({
    ...q,
    time_start: normalizeTime(q.time_start || ''),
    operator_callsign: q.operator_callsign || '',
    club_callsign: q.club_callsign || '',
  }));

  // Within-batch dedup: skip QSOs with the same key in the same batch
  const batchKeys = new Set<string>();
  const uniqueQsos = normalized.filter(q => {
    const key = upsertKey(q.operator_callsign, q.callsign, q.qso_date, q.time_start, q.log_type, q.club_callsign);
    if (batchKeys.has(key)) return false;
    batchKeys.add(key);
    return true;
  });
  const skipped = normalized.length - uniqueQsos.length;

  let result: { created: number; updated: number; errors: number; errorDetails: string[] };
  try {
    const existingMap = await loadExistingLogMapTargeted(sr, uniqueQsos);
    result = await upsertLogs(sr, uniqueQsos, existingMap);
  } catch (e: any) {
    console.log(`[upsertLogsNative] Targeted upsert failed: ${e.message}`);
    result = { created: 0, updated: 0, errors: uniqueQsos.length, errorDetails: [e.message || 'upsert error'] };
  }

  console.log(`[upsertLogsNative] ${result.created} new, ${result.updated} updated, ${skipped} skipped, ${result.errors} errors`);
  return { ...result, skipped };
}