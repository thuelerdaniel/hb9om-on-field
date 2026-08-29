import React, { useMemo } from "react";
import { Circle, LayerGroup } from "react-leaflet";
import { useMap } from "react-leaflet";

// Activity Zone Overlays — draws configurable radius circles around reference points.
// Shows activation zones for SOTA, POTA, WCA, IOTA, TOTA as semi-transparent circles.
// Only renders for the first N markers in viewport to keep performance reasonable.

const ZONE_COLORS = {
  sota: { fill: "#e74c3c", opacity: 0.08, stroke: 0.25 },
  pota: { fill: "#27ae60", opacity: 0.08, stroke: 0.25 },
  castle: { fill: "#e67e22", opacity: 0.08, stroke: 0.25 },
  iota: { fill: "#3498db", opacity: 0.08, stroke: 0.25 },
  tota: { fill: "#f97316", opacity: 0.08, stroke: 0.25 },
};

const DEFAULT_RADIUS_M = 1000; // 1 km default activation zone radius
const MAX_ZONES = 500; // cap to prevent performance issues

export default function ActivityZoneLayer({ markers, activeLayers, zoneRadiusKm }) {
  const map = useMap();
  const radiusM = (zoneRadiusKm || 1) * 1000;

  // Filter markers to those with zone support and active layers
  const zoneMarkers = useMemo(() => {
    const zoneTypes = ["sota", "pota", "castle", "iota", "tota"];
    const active = zoneTypes.filter(t => activeLayers.includes(t));
    if (active.length === 0) return [];

    const bounds = map.getBounds().pad(0.1);
    return markers
      .filter(m => active.includes(m.layerType) && m.lat != null && m.lng != null)
      .filter(m => bounds.contains([m.lat, m.lng]))
      .slice(0, MAX_ZONES);
  }, [markers, activeLayers, map]);

  if (zoneMarkers.length === 0) return null;

  return (
    <LayerGroup>
      {zoneMarkers.map((m, i) => {
        const cfg = ZONE_COLORS[m.layerType] || ZONE_COLORS.sota;
        return (
          <Circle
            key={`${m.layerType}-${m.code || m.id || i}`}
            center={[m.lat, m.lng]}
            radius={radiusM}
            pathOptions={{
              color: cfg.fill,
              fillColor: cfg.fill,
              fillOpacity: cfg.opacity,
              opacity: cfg.stroke,
              weight: 1,
            }}
          />
        );
      })}
    </LayerGroup>
  );
}