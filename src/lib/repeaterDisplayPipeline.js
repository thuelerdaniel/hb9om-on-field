// Repeater display pipeline — the ONE source of truth for which repeaters the repeater
// layer draws on the map.
//
// Used by BOTH:
//   - RepeaterLayer.jsx  → the markers on the map
//   - Home.jsx           → the PDF export
//
// The PDF list must show exactly the repeaters that are on the map right now, so the
// export runs through the identical country/continent/mode/search/radius/linked filter
// and then through the identical viewport culling + marker cap.

import { isValidCoord } from "@/lib/geoUtilsFrontend";
import { repeaterMatchesMode } from "@/lib/repeaterModes";
import { isInContinents } from "@/lib/continents";
import { isInCountries } from "@/lib/countries";

// Marker cap of the map rendering — safety net at extreme zoom-out.
// The PDF export uses the same cap so both lists have the same length.
export const REPEATER_MAX_MARKERS = 3000;

// Viewport buffer of the map rendering (bounds.pad) — matches RepeaterLayer.
export const REPEATER_VIEWPORT_PADDING = 0.3;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build a canonical link key from two endpoints (callsign + frequency).
// Used to match the same link across sources (RepeaterBook, USKA, admin).
export function linkKey(fromCall, fromFreq, toCall, toFreq) {
  const a = (fromCall || '') + (fromFreq != null ? fromFreq : '');
  const b = (toCall || '') + (toFreq != null ? toFreq : '');
  return [a, b].sort().join('→');
}

// Parse a linked_callsigns entry like "HB9W 145.3250 MHz (2m)" → { callsign, frequency, band }
// Returns null if the string doesn't contain a recognizable callsign.
export function parseLinkedString(str) {
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

// Build a map of linkKey → Set of sources ('repeaterbook', 'uska', 'admin').
// A link is only displayed if it's confirmed by 2+ sources — exception: admin links always shown.
export function buildLinkSourceMap(repeaters, adminLinks) {
  const map = new Map();
  // Source 1: RepeaterBook linked_callsigns
  for (const r of (repeaters || [])) {
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
}

// A link is displayable if it's an admin link OR confirmed by 2+ sources.
export function isLinkDisplayable(key, linkSourceMap) {
  const sources = linkSourceMap?.get(key);
  if (!sources) return false;
  if (sources.has('admin')) return true;
  return sources.size >= 2;
}

/**
 * Filter repeaters exactly like the map layer does:
 * valid coordinates → country/continent filter → mode filter → search → radius → "only linked".
 *
 * @returns {Array} the repeaters the layer draws (before viewport culling).
 */
export function filterRepeatersForDisplay({
  repeaters = [],
  filterModes = [],
  exclusiveModes = false,
  searchQuery = "",
  filterCountries = [],
  activeContinents = [],
  activeCountries = [],
  radiusKm = 0,
  userPosition = null,
  showOnlyLinked = false,
  adminLinks = null,
  linkSourceMap = null,
} = {}) {
  let result = repeaters;
  // Exclude repeaters without valid coordinates — null, NaN, out of range, or Null Island
  result = result.filter(r => isValidCoord(r.lat, r.lng));

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
  if (!filterModes || filterModes.length === 0) return [];

  if (exclusiveModes) {
    result = result.filter(r => {
      const modes = r.modes || [];
      if (modes.length === 0) {
        return r.primary_mode && filterModes.includes(r.primary_mode);
      }
      return modes.every(m => filterModes.includes(m));
    });
  } else {
    result = result.filter(r => filterModes.some(m => repeaterMatchesMode(r, m)));
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

  // Only linked repeaters filter — show only repeaters with actual crosslinks.
  // Uses the same coordinate-aware matching as the link line logic: a repeater
  // counts as "linked" only if its callsign AND frequency AND coordinates match
  // an approved admin link (or it has RepeaterBook crosslinks on its own record).
  if (showOnlyLinked) {
    const sources = linkSourceMap || buildLinkSourceMap(repeaters, adminLinks);
    const linkedIds = new Set();
    // From RepeaterBook crosslinks — only count displayable links (2+ sources or admin)
    for (const r of result) {
      if (!r.linked_callsigns || r.linked_callsigns.length === 0) continue;
      for (const linkedStr of r.linked_callsigns) {
        const parsed = parseLinkedString(linkedStr);
        if (!parsed) continue;
        const srcKey = linkKey(r.callsign, r.frequency, parsed.callsign, parsed.frequency);
        if (isLinkDisplayable(srcKey, sources)) {
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
          if (!isLinkDisplayable(srcKey, sources)) continue;
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
}

/**
 * Viewport culling of the map layer: keep only repeaters inside the (padded) map
 * bounds and apply the marker cap.
 *
 * @param {Array} repeaters already filtered
 * @param {object|null} bounds Leaflet LatLngBounds (already padded) — null = no culling
 * @param {number} max marker cap
 */
export function cullToViewport(repeaters, bounds, max = REPEATER_MAX_MARKERS) {
  let result = repeaters;
  if (bounds && typeof bounds.contains === "function") {
    result = result.filter(r => isValidCoord(r.lat, r.lng) && bounds.contains([r.lat, r.lng]));
  }
  return result.length > max ? result.slice(0, max) : result;
}

// Full display pipeline in one call: filter (country/continent/mode/search/radius/links)
// then viewport culling + marker cap. Exactly the repeaters the layer is drawing.
export function collectDisplayedRepeaters(config, bounds) {
  return cullToViewport(filterRepeatersForDisplay(config || {}), bounds);
}