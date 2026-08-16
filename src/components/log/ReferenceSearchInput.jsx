import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const COLOR_MAP = {
  sota: "#e74c3c", pota: "#27ae60", hbff: "#8e44ad", wwbota: "#795548",
  castle: "#e67e22", iota: "#3498db", lighthouse: "#f39c12",
  repeater: "#3b82f6", tota: "#f97316", aprs: "#22c55e",
};

const LABEL_MAP = {
  sota: "SOTA", pota: "POTA", hbff: "WWFF", wwbota: "WWBOTA",
  castle: "Burg/Schloss", iota: "IOTA", lighthouse: "Leuchtturm",
  repeater: "Relais", tota: "TOTA", aprs: "APRS",
};

/**
 * Dediziertes Such-Eingabefeld für Referenzen im Log-Formular.
 * Sucht ab 2 Zeichen in lokalen Markern + serverseitig (weltweit).
 * Bei Auswahl: onSelect(reference) wird aufgerufen.
 */
export default function ReferenceSearchInput({ refType, allMarkers, mapCenter, myPosition, onSelect, isOffline }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const lastQueryRef = useRef("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (lastQueryRef.current === query) return;
      lastQueryRef.current = query;
      setLoading(true);
      setShowDropdown(true);

      const q = query.toLowerCase();

      // 1. Lokale Suche (instant — aus geladenen Markern)
      let localResults = [];
      if (allMarkers && allMarkers.length > 0) {
        localResults = allMarkers.filter(m => {
          const code = (m.code || m.reference || "").toLowerCase();
          const name = (m.name || "").toLowerCase();
          return code.includes(q) || name.includes(q);
        });
        if (refType && refType !== "custom" && refType !== "generell") {
          localResults = localResults.filter(m => m.layerType === refType);
        }
        localResults = localResults.slice(0, 20);
      }

      // 2. Server-Suche (weltweit — auch Referenzen die nicht im Viewport geladen sind)
      let serverResults = [];
      if (!isOffline) {
        try {
          const center = myPosition
            ? { lat: myPosition[0], lng: myPosition[1] }
            : (mapCenter ? { lat: mapCenter[0], lng: mapCenter[1] } : null);
          const typesFilter = refType && refType !== "custom" && refType !== "generell" ? [refType] : null;
          const res = await base44.functions.invoke("searchReferences", {
            query,
            types: typesFilter,
            center,
          });
          if (res.data?.references) {
            for (const [type, refs] of Object.entries(res.data.references)) {
              for (const r of (refs || [])) {
                serverResults.push({
                  ...r,
                  code: r.code || r.reference,
                  reference: r.reference || r.code,
                  layerType: type,
                  color: COLOR_MAP[type] || "#888",
                  layerLabel: LABEL_MAP[type] || type,
                });
              }
            }
          }
        } catch {}
      }

      // 3. Merge: local + server (dedup by code)
      const localCodes = new Set(localResults.map(m => (m.code || m.reference || "").toLowerCase()));
      const serverOnly = serverResults.filter(m => {
        const code = (m.code || m.reference || "").toLowerCase();
        const name = (m.name || "").toLowerCase();
        return (code.includes(q) || name.includes(q)) && !localCodes.has(code);
      });
      const merged = [...localResults, ...serverOnly].slice(0, 30);
      setResults(merged);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, refType, allMarkers, mapCenter, myPosition, isOffline]);

  const handleSelect = (r) => {
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    if (onSelect) onSelect(r);
  };

  return (
    <div className="relative mt-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Referenz suchen... (z.B. Uetliberg, HB/AG-001, HB9MD)"
          className="w-full pl-9 pr-9 py-2 text-sm border-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-lg divide-y divide-gray-50 dark:divide-slate-700 z-10">
          {results.map((r, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700 text-left text-xs"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
              <span className="font-mono font-semibold text-gray-900 dark:text-slate-100">{r.code || r.reference}</span>
              <span className="flex-1 truncate text-gray-500 dark:text-slate-400">{r.name}</span>
              {r.lat != null && r.lng != null && (
                <span className="text-[10px] text-gray-400 dark:text-slate-500">
                  {r.lat.toFixed(3)}, {r.lng.toFixed(3)}
                </span>
              )}
              <span className="text-gray-400 dark:text-slate-500 capitalize flex-shrink-0">{r.layerLabel || r.layerType}</span>
            </button>
          ))}
        </div>
      )}
      {showDropdown && !loading && results.length === 0 && query.length >= 2 && (
        <div className="mt-1 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 text-xs text-gray-400 dark:text-slate-500 text-center">
          Keine Referenz gefunden — Code manuell eingeben
        </div>
      )}
    </div>
  );
}