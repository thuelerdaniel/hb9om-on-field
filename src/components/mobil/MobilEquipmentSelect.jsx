// MobilEquipmentSelect — Equipment-Auswahl: Mobil (Auto, 50W) vs Portable (Handheld, 5W).
// Ersetzt den festen Reichweiten-Slider durch dynamische Reichweitenberechnung.

import React from "react";
import { Car, Radio } from "lucide-react";

export default function MobilEquipmentSelect({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1">
      <button
        onClick={() => onChange("mobil")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          value === "mobil"
            ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm"
            : "text-gray-500 dark:text-slate-400"
        }`}
      >
        <Car className="w-4 h-4" />
        Mobil (50W)
      </button>
      <button
        onClick={() => onChange("portable")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          value === "portable"
            ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm"
            : "text-gray-500 dark:text-slate-400"
        }`}
      >
        <Radio className="w-4 h-4" />
        Portable (5W)
      </button>
    </div>
  );
}