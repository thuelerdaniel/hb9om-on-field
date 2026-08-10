import React, { useState } from "react";
import { Layers, Eye, EyeOff, Mountain, Trees, Castle, Anchor, Building, MapPin, Ruler, Zap, Radio, Wifi, Globe2 } from "lucide-react";
import { getMarkerSvg } from "@/lib/markerShapes";
import { CONTINENTS } from "@/lib/continents";

const LAYER_GROUPS = [
  {
    id: "sota",
    label: "SOTA – Summits on the Air",
    icon: Mountain,
    color: "#e74c3c",
    description: "Berggipfel-Referenzen weltweit (SOTA)"
  },
  {
    id: "pota",
    label: "POTA – Parks on the Air",
    icon: Trees,
    color: "#27ae60",
    description: "Park- und Schutzgebiet-Referenzen weltweit (POTA)"
  },
  {
    id: "hbff",
    label: "HBFF – Flora & Fauna",
    icon: Trees,
    color: "#8e44ad",
    description: "Flora-Fauna-Referenzen (weltweit)"
  },
  {
    id: "wwbota",
    label: "WWBOTA – Bunkers on the Air",
    icon: Building,
    color: "#795548",
    description: "Bunker-Referenzen weltweit"
  },
  {
    id: "castle",
    label: "Burgen / Schlösser (WCA/COTA)",
    icon: Castle,
    color: "#e67e22",
    description: "Burgen- und Schloss-Referenzen weltweit"
  },
  {
    id: "iota",
    label: "IOTA – Islands on the Air",
    icon: MapPin,
    color: "#3498db",
    description: "Insel-Referenzen weltweit"
  },
  {
    id: "lighthouse",
    label: "WLOTA / ILLW – Leuchttürme",
    icon: Anchor,
    color: "#f39c12",
    description: "Leuchtturm-Referenzen weltweit"
  },
  {
    id: "swiss_protected",
    label: "HBFF und Natur Zonen (CH)",
    icon: Trees,
    color: "#16a085",
    description: "BLN, Moore, Vogelreservate (nur Schweiz — map.geo.admin.ch)"
  },
  {
    id: "hazards",
    label: "Gefahren & Störquellen (CH)",
    icon: Zap,
    color: "#dc2626",
    description: "Hochspannungsleitungen, Mobilfunkantennen, Richtfunk, Radio/TV-Sender (nur Schweiz — map.geo.admin.ch)"
  },
  {
    id: "repeater",
    label: "Amateurfunk-Relais (RepeaterBook)",
    icon: Radio,
    color: "#3b82f6",
    description: "Weltweite FM, C4FM, DMR, D-STAR Relais mit permanenten Verlinkungen, Radius-Filter und Notstrom-Info"
  },
  {
    id: "private_nodes",
    label: "Private Nodes & Hotspots",
    icon: Wifi,
    color: "#8b5cf6",
    description: "Private Nodes, Hotspots, AllStar/EchoLink-Nodes für Netzwerk-Zugang"
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

export default function LayerControl({ activeLayers, onToggleLayer, baseLayer, onChangeBaseLayer, onSelectScale, lockedScale, mapOpacity, onChangeOpacity, activeContinents, onToggleContinent }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-[1005]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white shadow-lg rounded-lg p-2.5 hover:bg-gray-50 transition-colors border border-gray-200"
        title="Ebenen"
      >
        <Layers className="w-5 h-5 text-gray-700" />
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-80 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
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
            <p className="text-[10px] text-gray-400 mb-2">Blendet Overlay-Ebenen nach Kontinent ein/aus. Alle Welt = keine Auswahl.</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onToggleContinent && onToggleContinent("__all")}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  (!activeContinents || activeContinents.length === 0)
                    ? "bg-gray-900 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                Alle Welt
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

          {/* Overlay-Ebenen */}
          <div className="p-4">
            <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wide mb-3">Overlay-Ebenen</h3>
            <div className="space-y-1">
              {LAYER_GROUPS.map(group => {
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