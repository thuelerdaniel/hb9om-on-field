import React, { useState, useEffect, useRef } from "react";
import { Layers, Eye, EyeOff, Mountain, Trees, Castle, Anchor, Building, MapPin, Ruler, Zap, Radio, Wifi, Network, Globe2, RadioTower, Droplets } from "lucide-react";
import { getMarkerSvg } from "@/lib/markerShapes";
import { CONTINENTS } from "@/lib/continents";
import { COUNTRIES, getCountriesByContinent } from "@/lib/countries";
import { LAYER_ESTIMATES, formatPointsShort } from "@/components/map/HeavyLoadConfirmDialog";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { useAppFeatures, layerIdToFeatureKey } from "@/lib/appFeatures";

const LAYER_GROUPS = [
  {
    id: "sota",
    label: "SOTA – Summits on the Air",
    icon: Mountain,
    color: "#e74c3c",
    description: "Berggipfel-Referenzen ab 150 m Prominenz"
  },
  {
    id: "pota",
    label: "POTA – Parks on the Air",
    icon: Trees,
    color: "#27ae60",
    description: "Nationalparks und Schutzgebiete"
  },
  {
    id: "hbff",
    label: "WWFF – Flora & Fauna",
    icon: Trees,
    color: "#8e44ad",
    description: "Flora-Fauna-Naturreservate"
  },
  {
    id: "wwbota",
    label: "WWBOTA – Bunkers on the Air",
    icon: Building,
    color: "#795548",
    description: "Militärische Bunker, farbig nach Land"
  },
  {
    id: "castle",
    label: "WCA/COTA – Burgen & Schlösser",
    icon: Castle,
    color: "#e67e22",
    description: "Burgen- und Schloss-Referenzen"
  },
  {
    id: "tota",
    label: "TOTA – Towers on the Air",
    icon: RadioTower,
    color: "#f97316",
    description: "Aussichtstürme und Antennen weltweit (wwtota.com) — in der Schweiz getrennt nach Antennen und Türmen"
  },
  {
    id: "iota",
    label: "IOTA – Islands on the Air",
    icon: MapPin,
    color: "#3498db",
    description: "Insel-Referenzen"
  },
  {
    id: "lighthouse",
    label: "WLOTA – Leuchttürme (ILLW)",
    icon: Anchor,
    color: "#dc2626",
    description: "Leuchtturm-Referenzen — offizielle ILLW-Liste (wllw.org)"
  },
  {
    id: "llota",
    label: "LLOTA – Lakes & Lagoons",
    icon: Droplets,
    color: "#0ea5e9",
    description: "Seen und Lagunen weltweit — 8.357 Referenzen in 54 Ländern (llota.app)"
  },
  {
    id: "swiss_protected",
    label: "BLN – Natur Zonen (nur in CH)",
    icon: Trees,
    color: "#16a085",
    description: "BLN, Moore, Vogelreservate (nur in CH — map.geo.admin.ch)"
  },
  {
    id: "hazards",
    label: "Gefahren & Störquellen (nur in CH)",
    icon: Zap,
    color: "#dc2626",
    description: "Hochspannungsleitungen, Mobilfunkantennen, Richtfunk, Radio/TV-Sender (nur in CH — map.geo.admin.ch)"
  },
  {
    id: "repeater",
    label: "Amateurfunk-Relais",
    icon: Radio,
    color: "#3b82f6",
    description: "FM, C4FM, DMR, D-STAR Relais mit permanenten Verlinkungen, Radius-Filter und Notstrom-Info"
  },
  {
    id: "aprs",
    label: "APRS – Positionierung (aprs.fi)",
    icon: Wifi,
    color: "#8b5cf6",
    description: "APRS-Stationen: Digipeater, IGates, Wetterstationen und mobile Nutzer (Auto, Boot, Flugzeug, Fussgänger, Fahrrad) — Quelle: aprs.fi"
  },
  {
    id: "brandmeister",
    label: "BrandMeister – DMR-Netzwerk",
    icon: Network,
    color: "#14b8a6",
    description: "DMR-Relais und Hotspots im BrandMeister-Netzwerk mit Talkgroups (TG) und DMR-IDs — eigenständiges Netzwerk, nicht APRS"
  },
  {
    id: "activity_zones",
    label: "Aktivitätszonen (Radius-Kreise)",
    icon: Ruler,
    color: "#f59e0b",
    description: "Aktivitätszonen um Referenzpunkte (SOTA/POTA/WCA/IOTA/TOTA) als konfigurierbare Radius-Kreise"
  }
];

const BASE_LAYERS = [
  { id: "osm", label: "OpenStreetMap" },
  { id: "swisstopo", label: "SwissTopo" },
  { id: "satellite", label: "Satellit (ESRI)" }
];

const MAP_SCALES = [
  { id: "10000", label: "1:10'000" },
  { id: "25000", label: "1:25'000" },
  { id: "50000", label: "1:50'000" },
  { id: "100000", label: "1:100'000" }
];

export default function LayerControl({ activeLayers, onToggleLayer, baseLayer, onChangeBaseLayer, onSelectScale, lockedScale, mapOpacity, onChangeOpacity, activeContinents, onToggleContinent, activeCountries, onToggleCountry, externalIsOpen, onOpenChange }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [showCountries, setShowCountries] = useState(false);
  const { containerRef } = useDraggablePosition("drag-layer-control");
  const { features } = useAppFeatures();
  const panelRef = useRef(null);

  // v0.9029: All layers always visible in panel — feature flags only control map activation, not panel visibility
  const visibleLayerGroups = LAYER_GROUPS;
  // Support external open control (e.g. from ViewportLimitHint action button)
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  // Outside-click handler — closes the panel when clicking outside of it.
  // Uses a small delay on mount to avoid immediately closing from the opening click.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside, { passive: true });
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  // Countries to display: filtered by selected continents, or all if no continent selected
  const visibleCountries = activeContinents && activeContinents.length > 0
    ? activeContinents.flatMap(cid => getCountriesByContinent(cid))
    : COUNTRIES;

  return (
    <div ref={containerRef} className="absolute top-16 right-3 z-[10003]" style={{ WebkitTouchCallout: "none", userSelect: "none" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white shadow-lg rounded-lg p-2.5 hover:bg-gray-50 transition-colors border border-gray-200"
        title="Ebenen"
        style={{ touchAction: "none" }}
      >
        <Layers className="w-5 h-5 text-gray-700" />
      </button>

      {isOpen && (
        <div ref={panelRef} className="absolute top-12 right-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-80 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto overscroll-contain">
          {/* Hintergrundkarte */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wide">Hintergrundkarte</h3>
            <div className="mt-2 space-y-1">
              {BASE_LAYERS.map(bl => (
                <button
                  key={bl.id}
                  onClick={() => onChangeBaseLayer(bl.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    baseLayer === bl.id
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {bl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Kartenmassstab – nur bei Swisstopo */}
          {baseLayer === "swisstopo" && (
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
              <Ruler className="w-4 h-4" /> Kartenmassstab
            </h3>
            <button
              onClick={() => onSelectScale("auto")}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1.5 ${
                !lockedScale
                  ? "bg-gray-900 text-white"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              Dynamisch (Auto)
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              {MAP_SCALES.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelectScale(s.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    lockedScale === parseInt(s.id)
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Massstab wird gesperrt und beim Verschieben automatisch gehalten. Zum Aufheben "Dynamisch" wählen.</p>
          </div>
          )}

          {/* Karten-Transparenz */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> Karten-Transparenz
            </h3>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.1"
                value={mapOpacity}
                onChange={e => onChangeOpacity(parseFloat(e.target.value))}
                className="flex-1 accent-gray-900"
              />
              <span className="text-xs font-mono text-gray-600 w-10 text-right">{Math.round(mapOpacity * 100)}%</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Verringern Sie die Deckkraft, damit Referenzpunkte besser sichtbar werden.</p>
          </div>

          {/* Kontinent-Filter */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Globe2 className="w-4 h-4" /> Kontinent-Filter
            </h3>
            <p className="text-[10px] text-gray-400 mb-2">Blendet Overlay-Ebenen nach Kontinent ein/aus. Ganze Welt = keine Auswahl.</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onToggleContinent && onToggleContinent("__all")}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  (!activeContinents || activeContinents.length === 0)
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                Ganze Welt
              </button>
              {CONTINENTS.map(c => {
                const isActive = activeContinents && activeContinents.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => onToggleContinent && onToggleContinent(c.id)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Länder-Filter */}
          {visibleCountries.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <button
              onClick={() => setShowCountries(!showCountries)}
              className="w-full flex items-center justify-between mb-2"
            >
              <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
                <Globe2 className="w-4 h-4" /> Länder-Filter
              </h3>
              <span className="text-xs text-gray-400">
                {activeCountries && activeCountries.length > 0 ? `${activeCountries.length} aktiv` : "Alle"}
              </span>
            </button>
            {showCountries && (
              <>
                <p className="text-[10px] text-gray-400 mb-2">Einzelne Länder ein/aus. Alle = keine Auswahl. Gilt für SOTA, POTA, Burgen, IOTA, Leuchttürme und WWBOTA. Bei Relais und TOTA überschreibt der jeweilige Layer-Filter diesen globalen Filter.</p>
                <button
                  onClick={() => {
                    if (activeCountries && activeCountries.length > 0) {
                      // Clear all countries
                      activeCountries.forEach(c => onToggleCountry && onToggleCountry(c));
                    }
                  }}
                  className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium transition-colors mb-1.5 ${
                    (!activeCountries || activeCountries.length === 0)
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Alle Länder ({visibleCountries.length})
                </button>
                <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
                  {visibleCountries.map(c => {
                    const isActive = activeCountries && activeCountries.includes(c.iso2);
                    return (
                      <button
                        key={c.iso2}
                        onClick={() => onToggleCountry && onToggleCountry(c.iso2)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                          isActive ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {!showCountries && activeCountries && activeCountries.length > 0 && (
              <p className="text-[10px] text-blue-600">{activeCountries.length} Länder ausgewählt — klicken zum Anzeigen</p>
            )}
          </div>
          )}

          {/* Overlay-Ebenen */}
          <div className="p-4">
            <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wide mb-3">Overlay-Ebenen</h3>
            <div className="space-y-1">
              {visibleLayerGroups.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Keine Layer aktiviert — in Einstellungen aktivieren</p>
              )}
              {visibleLayerGroups.map(group => {
                const isActive = activeLayers.includes(group.id);
                const Icon = group.icon;
                return (
                  <div key={group.id} className="rounded-lg overflow-hidden">
                    <button
                      onClick={() => onToggleLayer(group.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all rounded-lg ${
                        isActive
                          ? "bg-gray-50 border border-gray-200"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className="w-5 h-5 flex-shrink-0 flex items-center justify-center"
                        style={{ opacity: isActive ? 1 : 0.4 }}
                        dangerouslySetInnerHTML={{ __html: getMarkerSvg(group.id, group.color) }}
                      />
                      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? group.color : '#9ca3af' }} />
                      <span className={`flex-1 text-left ${isActive ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        {group.label}
                      </span>
                      {LAYER_ESTIMATES[group.id] && (
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1.5 mr-1">
                          <span>{formatPointsShort(LAYER_ESTIMATES[group.id].points)}</span>
                          <span>·</span>
                          <span>{LAYER_ESTIMATES[group.id].mb} MB</span>
                        </span>
                      )}
                      {isActive ? (
                        <Eye className="w-4 h-4 text-gray-400" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-300" />
                      )}
                    </button>
                    {isActive && (
                      <p className="px-3 pb-2 text-xs text-gray-400 ml-10">{group.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { LAYER_GROUPS, BASE_LAYERS, MAP_SCALES };