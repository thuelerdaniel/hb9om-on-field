// MobilRepeaterFilter — Multi-Select Chips für Betriebsmodi, Reichweiten-Slider, Band-Filter.

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { FILTER_MODES, getModeLabel, getModeColor, repeaterMatchesMode } from "@/lib/repeaterModes";

const BANDS = ["10m", "6m", "4m", "2m", "70cm", "23cm"];

export default function MobilRepeaterFilter({
  selectedModes,
  onModesChange,
  rangeKm,
  onRangeChange,
  selectedBands,
  onBandsChange,
  compact = false,
}) {
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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3 space-y-3">
      {/* Betriebsmodi */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Betriebsmodi
        </div>
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
                    : "bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600"
                }`}
                style={selected ? { backgroundColor: color } : {}}
              >
                {getModeLabel(mode)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Band-Filter */}
      <div>
        <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Bänder</div>
        <div className="flex flex-wrap gap-1.5">
          {BANDS.map((band) => {
            const selected = selectedBands.includes(band);
            return (
              <button
                key={band}
                onClick={() => toggleBand(band)}
                className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                  selected
                    ? "bg-blue-600 text-white border-transparent"
                    : "bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-600"
                }`}
              >
                {band}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reichweiten-Slider */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
          <span>Reichweite</span>
          <span className="font-bold text-gray-900 dark:text-slate-100">{rangeKm} km</span>
        </div>
        <input
          type="range"
          min="5"
          max="100"
          step="5"
          value={rangeKm}
          onChange={(e) => onRangeChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>5 km</span>
          <span>100 km</span>
        </div>
      </div>
    </div>
  );
}