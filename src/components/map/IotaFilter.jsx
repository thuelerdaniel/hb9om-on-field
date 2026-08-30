import React, { useState, useMemo, useEffect } from "react";
import { MapPin, ChevronDown, X, Search, Info } from "lucide-react";
import CountryContinentFilter from "@/components/map/CountryContinentFilter";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { safeSetItem, safeGetItem } from "@/lib/safeStorage";
import BoundaryToggleSection from "@/components/map/BoundaryToggleSection";

const IOTA_STATUSES = [
  { id: "all", label: "Alle Status" },
  { id: "active", label: "Aktiv" },
  { id: "not_activated", label: "Nicht aktiviert" },
];

const IOTA_REGIONS = [
  { id: "all", label: "Alle Regionen" },
  { id: "AF", label: "Afrika" },
  { id: "EU", label: "Europa" },
  { id: "NA", label: "Nordamerika" },
  { id: "SA", label: "Südamerika" },
  { id: "AS", label: "Asien" },
  { id: "OC", label: "Ozeanien" },
  { id: "AN", label: "Antarktis" },
];

export default function IotaFilter({
  searchQuery,
  onSearchQueryChange,
  pointCount,
  visibleCount,
  points = [],
  filterCountries = [],
  onFilterCountriesChange,
  statusFilter = "all",
  onStatusFilterChange,
  regionFilter = "all",
  onRegionFilterChange,
  leftPx = 12,
  bottomPx = 230,
  defaultOpen = true,
  onToggleAllBoundaries,
  allBoundariesActive = false,
  activeBoundaryCount = 0,
  onClearBoundaries,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = safeGetItem("hb9om_filter_open_iota");
    if (saved !== null) return saved === "true";
    return defaultOpen;
  });
  const { containerRef } = useDraggablePosition("drag-iota-filter");

  useEffect(() => { safeSetItem("hb9om_filter_open_iota", String(isOpen)); }, [isOpen]);

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
          isOpen ? "border-blue-400" : "border-gray-200 hover:bg-gray-50"
        }`}
        title="IOTA-Filter"
      >
        <MapPin className="w-5 h-5 text-blue-600" />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">IOTA</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        {filterCountries.length > 0 && (
          <span className="px-1 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold">
            {filterCountries.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600" /> IOTA – Islands on the Air
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
                placeholder="Referenz, Insel-Name..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              {searchQuery && (
                <button onClick={() => onSearchQueryChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded text-gray-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Status filter */}
          <div className="p-3 border-b border-gray-100">
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Status</h4>
            <div className="flex flex-wrap gap-1">
              {IOTA_STATUSES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onStatusFilterChange?.(s.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                    statusFilter === s.id
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Region filter */}
          <div className="p-3 border-b border-gray-100">
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Region</h4>
            <div className="flex flex-wrap gap-1">
              {IOTA_REGIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onRegionFilterChange?.(r.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                    regionFilter === r.id
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <BoundaryToggleSection
            layerType="iota"
            allBoundariesActive={allBoundariesActive}
            onToggleAllBoundaries={onToggleAllBoundaries}
            activeBoundaryCount={activeBoundaryCount}
            onClearBoundaries={onClearBoundaries}
            accentColor="blue"
          />

          <CountryContinentFilter
            countries={countries}
            selectedCountries={filterCountries}
            onCountriesChange={onFilterCountriesChange}
            accentColor="blue"
          />

          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-gray-400" />
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Über IOTA</h4>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              IOTA (Islands on the Air) — Inselgruppen weltweit, kategorisiert nach Region (AF, EU, NA, SA, AS, OC, AN).
            </p>
            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
              <span>{visibleCount} von {pointCount} Inselgruppen</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}