import React from "react";
import { Circle, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";

function latLngToGrid(lat, lng) {
  const adjLng = lng + 180;
  const adjLat = lat + 90;
  const fieldLng = Math.floor(adjLng / 20);
  const fieldLat = Math.floor(adjLat / 10);
  const squareLng = Math.floor((adjLng % 20) / 2);
  const squareLat = Math.floor(adjLat % 10);
  const subSqLng = Math.floor((adjLng % 20 % 2) * 12);
  const subSqLat = Math.floor((adjLat % 10 % 1) * 24);
  return (
    String.fromCharCode(65 + fieldLng) +
    String.fromCharCode(65 + fieldLat) +
    squareLng + squareLat +
    String.fromCharCode(97 + subSqLng) +
    String.fromCharCode(97 + subSqLat)
  );
}

// Approximate WGS84 -> LV95 (Swiss grid EPSG:2056), accuracy ~1m for Switzerland
// Formula from swisstopo (uses 10000 arc-second units)
function wgs84ToLV95(lat, lng) {
  const phi = ((lat - 46.95240555555556) * 3600) / 10000;
  const lambda = ((lng - 7.439583333333333) * 3600) / 10000;

  const y =
    600072.37 +
    211455.93 * lambda -
    10938.51 * lambda * phi -
    0.36 * lambda * phi * phi -
    44.54 * lambda * lambda * lambda;

  const x =
    200147.07 +
    308807.95 * phi +
    3745.25 * lambda * lambda -
    76.63 * phi * phi -
    194.56 * lambda * lambda * phi +
    119.79 * phi * phi * phi;

  return { E: Math.round(y + 2000000), N: Math.round(x + 1000000) };
}

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
  const grid = latLngToGrid(lat, lng);
  const lv95 = wgs84ToLV95(lat, lng);

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
      <Marker position={[lat, lng]} icon={createPositionIcon(fixed)}>
        <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
          {fixed ? "📍 Fixierte Position" : "📍 Meine Position (GPS)"}
        </Tooltip>
        <Popup>
          <div className="text-xs space-y-1.5 min-w-[180px]">
            <div className="font-bold text-gray-900 text-sm pb-1 border-b border-gray-100">
              {fixed ? "📍 Fixierte Position" : "📍 GPS-Position"}
            </div>
            <div>
              <span className="text-gray-500">Maidenhead:</span>{" "}
              <span className="font-mono font-bold text-gray-900">{grid}</span>
            </div>
            <div>
              <span className="text-gray-500">Breite:</span>{" "}
              <span className="font-mono text-gray-900">{lat.toFixed(5)}° N</span>
            </div>
            <div>
              <span className="text-gray-500">Länge:</span>{" "}
              <span className="font-mono text-gray-900">{lng.toFixed(5)}° E</span>
            </div>
            <div className="pt-1 border-t border-gray-100">
              <span className="text-gray-500">LV95:</span>
              <div className="font-mono text-gray-900 mt-0.5">
                E: {lv95.E.toLocaleString("de-CH")}
              </div>
              <div className="font-mono text-gray-900">
                N: {lv95.N.toLocaleString("de-CH")}
              </div>
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}