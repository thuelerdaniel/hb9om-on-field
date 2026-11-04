import React, { memo, useEffect, useMemo } from "react";
import { Marker, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import MarkerPopup from "@/components/map/MarkerPopup";
import DraggablePopup from "@/components/map/DraggablePopup";
import { getMarkerSvg } from "@/lib/markerShapes";
import { isValidCoord } from "@/lib/geoUtilsFrontend";
import { AGGREGATE_THRESHOLD } from "@/components/map/CountryAggregateLayer";
import { useStableViewport } from "@/hooks/useStableViewport";

// Marker-Rendering der Referenz-Layer (SOTA/POTA/WWFF/…)
//
// v1.0 — Stabilität beim Pannen:
//   · Der Viewport kommt aus useStableViewport (200 ms Debounce, ein Frame) —
//     nicht mehr aus einem eigenen, sofort feuernden moveend-Handler.
//   · Die Marker-Reihenfolge wird nur bei neuen DATEN berechnet, nicht bei jeder
//     Bewegung. Dadurch bleiben Marker während des Ziehens an ihrem Platz.
//   · Massenmarker (> 400 im Ausschnitt) laufen automatisch über den Canvas-
//     Renderer (CircleMarker) statt über DOM-Symbole — kein Flackern, kein Ruckeln.
//   · Sichtbarkeitsfilter und Deckel sind memoisiert: nur Marker am Rand des
//     Ausschnitts kommen hinzu oder fallen weg.

const MAX_RENDER_MARKERS_SVG = 2000;
const MAX_RENDER_MARKERS_CANVAS = 10000;

// Ab dieser Anzahl sichtbarer Marker wird automatisch auf Canvas umgeschaltet —
// unabhängig davon, ob der Performance-Modus in den Einstellungen aktiv ist.
const AUTO_CANVAS_THRESHOLD = 400;

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
  // Stabile Viewport-Werte (Debounce + rAF) — siehe src/hooks/useStableViewport.js
  const { bounds, zoom } = useStableViewport();

  // Reihenfolge EINMAL pro Datensatz: nach Entfernung zur Kartenmitte, damit beim
  // Deckeln die nächstgelegenen Marker Vorrang haben. Während des Pannens wird
  // NICHT neu sortiert — das war die Ursache des Flackerns.
  const orderedMarkers = useMemo(() => {
    if (!markers || markers.length === 0) return [];
    const center = map.getCenter();
    const clat = center.lat, clng = center.lng;
    return markers
      .map(m => ({ m, d: isValidCoord(m.lat, m.lng) ? (m.lat - clat) ** 2 + (m.lng - clng) ** 2 : Infinity }))
      .sort((a, b) => a.d - b.d)
      .map(x => x.m);
  }, [markers, map]);

  // Zoom-based aggregation: when zoomed out below threshold, skip individual markers
  // — CountryAggregateLayer shows country-level badges instead for performance
  const isAggregated = zoom < AGGREGATE_THRESHOLD && orderedMarkers.length > 200;

  // Viewport culling: only render markers within current bounds + 30% buffer
  const paddedBounds = useMemo(() => bounds.pad(0.3), [bounds]);
  const visibleMarkers = useMemo(
    () => orderedMarkers.filter(m => isValidCoord(m.lat, m.lng) && paddedBounds.contains([m.lat, m.lng])),
    [orderedMarkers, paddedBounds]
  );

  // Canvas mode: performance mode, auto-canvas from parent, or simply "too many markers"
  const useCanvasMode = performanceMode || autoCanvasActive || visibleMarkers.length > AUTO_CANVAS_THRESHOLD;

  const maxRender = useCanvasMode ? MAX_RENDER_MARKERS_CANVAS : MAX_RENDER_MARKERS_SVG;

  const cappedMarkers = useMemo(
    () => (visibleMarkers.length > maxRender ? visibleMarkers.slice(0, maxRender) : visibleMarkers),
    [visibleMarkers, maxRender]
  );

  // Report viewport capping state to parent — used for the red hint above the legend
  // when not all available data is displayed.
  useEffect(() => {
    if (onViewportLimitChange) {
      onViewportLimitChange({
        visibleCount: visibleMarkers.length,
        maxRender,
        totalCount: orderedMarkers.length,
        isCapped: visibleMarkers.length > maxRender,
      });
    }
  }, [visibleMarkers.length, maxRender, orderedMarkers.length, onViewportLimitChange]);

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

  // Canvas mode: lightweight CircleMarkers on the canvas renderer (preferCanvas)
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