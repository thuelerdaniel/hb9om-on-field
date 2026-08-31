// MobilModeToggle — Toggle-Switch zwischen "Route" und "Live" Modus.

import React from "react";
import { Route, Radio } from "lucide-react";

export default function MobilModeToggle({ mode, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1">
      <button
        onClick={() => onChange("route")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          mode === "route"
            ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm"
            : "text-gray-500 dark:text-slate-400"
        }`}
      >
        <Route className="w-4 h-4" />
        Route
      </button>
      <button
        onClick={() => onChange("live")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          mode === "live"
            ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 shadow-sm"
            : "text-gray-500 dark:text-slate-400"
        }`}
      >
        <Radio className="w-4 h-4" />
        Live
      </button>
    </div>
  );
}