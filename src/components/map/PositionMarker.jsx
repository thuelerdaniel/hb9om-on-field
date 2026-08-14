import React, { useRef } from "react";
import { Circle, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import PositionPopupContent from "@/components/map/PositionPopupContent";

const positionIconCache = {};
function getPositionIcon(fixed) {
  if (!positionIconCache[fixed]) {
    const color = fixed ? "#2563eb" : "#ef4444";
    const html = `
      <div style="position: relative; width: 24px; height: 24px;">
        <div style="
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 14px; height: 14px; border-radius: 50%;
          background: ${color}; border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        "></div>
      </div>
    `;
    positionIconCache[fixed] = L.divIcon({ html, className: "position-marker-icon", iconSize: [24, 24], iconAnchor: [12, 12] });
  }
  return positionIconCache[fixed];
}

/**
 * Renders a fixed/manual position marker with circle and full popup.
 * Only renders when a position is explicitly set (fixedPosition).
 * GPS live position is handled by GpsTracker.
 */
export default function PositionMarker({ position, fixed, radius = 5000, onRadiusChange, onPositionChange, draggable = false }) {
  if (!position) return null;
  const [lat, lng] = position;

  return (
    <>
      <Circle
        center={[lat, lng]}
        radius={radius}
        interactive={false}
        pathOptions={{
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "6 4",
        }}
      />
      <Marker
        position={[lat, lng]}
        icon={getPositionIcon(true)}
        zIndexOffset={1000}
        draggable={draggable}
        eventHandlers={draggable ? {
          dragend: (e) => {
            const m = e.target;
            const p = m.getLatLng();
            onPositionChange?.([p.lat, p.lng]);
          },
        } : undefined}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
          📍 Fixierte Position
        </Tooltip>
        <Popup>
          <PositionPopupContent
            lat={lat}
            lng={lng}
            radius={radius}
            onRadiusChange={onRadiusChange}
            onPositionChange={onPositionChange}
            title="📍 Fixierte Position"
          />
        </Popup>
      </Marker>
    </>
  );
}