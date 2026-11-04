import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { getCountryFromLatLng } from "@/lib/countries";

// Live-Positionen aus APRS-IS (Backend-Funktion collectAprs schreibt sie in
// AprsPosition). Der Hook liefert Knoten im Format der bestehenden
// PrivateNodeLayer, damit Filter, Popups und Marker unverändert funktionieren.
//
// Anzeigedauer (Einstellungen → APRS, Standard 24 Std.): nur Stationen, deren
// letzte Positionsmeldung (last_heard, UTC) innerhalb der eingestellten Frist
// liegt. Exakt 24 Std. gilt bereits als abgelaufen. Die Datensätze selbst
// bleiben unverändert in der Datenbank (Archiv/Retention läuft separat) —
// ältere Stationen erscheinen nur nicht mehr auf der Karte, im Zähler, in der
// Suche, in den Bewegungsspuren oder im PDF-Export.

const TYPE_MAP = {
  mobile: "mobile",
  fixed: "simplex_node",
  wx: "weather_station",
  igate: "echolink_node",
  digi: "repeater_node",
  object: "other",
  balloon: "other",
  other: "other",
};

const REFRESH_MS = 120000;
export const DEFAULT_DISPLAY_HOURS = 24;

function isWithinDisplayHours(lastHeard, hours) {
  const t = lastHeard ? new Date(lastHeard).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  return t > Date.now() - hours * 3600000;
}

export function useAprsLive() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Anzeigedauer des Nutzers — bei jeder Aktualisierung neu gelesen,
      // damit eine Änderung in den Einstellungen ohne Neuladen greift.
      let hours = DEFAULT_DISPLAY_HOURS;
      try {
        const me = await base44.auth.me();
        if (typeof me?.aprs_display_hours === "number") hours = me.aprs_display_hours;
      } catch {
        // ohne Anmeldung gilt der Standard
      }

      const page = await base44.entities.AprsPosition.list({ sort: "-last_heard", limit: 5000 });
      const items = page?.items || [];
      if (cancelled) return;
      setNodes(
        items
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .filter((p) => isWithinDisplayHours(p.last_heard, hours))
          .map((p) => {
            const cc = getCountryFromLatLng(p.lat, p.lng);
            return {
              id: `aprs-is-${p.id || p.callsign}`,
              callsign: p.callsign,
              lat: p.lat,
              lng: p.lng,
              node_type: TYPE_MAP[p.station_type] || "other",
              station_type: p.station_type,
              source: "aprs-is",
              network: "APRS-IS",
              symbol: p.symbol,
              speed: p.speed,
              course: p.course,
              altitude: p.altitude,
              comment: p.comment,
              last_heard: p.last_heard,
              packet_count: p.packet_count,
              srccall: p.srccall,
              dstcall: p.dstcall,
              path: p.path,
              phg: p.phg,
              status: p.status,
              wx: p.wx,
              aprs_time: p.aprs_time,
              last_format: p.last_format,
              country_code: cc || undefined,
              is_live: true,
            };
          })
      );
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return nodes;
}