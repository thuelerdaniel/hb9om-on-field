import React, { useState } from "react";
import { Mountain, Trees, Castle, Building, MapPin, Anchor, ExternalLink, Pencil, ChevronDown, ChevronUp, Navigation, MapPinned, Droplets } from "lucide-react";
import { getWwbotaLink, getWwbotaCountryName } from "@/lib/wwbotaSchemes";

const LAYER_META = {
  sota: { icon: Mountain, color: "#e74c3c", label: "SOTA", program: "Summits on the Air", linkBase: "https://sotl.as/summits/" },
  pota: { icon: Trees, color: "#27ae60", label: "POTA", program: "Parks on the Air", linkBase: "https://pota-map.fr/?pota=" },
  hbff: { icon: Trees, color: "#8e44ad", label: "WWFF", program: "Flora & Fauna", linkBase: "" },
  wwbota: { icon: Building, color: "#795548", label: "WWBOTA", program: "Bunkers on the Air", linkBase: "" },
  castle: { icon: Castle, color: "#e67e22", label: "WCA/COTA", program: "Burgen on the Air", linkBase: "" },
  iota: { icon: MapPin, color: "#3498db", label: "IOTA", program: "Islands on the Air", linkBase: "https://www.iota-world.org/islands-on-the-air/iota-groups-islands.html?filter_search=" },
  lighthouse: { icon: Anchor, color: "#f39c12", label: "WLOTA", program: "Lighthouses on the Air", linkBase: "" },
  llota: { icon: Droplets, color: "#0ea5e9", label: "LLOTA", program: "Lakes & Lagoons on the Air", linkBase: "https://llota.app/referencias.html?ref=" },
  swiss_protected: { icon: Trees, color: "#16a085", label: "BLN/Moor", program: "Bundesinventar", linkBase: "https://map.geo.admin.ch/" }
};

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// Layer types that support boundary display (radius circle around the point)
const BOUNDARY_LAYERS = new Set(["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse", "llota"]);

// Layers with a fixed radius — no slider shown, radius is not adjustable
// LLOTA uses the actual lake outline + 200m buffer (no circle, no slider)
const FIXED_RADIUS_LAYERS = new Set(["wwbota", "llota"]);

// Default radius (meters) per layer type — used for boundary circle and slider initial value
const DEFAULT_RADIUS_M = {
  sota: 50,
  pota: 500,
  hbff: 500,
  wwbota: 1000,
  castle: 200,
  iota: 1000,
  lighthouse: 100,
  llota: 200,
};

// Slider range (meters) per layer type
const RADIUS_RANGE_M = {
  sota: { min: 25, max: 500, step: 25 },
  pota: { min: 100, max: 5000, step: 100 },
  hbff: { min: 100, max: 5000, step: 100 },
  castle: { min: 50, max: 2000, step: 50 },
  iota: { min: 500, max: 20000, step: 500 },
  lighthouse: { min: 50, max: 1000, step: 50 },
  llota: { min: 100, max: 2000, step: 100 },
};

export default function MarkerPopup({ data, layerType, isAdmin, onEdit, performanceMode, userPosition, isBoundaryShown, onToggleBoundary, onBoundaryRadiusChange, boundaryRadius }) {
  const [showDetails, setShowDetails] = useState(!performanceMode);
  const meta = LAYER_META[layerType] || {};
  const Icon = meta.icon || MapPin;

  const canShowBoundary = BOUNDARY_LAYERS.has(layerType) && data.lat != null && data.lng != null;
  const range = RADIUS_RANGE_M[layerType] || { min: 50, max: 2000, step: 50 };
  const currentRadius = boundaryRadius || DEFAULT_RADIUS_M[layerType] || 200;

  const hasCoords = data.lat != null && data.lng != null;
  const navUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lng}`
    : null;
  const distance = hasCoords && userPosition
    ? haversineKm(userPosition[0], userPosition[1], data.lat, data.lng)
    : null;

  const externalLink = (() => {
    if (layerType === "sota" && data.code) return meta.linkBase + encodeURIComponent(data.code);
    if (layerType === "pota" && (data.reference || data.code)) return meta.linkBase + encodeURIComponent(data.reference || data.code);
    if (layerType === "iota" && (data.code || data.reference)) return meta.linkBase + encodeURIComponent(data.code || data.reference);
    if (layerType === "llota" && (data.code || data.reference)) return meta.linkBase + encodeURIComponent(data.code || data.reference);
    if (layerType === "wwbota") return getWwbotaLink(data.scheme, data.code);
    if (data.link) return data.link;
    if (meta.linkBase) return meta.linkBase;
    return null;
  })();

  // Domain label for external link — shows the target site name
  const externalLinkLabel = (() => {
    if (layerType === "sota") return "sotl.as";
    if (layerType === "pota") return "pota-map.fr";
    if (layerType === "iota") return "iota-world.org";
    if (layerType === "llota") return "llota.app";
    return "Mehr Infos";
  })();

  // Use the marker's own color (e.g. WWBOTA country color) if available, else layer default
  const markerColor = data.color || meta.color;

  return (
    <div className="min-w-[220px] max-w-[300px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: markerColor + '20' }}>
          <Icon className="w-4 h-4" style={{ color: markerColor }} />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: markerColor }}>
            {meta.label}
          </span>
          {showDetails && <p className="text-xs text-gray-400">{meta.program}</p>}
        </div>
      </div>

      <h3 className="font-bold text-sm text-gray-900 mb-1">{data.name || data.reference || data.code}</h3>

      {data.code && <p className="text-xs text-gray-500 mb-1">Referenz: <span className="font-mono font-semibold">{data.code}</span></p>}
      {data.reference && !data.code && <p className="text-xs text-gray-500 mb-1">Referenz: <span className="font-mono font-semibold">{data.reference}</span></p>}

      {/* SOTA points — always visible (prominent badge) */}
      {layerType === "sota" && data.points != null && (
        <div className="inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
          ⭐ {data.points} SOTA-Punkte
        </div>
      )}
      {/* SOTA altitude — always visible */}
      {layerType === "sota" && data.altitude_m != null && (
        <p className="text-xs text-gray-500 mb-1">Höhe: {data.altitude_m} m ü.M.</p>
      )}
      {layerType === "sota" && data.alt != null && data.altitude_m == null && (
        <p className="text-xs text-gray-500 mb-1">Höhe: {data.alt} m ü.M.</p>
      )}

      {showDetails && (
        <>
          {data.alt && layerType !== "sota" && <p className="text-xs text-gray-500">Höhe: {data.alt} m ü.M.</p>}
          {data.points && layerType !== "sota" && <p className="text-xs text-gray-500">Punkte: {data.points}</p>}
          {layerType === "sota" && data.altitude_m == null && data.alt == null && data.points == null && null}
          {data.region && <p className="text-xs text-gray-500">Region: {data.region}</p>}
          {data.locationDesc && <p className="text-xs text-gray-500">Ort: {data.locationDesc}</p>}
          {data.parkType && <p className="text-xs text-gray-500">Typ: {data.parkType}</p>}
          {data.canton && <p className="text-xs text-gray-500">{layerType === "castle" ? "Ort" : "Kanton"}: {data.canton}</p>}
          {data.country && <p className="text-xs text-gray-500">Land: {data.country}</p>}
          {data.activationCount !== undefined && <p className="text-xs text-gray-500">Aktivierungen: {data.activationCount}</p>}

          {/* LLOTA-specific fields */}
          {layerType === "llota" && data.activation_count != null && (
            <div className="inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full text-xs font-bold">
              {data.activation_count > 0 ? `🌊 ${data.activation_count}× aktiviert` : 'Nie aktiviert'}
            </div>
          )}
          {layerType === "llota" && data.grid_locator && (
            <p className="text-xs text-gray-500">Locator: <span className="font-mono">{data.grid_locator}</span></p>
          )}
          {layerType === "llota" && data.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{data.description}</p>
          )}
          {layerType === "llota" && data.access_info && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">📍 {data.access_info}</p>
          )}

          {distance != null && (
            <div className="flex items-center gap-1 text-xs text-blue-600 mt-1.5 bg-blue-50 rounded px-2 py-1">
              <MapPin className="w-3 h-3" />
              <span>Entfernung: <span className="font-bold">{formatDistance(distance)}</span></span>
            </div>
          )}

          {externalLink && (
            <a href={externalLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline">
              {externalLinkLabel} <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {layerType === "castle" && data.name && (() => {
            const loc = data.canton || data.wcaLocation || '';
            const wikiQuery = loc ? `${data.name} ${loc}` : data.name;
            return (
              <a
                href={`https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(wikiQuery)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
              >
                Wikipedia <ExternalLink className="w-3 h-3" />
              </a>
            );
          })()}

          {layerType === "wwbota" && data.name && (() => {
            const countryName = getWwbotaCountryName(data.scheme);
            const wikiQuery = countryName
              ? `${data.name} Bunker ${countryName}`
              : `${data.name} Bunker`;
            return (
              <a
                href={`https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(wikiQuery)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline"
              >
                Wikipedia <ExternalLink className="w-3 h-3" />
              </a>
            );
          })()}

          {canShowBoundary && onToggleBoundary && (
            <>
              <button
                onClick={() => onToggleBoundary(data, layerType)}
                className={`mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  isBoundaryShown
                    ? "text-white bg-amber-500 border-amber-600 hover:bg-amber-600"
                    : "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"
                }`}
              >
                <MapPinned className="w-3 h-3" />
                {isBoundaryShown ? "Grenze ausblenden" : "Grenze anzeigen"}
              </button>
              {isBoundaryShown && onBoundaryRadiusChange && !FIXED_RADIUS_LAYERS.has(layerType) && (
                <div className="mt-2 px-1 py-1.5 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-amber-800">Radius</span>
                    <span className="text-[10px] font-bold text-amber-900">
                      {currentRadius >= 1000 ? `${(currentRadius / 1000).toFixed(1)} km` : `${currentRadius} m`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={currentRadius}
                    onChange={(e) => onBoundaryRadiusChange(data, layerType, parseInt(e.target.value))}
                    className="w-full h-1.5 accent-amber-500 cursor-pointer"
                  />
                </div>
              )}
              {isBoundaryShown && FIXED_RADIUS_LAYERS.has(layerType) && (
                <div className="mt-2 px-2 py-1.5 bg-amber-50 rounded-lg border border-amber-200 text-center">
                  {layerType === "llota" ? (
                    <>
                      <span className="text-[10px] font-medium text-amber-800">Aktivierungszone: </span>
                      <span className="text-[10px] font-bold text-amber-900">See-Kontur + 200m Puffer</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] font-medium text-amber-800">Radius fix: </span>
                      <span className="text-[10px] font-bold text-amber-900">
                        {currentRadius >= 1000 ? `${(currentRadius / 1000).toFixed(1)} km` : `${currentRadius} m`}
                      </span>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Navigation className="w-3 h-3" />
              Navigieren (Google Maps)
            </a>
          )}

          {isAdmin && onEdit && (
            <button
              onClick={() => onEdit(data)}
              className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-3 h-3" /> Referenz bearbeiten
            </button>
          )}
        </>
      )}

      {performanceMode && (
        <button
          onClick={() => setShowDetails(prev => !prev)}
          className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5"
        >
          {showDetails
            ? <><ChevronUp className="w-3 h-3" /> Weniger Infos</>
            : <><ChevronDown className="w-3 h-3" /> Mehr Infos</>}
        </button>
      )}

      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
        {data.lat?.toFixed(5)}, {data.lng?.toFixed(5)}
      </div>
    </div>
  );
}