import React, { memo, useState, useMemo } from "react";
import { Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Anchor, Radio } from "lucide-react";
import { getMarkerSvg } from "@/lib/markerShapes";

// 3-color system for lighthouse markers:
// - Red (#dc2626): ILLW active (illw_active = true) — larger, highlighted
// - Blue (#3b82f6): ILLW registered but not active — normal size
// - Amber (#f59e0b): Non-ILLW lighthouse — standard color
const COLORS = {
  active: "#dc2626",
  registered: "#3b82f6",
  standard: "#f59e0b",
};

// Cache icons per (color, isActive)
const iconCache = new Map();

function getLighthouseIcon(color, isActive) {
  const key = `${color}:${isActive}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = isActive ? 34 : 28;
    const svg = getMarkerSvg("lighthouse", color);
    const glow = isActive
      ? "filter: drop-shadow(0 0 6px rgba(220,38,38,0.8));"
      : "filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5));";
    icon = L.divIcon({
      html: `<div style="width: ${size}px; height: ${size}px; ${glow}">${svg}</div>`,
      className: "shape-marker-icon",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2 + 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function LighthousePopup({ lighthouse, illwStatus }) {
  const illwNumber = lighthouse.code || lighthouse.illw_number;
  const status = illwNumber ? illwStatus[illwNumber] : null;
  const isActive = status?.illw_active;
  const callsign = status?.illw_callsign;
  const yearActive = status?.illw_year_active;
  const currentYear = new Date().getFullYear();

  const color = isActive ? COLORS.active : (illwNumber ? COLORS.registered : COLORS.standard);

  return (
    <div className="p-1 min-w-[200px]">
      <div className="flex items-center gap-1.5 mb-2">
        <Anchor className="w-4 h-4 flex-shrink-0" style={{ color }} />
        <h3 className="font-bold text-sm text-gray-900 break-words">{lighthouse.name}</h3>
      </div>

      {illwNumber && (
        <div className="space-y-1.5 text-xs">
          {isActive ? (
            <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
              <p className="font-bold text-red-700 flex items-center gap-1">
                <Radio className="w-3 h-3" /> ILLW {yearActive || currentYear} AKTIV
              </p>
              {callsign && <p className="text-red-600 mt-0.5">Callsign: {callsign}</p>}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5">
              <p className="font-medium text-blue-700">ILLW-Leuchtturm (nicht aktiv {currentYear})</p>
              <p className="text-blue-500 text-[10px] mt-0.5">Offizieller ILLW-Leuchtturm, keine Anmeldung {currentYear}</p>
            </div>
          )}
          <p className="text-gray-600">ILLW-No: <span className="font-mono font-bold">{illwNumber}</span></p>
          {lighthouse.country && <p className="text-gray-600">Land: {lighthouse.country}</p>}
          <p className="text-gray-400 text-[10px]">
            {(lighthouse.lat ?? 0).toFixed(4)}, {(lighthouse.lng ?? 0).toFixed(4)}
          </p>
        </div>
      )}

      {!illwNumber && (
        <div className="text-xs text-gray-500 space-y-0.5">
          <p>Leuchtturm ohne ILLW-Bezug</p>
          {lighthouse.country && <p>Land: {lighthouse.country}</p>}
          <p className="text-gray-400 text-[10px]">
            {(lighthouse.lat ?? 0).toFixed(4)}, {(lighthouse.lng ?? 0).toFixed(4)}
          </p>
        </div>
      )}
    </div>
  );
}

function LighthouseLayerInner({
  lighthouses,
  illwStatus,
  performanceMode,
  searchQuery,
  filterCountries,
  onlyIllwActive,
  illwYear,
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  // Filter lighthouses by search, country, and ILLW-active filter
  const filteredLighthouses = useMemo(() => {
    let result = lighthouses;

    // ILLW-active filter
    if (onlyIllwActive) {
      result = result.filter((l) => {
        const illwNo = l.code || l.illw_number;
        if (!illwNo) return false;
        const status = illwStatus[illwNo];
        if (!status?.illw_active) return false;
        if (illwYear && status.illw_year_active !== illwYear) return false;
        return true;
      });
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(q) ||
          (l.code || l.illw_number || "").toLowerCase().includes(q) ||
          (l.country || "").toLowerCase().includes(q)
      );
    }

    // Country filter
    if (filterCountries.length > 0) {
      result = result.filter((l) => filterCountries.includes(l.country_code));
    }

    return result;
  }, [lighthouses, illwStatus, onlyIllwActive, illwYear, searchQuery, filterCountries]);

  // Zoom-based visibility:
  // - ILLW active: always visible (even at zoom < 8)
  // - ILLW registered: visible from zoom 8
  // - Non-ILLW: visible from zoom 10
  const visibleLighthouses = useMemo(() => {
    return filteredLighthouses.filter((l) => {
      const illwNo = l.code || l.illw_number;
      const status = illwNo ? illwStatus[illwNo] : null;
      const isActive = status?.illw_active;
      const hasIllw = !!illwNo;

      if (isActive) return true;
      if (hasIllw) return zoom >= 8;
      return zoom >= 10;
    });
  }, [filteredLighthouses, illwStatus, zoom]);

  // Render
  if (performanceMode) {
    const isTouch =
      typeof navigator !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    const radius = isTouch ? 10 : 7;
    const weight = isTouch ? 3 : 2;
    return (
      <>
        {visibleLighthouses.map((l, idx) => {
          const illwNo = l.code || l.illw_number;
          const status = illwNo ? illwStatus[illwNo] : null;
          const isActive = status?.illw_active;
          const hasIllw = !!illwNo;
          const color = isActive
            ? COLORS.active
            : hasIllw
            ? COLORS.registered
            : COLORS.standard;
          return (
            <CircleMarker
              key={`lh-${illwNo || idx}`}
              center={[l.lat, l.lng]}
              radius={isActive ? radius + 2 : radius}
              pathOptions={{
                color: "#ffffff",
                weight,
                fillColor: color,
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <LighthousePopup lighthouse={l} illwStatus={illwStatus} />
              </Popup>
            </CircleMarker>
          );
        })}
      </>
    );
  }

  return (
    <>
      {visibleLighthouses.map((l, idx) => {
        const illwNo = l.code || l.illw_number;
        const status = illwNo ? illwStatus[illwNo] : null;
        const isActive = status?.illw_active;
        const hasIllw = !!illwNo;
        const color = isActive
          ? COLORS.active
          : hasIllw
          ? COLORS.registered
          : COLORS.standard;
        return (
          <Marker
            key={`lh-${illwNo || idx}`}
            position={[l.lat, l.lng]}
            icon={getLighthouseIcon(color, isActive)}
          >
            <Popup>
              <LighthousePopup lighthouse={l} illwStatus={illwStatus} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

const LighthouseLayer = memo(LighthouseLayerInner);
export default LighthouseLayer;