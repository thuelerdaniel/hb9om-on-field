import React, { memo } from "react";
import { Circle, Polygon } from "react-leaflet";
import { expandPolygon } from "@/lib/polygonBuffer";

// Renders boundary circles for reference points where the user toggled
// "Grenze anzeigen" in the popup. Default radius per layer type:
// SOTA = 50m (activation zone), POTA = 500m (park area), WWFF = 500m (reserve).
//
// Polygon support (rendered instead of a circle when available):
//   - LLOTA: lake outline from SwissTopo/OSM + 200m buffer (activation zone)
//   - POTA (Switzerland): BLN protected area boundary from SwissTopo (no buffer —
//     the official BLN boundary IS the activation zone)
// While loading (or if fetch fails), the default circle is shown as fallback.

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

// LLOTA activation zone: lake outline + 200m buffer from shore
const LLOTA_BUFFER_M = 200;

function BoundaryLayerInner({ boundaryPoints }) {
  if (!boundaryPoints || boundaryPoints.length === 0) return null;

  return (
    <>
      {boundaryPoints.map((bp) => {
        const { data, layerType, radiusOverride, polygon, polygonLoading } = bp;
        const color = BOUNDARY_COLORS[layerType] || "#6b7280";
        const key = `${layerType}-${data.code || data.reference || data.id || ""}`;

        // Any layer with a polygon: render the polygon
        if (polygon && polygon.length > 2) {
          // LLOTA: lake outline + 200m buffer
          if (layerType === "llota") {
            const bufferPolygon = expandPolygon(polygon, LLOTA_BUFFER_M);
            return (
              <React.Fragment key={key}>
                <Polygon
                  positions={polygon}
                  pathOptions={{
                    color: color,
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.25,
                  }}
                />
                <Polygon
                  positions={bufferPolygon}
                  pathOptions={{
                    color: color,
                    weight: 1.5,
                    fillColor: color,
                    fillOpacity: 0.08,
                    dashArray: "6 4",
                  }}
                />
              </React.Fragment>
            );
          }
          // POTA (BLN) and other polygon boundaries: render without buffer
          return (
            <Polygon
              key={key}
              positions={polygon}
              pathOptions={{
                color: color,
                weight: 2,
                fillColor: color,
                fillOpacity: 0.2,
                dashArray: "6 4",
              }}
            />
          );
        }

        // LLOTA without polygon (loading or fallback): render 200m circle
        if (layerType === "llota" && data.lat != null && data.lng != null) {
          return (
            <Circle
              key={key}
              center={[data.lat, data.lng]}
              radius={LLOTA_BUFFER_M}
              pathOptions={{
                color: color,
                weight: 2,
                fillColor: color,
                fillOpacity: polygonLoading ? 0.05 : 0.1,
                dashArray: "6 4",
              }}
            />
          );
        }

        // Other layers: render circle (existing behavior)
        if (data.lat == null || data.lng == null) return null;
        const radius = radiusOverride || DEFAULT_RADIUS_M[layerType] || 200;
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