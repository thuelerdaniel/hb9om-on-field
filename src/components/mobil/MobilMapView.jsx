// MobilMapView — Vereinheitlichte Kartenansicht für den Mobil-Tab.
// Zeigt Route (Polyline), GPS-Marker, Repeater-Marker, Repeater-Abdeckung (Polygon oder Kreis),
// eigene Reichweite (Polygon), Auto-Zoom-Button und blinkenden aktiven Repeater-Marker.
//
// Repeater-Abdeckung:
//   - Wenn der Repeater ein coverage_polygon (GeoJSON) hat → als Polygon zeichnen
//   - Sonst → Fallback-Kreis mit calculateRange(band)
//   - Farbe: grün wenn erreichbar, orange wenn Fallback (außerhalb Reichweite)
//
// Auto-Zoom: Button unten-rechts auf der Karte. fitBounds(GPS + aktiver Repeater + Route).
// Blinken: aktiver Repeater-Marker blinkt (fillOpacity toggle alle 500ms), rot umrandet.

import React, { useState, useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Circle,
  Polygon,
  Popup,
  useMap,
} from "react-leaflet";
import { getModeColor, getModeLabel } from "@/lib/repeaterModes";
import { calculateRange } from "@/lib/equipmentRange";

// FitBounds — passt Kartenansicht an alle Punkte an.
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [bounds, map]);
  return null;
}

// MapRefSetter — gibt die map-Instanz nach außen (für Auto-Zoom).
function MapRefSetter({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

export default function MobilMapView({
  routeCoords,
  gpsPosition,
  accuracy,
  repeaters,
  recommendedRepeater,
  selectedRepeater,
  showRepeaterCoverage,
  showOwnCoverage,
  ownCoveragePolygon,
  isRecommendedReachable = true,
  equipmentType,
  height = "45vh",
}) {
  const [mapInstance, setMapInstance] = useState(null);
  const [autoZoom, setAutoZoom] = useState(false);
  const [blinkVisible, setBlinkVisible] = useState(true);

  // Blink animation for active repeater
  useEffect(() => {
    if (!recommendedRepeater) return;
    const interval = setInterval(() => {
      setBlinkVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, [recommendedRepeater?.id]);

  // Calculate bounds from all points
  const bounds = useMemo(() => {
    const points = [];
    if (routeCoords && routeCoords.length > 0) {
      routeCoords.forEach(([lat, lon]) => points.push([lat, lon]));
    }
    if (gpsPosition) {
      points.push([gpsPosition.lat, gpsPosition.lon]);
    }
    if (repeaters) {
      repeaters.forEach((r) => {
        if (r.lat != null && r.lng != null) points.push([r.lat, r.lng]);
      });
    }
    if (points.length === 0) return null;
    const lats = points.map((p) => p[0]);
    const lons = points.map((p) => p[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [routeCoords, gpsPosition, repeaters]);

  // Auto-zoom: fit bounds to GPS + active repeater (+ route)
  const doAutoZoom = useMemo(() => {
    return () => {
      if (!mapInstance) return;
      const points = [];
      if (gpsPosition) points.push([gpsPosition.lat, gpsPosition.lon]);
      if (recommendedRepeater && recommendedRepeater.lat != null) {
        points.push([recommendedRepeater.lat, recommendedRepeater.lng]);
      }
      if (routeCoords && routeCoords.length > 0) {
        routeCoords.forEach(([lat, lon]) => points.push([lat, lon]));
      }
      if (points.length >= 2) {
        const lats = points.map((p) => p[0]);
        const lons = points.map((p) => p[1]);
        const b = [
          [Math.min(...lats), Math.min(...lons)],
          [Math.max(...lats), Math.max(...lons)],
        ];
        mapInstance.fitBounds(b, { padding: [50, 50], animate: true, duration: 0.5 });
      } else if (points.length === 1) {
        mapInstance.setView(points[0], 12, { animate: true, duration: 0.5 });
      }
    };
  }, [mapInstance, gpsPosition, recommendedRepeater, routeCoords]);

  // Auto-zoom when toggled ON or when position/active repeater changes (if autoZoom is ON)
  useEffect(() => {
    if (autoZoom && mapInstance) {
      doAutoZoom();
    }
  }, [autoZoom, mapInstance, gpsPosition, recommendedRepeater?.id, routeCoords]);

  // Repeater coverage: use cached GeoJSON polygon if available, else fallback circle
  const repeaterCoverageLeaflet = useMemo(() => {
    if (!showRepeaterCoverage || !recommendedRepeater) return null;
    const poly = recommendedRepeater.coverage_polygon;
    if (poly && poly.coordinates && Array.isArray(poly.coordinates[0])) {
      return poly.coordinates[0].map(([lon, lat]) => [lat, lon]);
    }
    return null;
  }, [showRepeaterCoverage, recommendedRepeater]);

  const repeaterCoverageRadius = recommendedRepeater
    ? calculateRange(equipmentType, recommendedRepeater.band) * 1000
    : 0;

  const coverageColor = isRecommendedReachable ? "#22c55e" : "#f97316";

  // Own coverage polygon: GeoJSON [lon, lat] → Leaflet [lat, lon]
  const ownCoverageLeaflet = useMemo(() => {
    if (!ownCoveragePolygon || ownCoveragePolygon.length === 0) return null;
    return ownCoveragePolygon.map(([lon, lat]) => [lat, lon]);
  }, [ownCoveragePolygon]);

  const activeRepeaterId = recommendedRepeater?.id;

  return (
    <div
      style={{ height, position: "relative" }}
      className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700"
    >
      <MapContainer
        center={[46.8, 8.3]}
        zoom={8}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <MapRefSetter onReady={setMapInstance} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />

        {bounds && !autoZoom && <FitBounds bounds={bounds} />}

        {/* Route polyline */}
        {routeCoords && routeCoords.length > 1 && (
          <Polyline positions={routeCoords} pathOptions={{ color: "#3b82f6", weight: 4 }} />
        )}

        {/* Own coverage polygon */}
        {showOwnCoverage && ownCoverageLeaflet && (
          <Polygon
            positions={ownCoverageLeaflet}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}

        {/* Repeater coverage — Polygon (terrain-based) if available */}
        {showRepeaterCoverage && repeaterCoverageLeaflet && (
          <Polygon
            positions={repeaterCoverageLeaflet}
            pathOptions={{
              color: coverageColor,
              fillColor: coverageColor,
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}

        {/* Repeater coverage — Fallback circle if no polygon cached */}
        {showRepeaterCoverage &&
          !repeaterCoverageLeaflet &&
          recommendedRepeater &&
          recommendedRepeater.lat != null &&
          recommendedRepeater.lng != null && (
            <Circle
              center={[recommendedRepeater.lat, recommendedRepeater.lng]}
              radius={repeaterCoverageRadius}
              pathOptions={{
                color: coverageColor,
                fillColor: coverageColor,
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
          )}

        {/* GPS marker */}
        {gpsPosition && (
          <>
            <CircleMarker
              center={[gpsPosition.lat, gpsPosition.lon]}
              radius={8}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#2563eb",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">GPS Position</p>
                  <p>
                    {gpsPosition.lat.toFixed(4)}, {gpsPosition.lon.toFixed(4)}
                  </p>
                  {accuracy != null && <p>±{Math.round(accuracy)}m</p>}
                </div>
              </Popup>
            </CircleMarker>
            {accuracy != null && (
              <Circle
                center={[gpsPosition.lat, gpsPosition.lon]}
                radius={accuracy}
                pathOptions={{
                  color: "#2563eb",
                  fillColor: "#2563eb",
                  fillOpacity: 0.05,
                  weight: 1,
                }}
              />
            )}
          </>
        )}

        {/* Repeater markers */}
        {(repeaters || []).map((r, i) => {
          if (r.lat == null || r.lng == null) return null;
          const color = getModeColor(r.primary_mode);
          const isActive = activeRepeaterId && r.id === activeRepeaterId;
          return (
            <CircleMarker
              key={r.id || i}
              center={[r.lat, r.lng]}
              radius={isActive ? 10 : 5}
              pathOptions={{
                color: isActive ? "#ef4444" : color,
                fillColor: color,
                fillOpacity: isActive
                  ? (blinkVisible ? 0.9 : 0.2)
                  : 0.5,
                weight: isActive ? 4 : 1,
              }}
            >
              {isActive && (
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold font-mono">{r.callsign}</p>
                    <p>{r.frequency?.toFixed(4)} MHz</p>
                    <p>
                      {getModeLabel(r.primary_mode)} · {r.band}
                    </p>
                    {r.location_name && <p>{r.location_name}</p>}
                    {r._distToPos != null && <p>{r._distToPos.toFixed(1)} km</p>}
                    {r._distToRoute != null && (
                      <p>{r._distToRoute.toFixed(1)} km zur Route</p>
                    )}
                  </div>
                </Popup>
              )}
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Auto-Zoom Button — unten-rechts auf der Karte, 56x56px, weiß mit blauem Border */}
      <button
        onClick={() => setAutoZoom((v) => !v)}
        className="absolute z-[1000] flex items-center justify-center rounded-full transition-colors"
        style={{
          bottom: 80,
          right: 16,
          width: 56,
          height: 56,
          backgroundColor: autoZoom ? "#3b82f6" : "#ffffff",
          border: "2px solid #3b82f6",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
        }}
        title="Auto-Zoom: GPS + Repeater"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={autoZoom ? "#ffffff" : "#3b82f6"}
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </button>
    </div>
  );
}