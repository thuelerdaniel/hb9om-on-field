// MobilMapView — Vereinheitlichte Kartenansicht für den Mobil-Tab.
// Zeigt Route (Polyline), GPS-Marker, Repeater-Marker, Repeater-Abdeckung (ITM-Polygon oder Kreis),
// eigene Reichweite (Polygon), Auto-Zoom-Button (verschiebbar) und blinkenden aktiven Repeater-Marker.
//
// Repeater-Abdeckung Priorität:
//   1. ITM-Coverage-Polygon (itmCoveragePolygon) — Terrain-basiert, 16 Richtungen
//   2. GeoJSON coverage_polygon (cached) — falls verfügbar
//   3. Fallback-Kreis mit calculateRange(band)
//
// Auto-Zoom Button: verschiebbar (Long-Press 500ms auf Mobile, Maus auf Desktop).
// Position wird in localStorage gespeichert (useDraggableButton Hook).

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
import { useDraggableButton } from "@/hooks/useDraggableButton";

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [bounds, map]);
  return null;
}

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
  itmCoveragePolygon,
  isRecommendedReachable = true,
  equipmentType,
  height = "45vh",
}) {
  const [mapInstance, setMapInstance] = useState(null);
  const [autoZoom, setAutoZoom] = useState(false);
  const [blinkVisible, setBlinkVisible] = useState(true);

  // Draggable auto-zoom button
  const { buttonRef: autoZoomBtnRef, dragState: autoZoomDragState } = useDraggableButton(
    "mobilAutoZoomBtn",
    null
  );

  useEffect(() => {
    if (!recommendedRepeater) return;
    const interval = setInterval(() => {
      setBlinkVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, [recommendedRepeater?.id]);

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

  useEffect(() => {
    if (autoZoom && mapInstance) {
      doAutoZoom();
    }
  }, [autoZoom, mapInstance, gpsPosition, recommendedRepeater?.id, routeCoords]);

  // Cached GeoJSON polygon (fallback if no ITM polygon)
  const repeaterCoverageLeaflet = useMemo(() => {
    if (!showRepeaterCoverage || !recommendedRepeater || itmCoveragePolygon) return null;
    const poly = recommendedRepeater.coverage_polygon;
    if (poly && poly.coordinates && Array.isArray(poly.coordinates[0])) {
      return poly.coordinates[0].map(([lon, lat]) => [lat, lon]);
    }
    return null;
  }, [showRepeaterCoverage, recommendedRepeater, itmCoveragePolygon]);

  const repeaterCoverageRadius = recommendedRepeater
    ? calculateRange(equipmentType, recommendedRepeater.band) * 1000
    : 0;

  const coverageColor = isRecommendedReachable ? "#22c55e" : "#f97316";

  // ITM coverage polygon is already [lat, lng] — no conversion needed
  const itmCoverageLeaflet = itmCoveragePolygon || null;

  // Own coverage polygon: GeoJSON [lon, lat] → Leaflet [lat, lon]
  const ownCoverageLeaflet = useMemo(() => {
    if (!ownCoveragePolygon || ownCoveragePolygon.length === 0) return null;
    // Check if it's already [lat, lng] or [lon, lat] format
    if (Array.isArray(ownCoveragePolygon[0]) && ownCoveragePolygon[0].length >= 2) {
      // Assume [lon, lat] from GeoJSON — convert to [lat, lon]
      return ownCoveragePolygon.map(([lon, lat]) => [lat, lon]);
    }
    return null;
  }, [ownCoveragePolygon]);

  const activeRepeaterId = recommendedRepeater?.id;

  const handleAutoZoomClick = () => {
    // Don't toggle if the button was dragged
    if (autoZoomDragState.current.moved) return;
    setAutoZoom((v) => !v);
  };

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

        {/* ITM Coverage polygon (priority over cached polygon) */}
        {showRepeaterCoverage && itmCoverageLeaflet && (
          <Polygon
            positions={itmCoverageLeaflet}
            pathOptions={{
              color: coverageColor,
              fillColor: coverageColor,
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}

        {/* Cached GeoJSON coverage polygon (fallback if no ITM) */}
        {showRepeaterCoverage &&
          !itmCoverageLeaflet &&
          repeaterCoverageLeaflet && (
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

        {/* Fallback circle if no polygon (ITM or cached) */}
        {showRepeaterCoverage &&
          !itmCoverageLeaflet &&
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

      {/* Auto-Zoom Button — verschiebbar (Long-Press 500ms), Position wird gespeichert */}
      <button
        ref={autoZoomBtnRef}
        onClick={handleAutoZoomClick}
        className="fixed z-[1000] flex items-center justify-center rounded-full transition-colors"
        style={{
          bottom: 80,
          right: 16,
          width: 56,
          height: 56,
          backgroundColor: autoZoom ? "#3b82f6" : "#ffffff",
          border: "2px solid #3b82f6",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
          touchAction: "none",
        }}
        title="Auto-Zoom: GPS + Repeater (Long-Press zum Verschieben)"
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