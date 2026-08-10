import React, { memo, useMemo } from "react";
import { CircleMarker, Polyline, Popup, useMap, Marker } from "react-leaflet";
import L from "leaflet";
import RepeaterPopup from "@/components/map/RepeaterPopup";
import { getModeColor } from "@/lib/repeaterModes";
import { getMarkerSvg } from "@/lib/markerShapes";

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LINE_DASH_ARRAYS = {
  solid: undefined,
  dashed: "4 4",
  dotted: "1 4",
};

function RepeaterLayerInner({ repeaters, filterModes, searchQuery, showLinks, performanceMode, filterCountry, userPosition, radiusKm, adminLinks, onSuggestLink }) {
  const map = useMap();

  // Filter repeaters by mode, country, search, and radius
  const filteredRepeaters = useMemo(() => {
    let result = repeaters;
    if (filterCountry && filterCountry !== "all") {
      result = result.filter(r => r.country_code === filterCountry);
    }
    if (filterModes && filterModes.length > 0) {
      result = result.filter(r => filterModes.includes(r.primary_mode));
    }
    if (searchQuery && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.callsign || "").toLowerCase().includes(q) ||
        (r.location_name || "").toLowerCase().includes(q) ||
        (r.country || "").toLowerCase().includes(q) ||
        String(r.frequency || "").includes(q)
      );
    }
    // Radius filter from user position
    if (radiusKm && radiusKm > 0 && userPosition) {
      result = result.filter(r => {
        if (r.lat == null || r.lng == null) return false;
        return haversineKm(userPosition[0], userPosition[1], r.lat, r.lng) <= radiusKm;
      });
    }
    return result;
  }, [repeaters, filterModes, searchQuery, filterCountry, radiusKm, userPosition]);

  // Build linking lines from RepeaterBook crosslinks (linked_callsigns)
  const linkLines = useMemo(() => {
    if (!showLinks) return [];
    const byCallsign = new Map();
    for (const r of filteredRepeaters) {
      if (r.lat == null || r.lng == null) continue;
      if (!byCallsign.has(r.callsign)) byCallsign.set(r.callsign, []);
      byCallsign.get(r.callsign).push(r);
    }
    const lines = [];
    const drawn = new Set();
    for (const r of filteredRepeaters) {
      if (r.lat == null || r.lng == null) continue;
      if (!r.linked_callsigns || r.linked_callsigns.length === 0) continue;
      for (const linkedStr of r.linked_callsigns) {
        const linkedCall = linkedStr.split(/\s+/)[0].split('/')[0];
        const targets = byCallsign.get(linkedCall) || [];
        for (const target of targets) {
          if (target.callsign === r.callsign && target.frequency === r.frequency) continue;
          const key = [r.callsign + r.frequency, target.callsign + target.frequency].sort().join('→');
          if (drawn.has(key)) continue;
          drawn.add(key);
          lines.push({
            positions: [[r.lat, r.lng], [target.lat, target.lng]],
            color: "#3b82f6",
            lineStyle: "dashed",
          });
        }
      }
    }
    return lines;
  }, [filteredRepeaters, showLinks]);

  // Admin-managed links (from RepeaterLink entity, approved + permanent only)
  const adminLinkLines = useMemo(() => {
    if (!showLinks || !adminLinks) return [];
    return adminLinks
      .filter(l => l.status === "approved" && l.link_type === "permanent")
      .filter(l => l.from_lat != null && l.from_lng != null && l.to_lat != null && l.to_lng != null)
      .map(l => ({
        positions: [[l.from_lat, l.from_lng], [l.to_lat, l.to_lng]],
        color: l.color || "#3b82f6",
        lineStyle: l.line_style || "dashed",
      }));
  }, [adminLinks, showLinks]);

  const allLines = [...linkLines, ...adminLinkLines];

  // Viewport culling
  const bounds = map.getBounds();
  const paddedBounds = bounds.pad(0.3);
  const visibleRepeaters = filteredRepeaters.filter(r =>
    r.lat != null && r.lng != null && paddedBounds.contains([r.lat, r.lng])
  );

  const MAX = 1000;
  const cappedRepeaters = visibleRepeaters.length > MAX ? visibleRepeaters.slice(0, MAX) : visibleRepeaters;

  const visibleLines = allLines.filter(line =>
    paddedBounds.contains(line.positions[0]) || paddedBounds.contains(line.positions[1])
  );

  const isTouch = typeof navigator !== "undefined" && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  const circleRadius = performanceMode ? (isTouch ? 8 : 6) : (isTouch ? 10 : 8);
  const circleWeight = isTouch ? 3 : 2;

  // Custom antenna-on-mountain icon for non-performance mode
  const repeaterIcon = useMemo(() => {
    if (performanceMode) return null;
    return L.divIcon({
      className: "repeater-marker-icon",
      html: (color) => `<div style="width:24px;height:24px;">${getMarkerSvg("repeater", color)}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
  }, [performanceMode]);

  return (
    <>
      {/* Linking lines (RepeaterBook crosslinks + admin-managed) */}
      {visibleLines.map((line, i) => (
        <Polyline
          key={`link-${i}`}
          positions={line.positions}
          pathOptions={{
            color: line.color,
            weight: 1.5,
            opacity: 0.6,
            dashArray: LINE_DASH_ARRAYS[line.lineStyle] || LINE_DASH_ARRAYS.dashed,
          }}
        />
      ))}

      {/* Repeater markers */}
      {cappedRepeaters.map((r, idx) => {
        const color = getModeColor(r.primary_mode);
        const linked = r.linked_callsigns || [];
        return (
          <CircleMarker
            key={`rep-${r.id || idx}`}
            center={[r.lat, r.lng]}
            radius={circleRadius}
            pathOptions={{
              color: "#ffffff",
              weight: circleWeight,
              fillColor: color,
              fillOpacity: r.status === "off-air" ? 0.3 : 0.85,
            }}
          >
            <Popup>
              <RepeaterPopup repeater={r} linkedRepeaters={linked} userPosition={userPosition} onSuggestLink={onSuggestLink} />
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

function arePropsEqual(prev, next) {
  return (
    prev.repeaters === next.repeaters &&
    prev.filterModes === next.filterModes &&
    prev.searchQuery === next.searchQuery &&
    prev.showLinks === next.showLinks &&
    prev.performanceMode === next.performanceMode &&
    prev.filterCountry === next.filterCountry &&
    prev.userPosition === next.userPosition &&
    prev.radiusKm === next.radiusKm &&
    prev.adminLinks === next.adminLinks &&
    prev.onSuggestLink === next.onSuggestLink
  );
}

const RepeaterLayer = memo(RepeaterLayerInner, arePropsEqual);
export default RepeaterLayer;