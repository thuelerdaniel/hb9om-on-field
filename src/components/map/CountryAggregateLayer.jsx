import React, { memo, useState, useMemo, useCallback } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Zoom-based aggregation: when zoomed out (zoom < AGGREGATE_THRESHOLD), shows
// country-level badges with marker counts instead of thousands of individual
// markers. Dramatically improves render performance at wide zoom levels.
//
// Groups markers by country_code, computes centroid, shows a colored badge
// with the count. Clicking a badge zooms in to that country.

const AGGREGATE_THRESHOLD = 6;

// Layer colors (matches LAYER_COLORS in Home.jsx)
const LAYER_COLORS = {
  sota: "#e74c3c", pota: "#27ae60", hbff: "#8e44ad", wwbota: "#795548",
  castle: "#e67e22", iota: "#3498db", lighthouse: "#dc2626",
  tota: "#f97316", repeater: "#3b82f6", aprs: "#f59e0b", brandmeister: "#e11d48",
};

// Cache divIcons per (countryCode, count, color) — creating L.divIcon for every badge is expensive
const badgeIconCache = new Map();

function getBadgeIcon(count, color, countryCode) {
  // Bucket the count to increase cache hits — exact count doesn't matter for icon size
  const bucket = count < 50 ? "s" : count < 200 ? "m" : count < 1000 ? "l" : "xl";
  const key = `${countryCode}:${bucket}:${color}`;
  let icon = badgeIconCache.get(key);
  if (!icon) {
    const size = bucket === "s" ? 32 : bucket === "m" ? 38 : bucket === "l" ? 44 : 52;
    const fontSize = bucket === "s" ? 11 : bucket === "m" ? 12 : bucket === "l" ? 14 : 16;
    icon = L.divIcon({
      html: `<div style="
        width: ${size}px; height: ${size}px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center;
        font-size: ${fontSize}px; font-weight: 700; color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        font-family: ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
      ">${count > 999 ? Math.floor(count / 1000) + "k" : count}</div>`,
      className: "country-aggregate-badge",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    badgeIconCache.set(key, icon);
  }
  return icon;
}

function CountryAggregateLayerInner({ markers, extraMarkers, activeLayers }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  const updateZoom = useCallback(() => {
    setZoom(map.getZoom());
  }, [map]);

  useMapEvents({
    zoomend: updateZoom,
  });

  // Merge extra markers (e.g. TOTA points from TotaLayer) into the main markers array
  const allMarkers = useMemo(() => {
    if (!extraMarkers || extraMarkers.length === 0) return markers || [];
    return [...(markers || []), ...extraMarkers];
  }, [markers, extraMarkers]);

  // Group markers by country_code when zoomed out
  const countryBatches = useMemo(() => {
    if (zoom >= AGGREGATE_THRESHOLD) return [];
    if (!allMarkers || allMarkers.length === 0) return [];

    const groups = {};
    for (const m of allMarkers) {
      if (m.lat == null || m.lng == null) continue;
      const cc = m.country_code || (m.code || "").split(/[/ -]/)[0] || "?";
      if (!groups[cc]) {
        groups[cc] = { code: cc, latSum: 0, lngSum: 0, count: 0, typeCounts: {} };
      }
      groups[cc].latSum += m.lat;
      groups[cc].lngSum += m.lng;
      groups[cc].count++;
      const lt = m.layerType || "other";
      groups[cc].typeCounts[lt] = (groups[cc].typeCounts[lt] || 0) + 1;
    }

    // Compute centroid + dominant color per country
    return Object.values(groups).map(g => {
      const lat = g.latSum / g.count;
      const lng = g.lngSum / g.count;
      // Find dominant layer type for color
      let dominantType = "other";
      let maxCount = 0;
      for (const [type, count] of Object.entries(g.typeCounts)) {
        if (count > maxCount && LAYER_COLORS[type]) {
          maxCount = count;
          dominantType = type;
        }
      }
      const color = LAYER_COLORS[dominantType] || "#6b7280";
      return { code: g.code, lat, lng, count: g.count, color, typeCounts: g.typeCounts };
    }).sort((a, b) => b.count - a.count);
  }, [allMarkers, zoom]);

  // Don't render anything when zoomed in — individual markers take over
  if (zoom >= AGGREGATE_THRESHOLD || countryBatches.length === 0) return null;

  return (
    <>
      {countryBatches.map(g => (
        <Marker
          key={`agg-${g.code}`}
          position={[g.lat, g.lng]}
          icon={getBadgeIcon(g.count, g.color, g.code)}
          eventHandlers={{
            click: () => {
              map.flyTo([g.lat, g.lng], 7, { duration: 0.8 });
            },
          }}
        />
      ))}
    </>
  );
}

function arePropsEqual(prev, next) {
  return prev.markers === next.markers && prev.extraMarkers === next.extraMarkers && prev.activeLayers === next.activeLayers;
}

const CountryAggregateLayer = memo(CountryAggregateLayerInner, arePropsEqual);
export default CountryAggregateLayer;
export { AGGREGATE_THRESHOLD };