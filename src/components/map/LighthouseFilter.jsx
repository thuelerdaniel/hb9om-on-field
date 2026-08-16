import React, { useState, useMemo, useEffect } from "react";
import { Anchor, ChevronDown, X, Search, Info, Radio } from "lucide-react";
import CountryContinentFilter from "@/components/map/CountryContinentFilter";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

export default function LighthouseFilter({
  searchQuery,
  onSearchQueryChange,
  pointCount = 0,
  visibleCount = 0,
  points = [],
  filterCountries = [],
  onFilterCountriesChange,
  leftOffsetClass = "left-16",
  defaultOpen = true,
  // New ILLW-specific props
  onlyIllwActive = false,
  onOnlyIllwActiveChange,
  illwYear = null,
  onIllwYearChange,
  illwActiveCount = 0,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem("hb9om_filter_open_lighthouse");
    if (saved !== null) return saved === "true";
    return defaultOpen;
  });
  const { containerRef } = useDraggablePosition("drag-lighthouse-filter");

  useEffect(() => {
    localStorage.setItem("hb9om_filter_open_lighthouse", String(isOpen));
  }, [isOpen]);

  // Build country list from lighthouse points
  const countries = useMemo(() => {
    const counts = {};
    for (const p of points) {
      const cc = p.country_code || "?";
      counts[cc] = counts[cc] || { code: cc, name: p.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [points]);

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div
      ref={containerRef}
      className={`absolute top-16 ${leftOffsetClass} z-[1005]`}
      style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white shadow-lg rounded-lg p-2.5 transition-colors border flex items-center gap-1.5 ${
          isOpen ? "border-red-400" : "border-gray-200 hover:bg-gray-50"
        }`}
        title="Leuchtturm-Filter"
      >
        <Anchor className="w-5 h-5 text-red-600" />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">Leucht.</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        {onlyIllwActive && (
          <span className="px-1 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold flex items-center gap-0.5">
            <Radio className="w-2 h-2" />
            {illwActiveCount}
          </span>
        )}
        {!onlyIllwActive && filterCountries.length > 0 && (
          <span className="px-1 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold">
            {filterCountries.length}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <Anchor className="w-4 h-4 text-red-600" /> WLOTA – Leuchttürme (ILLW)
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ILLW-active toggle + year filter */}
          <div className="p-3 border-b border-gray-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyIllwActive}
                onChange={(e) => onOnlyIllwActiveChange?.(e.target.checked)}
                className="w-4 h-4 accent-red-600 flex-shrink-0"
              />
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-red-500" />
                Nur ILLW-aktive zeigen
              </span>
              {illwActiveCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                  {(illwActiveCount ?? 0).toLocaleString()} aktiv
                </span>
              )}
            </label>

            {/* Year filter */}
            <div className="flex items-center gap-2 pl-6">
              <span className="text-[11px] text-gray-500">ILLW Jahr:</span>
              <select
                value={illwYear ?? ""}
                onChange={(e) =>
                  onIllwYearChange?.(e.target.value ? parseInt(e.target.value) : null)
                }
                className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="">Alle Jahre</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Name, ILLW-Nr, Land..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchQueryChange("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded text-gray-400"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Country/Continent multi-select filter */}
          <CountryContinentFilter
            countries={countries}
            selectedCountries={filterCountries}
            onCountriesChange={onFilterCountriesChange}
            accentColor="red"
          />

          {/* Info section */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-gray-400" />
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Über Leuchttürme
              </h4>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Leuchttürme aus der offiziellen ILLW-Liste (wllw.org) — International
              Lighthouse/Lightship Weekend. Rot = ILLW aktiv {(currentYear)}, Blau =
              registriert, nicht aktiv, Orange = ohne ILLW-Bezug.
            </p>
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>
                {visibleCount} von {(pointCount ?? 0).toLocaleString()} Leuchttürmen
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}