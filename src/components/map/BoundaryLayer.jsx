import React, { memo } from "react";
import { Circle } from "react-leaflet";

// Renders boundary circles for reference points where the user toggled
// "Grenze anzeigen" in the popup. Default radius per layer type:
// SOTA = 50m (activation zone), POTA = 500m (park area), WWFF = 500m (reserve).
// The boundary is a visual approximation — actual GeoJSON park boundaries
// are not stored in the entity; this gives users a quick area indication.

const DEFAULT_RADIUS_M = {
  sota: 50,
  pota: 500,
  hbff: 500,
  wwbota: 1000,
  castle: 200,
  iota: 1000,
  lighthouse: 100,
  llota: 200,
};

const BOUNDARY_COLORS = {
  sota: "#e74c3c",
  pota: "#27ae60",
  hbff: "#8e44ad",
  wwbota: "#795548",
  castle: "#e67e22",
  iota: "#3498db",
  lighthouse: "#dc2626",
  llota: "#0ea5e9",
};

function BoundaryLayerInner({ boundaryPoints }) {
  if (!boundaryPoints || boundaryPoints.length === 0) return null;

  return (
    <>
      {boundaryPoints.map((bp) => {
        const { data, layerType, radiusOverride } = bp;
        if (data.lat == null || data.lng == null) return null;
        const radius = radiusOverride || DEFAULT_RADIUS_M[layerType] || 200;
        const color = BOUNDARY_COLORS[layerType] || "#6b7280";
        const key = `${layerType}-${data.code || data.reference || data.id || ""}`;
        return (
          <Circle
            key={key}
            center={[data.lat, data.lng]}
            radius={radius}
            pathOptions={{
              color: color,
              weight: 2,
              fillColor: color,
              fillOpacity: 0.1,
              dashArray: "6 4",
            }}
          />
        );
      })}
    </>
  );
}

function arePropsEqual(prev, next) {
  return prev.boundaryPoints === next.boundaryPoints;
}

const BoundaryLayer = memo(BoundaryLayerInner, arePropsEqual);
export default BoundaryLayer;