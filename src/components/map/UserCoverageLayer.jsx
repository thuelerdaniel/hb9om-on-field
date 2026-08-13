import React, { memo, useMemo } from "react";
import { Polygon, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Renders the user's coverage polygon (MODUS B) on the map.
// Orange polygon — not saved to database (transient state).
// Also renders a position marker when a position is set (even before calculation).
function UserCoverageLayerInner({ coverage, position, deviceType }) {
  // Convert GeoJSON [lng, lat] polygon to Leaflet [lat, lng], filtering invalid coords
  const positions = useMemo(() => {
    if (!coverage?.polygon?.coordinates?.[0]) return [];
    return coverage.polygon.coordinates[0]
      .map(([lng, lat]) => [lat, lng])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }, [coverage]);

  // Position marker icon — radio emoji for portabel, car for mobil, house for fix
  const deviceIcon = useMemo(() => {
    const icons = { mobil: "🚗", fix: "🏠", portabel: "📻" };
    return L.divIcon({
      className: "user-position-marker",
      html: `<div style="font-size:24px;">${icons[deviceType] || "📍"}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, [deviceType]);

  // Don't render anything if no position and no polygon
  if (!position && positions.length === 0) return null;

  return (
    <>
      {/* Coverage polygon — only if valid positions exist */}
      {positions.length >= 3 && (
        <Polygon
          positions={positions}
          pathOptions={{
            color: "#ff6400",
            weight: 1.5,
            opacity: 0.6,
            fillColor: "#ff6400",
            fillOpacity: 0.15,
          }}
        />
      )}

      {/* Position marker — shown as soon as a position is set (even before calculation) */}
      {position && Number.isFinite(position[0]) && Number.isFinite(position[1]) && (
        <Marker position={position} icon={deviceIcon}>
          <Popup>
            <div className="text-xs">
              <strong>Meine Position</strong><br />
              {coverage ? (
                <>
                  Ø Reichweite: {coverage.avg_range_km || 0} km<br />
                  Max: {coverage.max_range_km || 0} km ({coverage.max_direction?.angle || 0}°)<br />
                  Min: {coverage.min_range_km || 0} km ({coverage.min_direction?.angle || 0}°)<br />
                  Gelände-blockiert: {coverage.terrain_blocked_count || 0} Richtungen<br />
                  Höhe: {coverage.elevation_m != null ? `${Math.round(coverage.elevation_m)} m` : "unbekannt"}
                </>
              ) : (
                <span className="text-gray-500">Position gewählt — Abdeckung berechnen im Dialog</span>
              )}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

export default memo(UserCoverageLayerInner);