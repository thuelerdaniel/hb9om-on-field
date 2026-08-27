import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon } from "@/lib/geoUtilsFrontend";

// Hunting Map — zeigt alle aktiven Spots mit gültigen Koordinaten auf einer Karte.
// SOTA = orange, POTA = grün, DX = blau, Station QTH = rot.
// Nur Spots mit latitude/longitude != null werden angezeigt (FIX 7).

const DEFAULT_STATION = { station: "HB9OM", callsign: "HB3YNF", locator: "JN36FL" };

// AutoFit — zoomt zu allen Markern beim ersten Render
function AutoFit({ positions }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done || positions.length === 0) return;
    try { if (map._panes && map._mapPane) map.invalidateSize(); } catch (e) { console.warn('invalidateSize skipped:', e.message); }
    if (positions.length === 1) { map.setView(positions[0], 10); setDone(true); return; }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    setDone(true);
  }, [positions, map, done]);
  return null;
}

function ageText(age) {
  if (age == null) return "—";
  if (age < 60) return `${age}s`;
  if (age < 3600) return `${Math.floor(age / 60)}m`;
  return `${Math.floor(age / 3600)}h`;
}

function formatFreq(kHz) {
  if (!kHz) return "—";
  return `${(kHz / 1000).toFixed(3)} MHz`;
}

export default function HuntingMap({ gpsPos, stationInfo, onSpotClick }) {
  const [activities, setActivities] = useState([]);
  const [dxSpots, setDxSpots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Station-Position: GPS voran, Fallback auf Locator
  const stationPos = useMemo(() => {
    if (gpsPos) return { lat: gpsPos.lat, lon: gpsPos.lng };
    if (stationInfo?.locator) {
      const p = maidenheadToLatLon(stationInfo.locator);
      return p || { lat: 46.5, lon: 6.5 };
    }
    return { lat: 46.5, lon: 6.5 };
  }, [gpsPos, stationInfo]);

  // Daten laden
  useEffect(() => {
    const loadData = async () => {
      try {
        const [actList, dxList] = await Promise.all([
          base44.entities.ActivitySpot.list("-spot_time", 100),
          base44.entities.DxSpot.list("-spot_time", 50),
        ]);
        // FIX 7: Nur Spots mit gültigen Koordinaten
        setActivities((actList || []).filter(s => s.latitude != null && s.longitude != null));
        setDxSpots((dxList || []).filter(s => s.lat != null && s.lng != null));
      } catch {} finally { setLoading(false); }
    };
    loadData();
    const interval = setInterval(loadData, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Alle Positionen für AutoFit
  const allPositions = useMemo(() => {
    const arr = [[stationPos.lat, stationPos.lon]];
    for (const s of activities) arr.push([s.latitude, s.longitude]);
    for (const s of dxSpots) arr.push([s.lat, s.lng]);
    return arr;
  }, [stationPos, activities, dxSpots]);

  // Station-Marker (rot)
  const stationIcon = L.divIcon({
    className: "",
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#ff5252;border:3px solid #1a1a1a;box-shadow:0 0 6px #ff5252;"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00e5ff]" /> HUNTING MAP
          <span className="text-[10px] text-muted-foreground font-normal">
            ({activities.length + dxSpots.length} Spots)
          </span>
        </h2>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#ff9800]" />SOTA</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#8cff00]" />POTA</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#00e5ff]" />DX</span>
          <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#ff5252]" />QTH</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: 300 }} className="relative">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Karte wird geladen…
          </div>
        ) : allPositions.length <= 1 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Keine Spots mit Koordinaten verfügbar.
          </div>
        ) : (
          <MapContainer
            key="hunting-map"
            center={[stationPos.lat, stationPos.lon]}
            zoom={8}
            className="w-full h-full"
            zoomControl={false}
            scrollWheelZoom={true}
            touchZoom={true}
            doubleClickZoom={true}
            dragging={true}
            minZoom={3}
            maxZoom={18}
            zoomSnap={0.5}
            zoomDelta={0.5}
            zoomAnimation={false}
            bounceAtZoomLimits={true}
            style={{ background: "#0d1720" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />

            {/* Station QTH — roter Marker */}
            <Marker position={[stationPos.lat, stationPos.lon]} icon={stationIcon}>
              <Popup>
                <div className="text-xs">
                  <strong>Station QTH</strong><br />
                  {stationInfo?.callsign || DEFAULT_STATION.callsign}<br />
                  Locator: {stationInfo?.locator || DEFAULT_STATION.locator}
                </div>
              </Popup>
            </Marker>

            {/* ActivitySpots — SOTA=orange, POTA=grün */}
            {activities.map((s, i) => (
              <CircleMarker
                key={`act-${s.id || i}`}
                center={[s.latitude, s.longitude]}
                radius={6}
                pathOptions={{
                  color: s.activity_type === "SOTA" ? "#ff9800" : "#8cff00",
                  fillColor: s.activity_type === "SOTA" ? "#ff9800" : "#8cff00",
                  fillOpacity: 0.8,
                  weight: 2,
                }}
                eventHandlers={{ click: () => onSpotClick?.(s) }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong style={{ color: s.activity_type === "SOTA" ? "#ff9800" : "#8cff00" }}>
                      {s.activity_type}
                    </strong>{" "}
                    <strong>{s.call}</strong><br />
                    {s.reference && <span>Ref: {s.reference}<br /></span>}
                    {s.name && <span>{s.name}<br /></span>}
                    {formatFreq(s.frequency)} · {s.mode || "—"}<br />
                    {s.distance > 0 && <span>{s.distance} km · {s.azimuth}°<br /></span>}
                    Alter: {ageText(s.age_seconds)}
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* DxSpots — blau */}
            {dxSpots.map((s, i) => (
              <CircleMarker
                key={`dx-${s.id || i}`}
                center={[s.lat, s.lng]}
                radius={5}
                pathOptions={{
                  color: "#00e5ff",
                  fillColor: "#00e5ff",
                  fillOpacity: 0.7,
                  weight: 2,
                }}
                eventHandlers={{ click: () => onSpotClick?.(s) }}
              >
                <Popup>
                  <div className="text-xs">
                    <strong style={{ color: "#00e5ff" }}>DX</strong>{" "}
                    <strong>{s.call}</strong><br />
                    {s.countryCode && <span>{s.countryCode} </span>}
                    {s.country && <span>{s.country}<br /></span>}
                    {formatFreq(s.frequency)} · {s.mode || "—"} · {s.band || "—"}<br />
                    {s.distance > 0 && <span>{s.distance} km · {s.azimuth}°<br /></span>}
                    {s.activity && <span>Aktivität: {s.activity} {s.activity_ref || ""}<br /></span>}
                    Alter: {ageText(s.age_seconds)}<br />
                    Quelle: {s.source || "—"}
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            <AutoFit positions={allPositions} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}