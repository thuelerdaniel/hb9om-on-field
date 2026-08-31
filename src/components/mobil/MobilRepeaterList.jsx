// MobilRepeaterList — Scrollbare Repeater-Liste im Start-Modus.
// Eine Zeile pro Repeater: Callsign | Frequenz | Mode | Entfernung.
// Tippen → Marker-Popup auf Karte (via onSelect callback).

import React from "react";
import { getModeColor, getModeLabel } from "@/lib/repeaterModes";

export default function MobilRepeaterList({ repeaters, onSelect, selectedId }) {
  if (!repeaters || repeaters.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="p-2.5 border-b border-gray-100 dark:border-slate-700">
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
          Repeater ({repeaters.length})
        </span>
      </div>
      <div className="max-h-32 overflow-y-auto">
        {repeaters.map((r, i) => {
          const color = getModeColor(r.primary_mode);
          const isSelected = selectedId === r.id;
          const dist = r._distToPos != null ? r._distToPos : r._distToRoute;
          return (
            <button
              key={r.id || i}
              onClick={() => onSelect(r)}
              className={`w-full flex items-center gap-2 px-3 py-2 border-b border-gray-50 dark:border-slate-700 last:border-0 transition-colors text-left ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-gray-50 dark:hover:bg-slate-700"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-mono font-bold text-gray-900 dark:text-slate-100 flex-shrink-0">
                {r.callsign}
              </span>
              <span className="text-[10px] text-gray-500 flex-shrink-0">
                {r.frequency?.toFixed(3)}
              </span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                {getModeLabel(r.primary_mode)}
              </span>
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