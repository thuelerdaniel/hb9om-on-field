import React from "react";
import { Zap, X, Gauge, BellOff } from "lucide-react";

export default function PerformanceSuggestionPopup({ onActivate, onDontAskAgain, onClose }) {
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[10003] bg-white rounded-xl shadow-2xl border border-amber-300 p-5 max-w-sm w-[90vw]">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-gray-100 transition-colors"
        title="Schliessen"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="text-sm font-bold text-gray-900">Performance-Modus empfohlen</h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Viele Punkte werden geladen. Aktivieren Sie den Energiesparmodus für eine flüssigere Darstellung — Marker werden als einfache Punkte angezeigt.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={onActivate}
          className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
        >
          <Gauge className="w-4 h-4" />
          Energiesparmodus aktivieren
        </button>
        <button
          onClick={onDontAskAgain}
          className="w-full px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <BellOff className="w-3.5 h-3.5" />
          Nicht mehr fragen (bis zum nächsten Login)
        </button>
      </div>
    </div>
  );
}