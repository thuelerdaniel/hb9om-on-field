// MapLifecycleGuard — FIX 18.10.2026
// Prevents "Cannot read properties of undefined (reading '_leaflet_pos')" crash.
//
// ROOT CAUSE: When a Leaflet map unmounts during a zoom animation, the CSS
// transitionend event fires AFTER the map's panes/DOM are removed. The handler
// (_onZoomTransitionEnd → _move → _getNewPixelOrigin → _getMapPanePos) reads
// this._mapPane._leaflet_pos, but _mapPane is undefined → TypeError.
//
// FIX: On unmount, call map.stop() to synchronously finish/cancel any pending
// zoom animation, and remove all event listeners so no deferred callback fires
// on the destroyed map. This component must be a CHILD of <MapContainer>.
//
// Usage: place <MapLifecycleGuard /> inside any <MapContainer> that may unmount
// during a zoom animation (Home/Karte, Mobil views, Hunting map).

import { useEffect } from "react";
import { useMap } from "react-leaflet";

export default function MapLifecycleGuard() {
  const map = useMap();

  useEffect(() => {
    return () => {
      try {
        // Stop any running zoom/pan animation synchronously — prevents the
        // transitionend callback from firing after panes are removed.
        if (map && typeof map.stop === "function") {
          map.stop();
        }
        // Remove all event listeners so no deferred handler fires on the
        // destroyed map instance.
        if (map && typeof map.off === "function") {
          map.off();
        }
      } catch {
        // Map already partially destroyed — ignore.
      }
    };
  }, [map]);

  return null;
}