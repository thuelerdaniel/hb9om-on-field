import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { loadCachedReferenceData, loadCachedRepeaters, loadCachedPrivateNodes, loadCachedTota } from "@/lib/offlineDataCache";
import { loadAllRepeaters, loadAllPrivateNodes } from "@/lib/paginatedLoader";

// Loads all map data: reference points (SOTA, POTA, WWFF, WWBOTA, castles, lighthouses, IOTA),
// TOTA points, repeaters, private nodes (APRS + BrandMeister), and admin-managed repeater links.
// Tries offline cache first for instant display, then fetches from server.
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

  // Fetch from server — runs after offline cache is loaded
  useEffect(() => {
    cancelRef.current = false;
    let active = true;

    const loadFromServer = async () => {
      // Fetch reference data from ReferenceData entity (contains all refs as arrays)
      try {
        setLoadingMessage("Referenzen werden geladen…");
        const refDataEntries = await base44.entities.ReferenceData.list();
        if (!active || cancelRef.current) return;

        const refMap = {};
        for (const entry of refDataEntries || []) {
          if (entry.type && Array.isArray(entry.references)) {
            refMap[entry.type] = entry.references.filter(r => r.lat != null && r.lng != null);
          }
        }
        setData(prev => ({
          sota: refMap.sota || prev.sota,
          pota: refMap.pota || prev.pota,
          hbff: refMap.hbff || prev.hbff,
          wwbota: refMap.wwbota || prev.wwbota,
          castle: refMap.castle || prev.castle,
          iota: refMap.iota || prev.iota,
          lighthouse: refMap.lighthouse || prev.lighthouse,
          tota: prev.tota,
        }));
      } catch (e) {
        // Keep offline cache if server fetch fails
      }

      // Fetch TOTA points
      if (cancelRef.current) return;
      try {
        setLoadingMessage("TOTA-Punkte werden geladen…");
        const totaPoints = await base44.entities.TotaPoint.filter({}, undefined, 5000);
        if (!active || cancelRef.current) return;
        const totaFiltered = (totaPoints || []).filter(t => t.lat != null && t.lng != null);
        setData(prev => ({ ...prev, tota: totaFiltered }));
      } catch (e) { /* silent */ }

      // Fetch repeaters via paginated loader
      if (cancelRef.current) return;
      try {
        setLoadingMessage("Relais werden geladen…");
        await loadAllRepeaters({
          onBatch: (batch, total) => {
            if (!active || cancelRef.current) return;
            setRepeaters(prev => [...prev, ...batch]);
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

      if (active && !cancelRef.current) {
        setLoading(false);
      }
    };

    loadFromServer();

    return () => {
      active = false;
      cancelRef.current = true;
    };
  }, []);

  const cancelLoading = useCallback(() => {
    cancelRef.current = true;
    setLoading(false);
  }, []);

  return { data, repeaters, privateNodes, adminLinks, loading, loadingMessage, cancelLoading };
}