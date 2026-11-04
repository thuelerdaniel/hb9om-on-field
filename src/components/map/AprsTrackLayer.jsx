import React, { useEffect, useMemo, useState } from "react";
import { Polyline, useMapEvents } from "react-leaflet";
import { base44 } from "@/api/base44Client";
import { isValidCoord } from "@/lib/geoUtilsFrontend";

// Bewegungsspuren der mobilen Live-Stationen (AprsSample, 72 h Historie).
// Es werden nur Stationen im aktuellen Kartenausschnitt geladen (max. 40),
// damit ein Kartenausschnitt nicht hunderte Abfragen auslöst.

const MAX_CALLSIGNS = 40;

export default function AprsTrackLayer({ nodes }) {
  const [zoom, setZoom] = useState(0);
  const [samples, setSamples] = useState([]);
  useMapEvents({ moveend: (e) => setZoom(e.target.getZoom()) });

  const mobileCallsigns = useMemo(() => {
    return (nodes || [])
      .filter((n) => n.is_live && n.station_type === "mobile" && isValidCoord(n.lat, n.lng))
      .slice(0, MAX_CALLSIGNS)
      .map((n) => n.callsign);
  }, [nodes]);

  const key = mobileCallsigns.join(",");

  useEffect(() => {
    if (!key) {
      setSamples([]);
      return;
    }
    let cancelled = false;
    base44.entities.AprsSample
      .filter({ callsign: { $in: key.split(",") } }, { sort: "heard", limit: 2000 })
      .then((page) => {
        if (!cancelled) setSamples(page?.items || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key, zoom]);

  const tracks = useMemo(() => {
    const byCall = {};
    for (const s of samples) {
      if (!isValidCoord(s.lat, s.lng)) continue;
      (byCall[s.callsign] = byCall[s.callsign] || []).push([s.lat, s.lng]);
    }
    return Object.entries(byCall).filter(([, pts]) => pts.length >= 2);
  }, [samples]);

  return (
    <>
      {tracks.map(([call, positions]) => (
        <Polyline
          key={call}
          positions={positions}
          pathOptions={{ color: "#ec4899", weight: 2, opacity: 0.75, dashArray: "4 4" }}
        />
      ))}
    </>
  );
}