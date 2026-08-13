import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { loadCachedReferenceData, loadCachedRepeaters, loadCachedPrivateNodes, loadCachedTota } from "@/lib/offlineDataCache";
import { loadAllPrivateNodes, loadAllTotaPoints } from "@/lib/paginatedLoader";

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

  // Merge viewport-loaded reference data AND repeaters (called by ViewportDataLoader)
  const onViewportData = useCallback((references, isFirstLoad) => {
    // Handle repeaters separately — viewport-based, replace on each fetch
    if (Array.isArray(references.repeater)) {
      setRepeaters(references.repeater.filter(r => r.lat != null && r.lng != null));
    }
    // Handle reference types (SOTA, POTA, etc.)
    setData(prev => {
      const next = { ...prev };
      for (const [type, refs] of Object.entries(references)) {
        if (type === 'repeater') continue;
        if (Array.isArray(refs)) {
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
  // Repeaters and reference types are loaded viewport-based by ViewportDataLoader.
  // This hook loads private nodes (APRS/BrandMeister, smaller dataset) and admin links.
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

    // Show loading indicator — ViewportDataLoader sets false on first viewport data
    setLoading(true);
    setLoadingMessage("Daten werden geladen…");

    const tasks = [];

    // Private nodes (APRS + BrandMeister) — load all (smaller dataset)
    // Repeaters are loaded viewport-based via ViewportDataLoader → getReferencesInBounds
    if (needPrivateNodes && !loadedRef.current.privateNodes) {
      loadedRef.current.privateNodes = true;
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

    // Timeout guard — stop loading after 30s regardless of completion
    timeoutRef.current = setTimeout(() => {
      if (active && !cancelRef.current) setLoading(false);
    }, LOADING_TIMEOUT_MS);

    if (tasks.length > 0) {
      Promise.all(tasks).then(() => {
        // For private-nodes-only (no repeater layer), stop loading immediately
        if (!needRepeaters && active && !cancelRef.current) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setLoading(false);
        }
        // For repeater layer active, loading is stopped by onViewportData or timeout
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