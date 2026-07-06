import React from "react";
import { Circle, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

function createPositionIcon(fixed) {
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
  return L.divIcon({
    html,
    className: "position-marker-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function PositionMarker({ position, fixed, radius = 5000 }) {
  if (!position) return null;
  const [lat, lng] = position;

  return (
    <>
      <Circle
        center={[lat, lng]}
        radius={radius}
        pathOptions={{
          color: fixed ? "#2563eb" : "#ef4444",
          fillColor: fixed ? "#2563eb" : "#ef4444",
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "6 4",
        }}
      />
      <Marker
        position={[lat, lng]}
        icon={createPositionIcon(fixed)}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
          {fixed ? "📍 Fixierte Position" : "📍 Meine Position (GPS)"}
        </Tooltip>
      </Marker>
    </>
  );
}