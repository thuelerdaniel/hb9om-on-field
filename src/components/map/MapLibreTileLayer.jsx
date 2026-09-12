import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import "@maplibre/maplibre-gl-leaflet";
import { loadAllTileBlobs } from "@/lib/offlineMapStore";

/**
 * MapLibre GL tile layer for OpenFreeMap vector tiles.
 * Uses @maplibre/maplibre-gl-leaflet to render vector tiles within Leaflet.
 * v0.951: Supports offline mode — pre-loads PBF tiles from IndexedDB and
 * serves them via transformRequest (blob URLs created on demand).
 */
export default function MapLibreTileLayer({ styleUrl, attribution, opacity, isOffline, tileKeyPrefix }) {
  const map = useMap();
  const layerRef = useRef(null);
  const blobUrlsRef = useRef(new Set());

  useEffect(() => {
    if (!styleUrl || !L.maplibreGL) {
      console.warn("MapLibreTileLayer: maplibreGL not available or no styleUrl");
      return;
    }

    let cancelled = false;

    const initLayer = async () => {
      let transformRequest = undefined;

      // v0.951: Offline mode — pre-load PBF vector tiles from IndexedDB
      if (isOffline && tileKeyPrefix) {
        try {
          const tileBlobs = await loadAllTileBlobs(tileKeyPrefix);
          if (cancelled) return;
          console.log(`[MapLibreTileLayer] Offline: loaded ${tileBlobs.size} cached tiles for ${tileKeyPrefix}`);

          transformRequest = (url, resourceType) => {
            if (resourceType === "tile" && url.includes("openfreemap.org")) {
              // Extract z/x/y from OpenFreeMap tile URL
              const match = url.match(/\/tiles\/(\d+)\/(\d+)\/(\d+)/);
              if (match) {
                const [, z, x, y] = match;
                const key = `${tileKeyPrefix}_${z}_${x}_${y}`;
                const blob = tileBlobs.get(key);
                if (blob) {
                  const blobUrl = URL.createObjectURL(blob);
                  blobUrlsRef.current.add(blobUrl);
                  return { url: blobUrl };
                }
              }
            }
            return { url };
          };
        } catch (e) {
          console.warn("MapLibreTileLayer offline init failed:", e.message);
        }
      }

      if (cancelled) return;

      try {
        const gl = L.maplibreGL({
          style: styleUrl,
          attribution: attribution || "",
          transformRequest,
        });
        layerRef.current = gl;
        gl.addTo(map);
        gl.bringToBack();
      } catch (e) {
        console.warn("MapLibreTileLayer init failed:", e.message);
      }
    };

    initLayer();

    return () => {
      cancelled = true;
      if (layerRef.current) {
        try { map.removeLayer(layerRef.current); } catch {}
        layerRef.current = null;
      }
      // Revoke all blob URLs created during offline rendering
      for (const url of blobUrlsRef.current) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      blobUrlsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleUrl, isOffline, tileKeyPrefix]);

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