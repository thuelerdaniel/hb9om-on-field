import React, { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { safeSetItem } from "@/lib/safeStorage";

// Karten-Ereignisse der Hauptkarte (v1.0 aus Home.jsx ausgelagert).
//
// Neu: Der Kartenzustand (Mittelpunkt + Zoom) wird nicht mehr bei JEDEM moveend
// synchron in localStorage geschrieben — das kostete bei schnellem Pannen Zeit
// mitten im Gestus. Jetzt 300 ms nach der letzten Bewegung, einmal pro Ruhephase.

const SAVE_DEBOUNCE_MS = 300;

export default function MapController({ onMapReady, onMapClick }) {
  const map = useMap();
  const onMapClickRef = useRef(null);
  onMapClickRef.current = onMapClick;
  const saveTimer = useRef(null);

  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const saveState = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const c = map.getCenter();
      safeSetItem("hb9om_map_state", JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
    }, SAVE_DEBOUNCE_MS);
  };

  useMapEvents({
    zoomend: saveState,
    moveend: saveState,
    click: (e) => { if (onMapClickRef.current) onMapClickRef.current(e.latlng); },
  });

  return null;
}