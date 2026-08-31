// MobilModulationFilter — Einklappbare Filter für Betriebsmodi und Bänder.
// Chevron-Pfeil zum Auf/Zuklappen.

import React, { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { FILTER_MODES, getModeColor, getModeLabel } from "@/lib/repeaterModes";

const BANDS = ["10m", "6m", "4m", "2m", "70cm", "23cm"];

export default function MobilModulationFilter({ selectedModes, onModesChange, selectedBands, onBandsChange }) {
  const [expanded, setExpanded] = useState(false);

  const toggleMode = (mode) => {
    if (selectedModes.includes(mode)) {
      onModesChange(selectedModes.filter((m) => m !== mode));
    } else {
      onModesChange([...selectedModes, mode]);
    }
  };

  const toggleBand = (band) => {
    if (selectedBands.includes(band)) {
      onBandsChange(selectedBands.filter((b) => b !== band));
    } else {
      onBandsChange([...selectedBands, band]);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-700 dark:text-slate-200">
            Betriebsmodi & Bänder
          </span>
          {(selectedModes.length > 0 || selectedBands.length > 0) && (
            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] rounded-full font-mono">
              {selectedModes.length}M{selectedBands.length > 0 && ` ${selectedBands.length}B`}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100 dark:border-slate-700 pt-2">
          {/* Mode chips */}
          <div className="flex flex-wrap gap-1.5">
            {FILTER_MODES.map((mode) => {
              const selected = selectedModes.includes(mode);
              const color = getModeColor(mode);
              return (
                <button
                  key={mode}
                  onClick={() => toggleMode(mode)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    selected
                      ? "text-white border-transparent"
                      : "text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600"
                  }`}
                  style={selected ? { backgroundColor: color } : {}}
                >
                  {getModeLabel(mode)}
                </button>
              );
            })}
          </div>

          {/* Band chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {BANDS.map((band) => {
              const selected = selectedBands.includes(band);
              return (
                <button
                  key={band}
                  onClick={() => toggleBand(band)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    selected
                      ? "bg-blue-600 text-white border-transparent"
                      : "text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600"
                  }`}
                >
                  {band}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}