import React, { useState } from "react";
import { ChevronDown, X, Layers } from "lucide-react";
import { LAYER_GROUPS } from "./LayerControl";
import { getMarkerSvg } from "@/lib/markerShapes";
import { MODE_COLORS, FILTER_MODES, MODE_LABELS } from "@/lib/repeaterModes";
import { WWBOTA_LEGEND_SCHEMES } from "@/lib/wwbotaSchemes";

export default function MapLegend({ activeLayers, markerCount, castleStats }) {
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [wwbotaExpanded, setWwbotaExpanded] = useState(false);

  const activeItems = activeLayers
    .map(id => LAYER_GROUPS.find(g => g.id === id))
    .filter(Boolean);

  if (activeItems.length === 0) return null;

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="absolute bottom-16 left-3 z-[1000] w-8 h-8 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        title="Legende einblenden"
      >
        <Layers className="w-3.5 h-3.5 text-gray-600" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-16 left-3 z-[1000] max-w-[calc(100%-11rem)] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden">
      {/* Compact single-line header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5">
        {castleStats && activeLayers.includes("castle") && (
          <span className="px-1.5 py-0.5 text-[9px] bg-orange-50 text-orange-700 rounded-full font-medium">
            {castleStats.matched}/{castleStats.total}
          </span>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-gray-100 rounded text-gray-500 transition-colors"
        >
          <span className="text-[10px] uppercase tracking-wide">Legende</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={() => setHidden(true)}
          className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
          title="Legende ausblenden"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Expanded content — compact horizontal */}
      {expanded && (
        <div className="px-2.5 pb-2 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            {activeItems.map(lg => (
              <span key={lg.id} className="flex items-center gap-1 text-[10px]">
                {lg.id === "repeater" || lg.id === "aprs" || lg.id === "brandmeister" ? (
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white shadow-sm" style={{ backgroundColor: lg.color }} />
                ) : (
                  <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: getMarkerSvg(lg.id, lg.color) }} />
                )}
                <span className="text-gray-600">{lg.label.split("–")[0].trim()}</span>
              </span>
            ))}
          </div>

          {activeLayers.includes("repeater") && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5 pt-1.5 border-t border-gray-50">
              {FILTER_MODES.map(mode => (
                <span key={mode} className="flex items-center gap-0.5 text-[9px]">
                  <span className="w-2 h-2 rounded-full border border-white shadow-sm" style={{ backgroundColor: MODE_COLORS[mode] }} />
                  <span className="text-gray-500">{MODE_LABELS[mode]}</span>
                </span>
              ))}
            </div>
          )}

          {activeLayers.includes("wwbota") && (
            <div className="mt-1.5 pt-1.5 border-t border-gray-50">
              <button
                onClick={() => setWwbotaExpanded(!wwbotaExpanded)}
                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700"
              >
                <span className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: "#795548" }} />
                <span>WWBOTA nach Land</span>
                <ChevronDown className={`w-2.5 h-2.5 transition-transform ${wwbotaExpanded ? "rotate-180" : ""}`} />
              </button>
              {wwbotaExpanded && (
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  {WWBOTA_LEGEND_SCHEMES.map(s => (
                    <span key={s.scheme} className="flex items-center gap-0.5 text-[9px]">
                      <span className="w-2 h-2 rounded-full border border-white shadow-sm" style={{ backgroundColor: s.color }} />
                      <span className="text-gray-500">{s.country}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}