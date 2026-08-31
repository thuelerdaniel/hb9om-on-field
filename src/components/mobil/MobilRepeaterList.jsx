// MobilRepeaterList — Scrollbare Repeater-Liste im Start-Modus (unten).
// Eine Zeile pro Repeater: Callsign | Frequenz | Mode | ITM-Qualität | Entfernung | High-Badge.
// Tippen → wird aktiver Repeater (Detail-Panel + Karte + Abdeckung).
// ITM-Qualitäts-Badge aus itmResultsMap (Top 5 nächste Repeater).

import React from "react";
import { getModeColor, getModeLabel } from "@/lib/repeaterModes";
import { Mountain, Check } from "lucide-react";
import { getQualityColor, getQualityShort } from "@/lib/itmPropagation";

export default function MobilRepeaterList({ repeaters, onSelect, selectedId, recommendedId, itmResultsMap }) {
  if (!repeaters || repeaters.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="p-2.5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
          Repeater ({repeaters.length})
        </span>
        {recommendedId && (
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            ★ = empfohlen
          </span>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto">
        {repeaters.map((r, i) => {
          const color = getModeColor(r.primary_mode);
          const isSelected = selectedId === r.id;
          const isRecommended = recommendedId === r.id;
          const dist = r._distToPos != null ? r._distToPos : r._distToRoute;
          const itm = itmResultsMap?.[r.id];
          const qualityColor = itm ? getQualityColor(itm.quality) : null;
          return (
            <button
              key={r.id || i}
              onClick={() => onSelect(r)}
              className={`w-full flex items-center gap-2 px-3 py-2 border-b border-gray-50 dark:border-slate-700 last:border-0 transition-colors text-left ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400 dark:ring-blue-600"
                  : "hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              {isSelected ? (
                <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              ) : (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
              )}
              <span className="text-xs font-mono font-bold text-gray-900 dark:text-slate-100 flex-shrink-0">
                {r.callsign}
              </span>
              {isRecommended && !isSelected && (
                <span className="text-[9px] text-amber-500 flex-shrink-0">★</span>
              )}
              <span className="text-[10px] text-gray-500 flex-shrink-0">
                {r.frequency?.toFixed(3)}
              </span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                {getModeLabel(r.primary_mode)}
              </span>
              {/* ITM Quality Badge */}
              {itm && (
                <span
                  className="px-1 py-0.5 rounded text-[9px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: qualityColor }}
                  title={`${itm.rx_signal_dbm?.toFixed(1)} dBm`}
                >
                  {getQualityShort(itm.quality)}
                </span>
              )}
              {/* High-Repeater badge */}
              {r._isHigh && (
                <span className="flex items-center gap-0.5 px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[9px] font-bold flex-shrink-0">
                  <Mountain className="w-2.5 h-2.5" />
                  High
                </span>
              )}
              <div className="flex-1" />
              <span className="text-[10px] font-medium text-blue-600 flex-shrink-0">
                {dist?.toFixed(0)} km
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}