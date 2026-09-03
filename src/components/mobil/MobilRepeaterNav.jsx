// MobilRepeaterNav — +/- Buttons zum Blättern durch die Relais-Liste.
// v0.9033: Grosse Buttons (min 56x56px) für Auto/Feld-Bedienung.
// Zeigt "Relais X/Y" und deaktiviert - am Anfang / + am Ende.

import React from "react";
import { Minus, Plus } from "lucide-react";

export default function MobilRepeaterNav({ currentIndex, total, onPrev, onNext, canPrev, canNext }) {
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      {/* - Button (previous) */}
      <button
        onClick={onPrev}
        disabled={!canPrev}
        className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-800 dark:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-slate-600 transition-colors flex-shrink-0"
        aria-label="Vorheriges Relais"
      >
        <Minus className="w-8 h-8" strokeWidth={3} />
      </button>

      {/* Relais X/Y Anzeige */}
      <div className="flex flex-col items-center min-w-[100px]">
        <span className="text-xs text-gray-500 dark:text-slate-400">Relais</span>
        <span className="text-xl font-bold text-gray-900 dark:text-slate-100">
          {currentIndex} / {total}
        </span>
      </div>

      {/* + Button (next) */}
      <button
        onClick={onNext}
        disabled={!canNext}
        className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex-shrink-0"
        aria-label="Nächstes Relais"
      >
        <Plus className="w-8 h-8" strokeWidth={3} />
      </button>
    </div>
  );
}