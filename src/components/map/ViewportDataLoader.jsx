import React, { useEffect, useRef, useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { base44 } from "@/api/base44Client";

// Viewport-based loading of the reference layers (SOTA, POTA, WWFF, …).
//
// v1.0 — Hintergrund-Laden:
//   · Kein Nachladen mehr beim Pannen in bereits geladene Gebiete: liegt der
//     aktuelle Ausschnitt im zuletzt geladenen Bereich (gleiche Layer-Auswahl),
//     wird nichts angefordert — der Bestand bleibt ruhig und die Karte flüssig.
//   · Nach jedem erfolgreichen Laden holt ein Leerlauf-Task (requestIdleCallback)
//     den doppelt so grossen Bereich im HINTERGRUND nach (staged prefetch).
//     Wer danach pannt, hat die Daten meist schon — ohne Ladepause.
//   · Abbrechbar: eine neue Anfrage bricht die vorherige ab, beim Unmount ebenfalls.
const DEBOUNCE_MS = 350;
const MAX_PER_TYPE = 20000;
const REQUEST_TIMEOUT_MS = 30000;
const REF_TYPES = ["sota", "pota", "hbff", "wwbota", "castle", "lighthouse", "llota", "iota", "aprs", "brandmeister"];

// Leerlauf-Task: requestIdleCallback mit Timeout-Fallback (Safari älter).
function onIdle(fn) {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 4000 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = setTimeout(fn, 1500);
  return () => clearTimeout(id);
}

function boundsContain(outer, inner, epsilon = 0.02) {
  return (
    inner.getNorth() <= outer.getNorth() + epsilon &&
    inner.getSouth() >= outer.getSouth() - epsilon &&
    inner.getEast() <= outer.getEast() + epsilon &&
    inner.getWest() >= outer.getWest() - epsilon
  );
}

export default function ViewportDataLoader({ activeLayers, onDataLoaded, isOffline, reloadTrigger }) {
  const map = useMap();
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const fetchedRef = useRef(null); // { bounds, typesKey } — zuletzt geladener Bereich
  const isFirstLoadRef = useRef(true);
  const idleCancelRef = useRef(null);

  const typesKey = REF_TYPES.filter(t => activeLayers.includes(t)).join(",");

  const fetchArea = useCallback(async (bounds, types, { isFirstLoad = false, replace = true } = {}) => {
    if (types.length === 0 || isOffline) return;

    if (abortRef.current) abortRef.current.aborted = true;
    const myAbort = { aborted: false };
    abortRef.current = myAbort;

    try {
      const padded = bounds.pad(0.3);
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

      const responseData = response?.data || response;

      if (myAbort.aborted || !onDataLoaded) return;

      const center = map.getCenter();
      onDataLoaded(responseData?.references || {}, isFirstLoad, { lat: center.lat, lng: center.lng });

      if (replace) {
        fetchedRef.current = { bounds: padded, typesKey: types.join(",") };
        isFirstLoadRef.current = false;
      }
    } catch (e) {
      // Silent — offline cache or previous data still shows
    }
  }, [map, onDataLoaded, isOffline]);

  // Lädt den sichtbaren Bereich — aber nur, wenn er nicht schon abgedeckt ist.
  const loadVisible = useCallback(({ force = false } = {}) => {
    if (isOffline) return;
    const types = REF_TYPES.filter(t => activeLayers.includes(t));
    if (types.length === 0) return;

    const bounds = map.getBounds();
    const known = fetchedRef.current;
    if (!force && known && known.typesKey === typesKey && boundsContain(known.bounds, bounds)) {
      // Ausschnitt ist bereits abgedeckt — kein Nachladen, kein Flackern beim Pannen.
      return;
    }

    fetchArea(bounds, types, { isFirstLoad: isFirstLoadRef.current });

    // Staged prefetch: im Leerlauf den doppelt so grossen Bereich nachziehen,
    // damit das nächste Pannen ohne Wartezeit Daten hat.
    if (idleCancelRef.current) idleCancelRef.current();
    idleCancelRef.current = onIdle(() => {
      if (abortRef.current?.aborted) return;
      const big = map.getBounds().pad(1.0);
      fetchArea(big, types, { isFirstLoad: false, replace: false });
    });
  }, [map, activeLayers, typesKey, fetchArea, isOffline]);

  const handleMapChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadVisible(), DEBOUNCE_MS);
  }, [loadVisible]);

  // Immer die aktuelle Ladefunktion — die Effekte unten hängen nur an den Daten,
  // nicht an der Identität der Funktion (sonst lädt jeder Layer-Toggle neu).
  const loadRef = useRef(loadVisible);
  loadRef.current = loadVisible;

  // Neue Layer-Auswahl der Referenz-Typen → alter Bereich gilt nicht mehr.
  useEffect(() => {
    if (abortRef.current) abortRef.current.aborted = true;
    fetchedRef.current = null;
    isFirstLoadRef.current = true;
    if (idleCancelRef.current) idleCancelRef.current();
    loadRef.current({ force: true });
  }, [typesKey]);

  // Reload when reloadTrigger changes (e.g. when FirstTimeSetup modal closes)
  useEffect(() => {
    if (reloadTrigger) {
      isFirstLoadRef.current = true;
      fetchedRef.current = null;
      loadRef.current({ force: true });
    }
  }, [reloadTrigger]);

  useMapEvents({
    moveend: handleMapChange,
    zoomend: handleMapChange,
  });

  // Cleanup
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (idleCancelRef.current) idleCancelRef.current();
    if (abortRef.current) abortRef.current.aborted = true;
  }, []);

  return null;
}