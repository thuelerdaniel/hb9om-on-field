// Shared log dedup utilities — v0.9004
// Used by wavelogApi, fetchQrzClubLog, and cleanupLogDuplicates.
// Normalizes callsign (strips /P, /M, /PM, /MM suffixes) and time (truncates to HH:MM)
// so that QSOs from different sources (Wavelog vs QRZ) with format differences
// still match on the same dedup key.

/** Strip portable/mobile suffixes from a callsign → base callsign (uppercase). */
export function normalizeCallsign(callsign: string): string {
  if (!callsign) return '';
  return callsign.replace(/\/(P|M|PM|MM)$/i, '').toUpperCase().trim();
}

/**
 * Truncate a time string to HH:MM (strip seconds).
 * Handles "07:50" (HH:MM), "00:07:50" (HH:MM:SS), "075000" (HHMMSS), "0750" (HHMM).
 */
export function normalizeTime(time: string): string {
  if (!time) return '';
  // HH:MM:SS → HH:MM
  if (time.length >= 8 && time.includes(':')) return time.substring(0, 5);
  // HH:MM → as-is
  if (time.length === 5 && time.includes(':')) return time;
  // HHMMSS (6 digits) → HH:MM
  if (time.length === 6 && /^\d{6}$/.test(time)) return time.substring(0, 2) + ':' + time.substring(2, 4);
  // HHMM (4 digits) → HH:MM
  if (time.length === 4 && /^\d{4}$/.test(time)) return time.substring(0, 2) + ':' + time.substring(2, 4);
  return time.substring(0, 5);
}

/**
 * Build a normalized dedup key for a QSO.
 * Key: base_callsign | qso_date | time_HHMM | frequency | club_callsign
 */
export function dedupKey(
  callsign: string,
  qsoDate: string,
  timeStart: string,
  frequency: number | string | undefined,
  clubCallsign: string | undefined,
): string {
  const baseCall = normalizeCallsign(callsign);
  const timeHHMM = normalizeTime(timeStart);
  const freq = frequency != null ? String(frequency) : '';
  const club = clubCallsign ? normalizeCallsign(clubCallsign) : '';
  return `${baseCall}|${qsoDate || ''}|${timeHHMM}|${freq}|${club}`;
}