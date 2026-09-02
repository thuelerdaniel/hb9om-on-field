// RouteRepeaterList — Repeater-Tabelle sortiert nach Streckenabschnitt + PDF Export.

import React from "react";
import { FileDown, Radio } from "lucide-react";
import { getModeColor, getModeLabel } from "@/lib/repeaterModes";
import { generateMobilRoutePdf } from "@/lib/mobilRoutePdf";

export default function RouteRepeaterList({ repeaters, waypoints, routeName, totalDistance, modeFilter, date }) {
  const sorted = [...repeaters].sort(
    (a, b) => (a._segmentIdx || 0) - (b._segmentIdx || 0) || (a._distToRoute || 0) - (b._distToRoute || 0)
  );

  const handlePdfExport = () => {
    generateMobilRoutePdf(routeName, date, totalDistance, modeFilter, sorted, waypoints);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
            Repeater ({sorted.length})
          </span>
        </div>
        {sorted.length > 0 && (
          <button
            onClick={handlePdfExport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF Export
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Keine Repeater in Reichweite</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {sorted.map((r, i) => {
            const color = getModeColor(r.primary_mode);
            return (
              <div
                key={r.id || i}
                className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-gray-900 dark:text-slate-100">{r.callsign}</span>
                    <span className="text-[10px] text-gray-400">{getModeLabel(r.primary_mode)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
                    <span className="font-medium">{r.frequency?.toFixed(3)}</span>
                    {r.offset_mhz != null && <span>{r.offset_mhz > 0 ? "+" : ""}{r.offset_mhz.toFixed(3)}</span>}
                    {r.tone && <span>· {r.tone}</span>}
                    <span>· {r.band || "?"}</span>
                    {r.location_name && <span>· {r.location_name.substring(0, 25)}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-gray-400">Abschn. {r._segmentIdx != null ? `#${r._segmentIdx + 1}` : "-"}</p>
                  <p className="text-[10px] font-medium text-blue-600">{r._distToRoute != null ? `${r._distToRoute.toFixed(1)} km` : "-"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}