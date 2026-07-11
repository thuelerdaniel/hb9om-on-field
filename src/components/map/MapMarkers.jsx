import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import MarkerPopup from "@/components/map/MarkerPopup";
import { getMarkerSvg } from "@/lib/markerShapes";

// Above this count, automatically switch to lightweight CircleMarker (canvas) to prevent browser freeze
const CANVAS_THRESHOLD = 1500;
// Hard cap on markers rendered at once — prevents "page not responding" on extreme loads
const MAX_RENDER_MARKERS = 2000;

// Cache divIcons per (layerType, color) — creating L.divIcon for every marker is extremely expensive
const iconCache = new Map();
const draggableIconCache = new Map();

function getShapeIcon(layerType, color) {
  const key = `${layerType}:${color}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const svg = getMarkerSvg(layerType, color);
    icon = L.divIcon({
      html: `<div style="width: 28px; height: 28px; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5));">${svg}</div>`,
      className: "shape-marker-icon",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -12]
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function getDraggableIcon(color) {
  let icon = draggableIconCache.get(color);
  if (!icon) {
    icon = L.divIcon({
      html: `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${color}; border: 4px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.6); cursor: grab; display: flex; align-items: center; justify-content: center; touch-action: none;">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: white; opacity: 0.7;"></div>
      </div>`,
      className: "draggable-marker-icon",
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    draggableIconCache.set(color, icon);
  }
  return icon;
}

function MapMarkersInner({ markers, dragMode, isAdmin, onEdit, onMarkerDrag, performanceMode, autoModeOverride, onAutoCanvas }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());
  const debounceRef = useRef(null);
  const autoCanvasNotified = useRef(false);

  // Debounced viewport update — prevents filter+re-render storm during pan/zoom
  const updateBounds = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setBounds(map.getBounds());
      setZoom(map.getZoom());
    }, 150);
  }, [map]);

  useMapEvents({
    zoomend: updateBounds,
    moveend: updateBounds,
  });

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Viewport culling: only render markers within current bounds + 30% buffer
  const paddedBounds = bounds.pad(0.3);
  const visibleMarkers = markers.filter(m =>
    m.lat != null && m.lng != null && paddedBounds.contains([m.lat, m.lng])
  );

  // Auto-canvas: too many markers → switch to lightweight CircleMarker (canvas) to prevent freeze
  const isAutoCanvas = !performanceMode && !autoModeOverride && !dragMode && visibleMarkers.length > CANVAS_THRESHOLD;
  const useCanvasMode = performanceMode || isAutoCanvas;

  // Notify parent once per session when auto-canvas activates (not when user manually enabled performance mode)
  useEffect(() => {
    if (isAutoCanvas && !autoCanvasNotified.current && onAutoCanvas) {
      // Only show the banner once per browser session — prevents re-triggering on pan/zoom
      const alreadyShown = sessionStorage.getItem("hb9om_auto_canvas_shown") === "true";
      if (!alreadyShown) {
        autoCanvasNotified.current = true;
        sessionStorage.setItem("hb9om_auto_canvas_shown", "true");
        onAutoCanvas();
      }
    }
    if (!isAutoCanvas) {
      autoCanvasNotified.current = false;
    }
  }, [isAutoCanvas, onAutoCanvas]);
  // Hard cap: never render more than MAX_RENDER_MARKERS (takes first N within viewport)
  const cappedMarkers = visibleMarkers.length > MAX_RENDER_MARKERS
    ? visibleMarkers.slice(0, MAX_RENDER_MARKERS)
    : visibleMarkers;

  // Drag mode: always use draggable markers
  if (dragMode) {
    return (
      <>
        {cappedMarkers.map((m, idx) => {
          const key = `${m.layerType}-${m.code || m.reference || idx}`;
          return (
            <Marker
              key={key}
              position={[m.lat, m.lng]}
              icon={getDraggableIcon(m.color)}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const ll = e.target.getLatLng();
                  onMarkerDrag(m, ll.lat, ll.lng);
                }
              }}
            />
          );
        })}
      </>
    );
  }

  // Canvas mode (performance mode OR auto-switch when too many markers): lightweight CircleMarkers on canvas
  if (useCanvasMode) {
    return (
      <>
        {cappedMarkers.map((m, idx) => {
          const key = `${m.layerType}-${m.code || m.reference || idx}`;
          return (
            <CircleMarker
              key={key}
              center={[m.lat, m.lng]}
              radius={5}
              pathOptions={{
                color: "#ffffff",
                weight: 1.5,
                fillColor: m.color,
                fillOpacity: 0.85,
              }}
            >
              <Popup>
                <MarkerPopup data={m} layerType={m.layerType} isAdmin={isAdmin} onEdit={(data) => onEdit(data, m.layerType)} performanceMode={performanceMode} />
              </Popup>
            </CircleMarker>
          );
        })}
      </>
    );
  }

  // Normal mode: SVG divIcon markers with shapes (original symbols)
  return (
    <>
      {cappedMarkers.map((m, idx) => {
        const key = `${m.layerType}-${m.code || m.reference || idx}`;
        return (
          <Marker
            key={key}
            position={[m.lat, m.lng]}
            icon={getShapeIcon(m.layerType, m.color)}
          >
            <Popup>
              <MarkerPopup data={m} layerType={m.layerType} isAdmin={isAdmin} onEdit={(data) => onEdit(data, m.layerType)} performanceMode={performanceMode} />
            </Popup>
          </Marker>
        );
      })}
    </>
  );
  }

function arePropsEqual(prev, next) {
  return (
    prev.markers === next.markers &&
    prev.dragMode === next.dragMode &&
    prev.isAdmin === next.isAdmin &&
    prev.onMarkerDrag === next.onMarkerDrag &&
    prev.onEdit === next.onEdit &&
    prev.performanceMode === next.performanceMode &&
    prev.autoModeOverride === next.autoModeOverride
  );
}

const MapMarkers = memo(MapMarkersInner, arePropsEqual);
export default MapMarkers;