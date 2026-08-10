import React, { useState } from "react";
import { ChevronDown, ChevronUp, X, Layers } from "lucide-react";
import { LAYER_GROUPS } from "./LayerControl";
import { getMarkerSvg } from "@/lib/markerShapes";
import { MODE_COLORS, FILTER_MODES, MODE_LABELS } from "@/lib/repeaterModes";
import { WWBOTA_LEGEND_SCHEMES } from "@/lib/wwbotaSchemes";

export default function MapLegend({ activeLayers, markerCount, castleStats }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [wwbotaExpanded, setWwbotaExpanded] = useState(false);

  const activeItems = activeLayers
    .map(id => LAYER_GROUPS.find(g => g.id === id))
    .filter(Boolean);

  if (activeItems.length === 0) return null;

  // When hidden, show a small button to bring legend back
  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="absolute bottom-20 left-3 z-[1000] w-10 h-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        title="Legende einblenden"
      >
        <Layers className="w-4 h-4 text-gray-600" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-20 left-3 z-[1000] max-w-[calc(100%-11rem)] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900">{markerCount}</span>
        <span>Referenzen</span>
        {castleStats && activeLayers.includes("castle") && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-orange-50 text-orange-700 rounded-full font-medium">
            Burgen {castleStats.matched}/{castleStats.total}
          </span>
        )}
        <span className="flex-1" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Legende</span>
        {collapsed
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {!collapsed && (
        <div className="px-3 pb-2 flex items-center gap-3 flex-wrap border-t border-gray-100 pt-2 relative">
          {activeItems.map(lg => (
            <span key={lg.id} className="flex items-center gap-1 text-xs">
              {lg.id === "repeater" || lg.id === "private_nodes" ? (
                <span className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: lg.color }} />
              ) : (
                <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: getMarkerSvg(lg.id, lg.color) }} />
              )}
              <span className="text-gray-600">{lg.label.split("–")[0].trim()}</span>
            </span>
          ))}
          {activeLayers.includes("repeater") && (
            <span className="flex items-center gap-1.5 flex-wrap">
              {FILTER_MODES.map(mode => (
                <span key={mode} className="flex items-center gap-0.5 text-[10px]">
                  <span className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: MODE_COLORS[mode] }} />
                  <span className="text-gray-500">{MODE_LABELS[mode]}</span>
                </span>
              ))}
            </span>
          )}
          <button
            onClick={() => setHidden(true)}
            className="absolute top-1 right-1 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            title="Legende ausblenden"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {!collapsed && activeLayers.includes("wwbota") && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setWwbotaExpanded(!wwbotaExpanded)}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <span className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0" style={{ backgroundColor: "#795548" }} />
            <span>WWBOTA-Farben nach Land</span>
            <span className="flex-1" />
            <span className="text-[10px] text-gray-400">{WWBOTA_LEGEND_SCHEMES.length} Länder</span>
            {wwbotaExpanded
              ? <ChevronUp className="w-3 h-3 text-gray-400" />
              : <ChevronDown className="w-3 h-3 text-gray-400" />}
          </button>
          {wwbotaExpanded && (
            <div className="px-3 pb-2 flex items-center gap-1.5 flex-wrap">
              {WWBOTA_LEGEND_SCHEMES.map(s => (
                <span key={s.scheme} className="flex items-center gap-0.5 text-[10px]">
                  <span className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: s.color }} />
                  <span className="text-gray-500">{s.country}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {collapsed && (
        <button
          onClick={() => setHidden(true)}
          className="absolute top-1 right-1 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
          title="Legende ausblenden"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}