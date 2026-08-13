import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { loadCachedReferenceData, loadCachedRepeaters, loadCachedPrivateNodes, loadCachedTota } from "@/lib/offlineDataCache";
import { loadAllRepeaters, loadAllPrivateNodes, loadAllTotaPoints } from "@/lib/paginatedLoader";

// Loads map data with viewport-based loading for reference types.
// Reference types (SOTA, POTA, WWFF, WWBOTA, Castles, Lighthouses, IOTA) are loaded
// viewport-based via ViewportDataLoader component — NOT here.
// This hook loads: offline cache (instant), repeaters, private nodes, TOTA, admin links.
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
  const loadedRef = useRef({ repeaters: false, privateNodes: false, adminLinks: false });

  // Load offline cache synchronously on mount — instant display if available
  useEffect(() => {
    const cached = loadCachedReferenceData();
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
    const cachedRepeaters = loadCachedRepeaters();
    if (cachedRepeaters.length > 0) setRepeaters(cachedRepeaters);
    const cachedNodes = loadCachedPrivateNodes();
    if (cachedNodes.length > 0) setPrivateNodes(cachedNodes);
    const cachedTota = loadCachedTota();
    if (cachedTota.length > 0) setData(prev => ({ ...prev, tota: cachedTota }));
  }, []);

  // Merge viewport-loaded reference data (called by ViewportDataLoader)
  const onViewportData = useCallback((references, isFirstLoad) => {
    setData(prev => {
      const next = { ...prev };
      for (const [type, refs] of Object.entries(references)) {
        if (Array.isArray(refs)) {
          // On first load, replace offline cache with server data
          // On subsequent loads (pan/zoom), also replace — viewport data is authoritative
          next[type] = refs.filter(r => r.lat != null && r.lng != null);
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
  // Data loads once and stays in state; toggling a layer off hides markers but keeps data
  // so toggling back on is instant. Reference types (SOTA, POTA, etc.) are loaded
  // viewport-based by ViewportDataLoader, which also checks activeLayers.
  useEffect(() => {
    let active = true;
    cancelRef.current = false;

    const needRepeaters = activeLayers.includes("repeater");
    const needPrivateNodes = activeLayers.includes("aprs") || activeLayers.includes("brandmeister");

    // No data layers active — ensure loading indicator is off
    if (!needRepeaters && !needPrivateNodes) {
      setLoading(false);
      return;
    }

    const tasks = [];

    // Fetch repeaters via paginated loader — only when repeater layer is active
    if (needRepeaters && !loadedRef.current.repeaters) {
      loadedRef.current.repeaters = true;
      setLoading(true);
      setLoadingMessage("Relais werden geladen…");
      tasks.push((async () => {
        try {
          await loadAllRepeaters({
            onBatch: (batch, total) => {
              if (cancelRef.current) return;
              // Filter out repeaters without valid coordinates — they can't be rendered
              // on the map and waste memory/bandwidth (47k+ US repeaters without coords).
              const withCoords = batch.filter(r => r.lat != null && r.lng != null);
              setRepeaters(prev => [...prev, ...withCoords]);
              setLoadingMessage(`Relais werden geladen… (${total})`);
            },
          });
        } catch (e) { /* silent */ }
      })());
    }

    // Fetch private nodes (APRS + BrandMeister) — only when APRS or BrandMeister layer is active
    if (needPrivateNodes && !loadedRef.current.privateNodes) {
      loadedRef.current.privateNodes = true;
      setLoading(true);
      setLoadingMessage("APRS-Nodes werden geladen…");
      tasks.push((async () => {
        try {
          await loadAllPrivateNodes({
            onBatch: (batch, total) => {
              if (cancelRef.current) return;
              setPrivateNodes(prev => [...prev, ...batch]);
              setLoadingMessage(`APRS-Nodes werden geladen… (${total})`);
            },
          });
        } catch (e) { /* silent */ }
      })());
    }

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

    if (tasks.length > 0) {
      // Timeout guard — stop loading after 30s regardless of completion
      timeoutRef.current = setTimeout(() => {
        if (active && !cancelRef.current) setLoading(false);
      }, LOADING_TIMEOUT_MS);

      Promise.all(tasks).then(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (active && !cancelRef.current) setLoading(false);
      });
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