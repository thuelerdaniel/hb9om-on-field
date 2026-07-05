import React, { useState } from "react";
import { Layers, Eye, EyeOff, Mountain, Trees, Castle, Anchor, Building, MapPin, Ruler } from "lucide-react";

const LAYER_GROUPS = [
  {
    id: "sota",
    label: "SOTA – Summits on the Air",
    icon: Mountain,
    color: "#e74c3c",
    description: "Gipfel-Referenzen für Amateurfunk"
  },
  {
    id: "pota",
    label: "POTA – Parks on the Air",
    icon: Trees,
    color: "#27ae60",
    description: "Park-Referenzen für Amateurfunk"
  },
  {
    id: "hbff",
    label: "HBFF – Flora & Fauna",
    icon: Trees,
    color: "#8e44ad",
    description: "Schweizer Naturschutzgebiete"
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
    description: "Burgen- und Schloss-Referenzen"
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
    label: "WLOTA / ILLW – Leuchttürme",
    icon: Anchor,
    color: "#f39c12",
    description: "Leuchtturm-Referenzen"
  },
  {
    id: "swiss_protected",
    label: "HBFF und Natur Zonen",
    icon: Trees,
    color: "#16a085",
    description: "BLN, Moore, Vogelreservate"
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

export default function LayerControl({ activeLayers, onToggleLayer, baseLayer, onChangeBaseLayer, onSelectScale }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-[10002]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white shadow-lg rounded-lg p-2.5 hover:bg-gray-50 transition-colors border border-gray-200"
        title="Ebenen"
      >
        <Layers className="w-5 h-5 text-gray-700" />
      </button>

      {isOpen && (
        <div className="absolute top-12 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 w-80 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
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

          {/* Kartenmassstab */}
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 uppercase tracking-wide flex items-center gap-1.5">
              <Ruler className="w-4 h-4" /> Kartenmassstab
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {MAP_SCALES.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSelectScale(s.id)}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-900 hover:text-white transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Zoom wird automatisch aus Breitengrad berechnet.</p>
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
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: isActive ? group.color : '#d1d5db' }}
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