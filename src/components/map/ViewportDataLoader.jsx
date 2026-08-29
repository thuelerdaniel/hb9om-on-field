import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { base44 } from "@/api/base44Client";

// Viewport-based loading: only fetch reference points within the visible map area.
// Replaces the old "load all 270k+ points into memory" approach.
// Calls getReferencesInBounds backend function on debounced pan/zoom.
// Accumulates visited areas so panning back doesn't re-fetch.
// Also loads repeaters viewport-based (not all 48k at once).
const DEBOUNCE_MS = 350;
const MAX_PER_TYPE = 10000;
const REQUEST_TIMEOUT_MS = 30000;
const REF_TYPES = ["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse", "repeater", "aprs", "brandmeister"];

export default function ViewportDataLoader({ activeLayers, onDataLoaded, isOffline, reloadTrigger }) {
  const map = useMap();
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const fetchedBoundsRef = useRef(null); // Track the largest bounds we've fetched
  const isFirstLoadRef = useRef(true);

  // Reload when reloadTrigger changes (e.g. when FirstTimeSetup modal closes)
  useEffect(() => {
    if (reloadTrigger) {
      isFirstLoadRef.current = true;
      fetchedBoundsRef.current = null;
      handleMapChange();
    }
  }, [reloadTrigger]);

  const loadBounds = useCallback(async (bounds, types) => {
    if (types.length === 0 || isOffline) return;

    // Abort previous in-flight request
    if (abortRef.current) abortRef.current.aborted = true;
    const myAbort = { aborted: false };
    abortRef.current = myAbort;

    try {
      const padded = bounds.pad(0.3);
      // Race the function call against a timeout — prevents hanging if the backend is slow
      const responsePromise = base44.functions.invoke("getReferencesInBounds", {
        bounds: {
          north: padded.getNorth(),
          south: padded.getSouth(),
          east: padded.getEast(),
          west: padded.getWest(),
        },
        types,
        max_per_type: MAX_PER_TYPE,
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), REQUEST_TIMEOUT_MS)
      );
      const response = await Promise.race([responsePromise, timeoutPromise]);

      // SDK may wrap response in a `data` field — handle both formats
      const responseData = response?.data || response;

      if (!myAbort.aborted && onDataLoaded) {
        onDataLoaded(responseData?.references || {}, isFirstLoadRef.current);
        isFirstLoadRef.current = false;
        fetchedBoundsRef.current = padded;
      }
    } catch (e) {
      // Silent — offline cache or previous data still shows
    }
  }, [onDataLoaded, isOffline]);

  const handleMapChange = useCallback(() => {
    if (isOffline) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const bounds = map.getBounds();
      const types = REF_TYPES.filter(t => activeLayers.includes(t));
      if (types.length === 0) return;

      // Always re-fetch on map change — bounds caching prevented worldwide data from loading
      // when panning to new areas (e.g. POTA only showed CH because old CH bounds were cached)
      loadBounds(bounds, types);
    }, DEBOUNCE_MS);
  }, [map, activeLayers, loadBounds, isOffline]);

  useMapEvents({
    moveend: handleMapChange,
    zoomend: handleMapChange,
  });

  // Reset fetched bounds when active layers change — ensures new layers get fetched
  // even if the map hasn't moved (e.g. toggling APRS on without panning)
  useEffect(() => {
    fetchedBoundsRef.current = null;
    isFirstLoadRef.current = true;
  }, [activeLayers]);

  // Load on mount and when active layers change
  useEffect(() => {
    handleMapChange();
  }, [handleMapChange]);

  // Cleanup
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.aborted = true;
  }, []);

  return null;
}