import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { loadCachedReferenceData, loadCachedRepeaters, loadCachedPrivateNodes, loadCachedTota } from "@/lib/offlineDataCache";
import { loadAllTotaPoints } from "@/lib/paginatedLoader";

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Sort points by distance from map center (closest first) — PUNKT 2: center-outward loading
function sortByDistanceFromCenter(points, center) {
  if (!center || !points || points.length === 0) return points || [];
  return [...points].sort((a, b) => {
    const distA = haversineKm(center.lat, center.lng, a.lat, a.lng);
    const distB = haversineKm(center.lat, center.lng, b.lat, b.lng);
    return distA - distB;
  });
}

// Loads map data with viewport-based loading for reference types AND repeaters.
// Reference types (SOTA, POTA, WWFF, WWBOTA, Castles, Lighthouses, IOTA) and repeaters
// are loaded viewport-based via ViewportDataLoader component → getReferencesInBounds.
// This hook loads: offline cache (instant), private nodes (APRS/BrandMeister), admin links.
//
// Timeout guard: loading stops after 30s regardless of completion status,
// preventing the builder from hanging in "thinking..." state.

const LOADING_TIMEOUT_MS = 30000;

export function useMapData(activeLayers) {
  const [data, setData] = useState({
    sota: [], pota: [], hbff: [], wwbota: [], castle: [], iota: [], lighthouse: [], tota: [],
  });
  const [repeaters, setRepeaters] = useState([]);
  const [privateNodes, setPrivateNodes] = useState([]);
  const [adminLinks, setAdminLinks] = useState([]);
  // Only show loading indicator if layers are active (no autoload when all layers off)
  const [loading, setLoading] = useState(() => activeLayers && activeLayers.length > 0);
  const [loadingMessage, setLoadingMessage] = useState("Daten werden geladen…");
  const cancelRef = useRef(false);
  const timeoutRef = useRef(null);
  // Track which datasets have been loaded from server to avoid duplicate fetches
  const loadedRef = useRef({ privateNodes: false, adminLinks: false });
  // Track previous active layers to detect removals vs additions
  const prevLayersRef = useRef(activeLayers);

  // Load offline cache on mount — async (IndexedDB reads).
  // Shows cached data instantly if available, before server data loads.
  useEffect(() => {
    (async () => {
      const cached = await loadCachedReferenceData();
      if (cached) {
        setData(prev => ({
          sota: cached.sota || [],
          pota: cached.pota || [],
          hbff: cached.hbff || [],
          wwbota: cached.wwbota || [],
          castle: cached.castle || [],
          iota: cached.iota || [],
          lighthouse: cached.lighthouse || [],
          tota: prev.tota,
        }));
      }
      const cachedRepeaters = await loadCachedRepeaters();
      if (cachedRepeaters.length > 0) setRepeaters(cachedRepeaters);
      const cachedNodes = await loadCachedPrivateNodes();
      if (cachedNodes.length > 0) setPrivateNodes(cachedNodes);
      const cachedTota = await loadCachedTota();
      if (cachedTota.length > 0) setData(prev => ({ ...prev, tota: cachedTota }));
    })();
  }, []);

  // Merge viewport-loaded reference data AND repeaters (called by ViewportDataLoader)
  // PUNKT 2: Points are sorted by distance from map center (closest first) so the
  // rendering layer can display points near the center before those at the viewport edge.
  const onViewportData = useCallback((references, isFirstLoad, center) => {
    // Handle repeaters separately — viewport-based, replace on each fetch
    if (Array.isArray(references.repeater)) {
      setRepeaters(sortByDistanceFromCenter(
        references.repeater.filter(r => r.lat != null && r.lng != null), center
      ));
    }
    // Handle private nodes (APRS + BrandMeister) — viewport-based, replace on each fetch
    const aprsRefs = Array.isArray(references.aprs) ? references.aprs : null;
    const bmRefs = Array.isArray(references.brandmeister) ? references.brandmeister : null;
    if (aprsRefs || bmRefs) {
      const merged = [
        ...(aprsRefs || []),
        ...(bmRefs || []),
      ].filter(r => r.lat != null && r.lng != null);
      setPrivateNodes(sortByDistanceFromCenter(merged, center));
    }
    // Handle reference types (SOTA, POTA, etc.) — sorted by distance from center
    setData(prev => {
      const next = { ...prev };
      for (const [type, refs] of Object.entries(references)) {
        if (type === 'repeater' || type === 'aprs' || type === 'brandmeister') continue;
        if (Array.isArray(refs)) {
          next[type] = sortByDistanceFromCenter(
            refs.filter(r => r.lat != null && r.lng != null), center
          );
        }
      }
      return next;
    });
    // Stop loading indicator after first viewport data arrives
    if (isFirstLoad) {
      setLoading(false);
    }
  }, []);

  // Server loading — gated by activeLayers. Only loads data for layers the user has enabled.
  // Repeaters, reference types, AND private nodes (APRS/BrandMeister) are all loaded
  // viewport-based by ViewportDataLoader → getReferencesInBounds.
  // This hook only loads admin links (when repeater layer is active) and clears data
  // when layers are turned off.
  useEffect(() => {
    let active = true;
    cancelRef.current = false;

    const needRepeaters = activeLayers.includes("repeater");
    const needPrivateNodes = activeLayers.includes("aprs") || activeLayers.includes("brandmeister");

    // Detect whether a NEW layer was added (vs only removals)
    const prev = prevLayersRef.current;
    const hasNewLayer = activeLayers.some(l => !prev.includes(l));
    prevLayersRef.current = activeLayers;

    // Clear private nodes when neither APRS nor BrandMeister is active
    if (!needPrivateNodes) {
      setPrivateNodes([]);
      loadedRef.current.privateNodes = false;
    }

    // Clear repeaters when repeater layer is not active
    if (!needRepeaters) {
      setRepeaters([]);
      loadedRef.current.adminLinks = false;
      setAdminLinks([]);
    }

    // Clear reference types (sota, pota, hbff, wwbota, castle, iota, lighthouse) when their layer is turned off.
    // Without this, points stay on the map after the layer is toggled off because onViewportData
    // only updates types present in the response — it doesn't clear types that are no longer active.
    const refTypes = ["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse"];
    setData(prev => {
      let changed = false;
      const next = { ...prev };
      for (const type of refTypes) {
        if (!activeLayers.includes(type) && next[type] && next[type].length > 0) {
          next[type] = [];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    // No data layers active — ensure loading indicator is off
    if (!needRepeaters && !needPrivateNodes) {
      setLoading(false);
      return;
    }

    // Only show loading indicator when a NEW layer was added.
    // Turning OFF a layer should not show the loading spinner —
    // the ViewportDataLoader will silently refetch the remaining layers.
    if (hasNewLayer) {
      setLoading(true);
      setLoadingMessage("Daten werden geladen…");
    }

    const tasks = [];

    // Fetch admin-managed repeater links — only needed when repeater layer is active
    if (needRepeaters && !loadedRef.current.adminLinks) {
      loadedRef.current.adminLinks = true;
      tasks.push((async () => {
        try {
          const links = await base44.entities.RepeaterLink.filter({ status: "approved", link_type: "permanent" });
          if (!cancelRef.current) setAdminLinks(links || []);
        } catch (e) { /* silent */ }
      })());
    }

    // Timeout guard — stop loading after 30s regardless of completion
    timeoutRef.current = setTimeout(() => {
      if (active && !cancelRef.current) setLoading(false);
    }, LOADING_TIMEOUT_MS);

    if (tasks.length > 0) {
      Promise.all(tasks).then(() => {
        if (active && !cancelRef.current) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          // Don't stop loading for repeater-only — ViewportDataLoader handles it
          if (!needRepeaters) setLoading(false);
        }
      });
    } else {
      // No admin tasks — loading will be stopped by ViewportDataLoader
    }

    return () => {
      active = false;
    };
  }, [activeLayers]);

  const cancelLoading = useCallback(() => {
    cancelRef.current = true;
    setLoading(false);
  }, []);

  return { data, repeaters, privateNodes, adminLinks, loading, loadingMessage, cancelLoading, onViewportData };
}