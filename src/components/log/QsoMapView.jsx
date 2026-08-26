import React, { useState, useMemo } from "react";
import { Globe, Map as MapIcon } from "lucide-react";
import QsoWorldMap from "./QsoWorldMap";
import QsoGlobe from "./QsoGlobe";

// Wrapper mit Umschalter zwischen 3D-Globus und 2D-Weltkarte.
// Zeigt alle QSOs mit Grid-Locator auf der Karte/dem Globus.

export default function QsoMapView({ entries }) {
  const [view, setView] = useState('globe');

  const stats = useMemo(() => {
    let withGrid = 0;
    let total = entries.length;
    for (const e of entries) {
      if (e.operator_grid || e.my_grid) withGrid++;
    }
    return { withGrid, total };
  }, [entries]);

  if (stats.withGrid === 0) {
    return (
      <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
          <Globe className="w-4 h-4" /> QSO Weltkarte
        </h2>
        <p className="text-xs text-gray-400 text-center py-8">
          Keine QSOs mit Grid-Locator verfügbar. QSOs mit Operator-Grid werden automatisch auf der Karte angezeigt.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Globe className="w-4 h-4" /> QSO Weltkarte
          <span className="text-[10px] text-gray-400 font-normal">({stats.withGrid}/{stats.total} mit Grid)</span>
        </h2>
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
          <button
            onClick={() => setView('globe')}
            className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${view === 'globe' ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
          >
            <Globe className="w-3 h-3" /> Globus
          </button>
          <button
            onClick={() => setView('map')}
            className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${view === 'map' ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'}`}
          >
            <MapIcon className="w-3 h-3" /> Karte
          </button>
        </div>
      </div>
      <div style={{ height: 350 }} className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
        {view === 'globe' ? <QsoGlobe entries={entries} /> : <QsoWorldMap entries={entries} />}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">
        {view === 'globe'
          ? 'Globus mit Maus/Touch drehen · Scrollrad/Pinch zum Zoomen · grün = eigene Position · cyan = QSO-Partner'
          : 'Karte verschieben und zoomen · grün = eigene Position · cyan = QSO-Partner · Klick für Details'}
      </p>
    </section>
  );
}