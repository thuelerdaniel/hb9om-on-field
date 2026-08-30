import React, { useState, useMemo, useEffect } from "react";
import { Mountain, ChevronDown, X, Search, Info } from "lucide-react";
import CountryContinentFilter from "@/components/map/CountryContinentFilter";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { safeSetItem, safeGetItem } from "@/lib/safeStorage";

// Offizielle SOTA-Punkte-Tabelle (basierend auf Gipfelhöhe):
// https://www.sotadata.org.uk/en/summits
export const SOTA_POINTS = [
  { id: 1, label: "1 P", min: 150, max: 499 },
  { id: 2, label: "2 P", min: 500, max: 749 },
  { id: 3, label: "3 P", min: 750, max: 999 },
  { id: 4, label: "4 P", min: 1000, max: 1249 },
  { id: 5, label: "5 P", min: 1250, max: 1499 },
  { id: 6, label: "6 P", min: 1500, max: 1749 },
  { id: 7, label: "7 P", min: 1750, max: 1999 },
  { id: 8, label: "8 P", min: 2000, max: 2249 },
  { id: 9, label: "9 P", min: 2250, max: 2499 },
  { id: 10, label: "10 P", min: 2500, max: 2749 },
  { id: 12, label: "12 P", min: 2750, max: 2999 },
  { id: 15, label: "15 P", min: 3000, max: 3499 },
  { id: 20, label: "20 P", min: 3500, max: 3999 },
  { id: 25, label: "25 P", min: 4000, max: 4499 },
  { id: 30, label: "30 P", min: 4500, max: 4999 },
  { id: 35, label: "35 P", min: 5000, max: 5499 },
  { id: 40, label: "40 P", min: 5500, max: 5999 },
  { id: 45, label: "45 P", min: 6000, max: 6499 },
  { id: 50, label: "50 P", min: 6500, max: 6999 },
  { id: 55, label: "55 P", min: 7000, max: 7499 },
  { id: 60, label: "60 P", min: 7500, max: 7999 },
  { id: 70, label: "70 P", min: 8000, max: 8499 },
  { id: 80, label: "80 P", min: 8500, max: 8999 },
  { id: 90, label: "90 P", min: 9000, max: 9499 },
  { id: 100, label: "100 P", min: 9500, max: 9999 },
  { id: 110, label: "110 P", min: 10000, max: 10499 },
  { id: 120, label: "120 P", min: 10500, max: 10999 },
  { id: 130, label: "130 P", min: 11000, max: 11499 },
  { id: 140, label: "140 P", min: 11500, max: 11999 },
  { id: 150, label: "150 P", min: 12000, max: 12499 },
];

// Berechne SOTA-Punkte aus der Gipfelhöhe (altitude) nach offizieller Tabelle
export function altitudeToPoints(altitude) {
  if (altitude == null || isNaN(altitude)) return 0;
  const a = Math.round(altitude);
  for (const p of SOTA_POINTS) {
    if (a >= p.min && a <= p.max) return p.id;
  }
  if (a < 150) return 0;
  return 150; // > 12000m
}

const ALTITUDE_RANGES = [
  { id: "all", label: "Alle Höhen", min: 0, max: 99999 },
  { id: "lt500", label: "< 500 m", min: 0, max: 499 },
  { id: "500-1000", label: "500–1000 m", min: 500, max: 1000 },
  { id: "1000-2000", label: "1000–2000 m", min: 1000, max: 2000 },
  { id: "gt2000", label: "> 2000 m", min: 2001, max: 99999 },
];

export default function SotaFilter({
  searchQuery,
  onSearchQueryChange,
  pointCount,
  visibleCount,
  points = [],
  filterCountries = [],
  onFilterCountriesChange,
  filterPoints = [],
  onFilterPointsChange,
  altitudeRange = "all",
  onAltitudeRangeChange,
  leftPx = 12,
  bottomPx = 230,
  defaultOpen = true,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = safeGetItem("hb9om_filter_open_sota");
    if (saved !== null) return saved === "true";
    return defaultOpen;
  });
  const { containerRef } = useDraggablePosition("drag-sota-filter");

  useEffect(() => { safeSetItem("hb9om_filter_open_sota", String(isOpen)); }, [isOpen]);

  const countries = useMemo(() => {
    const counts = {};
    for (const p of points) {
      const cc = p.country_code || p.code?.split("/")[0] || "?";
      counts[cc] = counts[cc] || { code: cc, name: p.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [points]);

  const togglePoint = (pt) => {
    const current = filterPoints.length === 0 ? SOTA_POINTS.map(p => p.id) : filterPoints;
    if (current.includes(pt)) {
      onFilterPointsChange(current.filter(p => p !== pt));
    } else {
      onFilterPointsChange([...current, pt]);
    }
  };

  const allPointsOn = filterPoints.length === 0 || filterPoints.length === SOTA_POINTS.length;

  return (
    <div ref={containerRef} className="fixed z-[1000]" style={{ left: `${leftPx}px`, bottom: `${bottomPx}px`, touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white shadow-lg rounded-lg p-2.5 transition-colors border flex items-center gap-1.5 ${
          isOpen ? "border-red-400" : "border-gray-200 hover:bg-gray-50"
        }`}
        title="SOTA-Filter"
      >
        <Mountain className="w-5 h-5 text-red-600" />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">SOTA</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        {filterCountries.length > 0 && (
          <span className="px-1 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-bold">
            {filterCountries.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-red-600" /> SOTA – Summits on the Air
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
                placeholder="Gipfel-Code, Name..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              {searchQuery && (
                <button onClick={() => onSearchQueryChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded text-gray-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Altitude filter */}
          <div className="p-3 border-b border-gray-100">
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Höhe</h4>
            <div className="flex flex-wrap gap-1">
              {ALTITUDE_RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onAltitudeRangeChange?.(r.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                    altitudeRange === r.id
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Points filter — offizielle SOTA-Punkte basierend auf Gipfelhöhe */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Punkte (nach Höhe)</h4>
              <button
                onClick={() => onFilterPointsChange(allPointsOn ? [] : SOTA_POINTS.map(p => p.id))}
                className="text-[10px] text-red-600 hover:underline"
              >
                {allPointsOn ? "Keine" : "Alle"}
              </button>
            </div>
            <div className="flex flex-wrap gap-0.5 max-h-32 overflow-y-auto">
              {SOTA_POINTS.map((p) => {
                const isActive = filterPoints.length === 0 || filterPoints.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePoint(p.id)}
                    title={`${p.id} Punkte: ${p.min}-${p.max}m`}
                    className={`px-1.5 py-1 rounded text-[9px] font-medium transition-colors ${
                      isActive ? "bg-red-100 text-red-700" : "bg-gray-50 text-gray-400 opacity-50"
                    }`}
                  >
                    {p.id}
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-gray-400 mt-1.5">
              Offizielle SOTA-Punkte: 1P (150-499m) bis 150P (12000m+). <a href="https://www.sotadata.org.uk/en/summits" target="_blank" rel="noopener" className="text-red-500 hover:underline">Quelle</a>
            </p>
          </div>

          <CountryContinentFilter
            countries={countries}
            selectedCountries={filterCountries}
            onCountriesChange={onFilterCountriesChange}
            accentColor="red"
          />

          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-gray-400" />
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Über SOTA</h4>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              SOTA (Summits on the Air) — Berggipfel ab 150 m Prominenz. Punkte basieren auf Gipfelhöhe: 1–150 Punkte.
            </p>
            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
              <span>{visibleCount} von {pointCount} Gipfeln</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}