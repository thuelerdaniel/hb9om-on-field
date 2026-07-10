import React, { memo } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import MarkerPopup from "@/components/map/MarkerPopup";
import { getMarkerSvg } from "@/lib/markerShapes";

function createDraggableIcon(color) {
  return L.divIcon({
    html: `<div style="width: 32px; height: 32px; border-radius: 50%; background: ${color}; border: 4px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.6); cursor: grab; display: flex; align-items: center; justify-content: center; touch-action: none;">
      <div style="width: 10px; height: 10px; border-radius: 50%; background: white; opacity: 0.7;"></div>
    </div>`,
    className: "draggable-marker-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

function createShapeIcon(layerType, color) {
  const svg = getMarkerSvg(layerType, color);
  return L.divIcon({
    html: `<div style="width: 28px; height: 28px; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5));">${svg}</div>`,
    className: "shape-marker-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12]
  });
}

function MapMarkersInner({ markers, dragMode, isAdmin, onEdit, onMarkerDrag }) {
  return (
    <>
      {markers.map((m, idx) => {
        const key = `${m.layerType}-${m.code || m.reference || idx}`;
        if (dragMode) {
          return (
            <Marker
              key={key}
              position={[m.lat, m.lng]}
              icon={createDraggableIcon(m.color)}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const ll = e.target.getLatLng();
                  onMarkerDrag(m, ll.lat, ll.lng);
                }
              }}
            />
          );
        }
        return (
          <Marker
            key={key}
            position={[m.lat, m.lng]}
            icon={createShapeIcon(m.layerType, m.color)}
            eventHandlers={{
              click: (e) => {
                const map = e.target._map;
                if (map) {
                  map.flyTo([m.lat, m.lng], Math.max(map.getZoom(), 13), { duration: 0.5 });
                }
              }
            }}
          >
            <Popup>
              <MarkerPopup data={m} layerType={m.layerType} isAdmin={isAdmin} onEdit={(data) => onEdit(data, m.layerType)} />
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
    prev.onEdit === next.onEdit
  );
}

const MapMarkers = memo(MapMarkersInner, arePropsEqual);
export default MapMarkers;