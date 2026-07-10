import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getTile } from "@/lib/offlineMapStore";

// Custom Leaflet tile layer that serves from IndexedDB when offline
const OfflineTileLayerClass = L.TileLayer.extend({
  createTile: function (coords, done) {
    const tile = document.createElement("img");

    if (this.options.isOffline) {
      tile.style.backgroundColor = "#e8e8e8";
      const key = `${this.options.tileKeyPrefix}_${coords.z}_${coords.x}_${coords.y}`;
      getTile(key)
        .then((blob) => {
          if (blob) {
            tile.src = URL.createObjectURL(blob);
            done(null, tile);
          } else {
            done(null, tile);
          }
        })
        .catch(() => done(null, tile));
    } else {
      tile.src = this.getTileUrl(coords);
      tile.onload = () => done(null, tile);
      tile.onerror = () => done(new Error("tile error"), tile);
    }

    return tile;
  },
});

export default function MapTileLayer({
  url,
  attribution,
  maxZoom,
  opacity,
  isOffline,
  tileKeyPrefix,
}) {
  const map = useMap();
  const layerRef = useRef(null);

  // Create/remove layer only when url, offline mode, or tileKeyPrefix changes
  useEffect(() => {
    const layer = new OfflineTileLayerClass(url, {
      attribution,
      maxZoom,
      opacity: opacity != null ? opacity : 1,
      isOffline: !!isOffline,
      tileKeyPrefix: tileKeyPrefix || "",
      keepBuffer: 4,
      updateWhenZooming: false,
      updateWhenIdle: false,
      crossOrigin: "anonymous",
    });
    layerRef.current = layer;
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, url, isOffline, tileKeyPrefix]);

  // Update opacity in-place without recreating the layer (prevents tile reload)
  useEffect(() => {
    if (layerRef.current && opacity != null) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null;
}