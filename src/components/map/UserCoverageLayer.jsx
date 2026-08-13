import React, { memo, useMemo } from "react";
import { Polygon, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Mode colors for VHF/UHF (ITM+)
const VHF_MODE_COLORS = {
  los:          { color: "#0064ff", fill: "#0064ff", fillOpacity: 0.20, weight: 1.5 },
  diffraction:  { color: "#64a0ff", fill: "#64a0ff", fillOpacity: 0.15, weight: 1.0 },
  troposcatter: { color: "#96c8ff", fill: "#96c8ff", fillOpacity: 0.10, weight: 0.8 },
  reflection:   { color: "#00a0a0", fill: "#00a0a0", fillOpacity: 0.12, weight: 1.0 },
};

// Mode colors for KW/HF
const HF_MODE_COLORS = {
  ground_wave: { color: "#00c800", fill: "#00c800", fillOpacity: 0.18, weight: 1.5 },
  sky_wave:    { color: "#0064ff", fill: "#0064ff", fillOpacity: 0.10, weight: 1.0 },
  nvis:        { color: "#9600ff", fill: "#9600ff", fillOpacity: 0.15, weight: 1.2 },
};

// Convert GeoJSON [lng, lat] polygon to Leaflet [lat, lng], filtering invalid coords
function geoJsonToLeaflet(coords) {
  if (!coords || !Array.isArray(coords)) return [];
  return coords
    .map(([lng, lat]) => [lat, lng])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

// Renders the user's coverage polygon (MODUS B) on the map.
// VHF/UHF: multi-color polygons (LOS=blue, Diffraction=light blue, Troposcatter=pale blue)
// KW/HF: multi-color polygons (Ground Wave=green, Sky Wave=blue, NVIS=violet) + Skip Zone
function UserCoverageLayerInner({ coverage, position, deviceType }) {
  // Position marker icon
  const deviceIcon = useMemo(() => {
    const icons = { mobil: "🚗", fix: "🏠", portabel: "📻" };
    return L.divIcon({
      className: "user-position-marker",
      html: `<div style="font-size:24px;">${icons[deviceType] || "📍"}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, [deviceType]);

  // Convert all mode polygons
  const modePolys = useMemo(() => {
    if (!coverage?.mode_polygons) return {};
    const result = {};
    for (const [mode, poly] of Object.entries(coverage.mode_polygons)) {
      const positions = geoJsonToLeaflet(poly.coordinates?.[0]);
      if (positions.length >= 3) result[mode] = positions;
    }
    return result;
  }, [coverage]);

  // Overall polygon (fallback if no mode_polygons)
  const overallPositions = useMemo(() => {
    if (!coverage?.polygon?.coordinates?.[0]) return [];
    return geoJsonToLeaflet(coverage.polygon.coordinates[0]);
  }, [coverage]);

  const isHF = coverage?.is_hf;
  const colorMap = isHF ? HF_MODE_COLORS : VHF_MODE_COLORS;

  // Skip zone circle (KW only)
  const skipZone = coverage?.skip_zone;

  // Don't render anything if no position and no polygon
  if (!position && Object.keys(modePolys).length === 0 && overallPositions.length === 0) return null;

  // Render order: outermost (troposcatter/sky_wave) first, innermost (LOS/ground_wave) last
  // This creates the layered color effect
  const vhfRenderOrder = ["troposcatter", "diffraction", "los", "reflection"];
  const hfRenderOrder = ["sky_wave", "nvis", "ground_wave"];
  const renderOrder = isHF ? hfRenderOrder : vhfRenderOrder;

  return (
    <>
      {/* Multi-color mode polygons — rendered outermost first */}
      {renderOrder.map(mode => {
        const positions = modePolys[mode];
        if (!positions || positions.length < 3) return null;
        const colors = colorMap[mode];
        if (!colors) return null;
        return (
          <Polygon
            key={`mode-${mode}`}
            positions={positions}
            pathOptions={{
              color: colors.color,
              weight: colors.weight,
              opacity: 0.6,
              fillColor: colors.fill,
              fillOpacity: colors.fillOpacity,
            }}
          />
        );
      })}

      {/* Fallback: overall polygon if no mode polygons */}
      {Object.keys(modePolys).length === 0 && overallPositions.length >= 3 && (
        <Polygon
          positions={overallPositions}
          pathOptions={{
            color: "#ff6400",
            weight: 1.5,
            opacity: 0.6,
            fillColor: "#ff6400",
            fillOpacity: 0.15,
          }}
        />
      )}

      {/* Skip Zone — gray dashed circle (KW only) */}
      {skipZone && skipZone.outer_km > skipZone.inner_km && position && (
        <>
          <Circle
            center={position}
            radius={skipZone.inner_km * 1000}
            pathOptions={{
              color: "#666666",
              weight: 1,
              opacity: 0.4,
              fillOpacity: 0,
              dashArray: "4 6",
            }}
          />
          <Circle
            center={position}
            radius={skipZone.outer_km * 1000}
            pathOptions={{
              color: "#666666",
              weight: 1,
              opacity: 0.4,
              fillOpacity: 0.03,
              fillColor: "#666666",
              dashArray: "4 6",
            }}
          />
        </>
      )}

      {/* Position marker */}
      {position && Number.isFinite(position[0]) && Number.isFinite(position[1]) && (
        <Marker position={position} icon={deviceIcon}>
          <Popup>
            <div className="text-xs space-y-1">
              <strong>Meine Position</strong><br />
              {coverage ? (
                <>
                  <div>Ø Reichweite: <strong>{coverage.avg_range_km || 0} km</strong></div>
                  <div>Max: {coverage.max_range_km || 0} km ({coverage.max_direction?.angle || 0}°)</div>
                  <div>Min: {coverage.min_range_km || 0} km ({coverage.min_direction?.angle || 0}°)</div>
                  {coverage.is_hf ? (
                    <>
                      {coverage.muf_mhz && <div>MUF: {coverage.muf_mhz} MHz · LUF: {coverage.luf_mhz} MHz</div>}
                      {coverage.time_of_day && <div>Tageszeit: {coverage.time_of_day}</div>}
                      {coverage.skip_zone && (
                        <div className="text-amber-600">Skip-Zone: {coverage.skip_zone.inner_km}-{coverage.skip_zone.outer_km} km</div>
                      )}
                    </>
                  ) : (
                    <>
                      {coverage.los_km != null && <div>LOS: {coverage.los_km} km</div>}
                      {coverage.diffraction_km != null && coverage.diffraction_km > 0 && (
                        <div className="text-blue-600">+ Beugung: {coverage.diffraction_km} km</div>
                      )}
                      {coverage.troposcatter_km != null && coverage.troposcatter_km > 0 && (
                        <div className="text-cyan-600">+ Troposcatter: {coverage.troposcatter_km} km</div>
                      )}
                      <div>Gelände-blockiert: {coverage.terrain_blocked_count || 0} Richtungen</div>
                    </>
                  )}
                  <div>Höhe: {coverage.elevation_m != null ? `${Math.round(coverage.elevation_m)} m` : "unbekannt"}</div>
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