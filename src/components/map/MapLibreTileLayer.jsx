import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import "@maplibre/maplibre-gl-leaflet";

/**
 * MapLibre GL tile layer for OpenFreeMap vector tiles.
 * Uses @maplibre/maplibre-gl-leaflet to render vector tiles within Leaflet.
 * Falls back silently if MapLibre GL is not available.
 */
export default function MapLibreTileLayer({ styleUrl, attribution, opacity }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!styleUrl || !L.maplibreGL) {
      console.warn("MapLibreTileLayer: maplibreGL not available or no styleUrl");
      return;
    }

    try {
      const gl = L.maplibreGL({
        style: styleUrl,
        attribution: attribution || "",
      });
      layerRef.current = gl;
      gl.addTo(map);
      gl.bringToBack();
    } catch (e) {
      console.warn("MapLibreTileLayer init failed:", e.message);
    }

    return () => {
      if (layerRef.current) {
        try { map.removeLayer(layerRef.current); } catch {}
        layerRef.current = null;
      }
    };
  }, [map, styleUrl]);

  useEffect(() => {
    if (layerRef.current && opacity != null) {
      try {
        const container = layerRef.current.getContainer?.();
        if (container) container.style.opacity = String(opacity);
      } catch {}
    }
  }, [opacity]);

  return null;
}