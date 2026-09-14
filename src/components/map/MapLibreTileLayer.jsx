import { useEffect, useRef, useState } from "react";
import { useMap, TileLayer } from "react-leaflet";
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
export default function MapLibreTileLayer({ styleUrl, attribution, opacity, isOffline, tileKeyPrefix, terrain3DEnabled }) {
  const map = useMap();
  const layerRef = useRef(null);
  const blobUrlsRef = useRef(new Set());
  // v0.951-hotfix: L.maplibreGL may be undefined in production builds (tree-shaking removes side-effect).
  // Fall back to raster TileLayer if MapLibre GL plugin is not available.
  const [maplibreAvailable] = useState(() => typeof L.maplibreGL === "function");

  useEffect(() => {
    if (!maplibreAvailable || !styleUrl || !L.maplibreGL) {
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

      // Wait for map container to have valid dimensions (prevents NaN LatLng error)
      const size = map.getSize();
      if (size.x === 0 || size.y === 0) {
        map.invalidateSize();
        await new Promise(r => setTimeout(r, 200));
        if (cancelled) return;
        const size2 = map.getSize();
        if (size2.x === 0 || size2.y === 0) {
          console.warn("MapLibreTileLayer: map container has zero dimensions, skipping");
          return;
        }
      }

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
        // Retry once after invalidateSize (container may have just become visible)
        setTimeout(() => {
          if (cancelled || !layerRef.current) return;
          map.invalidateSize();
          try {
            layerRef.current.addTo(map);
            layerRef.current.bringToBack();
          } catch (retryErr) {
            console.warn("MapLibreTileLayer retry failed:", retryErr.message);
          }
        }, 300);
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

  // v0.951: 3D terrain toggle — adds terrain source + pitch to the MapLibre GL map.
  // The GL map is the base tile renderer; Leaflet overlays (markers, popups) stay in 2D screen space
  // but remain fully functional. Terrain gives a 3D elevation effect on the base map.
  useEffect(() => {
    const gl = layerRef.current;
    if (!gl) return;
    const glMap = gl._glMap || gl.getMap?.();
    if (!glMap) return;

    const applyTerrain = () => {
      try {
        if (terrain3DEnabled) {
          // Add terrain source if not present
          if (!glMap.getSource('terrain')) {
            glMap.addSource('terrain', {
              type: 'raster-dem',
              tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
              encoding: 'terrarium',
              tileSize: 256,
              maxzoom: 14,
            });
          }
          glMap.setTerrain({ source: 'terrain', exaggeration: 1.2 });
          glMap.setPitch(45);
        } else {
          glMap.setTerrain(null);
          glMap.setPitch(0);
        }
      } catch (e) {
        console.warn('MapLibreTileLayer 3D terrain toggle failed:', e.message);
      }
    };

    if (glMap.isStyleLoaded()) {
      applyTerrain();
    } else {
      glMap.once('load', applyTerrain);
    }
  }, [terrain3DEnabled]);

  // Fallback: raster TileLayer when MapLibre GL plugin is not available (production tree-shaking fix)
  if (!maplibreAvailable) {
    console.warn("[MapLibreTileLayer] L.maplibreGL not available — using raster tile fallback");
    return (
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
        opacity={opacity}
      />
    );
  }

  return null;
}