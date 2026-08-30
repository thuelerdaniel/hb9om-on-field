import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import MarkerPopup from "@/components/map/MarkerPopup";
import DraggablePopup from "@/components/map/DraggablePopup";
import { getMarkerSvg } from "@/lib/markerShapes";
import { AGGREGATE_THRESHOLD } from "@/components/map/CountryAggregateLayer";

// Hard cap on markers rendered at once — prevents "page not responding" on extreme loads.
// Canvas mode (CircleMarkers) is far cheaper than SVG divIcons, so allow 5x more.
const MAX_RENDER_MARKERS_SVG = 2000;
const MAX_RENDER_MARKERS_CANVAS = 10000;

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

function MapMarkersInner({ markers, dragMode, isAdmin, onEdit, onMarkerDrag, performanceMode, autoCanvasActive, userPosition, onViewportLimitChange, boundaryKeys, onToggleBoundary, onBoundaryRadiusChange, boundaryRadiusMap }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());
  const debounceRef = useRef(null);

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

  // Zoom-based aggregation: when zoomed out below threshold, skip individual markers
  // — CountryAggregateLayer shows country-level badges instead for performance
  const isAggregated = zoom < AGGREGATE_THRESHOLD && markers.length > 200;

  // Viewport culling: only render markers within current bounds + 30% buffer
  const paddedBounds = bounds.pad(0.3);
  const visibleMarkers = markers.filter(m =>
    m.lat != null && m.lng != null && paddedBounds.contains([m.lat, m.lng])
  );

  // Canvas mode: performance mode OR auto-canvas (time-based, triggered by parent)
  const useCanvasMode = performanceMode || autoCanvasActive;

  // Always sort by distance from map center — nearest markers render first.
  // This ensures markers closest to the viewport center are always prioritized
  // (progressive center-outward loading) and, when capping is needed, the
  // nearest ones are kept over distant ones earlier in the data array.
  const maxRender = useCanvasMode ? MAX_RENDER_MARKERS_CANVAS : MAX_RENDER_MARKERS_SVG;
  const center = map.getCenter();
  const clat = center.lat, clng = center.lng;
  const withDist = visibleMarkers.map(m => ({
    m,
    d: (m.lat - clat) ** 2 + (m.lng - clng) ** 2,
  }));
  withDist.sort((a, b) => a.d - b.d);
  const cappedMarkers = withDist.slice(0, maxRender).map(x => x.m);

  // Report viewport capping state to parent — used for the red blinking hint
  // above the legend when not all available data is displayed.
  useEffect(() => {
    if (onViewportLimitChange) {
      onViewportLimitChange({
        visibleCount: visibleMarkers.length,
        maxRender,
        totalCount: markers.length,
        isCapped: visibleMarkers.length > maxRender,
      });
    }
  }, [visibleMarkers.length, maxRender, markers.length, onViewportLimitChange]);

  // Aggregation active — CountryAggregateLayer takes over, skip individual markers
  if (isAggregated) return null;

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
  // Touch devices get larger markers for easier tapping; desktop stays compact for density
  const isTouch = typeof navigator !== "undefined" && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  const circleRadius = isTouch ? 10 : 7;
  const circleWeight = isTouch ? 3 : 2;
  if (useCanvasMode) {
    return (
      <>
        {cappedMarkers.map((m, idx) => {
          const key = `${m.layerType}-${m.code || m.reference || idx}`;
          return (
            <CircleMarker
              key={key}
              center={[m.lat, m.lng]}
              radius={circleRadius}
              pathOptions={{
                color: "#ffffff",
                weight: circleWeight,
                fillColor: m.color,
                fillOpacity: 0.85,
              }}
            >
              <DraggablePopup>
                <MarkerPopup data={m} layerType={m.layerType} isAdmin={isAdmin} onEdit={(data) => onEdit(data, m.layerType)} performanceMode={performanceMode} userPosition={userPosition} isBoundaryShown={boundaryKeys?.has(`${m.layerType}-${m.code || m.reference || m.id || ""}`)} onToggleBoundary={onToggleBoundary} onBoundaryRadiusChange={onBoundaryRadiusChange} boundaryRadius={boundaryRadiusMap?.[`${m.layerType}-${m.code || m.reference || m.id || ""}`]} />
              </DraggablePopup>
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
            <DraggablePopup>
              <MarkerPopup data={m} layerType={m.layerType} isAdmin={isAdmin} onEdit={(data) => onEdit(data, m.layerType)} performanceMode={performanceMode} userPosition={userPosition} isBoundaryShown={boundaryKeys?.has(`${m.layerType}-${m.code || m.reference || m.id || ""}`)} onToggleBoundary={onToggleBoundary} onBoundaryRadiusChange={onBoundaryRadiusChange} boundaryRadius={boundaryRadiusMap?.[`${m.layerType}-${m.code || m.reference || m.id || ""}`]} />
            </DraggablePopup>
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
    prev.autoCanvasActive === next.autoCanvasActive &&
    prev.userPosition === next.userPosition &&
    prev.onViewportLimitChange === next.onViewportLimitChange &&
    prev.boundaryKeys === next.boundaryKeys &&
    prev.onToggleBoundary === next.onToggleBoundary &&
    prev.onBoundaryRadiusChange === next.onBoundaryRadiusChange &&
    prev.boundaryRadiusMap === next.boundaryRadiusMap
  );
}

const MapMarkers = memo(MapMarkersInner, arePropsEqual);
export default MapMarkers;