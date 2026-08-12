import React, { useMemo } from "react";
import { CircleMarker, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { RadioTower, Signal, Building } from "lucide-react";
import { isInContinents } from "@/lib/continents";
import { isInCountries } from "@/lib/countries";
import { getMarkerSvg } from "@/lib/markerShapes";
import DraggablePopup from "@/components/map/DraggablePopup";

// Colors for TOTA types
const TOTA_COLORS = {
  antenna: "#8b5cf6", // purple — antennas
  tower: "#f97316",   // orange — lookout towers
};

// TOTA type labels
const TOTA_TYPE_LABELS = {
  antenna: "Antenne",
  tower: "Turm / Aussichtsturm",
};

// TOTA type icons (lucide — for popup header only)
const TOTA_TYPE_ICONS = {
  antenna: Signal,
  tower: RadioTower,
};

function formatCoords(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function TotaLayer({
  points,
  filterTypes,
  searchQuery,
  performanceMode,
  userPosition,
  activeContinents = [],
  activeCountries = [],
  filterCountries = [],
}) {
  const map = useMap();

  // Filter points by type, search query, continent and country
  const filteredPoints = useMemo(() => {
    let result = points;
    // null or all = no filter; array = filter by selected types
    if (filterTypes && filterTypes.length === 0) return [];
    if (filterTypes && filterTypes.length > 0) {
      result = result.filter((p) => filterTypes.includes(p.type));
    }
    if (searchQuery && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q) ||
          (p.subtype || "").toLowerCase().includes(q) ||
          (p.usage || "").toLowerCase().includes(q)
      );
    }
    // Per-layer country filter (multi-select) overrides global LayerControl country filter.
    // When specific countries are selected in the TotaFilter, the global
    // activeContinents/activeCountries from LayerControl are NOT applied.
    if (filterCountries && filterCountries.length > 0) {
      result = result.filter(p => filterCountries.includes(p.country_code || (p.source === "swiss_csv" ? "CH" : "")));
    } else {
      result = result
        .filter(p => isInContinents(p.lat, p.lng, activeContinents))
        .filter(p => isInCountries(p, activeCountries));
    }
    return result;
  }, [points, filterTypes, searchQuery, activeContinents, activeCountries, filterCountries]);

  // Viewport bounds filtering — only render markers within the current viewport
  const visiblePoints = useMemo(() => {
    if (!map) return filteredPoints;
    const bounds = map.getBounds();
    return filteredPoints.filter(
      (p) =>
        p.lat >= bounds.getSouth() &&
        p.lat <= bounds.getNorth() &&
        p.lng >= bounds.getWest() &&
        p.lng <= bounds.getEast()
    );
  }, [filteredPoints, map]);

  // Cached divIcon per type+color — avoids re-creating L.divIcon on every render.
  // Uses the `tota` SVG shape (lookout tower with antenna) from markerShapes.js.
  const iconCache = useMemo(() => new Map(), []);
  const getTotaIcon = (pointType, color) => {
    const cacheKey = `${pointType}:${color}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
    const svg = getMarkerSvg("tota", color);
    const icon = L.divIcon({
      className: "tota-marker-icon",
      html: `<div style="width:28px;height:28px;">${svg}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    iconCache.set(cacheKey, icon);
    return icon;
  };

  if (visiblePoints.length === 0) return null;

  return (
    <>
      {visiblePoints.map((point, idx) => {
        const color = TOTA_COLORS[point.type] || "#6b7280";
        const Icon = TOTA_TYPE_ICONS[point.type] || Building;

        const popupContent = (
          <div className="text-xs space-y-1.5 min-w-[180px]">
              <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900 border-b pb-1.5 mb-1.5">
                <Icon className="w-4 h-4" style={{ color }} />
                {point.name || point.code}
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Typ:</span>
                <span style={{ color }} className="font-medium">
                  {TOTA_TYPE_LABELS[point.type] || point.type}
                </span>
              </div>
              {point.code && (
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Ref:</span>
                  <span className="font-mono text-gray-900">{point.code}</span>
                </div>
              )}
              {point.subtype && (
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Kategorie:</span>
                  <span className="text-gray-900">{point.subtype}</span>
                </div>
              )}
              {point.usage && (
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Nutzung:</span>
                  <span className="text-gray-900">{point.usage}</span>
                </div>
              )}
              {point.country && (
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Land:</span>
                  <span className="text-gray-900">{point.country}</span>
                </div>
              )}
              {point.locator && (
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Locator:</span>
                  <span className="font-mono text-gray-900">{point.locator}</span>
                </div>
              )}
              {point.height_m != null && (
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Höhe:</span>
                  <span className="text-gray-900">{point.height_m} m</span>
                </div>
              )}
              {point.spot_height_m != null && (
                <div className="flex gap-2">
                  <span className="text-gray-500 font-medium">Standort:</span>
                  <span className="text-gray-900">{point.spot_height_m} m ü.M.</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Quelle:</span>
                <span className="text-gray-900">
                  {point.source === 'swiss_csv' ? 'Schweiz (CSV)' : 'wwtota.com'}
                </span>
              </div>
              <div className="text-gray-400 text-[10px] pt-1 border-t">
                {formatCoords(point.lat, point.lng)}
              </div>

              {/* wwtota.com Links — nur für Punkte mit Code aus der wwtota.com-Datenbank */}
              {point.code && point.source !== 'swiss_csv' && (
                <div className="space-y-1 pt-1.5 border-t">
                  <a
                    href={`https://wwtota.com/karta_rozhledny.php?ref=${encodeURIComponent(point.code)}&lang=de`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-white bg-orange-600 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-orange-700"
                  >
                    🔗 TOTA Detailseite (wwtota.com)
                  </a>
                  <a
                    href={`https://wwtota.com/seznam/?lang=de`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-gray-700 bg-gray-100 rounded-lg px-2 py-1 text-xs font-medium hover:bg-gray-200"
                  >
                    📋 Alle TOTA-Türme (Tabelle)
                  </a>
                </div>
              )}

              {/* Schweizer Punkte — Link zu wwtota.com Liste mit Hinweis */}
              {point.code && point.source === 'swiss_csv' && (
                <div className="pt-1.5 border-t">
                  <a
                    href={`https://wwtota.com/seznam/?lang=de`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-gray-700 bg-gray-100 rounded-lg px-2 py-1 text-xs font-medium hover:bg-gray-200"
                  >
                    📋 TOTA-Türme auf wwtota.com
                  </a>
                </div>
              )}

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-white bg-blue-600 rounded-lg px-2 py-1 text-xs font-medium hover:bg-blue-700 mt-1.5"
              >
                Navigation
              </a>

              {/* TOTA-Programm Info — erklärt das TOTA-Programm und die wwtota.com-Tabelle */}
              <details className="pt-1.5 border-t">
                <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
                  ℹ️ Über TOTA (Towers on the Air)
                </summary>
                <div className="text-[10px] text-gray-600 mt-1 space-y-1">
                  <p>
                    <strong>TOTA</strong> ist ein Amateurfunk-Programm für Aktivierungen von Aussichtstürmen, Antennen und ähnlichen Bauwerken.
                    Punkte werden nach Referenznummer (<span className="font-mono">Ref_No</span>), Name, Ort, Bezirk, Region, Höhenpunkt, Höhe, Locator und Zugänglichkeit katalogisiert.
                  </p>
                  <p>
                    Die vollständige Tabelle auf <a href="https://wwtota.com/seznam/?lang=de" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">wwtota.com/seznam</a> enthält:
                  </p>
                  <ul className="list-disc list-inside text-[9px] text-gray-500 pl-1">
                    <li><strong>Ref_No</strong> — TOTA-Referenzcode</li>
                    <li><strong>Name</strong> — Turm-/Antennenname</li>
                    <li><strong>Ort / Bezirk / Region</strong> — Geografische Einordnung</li>
                    <li><strong>Höhenpunkt</strong> — Standorthöhe ü.M.</li>
                    <li><strong>Höhe</strong> — Bauwerkshöhe in Metern</li>
                    <li><strong>Locator</strong> — Maidenhead-Grid-Quadrat</li>
                    <li><strong>Zugänglich</strong> — Öffentlich erreichbar (YES/NO)</li>
                    <li><strong>Erstaktivierung</strong> — Datum der ersten TOTA-Aktivierung</li>
                    <li><strong>Aktivator</strong> — Rufzeichen des Erstaktivierers</li>
                  </ul>
                  <p className="text-gray-400">
                    Quelle: <a href="https://wwtota.com" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">wwtota.com</a> · <a href="https://wwtota.com/rules/" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline">Regeln</a>
                  </p>
                </div>
              </details>
          </div>
        );

        // Performance mode: use CircleMarker (lighter rendering for 5k+ points)
        if (performanceMode) {
          return (
            <CircleMarker
              key={point.id || idx}
              center={[point.lat, point.lng]}
              radius={5}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <DraggablePopup>
                {popupContent}
              </DraggablePopup>
            </CircleMarker>
          );
        }

        // Normal mode: use SVG tower icon (divIcon) — consistent with other layers
        return (
          <Marker
            key={point.id || idx}
            position={[point.lat, point.lng]}
            icon={getTotaIcon(point.type, color)}
          >
            <DraggablePopup>
              {popupContent}
            </DraggablePopup>
          </Marker>
        );
      })}
    </>
  );
}