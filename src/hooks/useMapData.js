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

export function useMapData() {
  const [data, setData] = useState({
    sota: [], pota: [], hbff: [], wwbota: [], castle: [], iota: [], lighthouse: [], tota: [],
  });
  const [repeaters, setRepeaters] = useState([]);
  const [privateNodes, setPrivateNodes] = useState([]);
  const [adminLinks, setAdminLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Daten werden geladen…");
  const cancelRef = useRef(false);
  const timeoutRef = useRef(null);

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

  // Fetch from server — only repeaters, private nodes, TOTA, admin links
  // Reference types (SOTA, POTA, WWFF, etc.) are loaded viewport-based by ViewportDataLoader
  useEffect(() => {
    cancelRef.current = false;
    let active = true;

    // Timeout guard — stop loading after 30s regardless of completion
    timeoutRef.current = setTimeout(() => {
      if (active && !cancelRef.current) {
        setLoading(false);
      }
    }, LOADING_TIMEOUT_MS);

    const loadFromServer = async () => {
      // TOTA is now loaded viewport-based by TotaLayer itself — not here.
      // This avoids loading all 5k+ TOTA points into memory on startup.

      // Fetch repeaters via paginated loader
      if (cancelRef.current) return;
      try {
        setLoadingMessage("Relais werden geladen…");
        await loadAllRepeaters({
          onBatch: (batch, total) => {
            if (!active || cancelRef.current) return;
            // Filter out repeaters without valid coordinates — they can't be rendered
            // on the map and waste memory/bandwidth (47k+ US repeaters without coords).
            const withCoords = batch.filter(r => r.lat != null && r.lng != null);
            setRepeaters(prev => [...prev, ...withCoords]);
            setLoadingMessage(`Relais werden geladen… (${total})`);
          },
        });
      } catch (e) { /* silent */ }

      // Fetch private nodes (APRS + BrandMeister) via paginated loader
      if (cancelRef.current) return;
      try {
        setLoadingMessage("APRS-Nodes werden geladen…");
        await loadAllPrivateNodes({
          onBatch: (batch, total) => {
            if (!active || cancelRef.current) return;
            setPrivateNodes(prev => [...prev, ...batch]);
            setLoadingMessage(`APRS-Nodes werden geladen… (${total})`);
          },
        });
      } catch (e) { /* silent */ }

      // Fetch admin-managed repeater links (approved, permanent only)
      if (cancelRef.current) return;
      try {
        const links = await base44.entities.RepeaterLink.filter({ status: "approved", link_type: "permanent" });
        if (!active || cancelRef.current) return;
        setAdminLinks(links || []);
      } catch (e) { /* silent */ }

      // Note: loading is set to false by onViewportData (first viewport data) or timeout
      if (active && !cancelRef.current) {
        // If viewport data hasn't arrived yet, stop loading after background data is done
        setLoading(false);
      }
    };

    loadFromServer();

    return () => {
      active = false;
      cancelRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const cancelLoading = useCallback(() => {
    cancelRef.current = true;
    setLoading(false);
  }, []);

  return { data, repeaters, privateNodes, adminLinks, loading, loadingMessage, cancelLoading, onViewportData };
}