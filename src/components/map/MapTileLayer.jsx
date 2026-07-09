import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getTile } from "@/lib/offlineMapStore";

// Custom Leaflet tile layer that serves from IndexedDB when offline
const OfflineTileLayerClass = L.TileLayer.extend({
  createTile: function (coords, done) {
    const tile = document.createElement("img");

    if (this.options.isOffline) {
      // Light gray placeholder so missing tiles don't show as black bars
      tile.style.backgroundColor = "#e8e8e8";
      const key = `${this.options.tileKeyPrefix}_${coords.z}_${coords.x}_${coords.y}`;
      getTile(key)
        .then((blob) => {
          if (blob) {
            tile.src = URL.createObjectURL(blob);
            done(null, tile);
          } else {
            // No cached tile – keep light placeholder, no error
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

  useEffect(() => {
    const layer = new OfflineTileLayerClass(url, {
      attribution,
      maxZoom,
      opacity: opacity != null ? opacity : 1,
      isOffline: !!isOffline,
      tileKeyPrefix: tileKeyPrefix || "",
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, url, attribution, maxZoom, opacity, isOffline, tileKeyPrefix]);

  return null;
}