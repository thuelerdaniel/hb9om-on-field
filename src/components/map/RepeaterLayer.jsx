import React, { memo, useMemo, useRef, useEffect } from "react";
import { CircleMarker, Polyline, Popup, useMap, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import RepeaterPopup from "@/components/map/RepeaterPopup";
import { getModeColor, repeaterMatchesMode, FILTER_MODES, FEATURE_MODES } from "@/lib/repeaterModes";
import { getMarkerSvg } from "@/lib/markerShapes";
import { isInContinents } from "@/lib/continents";
import { isInCountries, getCountriesByContinent } from "@/lib/countries";

// Approximate coverage radius (km) by band — based on typical VHF/UHF propagation
const COVERAGE_RADIUS_KM = {
  "10m": 80,
  "6m": 60,
  "4m": 50,
  "2m": 35,
  "70cm": 25,
  "23cm": 15,
  "Other": 30,
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const LINE_DASH_ARRAYS = {
  solid: undefined,
  dashed: "12 8",
  dotted: "3 6",
};

function RepeaterLayerInner({ repeaters, filterModes, searchQuery, showLinks, showCoverage, showOnlyLinked, performanceMode, filterCountry, userPosition, radiusKm, adminLinks, onSuggestLink, individualCoverage, onToggleCoverage, activeContinents, activeCountries, isAdmin }) {
  const map = useMap();

  // Filter repeaters by continent, country, mode, search, and radius
  const filteredRepeaters = useMemo(() => {
    let result = repeaters;
    // Apply LayerControl continent/country filter (same as other markers)
    if (activeContinents && activeContinents.length > 0) {
      result = result.filter(r => r.lat != null && r.lng != null && isInContinents(r.lat, r.lng, activeContinents));
    }
    if (activeCountries && activeCountries.length > 0) {
      result = result.filter(r => isInCountries({ ...r, layerType: 'repeater' }, activeCountries));
    }
    if (filterCountry && filterCountry !== "all") {
      if (filterCountry.startsWith("continent:")) {
        const contId = filterCountry.split(":")[1];
        const contCountries = getCountriesByContinent(contId).map(c => c.iso2);
        result = result.filter(r => contCountries.includes(r.country_code));
      } else {
        result = result.filter(r => r.country_code === filterCountry);
      }
    }
    // No modes selected = NO repeaters shown (user must actively choose at least one mode)
    if (!filterModes || filterModes.length === 0) {
      return [];
    }
    result = result.filter(r => filterModes.some(m => repeaterMatchesMode(r, m)));
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
    // Only linked repeaters filter — show only repeaters with actual crosslinks
    if (showOnlyLinked) {
      const linkedCallsigns = new Set();
      // From RepeaterBook crosslinks
      for (const r of result) {
        if (r.linked_callsigns && r.linked_callsigns.length > 0) {
          linkedCallsigns.add(r.callsign);
        }
      }
      // From admin-managed links
      if (adminLinks) {
        for (const l of adminLinks) {
          if (l.status === "approved" && l.link_type === "permanent") {
            linkedCallsigns.add(l.from_callsign);
            linkedCallsigns.add(l.to_callsign);
          }
        }
      }
      result = result.filter(r => linkedCallsigns.has(r.callsign));
    }
    return result;
  }, [repeaters, filterModes, searchQuery, filterCountry, radiusKm, userPosition, activeContinents, activeCountries, showOnlyLinked, adminLinks]);

  // Build callsign→repeaters map from ALL repeaters (not just filtered) so link lines
  // connect to targets even when the target is filtered out by mode/country/etc.
  const byCallsignAll = useMemo(() => {
    const map = new Map();
    for (const r of repeaters) {
      if (r.lat == null || r.lng == null) continue;
      if (!map.has(r.callsign)) map.set(r.callsign, []);
      map.get(r.callsign).push(r);
    }
    return map;
  }, [repeaters]);

  // Build linking lines from RepeaterBook crosslinks (linked_callsigns).
  // Lines are drawn FROM filtered (visible) repeaters TO any matching target in the full DB.
  const linkLines = useMemo(() => {
    if (!showLinks) return [];
    const lines = [];
    const drawn = new Set();
    for (const r of filteredRepeaters) {
      if (r.lat == null || r.lng == null) continue;
      if (!r.linked_callsigns || r.linked_callsigns.length === 0) continue;
      for (const linkedStr of r.linked_callsigns) {
        const linkedCall = String(linkedStr).split(/\s+/)[0].split('/')[0];
        const targets = byCallsignAll.get(linkedCall) || [];
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
  }, [filteredRepeaters, byCallsignAll, showLinks]);

  // Admin-managed links (from RepeaterLink entity, approved + permanent only).
  // Connects ALL repeaters with matching from_callsign to ALL with matching to_callsign,
  // so multiple repeaters sharing a callsign (different frequencies/locations) all get lines.
  const adminLinkLines = useMemo(() => {
    if (!showLinks || !adminLinks) return [];
    return adminLinks
      .filter(l => l.status === "approved" && l.link_type === "permanent")
      .flatMap(l => {
        const fromReps = byCallsignAll.get(l.from_callsign) || [];
        const toReps = byCallsignAll.get(l.to_callsign) || [];
        // Fallback: use stored coordinates if no matching repeaters in DB
        if (fromReps.length === 0 && toReps.length === 0 &&
            l.from_lat != null && l.from_lng != null && l.to_lat != null && l.to_lng != null) {
          return [{
            positions: [[l.from_lat, l.from_lng], [l.to_lat, l.to_lng]],
            color: l.color || "#3b82f6",
            lineStyle: l.line_style || "dashed",
          }];
        }
        // Draw lines between every from×to combination (deduped)
        const lines = [];
        const drawn = new Set();
        for (const fr of fromReps) {
          for (const tr of toReps) {
            if (fr.id === tr.id) continue;
            const key = [fr.id, tr.id].sort().join('→');
            if (drawn.has(key)) continue;
            drawn.add(key);
            lines.push({
              positions: [[fr.lat, fr.lng], [tr.lat, tr.lng]],
              color: l.color || "#3b82f6",
              lineStyle: l.line_style || "dashed",
            });
          }
        }
        return lines;
      });
  }, [adminLinks, showLinks, byCallsignAll]);

  // Dedicated SVG renderer for link lines — enables CSS animations (canvas renderer can't animate)
  const linkRenderer = useMemo(() => L.svg({ pane: 'overlayPane' }), []);

  // Animated link line: white halo + colored flowing dashes on SVG renderer.
  // Uses ref to add the CSS animation class (pathOptions.className is unreliable in react-leaflet).
  const AnimatedLinkLine = ({ positions, color, lineStyle }) => {
    const flowRef = useRef(null);
    useEffect(() => {
      if (flowRef.current) {
        const el = flowRef.current.getElement?.() || flowRef.current._path;
        if (el) el.classList.add('repeater-link-flow');
      }
    }, []);
    return (
      <>
        <Polyline
          positions={positions}
          renderer={linkRenderer}
          pathOptions={{ color: "#ffffff", weight: 7, opacity: 0.6, lineCap: "round" }}
        />
        <Polyline
          ref={flowRef}
          positions={positions}
          renderer={linkRenderer}
          pathOptions={{
            color,
            weight: 4.5,
            opacity: 0.95,
            dashArray: LINE_DASH_ARRAYS[lineStyle] || LINE_DASH_ARRAYS.dashed,
            lineCap: "round",
          }}
        />
      </>
    );
  };

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

  // Custom antenna-on-mountain icon for non-performance mode — cached per color
  const iconCache = useMemo(() => new Map(), []);
  const getRepeaterIcon = (color) => {
    if (iconCache.has(color)) return iconCache.get(color);
    const icon = L.divIcon({
      className: "repeater-marker-icon",
      html: `<div style="width:28px;height:28px;">${getMarkerSvg("repeater", color)}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    iconCache.set(color, icon);
    return icon;
  };

  return (
    <>
      {/* Coverage circles (approximate, based on band) — global toggle OR per-repeater */}
      {(showCoverage || (individualCoverage && individualCoverage.size > 0)) && cappedRepeaters.map((r, idx) => {
        const showThis = showCoverage || (individualCoverage && individualCoverage.has(r.id));
        if (!showThis) return null;
        const radiusKm = r.coverage_radius_km || COVERAGE_RADIUS_KM[r.band] || COVERAGE_RADIUS_KM["Other"];
        const color = getModeColor(r.primary_mode);
        // Opacity scales with refinement: 0% = 0.05, 100% = 0.25
        const refinementPct = r.coverage_refinement_pct || 0;
        const fillOpacity = r.status === "off-air"
          ? 0.02
          : 0.05 + (refinementPct / 100) * 0.20;
        return (
          <Circle
            key={`cov-${r.id || idx}`}
            center={[r.lat, r.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: color,
              weight: refinementPct >= 50 ? 1 : 0.5,
              opacity: 0.3 + (refinementPct / 100) * 0.3,
              fillColor: color,
              fillOpacity: fillOpacity,
            }}
          />
        );
      })}

      {/* Linking lines (RepeaterBook crosslinks + admin-managed) — animated flowing dashes on SVG renderer */}
      {visibleLines.map((line, i) => (
        <AnimatedLinkLine
          key={`link-${i}`}
          positions={line.positions}
          color={line.color}
          lineStyle={line.lineStyle}
        />
      ))}

      {/* Repeater markers — antenna icon in full mode, circle in performance mode */}
      {cappedRepeaters.map((r, idx) => {
        const color = getModeColor(r.primary_mode);
        const linked = r.linked_callsigns || [];
        const popup = (
          <Popup>
            <RepeaterPopup
              repeater={r}
              linkedRepeaters={linked}
              userPosition={userPosition}
              onSuggestLink={onSuggestLink}
              onToggleCoverage={onToggleCoverage}
              showCoverageForThis={individualCoverage && individualCoverage.has(r.id)}
              isAdmin={isAdmin}
            />
          </Popup>
        );
        if (performanceMode) {
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
              {popup}
            </CircleMarker>
          );
        }
        return (
          <Marker
            key={`rep-${r.id || idx}`}
            position={[r.lat, r.lng]}
            icon={getRepeaterIcon(color)}
          >
            {popup}
          </Marker>
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
    prev.showCoverage === next.showCoverage &&
    prev.showOnlyLinked === next.showOnlyLinked &&
    prev.performanceMode === next.performanceMode &&
    prev.filterCountry === next.filterCountry &&
    prev.userPosition === next.userPosition &&
    prev.radiusKm === next.radiusKm &&
    prev.adminLinks === next.adminLinks &&
    prev.onSuggestLink === next.onSuggestLink &&
    prev.individualCoverage === next.individualCoverage &&
    prev.onToggleCoverage === next.onToggleCoverage &&
    prev.activeContinents === next.activeContinents &&
    prev.activeCountries === next.activeCountries &&
    prev.isAdmin === next.isAdmin
  );
}

const RepeaterLayer = memo(RepeaterLayerInner, arePropsEqual);
export default RepeaterLayer;