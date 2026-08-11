import React, { memo, useMemo } from "react";
import { CircleMarker, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { Radio, Globe, Signal, Network, MapPin, Navigation, Hash } from "lucide-react";
import { APRS_SYMBOLS } from "@/lib/aprsSymbols";

const NODE_TYPE_LABELS = {
  repeater_node: "Digipeater / Relais",
  echolink_node: "IGate / EchoLink",
  allstar_node: "AllStar Node",
  weather_station: "Wetterstation",
  hotspot: "Hotspot / Home",
  simplex_node: "Simplex Node",
  mobile: "Mobile (diverse)",
  car: "Auto / Fahrzeug",
  bike: "Fahrrad / Moto",
  boat: "Boot / Schiff",
  aircraft: "Flugzeug / Heli",
  walker: "Fussgänger",
  other: "Sonstiges",
};

const NODE_COLORS = {
  repeater_node: "#3b82f6",
  echolink_node: "#6366f1",
  allstar_node: "#f59e0b",
  weather_station: "#10b981",
  hotspot: "#8b5cf6",
  simplex_node: "#0ea5e9",
  mobile: "#ec4899",
  car: "#ef4444",
  bike: "#f97316",
  boat: "#06b6d4",
  aircraft: "#7c3aed",
  walker: "#84cc16",
  other: "#6b7280",
};

// BrandMeister DMR color scheme — distinct from APRS to visually separate the two systems.
// Teal/cyan tones represent the DMR network (BrandMeister) vs purple/multi-color for APRS.
const BM_COLORS = {
  repeater_node: "#14b8a6",
  hotspot: "#0891b2",
  other: "#64748b",
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function PrivateNodePopup({ node, userPosition, colorScheme }) {
  const hasCoords = node.lat != null && node.lng != null;
  const navUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${node.lat},${node.lng}`
    : null;
  const distance = hasCoords && userPosition
    ? haversineKm(userPosition[0], userPosition[1], node.lat, node.lng)
    : null;
  const colorMap = colorScheme === "brandmeister" ? BM_COLORS : NODE_COLORS;
  const color = colorMap[node.node_type] || colorMap.other;
  const typeLabel = NODE_TYPE_LABELS[node.node_type] || "Node";

  return (
    <div className="text-xs min-w-[200px] max-w-[260px]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" style={{ color }} />
            {node.callsign}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{node.location_name}</div>
          {node.country && (
            <div className="text-[10px] text-gray-400 mt-0.5">{node.country}</div>
          )}
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ color, backgroundColor: color + "15" }}>
          {typeLabel}
        </span>
      </div>

      {node.network && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600 mb-1.5 bg-gray-50 rounded px-1.5 py-1">
          <Network className="w-3 h-3" />
          <span>Netzwerk: <span className="font-medium">{node.network}</span></span>
        </div>
      )}

      {node.node_number && (
        <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 mb-1.5">
          <Hash className="w-3 h-3" />
          <span>Node: <span className="font-mono font-medium">{node.node_number}</span></span>
        </div>
      )}

      {node.frequency > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600 mb-1.5">
          <Signal className="w-3 h-3" />
          <span className="font-mono">{node.frequency.toFixed(4)} MHz</span>
          {node.mode && <span className="text-gray-400">· {node.mode}</span>}
        </div>
      )}

      {node.description && (
        <p className="text-[11px] text-gray-500 mb-2">{node.description}</p>
      )}

      {distance != null && (
        <div className="flex items-center gap-1 text-[11px] text-blue-600 mb-1.5 bg-blue-50 rounded px-1.5 py-1">
          <MapPin className="w-3 h-3" />
          <span>Entfernung: <span className="font-bold">{formatDistance(distance)}</span></span>
        </div>
      )}

      {navUrl && (
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Navigation className="w-3 h-3" />
          Navigieren (Google Maps)
        </a>
      )}

      <div className="text-[9px] text-gray-300 mt-2 pt-1 border-t border-gray-100">
        Quelle: {node.source || "RepeaterBook"}
      </div>
    </div>
  );
}

function PrivateNodeLayerInner({ nodes, performanceMode, userPosition, filterTypes, searchQuery, sourceFilter, colorScheme }) {
  const map = useMap();
  const isTouch = typeof navigator !== "undefined" && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  const circleRadius = performanceMode ? (isTouch ? 7 : 5) : (isTouch ? 9 : 7);
  const circleWeight = isTouch ? 3 : 2;
  const colorMap = colorScheme === "brandmeister" ? BM_COLORS : NODE_COLORS;

  const visibleNodes = useMemo(() => {
    let result = nodes.filter(n => n.lat != null && n.lng != null);
    // Filter by source (e.g. "aprs.fi" for APRS layer, "brandmeister" for BrandMeister layer)
    if (sourceFilter) {
      const filters = Array.isArray(sourceFilter) ? sourceFilter : [sourceFilter];
      result = result.filter(n => {
        const src = (n.source || "").toLowerCase();
        return filters.some(f => src.includes(f.toLowerCase()));
      });
    }
    // Filter by node type (null = all types, empty array = none, array = selected types only)
    if (filterTypes && filterTypes.length === 0) return [];
    if (filterTypes && filterTypes.length > 0) {
      result = result.filter(n => filterTypes.includes(n.node_type));
    }
    // Filter by search query
    if (searchQuery && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        (n.callsign || "").toLowerCase().includes(q) ||
        (n.location_name || "").toLowerCase().includes(q) ||
        (n.network || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [nodes, filterTypes, searchQuery, sourceFilter]);

  // Viewport culling — only render nodes within the current map bounds (padded)
  const bounds = map.getBounds();
  const paddedBounds = bounds.pad(0.3);
  const cappedNodes = visibleNodes.filter(n => paddedBounds.contains([n.lat, n.lng]));

  const MAX = 2000;
  const renderNodes = cappedNodes.length > MAX ? cappedNodes.slice(0, MAX) : cappedNodes;

  // Custom SVG icon for private nodes — square with double lightning bolt
  // Cached per color to avoid re-creating L.divIcon on every render
  const iconCache = useMemo(() => new Map(), []);
  const getNodeIcon = (nodeType, color) => {
    const cacheKey = `${nodeType}:${color}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
    const symbol = APRS_SYMBOLS[nodeType] || APRS_SYMBOLS.other;
    const icon = L.divIcon({
      className: "private-node-marker-icon",
      html: `<div style="width:28px;height:28px;">${symbol.svg(color)}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    iconCache.set(cacheKey, icon);
    return icon;
  };

  return (
    <>
      {renderNodes.map((n, idx) => {
        const color = colorMap[n.node_type] || colorMap.other;
        const popup = (
          <Popup>
            <PrivateNodePopup node={n} userPosition={userPosition} colorScheme={colorScheme} />
          </Popup>
        );
        if (performanceMode) {
          return (
            <CircleMarker
              key={`pn-${n.id || idx}`}
              center={[n.lat, n.lng]}
              radius={circleRadius}
              pathOptions={{
                color: "#ffffff",
                weight: circleWeight,
                fillColor: color,
                fillOpacity: 0.85,
              }}
            >
              {popup}
            </CircleMarker>
          );
        }
        return (
          <Marker
            key={`pn-${n.id || idx}`}
            position={[n.lat, n.lng]}
            icon={getNodeIcon(n.node_type, color)}
          >
            {popup}
          </Marker>
        );
      })}
    </>
  );
}

function arePropsEqual(prev, next) {
  return prev.nodes === next.nodes &&
    prev.performanceMode === next.performanceMode &&
    prev.userPosition === next.userPosition &&
    prev.filterTypes === next.filterTypes &&
    prev.searchQuery === next.searchQuery &&
    prev.sourceFilter === next.sourceFilter &&
    prev.colorScheme === next.colorScheme;
}

const PrivateNodeLayer = memo(PrivateNodeLayerInner, arePropsEqual);
export default PrivateNodeLayer;
export { NODE_COLORS, NODE_TYPE_LABELS, BM_COLORS };