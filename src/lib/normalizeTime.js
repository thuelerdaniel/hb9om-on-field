// normalizeTime — normalizes QSO time strings to 'HH:MM:SS' format.
// Handles all input formats from QRZ, ADIF, and Wavelog:
//   'HH:MM'     → 'HH:MM:00'
//   'HHMM'      → 'HH:MM:00'  (4 digits — pad RIGHT, hours are first 2)
//   'HH:MM:SS'  → unchanged
//   'HHMMSS'    → 'HH:MM:SS'  (6 digits — pad LEFT if needed)
//   '' / null   → null  (no fake time generated)
//
// BUG FIX: Previously padStart(6,'0') was used on 4-digit HHMM times,
// producing '00HHMM' → '00:HH:MM' instead of 'HH:MM:00'.
// 4-digit times must be padded RIGHT (HHMM00), not LEFT.
export function normalizeTime(t) {
  if (!t) return null;
  const s = String(t).trim();
  if (!s) return null;

  // Already HH:MM:SS
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;

  // HH:MM → HH:MM:00
  if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';

  // Pure digits
  if (/^\d+$/.test(s)) {
    if (s.length === 4) {
      // HHMM → HH:MM:00 (pad RIGHT — hours/minutes are the first 4 digits)
      return s.substring(0, 2) + ':' + s.substring(2, 4) + ':00';
    }
    // 5-6 digits → pad left to 6 → HH:MM:SS
    const p = s.padStart(6, '0');
    return p.substring(0, 2) + ':' + p.substring(2, 4) + ':' + p.substring(4, 6);
  }

  return null;
}