import React, { memo, useMemo, useRef, useEffect, useCallback } from "react";
import { CircleMarker, Polyline, Popup, useMap, Marker, Circle, Polygon } from "react-leaflet";
import L from "leaflet";
import RepeaterPopup from "@/components/map/RepeaterPopup";
import DraggablePopup from "@/components/map/DraggablePopup";
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

// Build a canonical link key from two endpoints (callsign + frequency).
// Used to match the same link across sources (RepeaterBook, USKA, admin).
function linkKey(fromCall, fromFreq, toCall, toFreq) {
  const a = (fromCall || '') + (fromFreq != null ? fromFreq : '');
  const b = (toCall || '') + (toFreq != null ? toFreq : '');
  return [a, b].sort().join('→');
}

// Parse a linked_callsigns entry like "HB9W 145.3250 MHz (2m)" → { callsign, frequency, band }
// Returns null if the string doesn't contain a recognizable callsign.
function parseLinkedString(str) {
  const s = String(str).trim();
  const match = s.match(/^(\S+)\s+([\d.]+)\s*MHz\s*(?:\(([^)]+)\))?/);
  if (match) {
    return {
      callsign: match[1].split('/')[0],
      frequency: parseFloat(match[2]),
      band: match[3] || null,
    };
  }
  // Fallback: just a callsign with no frequency
  if (s.length >= 3 && /^[A-Z0-9]{3,}/.test(s.split(/\s+/)[0])) {
    return { callsign: s.split(/\s+/)[0].split('/')[0], frequency: null, band: null };
  }
  return null;
}

const LINE_DASH_ARRAYS = {
  solid: undefined,
  dashed: "12 8",
  dotted: "3 6",
};

function RepeaterLayerInner({ repeaters, filterModes, searchQuery, showLinks, showCoverage, showOnlyLinked, performanceMode, filterCountries, userPosition, radiusKm, adminLinks, onSuggestLink, individualCoverage, onToggleCoverage, activeContinents, activeCountries, isAdmin }) {
  const map = useMap();

  // Build a map of linkKey → Set of sources ('repeaterbook', 'uska', 'admin').
  // A link is only displayed if it's confirmed by 2+ sources — exception: admin links always shown.
  const linkSourceMap = useMemo(() => {
    const map = new Map();
    // Source 1: RepeaterBook linked_callsigns
    for (const r of repeaters) {
      if (!r.linked_callsigns || r.linked_callsigns.length === 0) continue;
      for (const linkedStr of r.linked_callsigns) {
        const parsed = parseLinkedString(linkedStr);
        if (!parsed) continue;
        const key = linkKey(r.callsign, r.frequency, parsed.callsign, parsed.frequency);
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add('repeaterbook');
      }
    }
    // Sources 2 & 3: USKA + admin from RepeaterLink entries
    if (adminLinks) {
      for (const l of adminLinks) {
        if (l.status !== 'approved' || l.link_type !== 'permanent') continue;
        const key = linkKey(l.from_callsign, l.from_frequency, l.to_callsign, l.to_frequency);
        if (!map.has(key)) map.set(key, new Set());
        const source = (l.description || '').includes('USKA') ? 'uska' : 'admin';
        map.get(key).add(source);
      }
    }
    return map;
  }, [repeaters, adminLinks]);

  // A link is displayable if it's an admin link OR confirmed by 2+ sources.
  const isLinkDisplayable = useCallback((key) => {
    const sources = linkSourceMap.get(key);
    if (!sources) return false;
    if (sources.has('admin')) return true;
    return sources.size >= 2;
  }, [linkSourceMap]);

  // Filter repeaters by continent, country, mode, search, and radius
  const filteredRepeaters = useMemo(() => {
    let result = repeaters;
    // Exclude repeaters without coordinates — they can't be placed on the map
    result = result.filter(r => r.lat != null && r.lng != null);
    // Per-layer country filter (multi-select) overrides global LayerControl country filter.
    // When specific countries are selected in the RepeaterFilter, the global
    // activeContinents/activeCountries from LayerControl are NOT applied — so the
    // user can show "Schweiz" globally for SOTA/POTA but still see German + Austrian
    // repeaters by selecting both in the RepeaterFilter.
    if (!filterCountries || filterCountries.length === 0) {
      if (activeContinents && activeContinents.length > 0) {
        result = result.filter(r => r.lat != null && r.lng != null && isInContinents(r.lat, r.lng, activeContinents));
      }
      if (activeCountries && activeCountries.length > 0) {
        result = result.filter(r => isInCountries({ ...r, layerType: 'repeater' }, activeCountries));
      }
    } else {
      result = result.filter(r => filterCountries.includes(r.country_code));
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
    // Only linked repeaters filter — show only repeaters with actual crosslinks.
    // Uses the same coordinate-aware matching as the link line logic: a repeater
    // counts as "linked" only if its callsign AND frequency AND coordinates match
    // an approved admin link (or it has RepeaterBook crosslinks on its own record).
    if (showOnlyLinked) {
      const linkedIds = new Set();
      // From RepeaterBook crosslinks — only count displayable links (2+ sources or admin)
      for (const r of result) {
        if (!r.linked_callsigns || r.linked_callsigns.length === 0) continue;
        for (const linkedStr of r.linked_callsigns) {
          const parsed = parseLinkedString(linkedStr);
          if (!parsed) continue;
          const srcKey = linkKey(r.callsign, r.frequency, parsed.callsign, parsed.frequency);
          if (isLinkDisplayable(srcKey)) {
            if (r.id) linkedIds.add(r.id);
            break;
          }
        }
      }
      // From admin-managed links — admin links always count; USKA links need 2+ sources
      if (adminLinks) {
        for (const l of adminLinks) {
          if (l.status !== "approved" || l.link_type !== "permanent") continue;
          const isUSKA = (l.description || '').includes('USKA');
          if (isUSKA) {
            const srcKey = linkKey(l.from_callsign, l.from_frequency, l.to_callsign, l.to_frequency);
            if (!isLinkDisplayable(srcKey)) continue;
          }
          // Find matching "from" repeaters
          const allFrom = repeaters.filter(r => r.callsign === l.from_callsign);
          for (const r of allFrom) {
            if (l.from_frequency != null && Math.abs(r.frequency - l.from_frequency) > 0.001) continue;
            if (l.from_lat != null && l.from_lng != null && r.lat != null && r.lng != null) {
              if (Math.abs(r.lat - l.from_lat) > 0.001 || Math.abs(r.lng - l.from_lng) > 0.001) continue;
            }
            if (r.id) linkedIds.add(r.id);
          }
          // Find matching "to" repeaters
          const allTo = repeaters.filter(r => r.callsign === l.to_callsign);
          for (const r of allTo) {
            if (l.to_frequency != null && Math.abs(r.frequency - l.to_frequency) > 0.001) continue;
            if (l.to_lat != null && l.to_lng != null && r.lat != null && r.lng != null) {
              if (Math.abs(r.lat - l.to_lat) > 0.001 || Math.abs(r.lng - l.to_lng) > 0.001) continue;
            }
            if (r.id) linkedIds.add(r.id);
          }
        }
      }
      result = result.filter(r => linkedIds.has(r.id));
    }
    return result;
  }, [repeaters, filterModes, searchQuery, filterCountries, radiusKm, userPosition, activeContinents, activeCountries, showOnlyLinked, adminLinks, isLinkDisplayable]);

  // Build callsign→repeaters map from ALL repeaters (not just filtered) so link lines
  // connect to targets even when the target is filtered out by mode/country/etc.
  // Map from ALL repeaters — used for popup resolution (popup shows linked repeaters
  // even when the target is filtered out by mode/country/etc).
  const byCallsignAll = useMemo(() => {
    const map = new Map();
    for (const r of repeaters) {
      if (r.lat == null || r.lng == null) continue;
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
      if (r.lat == null || r.lng == null) continue;
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

  // Viewport culling already limits to the current map area. The cap is a safety net
  // for extreme zoom-out (e.g. all of Europe with all countries selected). Canvas
  // rendering (preferCanvas) handles 10k+ markers without noticeable lag.
  // Previously MAX=1000 caused repeaters to silently disappear when multiple countries
  // were selected and the viewport contained more than 1000 repeaters.
  // Auto-switch to CircleMarker (canvas-rendered) when there are too many repeaters.
  // divIcon Marker rendering freezes the browser above ~500 markers.
  const MAX = 3000;
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
      {/* Coverage — terrain polygon (LOS) OR circle fallback (band estimate) */}
      {(showCoverage || (individualCoverage && individualCoverage.size > 0)) && cappedRepeaters.map((r, idx) => {
        const showThis = showCoverage || (individualCoverage && individualCoverage.has(r.id));
        if (!showThis) return null;
        const color = getModeColor(r.primary_mode);
        const refinementPct = r.coverage_refinement_pct || 0;
        const fillOpacity = r.status === "off-air"
          ? 0.02
          : 0.05 + (refinementPct / 100) * 0.20;

        // Terrain-LOS polygon: render asymmetric GeoJSON polygon
        if (r.coverage_polygon?.coordinates?.[0] && r.coverage_source === "terrain_los") {
          const polyPositions = r.coverage_polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
          return (
            <Polygon
              key={`cov-${r.id || idx}`}
              positions={polyPositions}
              pathOptions={{
                color: color,
                weight: 1.5,
                opacity: 0.5,
                fillColor: color,
                fillOpacity: fillOpacity,
              }}
            />
          );
        }

        // Fallback: circle from coverage_radius_km or band estimate
        const radiusKm = r.coverage_radius_km || COVERAGE_RADIUS_KM[r.band] || COVERAGE_RADIUS_KM["Other"];
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
        // Combine RepeaterBook crosslinks + admin-managed links for popup display
        const linkedResolved = [...resolveLinkedRepeaters(r), ...resolveAdminLinks(r)];
        const popupContent = (
          <RepeaterPopup
            repeater={r}
            linkedRepeaters={linkedResolved}
            userPosition={userPosition}
            onSuggestLink={onSuggestLink}
            onToggleCoverage={onToggleCoverage}
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
    prev.activeContinents === next.activeContinents &&
    prev.activeCountries === next.activeCountries &&
    prev.isAdmin === next.isAdmin
  );
}

const RepeaterLayer = memo(RepeaterLayerInner, arePropsEqual);
export default RepeaterLayer;