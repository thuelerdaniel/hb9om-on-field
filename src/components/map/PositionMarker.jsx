import React, { useRef, useEffect, useState } from "react";
import { Circle, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { Navigation, MapPin } from "lucide-react";

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

// WGS84 -> LV95 (Swiss grid EPSG:2056), accuracy ~1m for Switzerland
function wgs84ToLV95(lat, lng) {
  const phi = ((lat - 46.95240555555556) * 3600) / 10000;
  const lambda = ((lng - 7.439583333333333) * 3600) / 10000;
  const y =
    600072.37 + 211455.93 * lambda - 10938.51 * lambda * phi - 0.36 * lambda * phi * phi - 44.54 * lambda * lambda * lambda;
  const x =
    200147.07 + 308807.95 * phi + 3745.25 * lambda * lambda - 76.63 * phi * phi - 194.56 * lambda * lambda * phi + 119.79 * phi * phi * phi;
  return { E: Math.round(y + 2000000), N: Math.round(x + 1000000) };
}

// LV95 -> WGS84 (inverse approximate formula from swisstopo NAVREF)
function lv95ToWgs84(E, N) {
  const yp = (E - 2000000) / 1000000;
  const xp = (N - 1000000) / 1000000;
  const lambda =
    2.6779094 + 4.728982 * yp + 0.791484 * yp * xp + 0.1306 * yp * xp * xp - 0.0436 * yp * yp * yp;
  const phi =
    16.9023892 + 3.238272 * xp - 0.270978 * yp * yp - 0.002528 * xp * xp - 0.0447 * yp * yp * xp - 0.0140 * xp * xp * xp;
  return { lat: phi * 100 / 36, lng: lambda * 100 / 36 };
}

function formatRadius(m) {
  if (m >= 1000) {
    const km = m / 1000;
    return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
  }
  return `${m} m`;
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
  return L.divIcon({ html, className: "position-marker-icon", iconSize: [24, 24], iconAnchor: [12, 12] });
}

export default function PositionMarker({ position, fixed, radius = 5000, onRadiusChange, onPositionChange }) {
  const interactiveRef = useRef(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [eInput, setEInput] = useState("");
  const [nInput, setNInput] = useState("");
  const [radiusInput, setRadiusInput] = useState("");

  useEffect(() => {
    const el = interactiveRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    const stop = (e) => { L.DomEvent.stopPropagation(e); };
    L.DomEvent.on(el, "mousedown", stop);
    L.DomEvent.on(el, "touchstart", stop);
    L.DomEvent.on(el, "pointerdown", stop);
  }, []);

  if (!position) return null;
  const [lat, lng] = position;
  const grid = latLngToGrid(lat, lng);
  const lv95 = wgs84ToLV95(lat, lng);
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  const handleWgsGo = () => {
    const la = parseFloat(latInput.replace(",", "."));
    const ln = parseFloat(lngInput.replace(",", "."));
    if (isNaN(la) || isNaN(ln)) return;
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return;
    onPositionChange?.([la, ln]);
    setLatInput("");
    setLngInput("");
  };

  const handleLv95Go = () => {
    const e = parseFloat(eInput.replace(/['\s]/g, "").replace(",", "."));
    const n = parseFloat(nInput.replace(/['\s]/g, "").replace(",", "."));
    if (isNaN(e) || isNaN(n)) return;
    const { lat: la, lng: ln } = lv95ToWgs84(e, n);
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return;
    onPositionChange?.([la, ln]);
    setEInput("");
    setNInput("");
  };

  const handleRadiusInput = (val) => {
    setRadiusInput(val);
    const m = parseInt(val);
    if (!isNaN(m) && m >= 100 && m <= 10000) {
      onRadiusChange?.(m);
    }
  };

  return (
    <>
      <Circle
        center={[lat, lng]}
        radius={radius}
        interactive={false}
        pathOptions={{
          color: fixed ? "#2563eb" : "#ef4444",
          fillColor: fixed ? "#2563eb" : "#ef4444",
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "6 4",
        }}
      />
      <Marker position={[lat, lng]} icon={createPositionIcon(fixed)} zIndexOffset={1000}>
        <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
          {fixed ? "📍 Fixierte Position" : "📍 Meine Position (GPS)"}
        </Tooltip>
        <Popup>
          <div ref={interactiveRef} className="text-xs space-y-1.5 min-w-[220px]">
            <div className="font-bold text-gray-900 text-sm pb-1 border-b border-gray-100">
              {fixed ? "📍 Fixierte Position" : "📍 GPS-Position"}
            </div>
            <div>
              <span className="text-gray-500">Maidenhead:</span>{" "}
              <span className="font-mono font-bold text-gray-900">{grid}</span>
            </div>

            {/* WGS84 editable */}
            <div className="pt-1 border-t border-gray-100">
              <span className="text-gray-500 block mb-1">WGS84 (Breite / Länge)</span>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleWgsGo()}
                  placeholder={lat.toFixed(5)}
                  className="flex-1 min-w-0 px-1.5 py-1 text-[11px] border border-gray-200 rounded bg-white text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <input
                  type="text"
                  value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleWgsGo()}
                  placeholder={lng.toFixed(5)}
                  className="flex-1 min-w-0 px-1.5 py-1 text-[11px] border border-gray-200 rounded bg-white text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={handleWgsGo}
                  disabled={!latInput || !lngInput}
                  className="px-2 py-1 bg-gray-900 text-white rounded text-[11px] font-medium hover:bg-gray-800 disabled:opacity-30 flex-shrink-0"
                  title="Position setzen"
                >
                  <MapPin className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* LV95 editable */}
            <div className="pt-1 border-t border-gray-100">
              <span className="text-gray-500 block mb-1">LV95 (E / N)</span>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={eInput}
                  onChange={(e) => setEInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLv95Go()}
                  placeholder={lv95.E.toLocaleString("de-CH")}
                  className="flex-1 min-w-0 px-1.5 py-1 text-[11px] border border-gray-200 rounded bg-white text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <input
                  type="text"
                  value={nInput}
                  onChange={(e) => setNInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLv95Go()}
                  placeholder={lv95.N.toLocaleString("de-CH")}
                  className="flex-1 min-w-0 px-1.5 py-1 text-[11px] border border-gray-200 rounded bg-white text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={handleLv95Go}
                  disabled={!eInput || !nInput}
                  className="px-2 py-1 bg-gray-900 text-white rounded text-[11px] font-medium hover:bg-gray-800 disabled:opacity-30 flex-shrink-0"
                  title="Position setzen"
                >
                  <MapPin className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Radius slider + number input */}
            <div className="pt-1.5 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500">Radius</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={radiusInput !== "" ? radiusInput : radius}
                    onChange={(e) => handleRadiusInput(e.target.value)}
                    onBlur={() => setRadiusInput("")}
                    className="w-16 px-1 py-0.5 text-[11px] border border-gray-200 rounded bg-white text-gray-900 font-mono text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <span className="text-gray-400 text-[10px]">m</span>
                </div>
              </div>
              <input
                type="range"
                min={100}
                max={10000}
                step={100}
                value={radius}
                onChange={(e) => onRadiusChange?.(parseInt(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>100 m</span>
                <span>{formatRadius(radius)}</span>
                <span>10 km</span>
              </div>
            </div>

            {/* Navigate button */}
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 w-full px-3 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors no-underline"
            >
              <Navigation className="w-4 h-4" />
              Navigieren zu
            </a>
          </div>
        </Popup>
      </Marker>
    </>
  );
}