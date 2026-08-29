import React, { useState, useMemo, useEffect } from "react";
import { Trees, ChevronDown, X, Search, Info } from "lucide-react";
import CountryContinentFilter from "@/components/map/CountryContinentFilter";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { safeSetItem, safeGetItem } from "@/lib/safeStorage";

export default function PotaFilter({
  searchQuery,
  onSearchQueryChange,
  pointCount,
  visibleCount,
  points = [],
  filterCountries = [],
  onFilterCountriesChange,
  leftPx = 12,
  bottomPx = 230,
  defaultOpen = true,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = safeGetItem("hb9om_filter_open_pota");
    if (saved !== null) return saved === "true";
    return defaultOpen;
  });
  const { containerRef } = useDraggablePosition("drag-pota-filter");

  useEffect(() => { safeSetItem("hb9om_filter_open_pota", String(isOpen)); }, [isOpen]);

  const countries = useMemo(() => {
    const counts = {};
    for (const p of points) {
      const cc = p.country_code || p.code?.split("-")[0] || "?";
      counts[cc] = counts[cc] || { code: cc, name: p.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [points]);

  return (
    <div ref={containerRef} className="fixed z-[1000]" style={{ left: `${leftPx}px`, bottom: `${bottomPx}px`, touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white shadow-lg rounded-lg p-2.5 transition-colors border flex items-center gap-1.5 ${
          isOpen ? "border-green-400" : "border-gray-200 hover:bg-gray-50"
        }`}
        title="POTA-Filter"
      >
        <Trees className="w-5 h-5 text-green-600" />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">POTA</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        {filterCountries.length > 0 && (
          <span className="px-1 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-bold">
            {filterCountries.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <Trees className="w-4 h-4 text-green-600" /> POTA – Parks on the Air
            </h3>
            <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-gray-100 rounded text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Park-Code, Name..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              {searchQuery && (
                <button onClick={() => onSearchQueryChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded text-gray-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <CountryContinentFilter
            countries={countries}
            selectedCountries={filterCountries}
            onCountriesChange={onFilterCountriesChange}
            accentColor="green"
          />

          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-gray-400" />
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Über POTA</h4>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              POTA (Parks on the Air) — Nationalparks, Schutzgebiete und Naturreservate weltweit.
            </p>
            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
              <span>{visibleCount} von {pointCount} Parks</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}