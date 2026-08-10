import React, { memo, useMemo } from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { Radio, Globe, Signal, Network, MapPin, Navigation, Hash } from "lucide-react";

const NODE_TYPE_LABELS = {
  hotspot: "Hotspot",
  simplex_node: "Simplex Node",
  repeater_node: "Repeater Node",
  allstar_node: "AllStar Node",
  echolink_node: "EchoLink Node",
  other: "Node",
};

const NODE_COLORS = {
  hotspot: "#8b5cf6",
  simplex_node: "#0ea5e9",
  repeater_node: "#3b82f6",
  allstar_node: "#f59e0b",
  echolink_node: "#6366f1",
  other: "#6b7280",
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

function PrivateNodePopup({ node, userPosition }) {
  const hasCoords = node.lat != null && node.lng != null;
  const navUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${node.lat},${node.lng}`
    : null;
  const distance = hasCoords && userPosition
    ? haversineKm(userPosition[0], userPosition[1], node.lat, node.lng)
    : null;
  const color = NODE_COLORS[node.node_type] || NODE_COLORS.other;
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

function PrivateNodeLayerInner({ nodes, performanceMode, userPosition }) {
  const isTouch = typeof navigator !== "undefined" && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  const circleRadius = performanceMode ? (isTouch ? 7 : 5) : (isTouch ? 9 : 7);
  const circleWeight = isTouch ? 3 : 2;

  const visibleNodes = useMemo(() => {
    return nodes.filter(n => n.lat != null && n.lng != null);
  }, [nodes]);

  return (
    <>
      {visibleNodes.map((n, idx) => {
        const color = NODE_COLORS[n.node_type] || NODE_COLORS.other;
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
            <Popup>
              <PrivateNodePopup node={n} userPosition={userPosition} />
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function arePropsEqual(prev, next) {
  return prev.nodes === next.nodes &&
    prev.performanceMode === next.performanceMode &&
    prev.userPosition === next.userPosition;
}

const PrivateNodeLayer = memo(PrivateNodeLayerInner, arePropsEqual);
export default PrivateNodeLayer;
export { NODE_COLORS, NODE_TYPE_LABELS };