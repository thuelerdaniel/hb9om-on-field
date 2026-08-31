// MobilMapView — Vereinheitlichte Kartenansicht für den Mobil-Tab.
// Zeigt Route (Polyline), GPS-Marker, Repeater-Marker, Repeater-Abdeckung (Polygon oder Kreis),
// und eigene Reichweite (Polygon) an.
//
// Repeater-Abdeckung:
//   - Wenn der Repeater ein coverage_polygon (GeoJSON) hat → als Polygon zeichnen
//   - Sonst →Fallback-Kreis mit calculateRange(band)
//   - Farbe: grün wenn erreichbar, orange wenn Fallback (außerhalb Reichweite)

import React, { useEffect, useMemo } from "react";
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
  height = "40vh",
}) {
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

  // Repeater coverage: use cached GeoJSON polygon if available, else fallback circle
  const repeaterCoverageLeaflet = useMemo(() => {
    if (!showRepeaterCoverage || !recommendedRepeater) return null;
    const poly = recommendedRepeater.coverage_polygon;
    if (poly && poly.coordinates && Array.isArray(poly.coordinates[0])) {
      // GeoJSON Polygon: coordinates[0] = outer ring of [lon, lat] pairs
      return poly.coordinates[0].map(([lon, lat]) => [lat, lon]);
    }
    return null;
  }, [showRepeaterCoverage, recommendedRepeater]);

  const repeaterCoverageRadius = recommendedRepeater
    ? calculateRange(equipmentType, recommendedRepeater.band) * 1000
    : 0;

  // Coverage color: green if reachable, orange if fallback
  const coverageColor = isRecommendedReachable ? "#22c55e" : "#f97316";

  // Own coverage polygon: GeoJSON [lon, lat] → Leaflet [lat, lon]
  const ownCoverageLeaflet = useMemo(() => {
    if (!ownCoveragePolygon || ownCoveragePolygon.length === 0) return null;
    return ownCoveragePolygon.map(([lon, lat]) => [lat, lon]);
  }, [ownCoveragePolygon]);

  return (
    <div
      style={{ height }}
      className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700"
    >
      <MapContainer
        center={[46.8, 8.3]}
        zoom={8}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />

        {bounds && <FitBounds bounds={bounds} />}

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
          const isRecommended =
            recommendedRepeater && r.id === recommendedRepeater.id;
          const isSelected = selectedRepeater && r.id === selectedRepeater.id;
          return (
            <CircleMarker
              key={r.id || i}
              center={[r.lat, r.lng]}
              radius={isRecommended ? 8 : 5}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: isRecommended ? 0.8 : 0.5,
                weight: isRecommended ? 3 : 1,
              }}
            >
              {(isSelected || isRecommended) && (
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
    </div>
  );
}