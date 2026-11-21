// Einheitliche Zuordnung von Logbuch-Einträgen zum persönlichen Rufzeichen
// und zur Clubstation. Ältere Importe (z. B. Wavelog) haben kein log_type —
// dort entscheidet is_clubstation.
export const LOG_STATION_VIEW_KEY = "hb9om_log_station_view";

export function isClubEntry(entry) {
  if (!entry) return false;
  if (entry.log_type === "club") return true;
  if (entry.log_type === "private") return false;
  return entry.is_clubstation === true;
}

// Rufzeichen, unter dem der QSO geloggt wurde.
export function stationCallsign(entry, clubCallsign) {
  if (isClubEntry(entry)) return entry.club_callsign || clubCallsign || "";
  return entry.operator_callsign || "";
}