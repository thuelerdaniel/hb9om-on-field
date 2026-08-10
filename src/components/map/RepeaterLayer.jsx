import React, { memo, useMemo } from "react";
import { CircleMarker, Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import RepeaterPopup from "@/components/map/RepeaterPopup";
import { getModeColor } from "@/lib/repeaterModes";

function RepeaterLayerInner({ repeaters, filterModes, searchQuery, showLinks, performanceMode }) {
  const map = useMap();

  // Filter repeaters by mode and search
  const filteredRepeaters = useMemo(() => {
    let result = repeaters;
    // Filter by mode (primary_mode must be in filterModes)
    if (filterModes && filterModes.length > 0) {
      result = result.filter(r => filterModes.includes(r.primary_mode));
    }
    // Filter by search query
    if (searchQuery && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.callsign || "").toLowerCase().includes(q) ||
        (r.location_name || "").toLowerCase().includes(q) ||
        String(r.frequency || "").includes(q)
      );
    }
    return result;
  }, [repeaters, filterModes, searchQuery]);

  // Build linking lines: group by callsign, draw lines between repeaters with same callsign at different bands
  const linkLines = useMemo(() => {
    if (!showLinks) return [];
    const byCallsign = new Map();
    for (const r of filteredRepeaters) {
      if (r.lat == null || r.lng == null) continue;
      if (!byCallsign.has(r.callsign)) byCallsign.set(r.callsign, []);
      byCallsign.get(r.callsign).push(r);
    }
    const lines = [];
    for (const [callsign, group] of byCallsign) {
      if (group.length < 2) continue;
      // Draw lines between all pairs in the group
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          lines.push({
            positions: [
              [group[i].lat, group[i].lng],
              [group[j].lat, group[j].lng],
            ],
            callsign,
          });
        }
      }
    }
    return lines;
  }, [filteredRepeaters, showLinks]);

  // Build a map of callsign → linked repeaters for popup
  const linkedByCallsign = useMemo(() => {
    const map = new Map();
    for (const r of filteredRepeaters) {
      if (!map.has(r.callsign)) map.set(r.callsign, []);
      map.get(r.callsign).push(r);
    }
    return map;
  }, [filteredRepeaters]);

  // Viewport culling
  const bounds = map.getBounds();
  const paddedBounds = bounds.pad(0.3);
  const visibleRepeaters = filteredRepeaters.filter(r =>
    r.lat != null && r.lng != null && paddedBounds.contains([r.lat, r.lng])
  );

  // Cap to prevent performance issues
  const MAX = 1000;
  const cappedRepeaters = visibleRepeaters.length > MAX ? visibleRepeaters.slice(0, MAX) : visibleRepeaters;

  // Filter link lines to only those within viewport
  const visibleLines = linkLines.filter(line =>
    paddedBounds.contains(line.positions[0]) || paddedBounds.contains(line.positions[1])
  );

  const isTouch = typeof navigator !== "undefined" && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  const circleRadius = performanceMode ? (isTouch ? 8 : 6) : (isTouch ? 10 : 8);
  const circleWeight = isTouch ? 3 : 2;

  return (
    <>
      {/* Linking lines */}
      {visibleLines.map((line, i) => (
        <Polyline
          key={`link-${i}`}
          positions={line.positions}
          pathOptions={{
            color: "#3b82f6",
            weight: 1.5,
            opacity: 0.5,
            dashArray: "4 4",
          }}
        />
      ))}

      {/* Repeater markers */}
      {cappedRepeaters.map((r, idx) => {
        const color = getModeColor(r.primary_mode);
        const linked = (linkedByCallsign.get(r.callsign) || [])
          .filter(lr => lr.frequency !== r.frequency || lr.band !== r.band)
          .map(lr => `${lr.callsign} ${lr.frequency.toFixed(4)} MHz (${lr.band})`);
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
              <RepeaterPopup repeater={r} linkedRepeaters={linked} />
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
    prev.performanceMode === next.performanceMode
  );
}

const RepeaterLayer = memo(RepeaterLayerInner, arePropsEqual);
export default RepeaterLayer;