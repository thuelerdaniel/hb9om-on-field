import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useMap, useMapEvents } from "react-leaflet";

// Stabiler Karten-Viewport (v1.0).
//
// Problem vorher: Jede Pan-Bewegung löste über moveend/zoomend sofort ein
// Neu-Filtern der Marker, ein Neu-Sortieren und damit ein Neu-Anlegen von
// hunderten Markern aus — die Karte flackerte, Marker verschwanden kurz.
//
// Dieser Hook liefert den Viewport deshalb:
//   - entkoppelt vom Gestus: erst 200 ms NACH moveend/zoomend (Debounce),
//   - gebündelt in einem requestAnimationFrame (ein React-Render, nicht viele),
//   - als STABILES Objekt: unveränderte Werte behalten ihre Referenz, damit
//     useMemo-Ketten nicht unnötig neu rechnen.
//
// Während des Ziehens bleibt der alte Viewport gültig — der bestehende
// Marker-Bestand bleibt also stehen, statt bei jedem Pixel neu aufgebaut zu werden.

const DEBOUNCE_MS = 200;

function round(v) {
  // 5 Nachkommastellen ≈ 1 m — feiner braucht keine Karte, und es hält die
  // Referenzen stabil, wenn Leaflet minimal andere Werte liefert.
  return Math.round(v * 1e5) / 1e5;
}

function readViewport(map) {
  const b = map.getBounds();
  const c = map.getCenter();
  return {
    north: round(b.getNorth()),
    south: round(b.getSouth()),
    east: round(b.getEast()),
    west: round(b.getWest()),
    imperialist: false,
    zoom: map.getZoom(),
    center: [round(c.lat), round(c.lng)],
  };
}

function sameViewport(a, b) {
  return (
    a.north === b.north && a.south === b.south &&
    a.east === b.east && a.west === b.west &&
    a.zoom === b.zoom &&
    a.center[0] === b.center[0] && a.center[1] === b.center[1]
  );
}

// Bounds-Objekt mit der Leaflet-API, die die Renderer brauchen (contains/pad/isValid).
function toBounds(vp) {
  return {
    north: vp.north,
    south: vp.south,
    east: vp.east,
    west: vp.west,
    zoom: vp.zoom,
    center: vp.center,
    contains: ([lat, lng]) =>
      lat <= vp.north && lat >= vp.south && lng <= vp.east && lng >= vp.west,
    pad: (ratio) => {
      const dLat = (vp.north - vp.south) * ratio;
      const dLng = (vp.east - vp.west) * ratio;
      const p = {
        north: vp.north + dLat,
        south: vp.south - dLat,
        east: vp.east + dLng,
        west: vp.west - dLng,
      };
      p.contains = ([lat, lng]) =>
        lat <= p.north && lat >= p.south && lng <= p.east && lng >= p.west;
      p.isValid = () => true;
      p.getNorth = () => p.north;
      p.getSouth = () => p.south;
      p.getEast = () => p.east;
      p.getWest = () => p.west;
      return p;
    },
    isValid: () => true,
    getNorth: () => vp.north,
    getSouth: () => vp.south,
    getEast: () => vp.east,
    getWest: () => vp.west,
  };
}

export function useStableViewport(debounceMs = DEBOUNCE_MS) {
  const map = useMap();
  const [viewport, setViewport] = useState(() => readViewport(map));
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const timerRef = useRef(null);
  const rafRef = useRef(null);

  const commit = useCallback((next) => {
    setViewport(prev => (sameViewport(prev, next) ? prev : next));
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const next = readViewport(map);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => commit(next));
    }, debounceMs);
  }, [map, commit, debounceMs]);

  useMapEvents({
    moveend: schedule,
    zoomend: schedule,
    // Beim Start eines Gestus nichts tun — der alte Viewport bleibt gültig,
    // damit der Marker-Bestand während des Ziehens stehen bleibt.
  });

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // Referenz bleibt stabil, solange sich der Viewport nicht geändert hat —
  // sonst würden alle useMemo-Ketten der Layer bei jedem Render neu rechnen.
  const bounds = useMemo(() => toBounds(viewport), [viewport]);

  return { viewport, bounds, zoom: viewport.zoom, center: viewport.center };
}

export default useStableViewport;