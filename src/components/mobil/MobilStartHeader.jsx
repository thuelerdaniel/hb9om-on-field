// MobilStartHeader — Header-Leiste im Start-Modus.
// Stop-Button (rot, min 48x80px), Equipment-Anzeige, Modus-Anzeige, Coverage-Toggles (min 44x44px).
// Touch-Ziele nach Apple/Google Richtlinie (min 44x44px).

import React from "react";
import { Square, Car, Radio, Route, MapPin, Circle, Users } from "lucide-react";

export default function MobilStartHeader({
  mode,
  equipmentType,
  showRepeaterCoverage,
  showOwnCoverage,
  onToggleRepeaterCoverage,
  onToggleOwnCoverage,
  onStop,
}) {
  return (
    <div
      className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-3 py-2 flex items-center gap-2 flex-wrap"
      style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
    >
      {/* Stop button — min 48x80px, text-base, gut mit Daumen erreichbar */}
      <button
        onClick={onStop}
        className="flex items-center gap-1.5 px-4 bg-red-500 text-white rounded-lg text-base font-bold hover:bg-red-600 transition-colors"
        style={{ minHeight: 48, minWidth: 80 }}
      >
        <Square className="w-5 h-5 fill-current" />
        Stop
      </button>

      {/* Equipment display */}
      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-300">
        {equipmentType === "mobil" ? (
          <Car className="w-3.5 h-3.5" />
        ) : (
          <Radio className="w-3.5 h-3.5" />
        )}
        <span className="font-medium">
          {equipmentType === "mobil" ? "Mobil 50W" : "Portable 5W"}
        </span>
      </div>

      {/* Mode display */}
      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-300">
        {mode === "route" ? (
          <Route className="w-3.5 h-3.5" />
        ) : (
          <MapPin className="w-3.5 h-3.5" />
        )}
        <span className="font-medium">{mode === "route" ? "Route" : "Live"}</span>
      </div>

      <div className="flex-1" />

      {/* Coverage toggles — min 44x44px touch target, px-3 py-2 */}
      <button
        onClick={onToggleRepeaterCoverage}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
          showRepeaterCoverage
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400"
        }`}
        style={{ minHeight: 44, minWidth: 44 }}
      >
        <Circle className="w-4 h-4" />
        Repeater
      </button>
      <button
        onClick={onToggleOwnCoverage}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
          showOwnCoverage
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            : "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400"
        }`}
        style={{ minHeight: 44, minWidth: 44 }}
      >
        <Users className="w-4 h-4" />
        Eigene
      </button>
    </div>
  );
}