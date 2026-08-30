import React, { useState } from "react";
import { Layers, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import { safeRemoveItem } from "@/lib/safeStorage";

// PUNKT 14: Setzt die Layer-Ladeanzeige zurück — löscht alle Layer-Loading-Cache-Keys
// aus localStorage und IndexedDB, sodass die Ladeanzeige wieder erscheint.
export default function LayerLoadingReset() {
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    setDone(false);
    try {
      // 1. Layer-spezifische localStorage-Keys löschen
      const layerKeys = [
        "hb9om_active_layers",
        "hb9om_base_layer",
        "hb9om_map_state",
        "hb9om_map_opacity",
        "hb9om_locked_scale",
        "hb9om_performance_mode",
        "hb9om_drag_mode",
        "hb9om_fox_mode",
        "hb9om_active_continents",
        "hb9om_active_countries",
        "hb9om_filter_state",
        "hb9om_ref_search",
        "hb9om_sota_filter_countries",
        "hb9om_pota_filter_countries",
        "hb9om_wwff_filter_countries",
        "hb9om_iota_filter_countries",
        "hb9om_show_ch_tota",
        "hb9om_perf_suggestion_dismissed",
        "hb9om_filter_open_sota",
        "hb9om_filter_open_pota",
        "hb9om_filter_open_hbff",
        "hb9om_filter_open_iota",
        "hb9om_filter_open_repeater",
        "hb9om_filter_open_tota",
        "hb9om_filter_open_aprs",
        "hb9om_filter_open_bm",
        "hb9om_filter_open_lighthouse",
      ];
      for (const key of layerKeys) {
        safeRemoveItem(key);
      }

      // 2. IndexedDB-Caches löschen (Offline-Tile-Cache, Daten-Cache)
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // 3. ViewportDataLoader-Cache löschen (falls in IndexedDB)
      if ("indexedDB" in window) {
        try {
          const dbReq = indexedDB.deleteDatabase("hb9om_viewport_cache");
          await new Promise((resolve) => {
            dbReq.onsuccess = resolve;
            dbReq.onerror = resolve;
          });
        } catch {}
      }

      setDone(true);
      setTimeout(() => setDone(false), 5000);
    } catch {
      setDone(true);
      setTimeout(() => setDone(false), 5000);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-4 h-4 text-indigo-500" />
        <h4 className="text-xs font-semibold text-gray-900 dark:text-slate-100">Layer-Ladeanzeige zurücksetzen</h4>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2">
        Setzt alle Layer-Loading-States und Caches zurück. Falls die Ladeanzeige hängen bleibt oder verschwunden ist,
        hilft ein Neuladen der Seite nach dem Zurücksetzen.
      </p>
      <button
        onClick={handleReset}
        disabled={resetting}
        className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 flex items-center gap-1.5"
      >
        {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : done ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <RotateCcw className="w-3 h-3" />}
        {done ? "Zurückgesetzt — bitte Seite neu laden" : "Layer-Anzeige zurücksetzen"}
      </button>
    </div>
  );
}