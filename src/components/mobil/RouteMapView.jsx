// RouteMapView — Leaflet-Karte mit Route (Polyline), Reichweite-Korridor, Repeater-Markern, GPS-Position.

import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { getModeColor, getModeLabel, repeaterMatchesMode } from "@/lib/repeaterModes";

// Auto-Zentrierung auf Route
function FitBounds({ routeCoords }) {
  const map = useMap();
  useEffect(() => {
    if (routeCoords && routeCoords.length > 0) {
      const bounds = L.latLngBounds(routeCoords.map(([lat, lon]) => [lat, lon]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [routeCoords, map]);
  return null;
}

// GPS-Position Marker (blauer Punkt)
function createGpsIcon() {
  return L.divIcon({
    className: "mobil-gps-marker",
    html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.6);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// Korridor-Polygon aus Route-Koordinaten + Reichweite
function corridorPolygon(coords, rangeKm) {
  if (!coords || coords.length < 2) return [];
  const left = [];
  const right = [];
  for (let i = 0; i < coords.length; i++) {
    const [lat, lon] = coords[i];
    let dLat, dLon;
    if (i === 0) {
      dLat = coords[1][0] - lat;
      dLon = coords[1][1] - lon;
    } else if (i === coords.length - 1) {
      dLat = lat - coords[i - 1][0];
      dLon = lon - coords[i - 1][1];
    } else {
      dLat = coords[i + 1][0] - coords[i - 1][0];
      dLon = coords[i + 1][1] - coords[i - 1][1];
    }
    const len = Math.sqrt(dLat * dLat + dLon * dLon);
    if (len === 0) continue;
    const pLat = -dLon / len;
    const pLon = dLat / len;
    const latDeg = rangeKm / 111;
    const lonDeg = rangeKm / (111 * Math.cos((lat * Math.PI) / 180));
    left.push([lat + pLat * latDeg, lon + pLon * lonDeg]);
    right.push([lat - pLat * latDeg, lon - pLon * lonDeg]);
  }
  return [...left, ...right.reverse()];
}

export default function RouteMapView({ routeCoords, repeaters, rangeKm, gpsPosition, selectedModes, selectedBands }) {
  const corridor = useMemo(() => corridorPolygon(routeCoords, rangeKm), [routeCoords, rangeKm]);
  const gpsIcon = useMemo(() => createGpsIcon(), []);

  const filteredRepeaters = useMemo(() => {
    return repeaters.filter((r) => {
      if (r.lat == null || r.lng == null) return false;
      if (selectedModes.length > 0 && !selectedModes.some((m) => repeaterMatchesMode(r, m))) return false;
      if (selectedBands.length > 0 && r.band && !selectedBands.includes(r.band)) return false;
      return true;
    });
  }, [repeaters, selectedModes, selectedBands]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700" style={{ height: "300px" }}>
      <MapContainer
        center={routeCoords && routeCoords.length > 0 ? routeCoords[0] : [46.979, 7.458]}
        zoom={9}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />

        <FitBounds routeCoords={routeCoords} />

        {/* Reichweite-Korridor */}
        {corridor.length > 2 && (
          <Polyline
            positions={corridor}
            pathOptions={{ color: "#3b82f6", weight: 1, opacity: 0.15, fillColor: "#3b82f6", fillOpacity: 0.08 }}
          />
        )}

        {/* Route als Polyline */}
        {routeCoords && routeCoords.length > 0 && (
          <Polyline positions={routeCoords} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.8 }} />
        )}

        {/* GPS-Position */}
        {gpsPosition && (
          <Marker position={[gpsPosition.lat, gpsPosition.lon]} icon={gpsIcon} />
        )}

        {/* Repeater-Marker */}
        {filteredRepeaters.map((r, i) => {
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
                  {r._distToRoute != null && <p className="text-blue-600">Entf. zur Route: {r._distToRoute.toFixed(1)} km</p>}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}