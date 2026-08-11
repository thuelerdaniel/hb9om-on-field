import React, { useMemo } from "react";
import { CircleMarker, Popup, useMap } from "react-leaflet";
import { RadioTower, Signal, Building, Zap } from "lucide-react";

// Colors for TOTA types
const TOTA_COLORS = {
  antenna: "#8b5cf6", // purple — antennas
  tower: "#f97316",   // orange — lookout towers
};

// TOTA type labels
const TOTA_TYPE_LABELS = {
  antenna: "Antenne",
  tower: "Turm / Aussichtsturm",
};

// TOTA type icons (lucide)
const TOTA_TYPE_ICONS = {
  antenna: Signal,
  tower: RadioTower,
};

function formatCoords(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function TotaLayer({
  points,
  filterTypes,
  searchQuery,
  performanceMode,
  userPosition,
}) {
  const map = useMap();

  // Filter points by type and search query
  const filteredPoints = useMemo(() => {
    let result = points;
    // null or all = no filter; array = filter by selected types
    if (filterTypes && filterTypes.length === 0) return [];
    if (filterTypes && filterTypes.length > 0) {
      result = result.filter((p) => filterTypes.includes(p.type));
    }
    if (searchQuery && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q) ||
          (p.subtype || "").toLowerCase().includes(q) ||
          (p.usage || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [points, filterTypes, searchQuery]);

  // Viewport bounds filtering — only render markers within the current viewport
  const visiblePoints = useMemo(() => {
    if (!map) return filteredPoints;
    const bounds = map.getBounds();
    return filteredPoints.filter(
      (p) =>
        p.lat >= bounds.getSouth() &&
        p.lat <= bounds.getNorth() &&
        p.lng >= bounds.getWest() &&
        p.lng <= bounds.getEast()
    );
  }, [filteredPoints, map]);

  if (visiblePoints.length === 0) return null;

  return (
    <>
      {visiblePoints.map((point, idx) => {
        const color = TOTA_COLORS[point.type] || "#6b7280";
        const Icon = TOTA_TYPE_ICONS[point.type] || Building;

        return (
          <CircleMarker
            key={point.id || idx}
            center={[point.lat, point.lng]}
            radius={performanceMode ? 4 : 6}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.7,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1.5 min-w-[180px]">
                <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900 border-b pb-1.5 mb-1.5">
                  <Icon className="w-4 h-4" style={{ color }} />
                  {point.name || point.code}
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Typ:</span>
                  <span style={{ color }} className="font-medium">
                    {TOTA_TYPE_LABELS[point.type] || point.type}
                  </span>
                </div>
                {point.code && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 font-medium">Ref:</span>
                    <span className="font-mono text-gray-900">{point.code}</span>
                  </div>
                )}
                {point.subtype && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 font-medium">Kategorie:</span>
                    <span className="text-gray-900">{point.subtype}</span>
                  </div>
                )}
                {point.usage && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 font-medium">Nutzung:</span>
                    <span className="text-gray-900">{point.usage}</span>
                  </div>
                )}
                {point.country && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 font-medium">Land:</span>
                    <span className="text-gray-900">{point.country}</span>
                  </div>
                )}
                {point.locator && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 font-medium">Locator:</span>
                    <span className="font-mono text-gray-900">{point.locator}</span>
                  </div>
                )}
                {point.height_m != null && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 font-medium">Höhe:</span>
                    <span className="text-gray-900">{point.height_m} m</span>
                  </div>
                )}
                {point.spot_height_m != null && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 font-medium">Standort:</span>
                    <span className="text-gray-900">{point.spot_height_m} m ü.M.</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Quelle:</span>
                  <span className="text-gray-900">
                    {point.source === 'swiss_csv' ? 'Schweiz (CSV)' : 'wwtota.com'}
                  </span>
                </div>
                <div className="text-gray-400 text-[10px] pt-1 border-t">
                  {formatCoords(point.lat, point.lng)}
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-white bg-blue-600 rounded-lg px-2 py-1 text-xs font-medium hover:bg-blue-700 mt-1.5"
                >
                  Navigation
                </a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}