import React, { memo, useState } from "react";
import { Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import MarkerPopup from "@/components/map/MarkerPopup";
import { getMarkerSvg } from "@/lib/markerShapes";

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

function MapMarkersInner({ markers, dragMode, isAdmin, onEdit, onMarkerDrag, performanceMode }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds());

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
    moveend: () => setBounds(map.getBounds()),
  });

  // Viewport culling: only render markers within current bounds + 30% buffer
  const paddedBounds = bounds.pad(0.3);
  const visibleMarkers = markers.filter(m =>
    m.lat != null && m.lng != null && paddedBounds.contains([m.lat, m.lng])
  );

  // Drag mode: always use draggable markers
  if (dragMode) {
    return (
      <>
        {visibleMarkers.map((m, idx) => {
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

  // Performance mode: simple colored dots (Canvas) — for slow devices/connections
  if (performanceMode) {
    return (
      <>
        {visibleMarkers.map((m, idx) => {
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
              {visibleMarkers.map((m, idx) => {
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
    prev.performanceMode === next.performanceMode
  );
}

const MapMarkers = memo(MapMarkersInner, arePropsEqual);
export default MapMarkers;