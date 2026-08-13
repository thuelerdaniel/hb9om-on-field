import React, { memo, useMemo } from "react";
import { Polygon, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Renders the user's coverage polygon (MODUS B) on the map.
// Orange polygon — not saved to database (transient state).
function UserCoverageLayerInner({ coverage, position, deviceType }) {
  const positions = useMemo(() => {
    if (!coverage?.polygon?.coordinates?.[0]) return [];
    return coverage.polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
  }, [coverage]);

  const deviceIcon = useMemo(() => {
    const icons = { mobil: "🚗", fix: "🏠", portabel: "📱" };
    return L.divIcon({
      className: "user-position-marker",
      html: `<div style="font-size:24px;">${icons[deviceType] || "📍"}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, [deviceType]);

  if (positions.length === 0) return null;

  return (
    <>
      <Polygon
        positions={positions}
        pathOptions={{
          color: "rgba(255, 100, 0, 0.6)",
          weight: 1.5,
          fillColor: "rgba(255, 100, 0, 0.15)",
          fillOpacity: 0.15,
        }}
      />
      {position && (
        <Marker position={position} icon={deviceIcon}>
          <Popup>
            <div className="text-xs">
              <strong>Meine Position</strong><br />
              Ø Reichweite: {coverage?.avg_range_km || 0} km<br />
              Max: {coverage?.max_range_km || 0} km ({coverage?.max_direction?.angle || 0}°)<br />
              Min: {coverage?.min_range_km || 0} km ({coverage?.min_direction?.angle || 0}°)<br />
              Gelände-blockiert: {coverage?.terrain_blocked_count || 0} Richtungen<br />
              Höhe: {coverage?.elevation_m != null ? `${Math.round(coverage.elevation_m)} m` : "unbekannt"}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

export default memo(UserCoverageLayerInner);