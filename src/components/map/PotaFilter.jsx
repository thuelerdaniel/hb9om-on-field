import React, { useState, useMemo, useEffect } from "react";
import { Trees, ChevronDown, X, Search, Info, MapPinned, Trash2 } from "lucide-react";
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
  onToggleAllBoundaries,
  allBoundariesActive = false,
  activeBoundaryCount = 0,
  onClearBoundaries,
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

          {onToggleAllBoundaries && (
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <MapPinned className="w-3.5 h-3.5 text-green-600" />
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Grenzen</h4>
                </div>
                {activeBoundaryCount > 0 && (
                  <span className="text-[10px] font-mono text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                    {activeBoundaryCount} aktiv
                  </span>
                )}
              </div>
              <button
                onClick={() => onToggleAllBoundaries(!allBoundariesActive)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                  allBoundariesActive
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <MapPinned className="w-3.5 h-3.5" />
                  Alle Grenzen {allBoundariesActive ? "ausblenden" : "zeichnen"}
                </span>
                <div className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                  allBoundariesActive ? "bg-green-500" : "bg-gray-300"
                }`}>
                  <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform mt-0.5 ${
                    allBoundariesActive ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                  }`} />
                </div>
              </button>
              {activeBoundaryCount > 0 && onClearBoundaries && (
                <button
                  onClick={onClearBoundaries}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Alle Grenzen entfernen ({activeBoundaryCount})
                </button>
              )}
              <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                Zeichnet Grenz-Kreise für alle sichtbaren POTA-Parks. Einzelne Grenzen können im Marker-Popup ein-/ausgeschaltet werden.
              </p>
            </div>
          )}

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