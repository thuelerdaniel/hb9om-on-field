import React, { memo, useMemo, useRef, useEffect, useCallback, useState } from "react";
import { CircleMarker, Polyline, Popup, useMap, useMapEvents, Marker, Circle, Polygon } from "react-leaflet";
import L from "leaflet";
import RepeaterPopup from "@/components/map/RepeaterPopup";
import DraggablePopup from "@/components/map/DraggablePopup";
import CoveragePolygon, { CoverageCircle } from "@/components/map/CoveragePolygon";
import { getModeColor, repeaterMatchesMode, FILTER_MODES, FEATURE_MODES } from "@/lib/repeaterModes";
import { getMarkerSvg } from "@/lib/markerShapes";
import { isValidCoord } from "@/lib/geoUtilsFrontend";
import { isInContinents } from "@/lib/continents";
import { isInCountries, getCountriesByContinent } from "@/lib/countries";
import { AGGREGATE_THRESHOLD } from "@/components/map/CountryAggregateLayer";
// Shared filter pipeline — the same functions back the PDF export, so the PDF list
// always matches the markers drawn here.
import {
  filterRepeatersForDisplay,
  buildLinkSourceMap,
  isLinkDisplayable as isLinkDisplayableFor,
  parseLinkedString,
  linkKey,
  haversineKm,
  REPEATER_MAX_MARKERS,
  REPEATER_VIEWPORT_PADDING,
} from "@/lib/repeaterDisplayPipeline";

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

// haversineKm, linkKey, parseLinkedString and the filter pipeline live in
// src/lib/repeaterDisplayPipeline.js (shared with the PDF export).

const LINE_DASH_ARRAYS = {
  solid: undefined,
  dashed: "12 8",
  dotted: "3 6",
};

function RepeaterLayerInner({ repeaters, filterModes, exclusiveModes, searchQuery, showLinks, showCoverage, showOnlyLinked, performanceMode, filterCountries, userPosition, radiusKm, adminLinks, onSuggestLink, individualCoverage, onToggleCoverage, onRepeaterUpdate, activeContinents, activeCountries, isAdmin }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  // Link sources + displayability come from the shared display pipeline, so the map and
  // the PDF export judge "verlinkte Relais" identically.
  const linkSourceMap = useMemo(() => buildLinkSourceMap(repeaters, adminLinks), [repeaters, adminLinks]);

  const isLinkDisplayable = useCallback((key) => isLinkDisplayableFor(key, linkSourceMap), [linkSourceMap]);

  // Filter repeaters by continent, country, mode, search, radius and links.
  // Shared pipeline (src/lib/repeaterDisplayPipeline.js) — the SAME function backs the
  // PDF export, so the exported list always matches what is drawn here.
  const filteredRepeaters = useMemo(() => filterRepeatersForDisplay({
    repeaters,
    filterModes,
    exclusiveModes,
    searchQuery,
    filterCountries,
    activeContinents,
    activeCountries,
    radiusKm,
    userPosition,
    showOnlyLinked,
    adminLinks,
    linkSourceMap,
  }), [repeaters, filterModes, exclusiveModes, searchQuery, filterCountries, radiusKm, userPosition, activeContinents, activeCountries, showOnlyLinked, adminLinks, linkSourceMap]);

  // Build callsign→repeaters map from ALL repeaters (not just filtered) so link lines
  // connect to targets even when the target is filtered out by mode/country/etc.
  // Map from ALL repeaters — used for popup resolution (popup shows linked repeaters
  // even when the target is filtered out by mode/country/etc).
  const byCallsignAll = useMemo(() => {
    const map = new Map();
    for (const r of repeaters) {
      if (!isValidCoord(r.lat, r.lng)) continue;
      if (!map.has(r.callsign)) map.set(r.callsign, []);
      map.get(r.callsign).push(r);
    }
    return map;
  }, [repeaters]);

  // Map from FILTERED repeaters only — used for link line drawing.
  // Lines are only drawn when BOTH endpoints are visible (filtered in).
  const byCallsignFiltered = useMemo(() => {
    const map = new Map();
    for (const r of filteredRepeaters) {
      if (!isValidCoord(r.lat, r.lng)) continue;
      if (!map.has(r.callsign)) map.set(r.callsign, []);
      map.get(r.callsign).push(r);
    }
    return map;
  }, [filteredRepeaters]);

  // Build linking lines from RepeaterBook crosslinks (linked_callsigns).
  // linked_callsigns entries are pre-resolved strings like "HB9W 145.3250 MHz (2m)".
  // We parse callsign AND frequency to match the EXACT target repeater — not all
  // repeaters sharing the same callsign (same callsign on different bands ≠ linked).
  const linkLines = useMemo(() => {
    if (!showLinks) return [];
    const lines = [];
    const drawn = new Set();
    for (const r of filteredRepeaters) {
      if (r.lat == null || r.lng == null) continue;
      if (!r.linked_callsigns || r.linked_callsigns.length === 0) continue;
      for (const linkedStr of r.linked_callsigns) {
        const parsed = parseLinkedString(linkedStr);
        if (!parsed) continue;
        // Multi-source filter: only show if confirmed by 2+ sources (or admin link)
        const srcKey = linkKey(r.callsign, r.frequency, parsed.callsign, parsed.frequency);
        if (!isLinkDisplayable(srcKey)) continue;
        const targets = byCallsignFiltered.get(parsed.callsign) || [];
        for (const target of targets) {
          if (target.callsign === r.callsign && target.frequency === r.frequency) continue;
          // Match by callsign AND frequency (within 1 kHz tolerance) — the specific repeater
          if (parsed.frequency != null && Math.abs(target.frequency - parsed.frequency) > 0.001) continue;
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
  }, [filteredRepeaters, byCallsignFiltered, showLinks, isLinkDisplayable]);

  // Resolve linked_callsigns strings to actual repeater objects for popup display.
  // Returns array of { callsign, frequency, band, location_name, lat, lng, distance }.
  const resolveLinkedRepeaters = useCallback((repeater) => {
    if (!repeater.linked_callsigns || repeater.linked_callsigns.length === 0) return [];
    const resolved = [];
    const seen = new Set();
    for (const linkedStr of repeater.linked_callsigns) {
      const parsed = parseLinkedString(linkedStr);
      if (!parsed) continue;
      // Multi-source filter: only show if confirmed by 2+ sources (or admin link)
      const srcKey = linkKey(repeater.callsign, repeater.frequency, parsed.callsign, parsed.frequency);
      if (!isLinkDisplayable(srcKey)) continue;
      const targets = byCallsignAll.get(parsed.callsign) || [];
      // Find the specific target by frequency, or fall back to first match
      const target = parsed.frequency != null
        ? targets.find(t => Math.abs(t.frequency - parsed.frequency) < 0.001)
        : targets[0];
      const key = parsed.callsign + (parsed.frequency || '');
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push({
        callsign: parsed.callsign,
        frequency: parsed.frequency,
        band: parsed.band,
        location_name: target?.location_name,
        lat: target?.lat,
        lng: target?.lng,
        distance: target && repeater.lat != null && repeater.lng != null && target.lat != null
          ? haversineKm(repeater.lat, repeater.lng, target.lat, target.lng)
          : null,
      });
    }
    return resolved;
  }, [byCallsignAll, isLinkDisplayable]);

  // Admin-managed links (from RepeaterLink entity, approved + permanent only).
  // Uses from_frequency / to_frequency to match the EXACT repeater — not all
  // repeaters sharing the same callsign. Falls back to callsign-only if no frequency set.
  const adminLinkLines = useMemo(() => {
    if (!showLinks || !adminLinks) return [];
    return adminLinks
      .filter(l => l.status === "approved" && l.link_type === "permanent")
      .flatMap(l => {
        // Multi-source filter: USKA-only links need 2+ sources; admin links always pass
        const isUSKA = (l.description || '').includes('USKA');
        if (isUSKA) {
          const srcKey = linkKey(l.from_callsign, l.from_frequency, l.to_callsign, l.to_frequency);
          if (!isLinkDisplayable(srcKey)) return [];
        }
        // Match specific repeaters by callsign + frequency (if frequency is set)
        // Use FILTERED map so lines only show when both endpoints are visible
        const allFrom = byCallsignFiltered.get(l.from_callsign) || [];
        const allTo = byCallsignFiltered.get(l.to_callsign) || [];
        let fromReps = l.from_frequency != null
          ? allFrom.filter(r => Math.abs(r.frequency - l.from_frequency) < 0.001)
          : allFrom;
        let toReps = l.to_frequency != null
          ? allTo.filter(r => Math.abs(r.frequency - l.to_frequency) < 0.001)
          : allTo;
        // Narrow further by stored coordinates — distinguishes same-callsign/same-frequency
        // repeaters at different locations (e.g. HB9UF 439.15 Winterthur vs. Zofingen)
        if (l.from_lat != null && l.from_lng != null) {
          const coordMatch = fromReps.filter(r =>
            r.lat != null && r.lng != null &&
            Math.abs(r.lat - l.from_lat) < 0.001 && Math.abs(r.lng - l.from_lng) < 0.001
          );
          if (coordMatch.length > 0) fromReps = coordMatch;
        }
        if (l.to_lat != null && l.to_lng != null) {
          const coordMatch = toReps.filter(r =>
            r.lat != null && r.lng != null &&
            Math.abs(r.lat - l.to_lat) < 0.001 && Math.abs(r.lng - l.to_lng) < 0.001
          );
          if (coordMatch.length > 0) toReps = coordMatch;
        }

        // No fallback to stored coordinates — lines must terminate on actual repeater
        // markers. If either endpoint is missing from the filtered set, skip the line.
        // Draw lines between matched from×to repeaters (deduped)
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
  }, [adminLinks, showLinks, byCallsignFiltered, byCallsignAll, isLinkDisplayable]);

  // Resolve admin-managed links for a repeater (for popup display).
  // Returns array of linked repeater objects with details.
  const resolveAdminLinks = useCallback((repeater) => {
    if (!adminLinks) return [];
    const resolved = [];
    const seen = new Set();
    for (const l of adminLinks) {
      if (l.status !== "approved" || l.link_type !== "permanent") continue;
      // Multi-source filter: USKA-only links need 2+ sources; admin links always pass
      const isUSKA = (l.description || '').includes('USKA');
      if (isUSKA) {
        const srcKey = linkKey(l.from_callsign, l.from_frequency, l.to_callsign, l.to_frequency);
        if (!isLinkDisplayable(srcKey)) continue;
      }
      const isFrom = l.from_callsign === repeater.callsign &&
        (l.from_frequency == null || Math.abs(l.from_frequency - repeater.frequency) < 0.001) &&
        (l.from_lat == null || l.from_lng == null || repeater.lat == null ||
          (Math.abs(repeater.lat - l.from_lat) < 0.001 && Math.abs(repeater.lng - l.from_lng) < 0.001));
      const isTo = l.to_callsign === repeater.callsign &&
        (l.to_frequency == null || Math.abs(l.to_frequency - repeater.frequency) < 0.001) &&
        (l.to_lat == null || l.to_lng == null || repeater.lat == null ||
          (Math.abs(repeater.lat - l.to_lat) < 0.001 && Math.abs(repeater.lng - l.to_lng) < 0.001));
      if (!isFrom && !isTo) continue;
      // Find the linked target repeater
      const targetCall = isFrom ? l.to_callsign : l.from_callsign;
      const targetFreq = isFrom ? l.to_frequency : l.from_frequency;
      const allTargets = byCallsignAll.get(targetCall) || [];
      const target = targetFreq != null
        ? allTargets.find(t => Math.abs(t.frequency - targetFreq) < 0.001)
        : allTargets[0];
      const key = targetCall + (targetFreq || '');
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push({
        callsign: targetCall,
        frequency: targetFreq,
        band: target?.band,
        location_name: target?.location_name,
        lat: target?.lat,
        lng: target?.lng,
        distance: target && repeater.lat != null && repeater.lng != null && target.lat != null
          ? haversineKm(repeater.lat, repeater.lng, target.lat, target.lng)
          : null,
        network: l.network,
        source: 'admin',
      });
    }
    return resolved;
  }, [adminLinks, byCallsignAll, isLinkDisplayable]);

  // Dedicated SVG renderer for link lines — enables CSS animations (canvas renderer can't animate)
  const linkRenderer = useMemo(() => L.svg({ pane: 'overlayPane' }), []);

  // Dedicated SVG renderer for coverage polygons — enables radial gradient fills
  // (canvas renderer doesn't support SVG gradients, and the map uses preferCanvas=true)
  const coverageRenderer = useMemo(() => L.svg({ pane: 'overlayPane' }), []);

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

  // Zoom-based aggregation: when zoomed out below threshold with many repeaters,
  // CountryAggregateLayer shows country-level badges instead — skip individual markers
  const isAggregated = zoom < AGGREGATE_THRESHOLD && filteredRepeaters.length > 200;

  // Viewport culling
  const bounds = map.getBounds();
  const paddedBounds = bounds.pad(REPEATER_VIEWPORT_PADDING);
  const visibleRepeaters = filteredRepeaters.filter(r =>
    isValidCoord(r.lat, r.lng) && paddedBounds.contains([r.lat, r.lng])
  );

  // Viewport culling already limits to the current map area. The cap is a safety net
  // for extreme zoom-out (e.g. all of Europe with all countries selected). Canvas
  // rendering (preferCanvas) handles 10k+ markers without noticeable lag.
  // Previously MAX=1000 caused repeaters to silently disappear when multiple countries
  // were selected and the viewport contained more than 1000 repeaters.
  // Auto-switch to CircleMarker (canvas-rendered) when there are too many repeaters.
  // divIcon Marker rendering freezes the browser above ~500 markers.
  const MAX = REPEATER_MAX_MARKERS;
  const cappedRepeaters = visibleRepeaters.length > MAX ? visibleRepeaters.slice(0, MAX) : visibleRepeaters;
  const useCircleMode = performanceMode || cappedRepeaters.length > 500;

  // Only show link lines where BOTH endpoints are actually rendered as markers.
  // cappedRepeaters may be a subset of filteredRepeaters (MAX limit), so lines
  // connecting to repeaters outside the cap would appear without markers.
  const cappedPositionSet = new Set(cappedRepeaters.map(r => `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`));
  const visibleLines = allLines.filter(line => {
    const [p1, p2] = line.positions;
    return cappedPositionSet.has(`${p1[0].toFixed(5)},${p1[1].toFixed(5)}`) &&
           cappedPositionSet.has(`${p2[0].toFixed(5)},${p2[1].toFixed(5)}`);
  });

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
      {/* Coverage — terrain polygon (LOS) OR circle from calculated radius.
           Only repeaters with ACTUAL calculated coverage data are rendered.
           Uses a radial gradient fill for a natural fade-out effect (auslaufen).
           Uncalculated repeaters (no coverage_radius_km, no polygon) show nothing. */}
      {(showCoverage || (individualCoverage && individualCoverage.size > 0)) && cappedRepeaters.map((r, idx) => {
        const showThis = showCoverage || (individualCoverage && individualCoverage.has(r.id));
        if (!showThis) return null;

        // Skip repeaters with no calculated coverage data at all
        const hasCalculated = r.coverage_radius_km != null || r.coverage_polygon?.coordinates?.[0];
        if (!hasCalculated) return null;

        const color = getModeColor(r.primary_mode);
        const refinementPct = r.coverage_refinement_pct || 0;
        const fillOpacity = r.status === "off-air"
          ? 0.02
          : 0.08 + (refinementPct / 100) * 0.20;

        // Terrain-LOS polygon: render asymmetric GeoJSON polygon with gradient fill
        if (r.coverage_polygon?.coordinates?.[0] && r.coverage_source === "terrain_los") {
          const polyPositions = r.coverage_polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
          return (
            <CoveragePolygon
              key={`cov-${r.id || idx}`}
              positions={polyPositions}
              color={color}
              fillOpacity={fillOpacity}
              weight={1.2}
              strokeOpacity={0.35}
              renderer={coverageRenderer}
            />
          );
        }

        // Circle from calculated coverage_radius_km (no band estimate fallback)
        const radiusKm = r.coverage_radius_km;
        if (radiusKm == null) return null;
        return (
          <CoverageCircle
            key={`cov-${r.id || idx}`}
            center={[r.lat, r.lng]}
            radiusKm={radiusKm}
            color={color}
            fillOpacity={fillOpacity}
            weight={refinementPct >= 50 ? 0.8 : 0.5}
            strokeOpacity={0.25 + (refinementPct / 100) * 0.25}
            renderer={coverageRenderer}
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

      {/* Repeater markers — antenna icon in full mode, circle in performance mode.
           Hidden when aggregated (zoom < threshold + many repeaters) — country badges take over. */}
      {!isAggregated && cappedRepeaters.map((r, idx) => {
        const color = getModeColor(r.primary_mode);
        // Combine RepeaterBook crosslinks + admin-managed links for popup display
        const linkedResolved = [...resolveLinkedRepeaters(r), ...resolveAdminLinks(r)];
        const popupContent = (
          <RepeaterPopup
            repeater={r}
            linkedRepeaters={linkedResolved}
            userPosition={userPosition}
            onSuggestLink={onSuggestLink}
            onToggleCoverage={onToggleCoverage}
            onRepeaterUpdate={onRepeaterUpdate}
            showCoverageForThis={individualCoverage && individualCoverage.has(r.id)}
            isAdmin={isAdmin}
          />
        );
        if (useCircleMode) {
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
              <DraggablePopup autoPan={false}>
                {popupContent}
              </DraggablePopup>
            </CircleMarker>
          );
        }
        return (
          <Marker
            key={`rep-${r.id || idx}`}
            position={[r.lat, r.lng]}
            icon={getRepeaterIcon(color)}
          >
            <DraggablePopup autoPan={false}>
              {popupContent}
            </DraggablePopup>
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
    prev.exclusiveModes === next.exclusiveModes &&
    prev.searchQuery === next.searchQuery &&
    prev.showLinks === next.showLinks &&
    prev.showCoverage === next.showCoverage &&
    prev.showOnlyLinked === next.showOnlyLinked &&
    prev.performanceMode === next.performanceMode &&
    prev.filterCountries === next.filterCountries &&
    prev.userPosition === next.userPosition &&
    prev.radiusKm === next.radiusKm &&
    prev.adminLinks === next.adminLinks &&
    prev.onSuggestLink === next.onSuggestLink &&
    prev.individualCoverage === next.individualCoverage &&
    prev.onToggleCoverage === next.onToggleCoverage &&
    prev.onRepeaterUpdate === next.onRepeaterUpdate &&
    prev.activeContinents === next.activeContinents &&
    prev.activeCountries === next.activeCountries &&
    prev.isAdmin === next.isAdmin
  );
}

const RepeaterLayer = memo(RepeaterLayerInner, arePropsEqual);
export default RepeaterLayer;