// LiveMapView — Live GPS-Karte (40% Bildschirmhöhe) mit pulsierendem GPS-Punkt,
// Accuracy-Kreis, Repeater-Markern und hervorgehobenem empfohlenem Repeater.

import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { getModeColor, getModeLabel, repeaterMatchesMode } from "@/lib/repeaterModes";

// Auto-Zentrierung auf GPS-Position
function AutoCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lon], Math.max(map.getZoom(), 12), { animate: true });
    }
  }, [position, map]);
  return null;
}

// GPS-Icon (pulsierender blauer Punkt)
function createPulsingGpsIcon() {
  return L.divIcon({
    className: "mobil-live-gps-marker",
    html: `
      <div style="position:relative;width:20px;height:20px;">
        <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;opacity:0.3;animation:mobil-pulse 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:4px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 6px rgba(59,130,246,0.8);"></div>
      </div>
      <style>
        @keyframes mobil-pulse {
          0% { transform: scale(0.5); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      </style>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

// Hervorgehobener Repeater-Icon (größer, andere Farbe)
function createRecommendedIcon(color) {
  return L.divIcon({
    className: "mobil-recommended-marker",
    html: `
      <div style="width:24px;height:24px;background:${color};border:3px solid #fbbf24;border-radius:50%;box-shadow:0 0 10px rgba(251,191,36,0.8);display:flex;align-items:center;justify-content:center;">
        <div style="width:6px;height:6px;background:white;border-radius:50%;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function LiveMapView({ gpsPosition, accuracy, repeaters, recommendedRepeater, selectedModes, selectedBands, rangeKm }) {
  const gpsIcon = useMemo(() => createPulsingGpsIcon(), []);
  const recommendedIcon = useMemo(
    () => recommendedRepeater ? createRecommendedIcon(getModeColor(recommendedRepeater.primary_mode)) : null,
    [recommendedRepeater]
  );

  const filteredRepeaters = useMemo(() => {
    return repeaters.filter((r) => {
      if (r.lat == null || r.lng == null) return false;
      if (selectedModes.length > 0 && !selectedModes.some((m) => repeaterMatchesMode(r, m))) return false;
      if (selectedBands.length > 0 && r.band && !selectedBands.includes(r.band)) return false;
      return true;
    });
  }, [repeaters, selectedModes, selectedBands]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700" style={{ height: "40vh", minHeight: "200px" }}>
      <MapContainer
        center={gpsPosition ? [gpsPosition.lat, gpsPosition.lon] : [46.979, 7.458]}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

        <AutoCenter position={gpsPosition} />

        {/* GPS Accuracy-Kreis */}
        {gpsPosition && accuracy != null && (
          <Circle
            center={[gpsPosition.lat, gpsPosition.lon]}
            radius={accuracy}
            pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.08, weight: 1 }}
          />
        )}

        {/* GPS-Position (pulsierend) */}
        {gpsPosition && (
          <Marker position={[gpsPosition.lat, gpsPosition.lon]} icon={gpsIcon} />
        )}

        {/* Repeater-Marker */}
        {filteredRepeaters.map((r, i) => {
          if (recommendedRepeater && r.id === recommendedRepeater.id) return null; // separat rendern
          const color = getModeColor(r.primary_mode);
          return (
            <CircleMarker
              key={r.id || i}
              center={[r.lat, r.lng]}
              radius={6}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 2 }}
            >
              <Popup>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm">{r.callsign}</p>
                  <p>{r.frequency?.toFixed(3)} MHz {r.offset_mhz != null ? `(${r.offset_mhz > 0 ? "+" : ""}${r.offset_mhz.toFixed(3)})` : ""}</p>
                  {r.tone && <p>Tone: {r.tone}</p>}
                  <p>{getModeLabel(r.primary_mode)} · {r.band || "?"}</p>
                  {r.location_name && <p>{r.location_name}</p>}
                  {r._distToPos != null && <p className="text-blue-600">Entf.: {r._distToPos.toFixed(1)} km, {r._azimuthToPos || 0}°</p>}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Empfohlener Repeater (hervorgehoben) */}
        {recommendedRepeater && recommendedRepeater.lat != null && (
          <Marker
            position={[recommendedRepeater.lat, recommendedRepeater.lng]}
            icon={recommendedIcon}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm text-amber-600">★ {recommendedRepeater.callsign}</p>
                <p>{recommendedRepeater.frequency?.toFixed(3)} MHz {recommendedRepeater.offset_mhz != null ? `(${recommendedRepeater.offset_mhz > 0 ? "+" : ""}${recommendedRepeater.offset_mhz.toFixed(3)})` : ""}</p>
                {recommendedRepeater.tone && <p>Tone: {recommendedRepeater.tone}</p>}
                <p>{getModeLabel(recommendedRepeater.primary_mode)} · {recommendedRepeater.band || "?"}</p>
                {recommendedRepeater.location_name && <p>{recommendedRepeater.location_name}</p>}
                {recommendedRepeater._distToPos != null && <p className="text-blue-600">Entf.: {recommendedRepeater._distToPos.toFixed(1)} km, {recommendedRepeater._azimuthToPos || 0}°</p>}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}