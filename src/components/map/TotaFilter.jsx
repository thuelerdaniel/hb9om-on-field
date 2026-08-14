import React, { useState, useMemo } from "react";
import { RadioTower, Signal, ChevronDown, X, Search, Info } from "lucide-react";
import CountryContinentFilter from "@/components/map/CountryContinentFilter";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

const TOTA_TYPES = [
  { id: "tower", label: "Türme / Aussichtstürme", icon: RadioTower, color: "#f97316" },
  { id: "antenna", label: "Antennen", icon: Signal, color: "#8b5cf6" },
];

const TOTA_TYPE_IDS = TOTA_TYPES.map((t) => t.id);

export default function TotaFilter({
  filterTypes,
  onFilterTypesChange,
  searchQuery,
  onSearchQueryChange,
  pointCount,
  visibleCount,
  points = [],
  filterCountries = [],
  onFilterCountriesChange,
  showChTota = false,
  onShowChTotaChange,
  leftOffsetClass = "left-16",
  defaultOpen = true,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { containerRef } = useDraggablePosition("drag-tota-filter");

  const allOn = !filterTypes || filterTypes.length === TOTA_TYPE_IDS.length;
  const noneOn = filterTypes && filterTypes.length === 0;

  const toggleType = (type) => {
    const current = filterTypes || TOTA_TYPE_IDS;
    if (current.includes(type)) {
      onFilterTypesChange(current.filter((t) => t !== type));
    } else {
      onFilterTypesChange([...current, type]);
    }
  };

  // Build country list from TOTA points
  const countries = useMemo(() => {
    const counts = {};
    for (const p of points) {
      const cc = p.country_code || (p.source === "swiss_csv" ? "CH" : "?");
      counts[cc] = counts[cc] || { code: cc, name: p.country || cc, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [points]);

  return (
    <div ref={containerRef} className={`absolute top-16 ${leftOffsetClass} z-[1005]`} style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white shadow-lg rounded-lg p-2.5 transition-colors border flex items-center gap-1.5 ${
          isOpen ? "border-orange-400" : "border-gray-200 hover:bg-gray-50"
        }`}
        title="TOTA-Filter"
      >
        <RadioTower className="w-5 h-5 text-orange-600" />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">TOTA</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        {filterCountries.length > 0 && (
          <span className="px-1 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-bold">
            {filterCountries.length}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <RadioTower className="w-4 h-4 text-orange-600" /> TOTA – Towers on the Air
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400"
            >
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
                placeholder="Name, Code, Kategorie..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
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

          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Typ
              </h4>
              <button
                onClick={() => onFilterTypesChange(allOn ? [] : null)}
                className="text-[10px] text-orange-600 hover:underline"
              >
                {allOn ? "Keine" : "Alle"}
              </button>
            </div>
            <div className="space-y-1">
              {TOTA_TYPES.map((type) => {
                const isActive = !filterTypes || filterTypes.includes(type.id);
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isActive ? "bg-gray-50" : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    <Icon
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: type.color }}
                    />
                    <span
                      className={`flex-1 text-left ${
                        isActive ? "text-gray-900 font-medium" : "text-gray-500"
                      }`}
                    >
                      {type.label}
                    </span>
                    {isActive && <span className="text-[10px] text-gray-400">✓</span>}
                  </button>
                );
              })}
            </div>
            {noneOn && (
              <p className="text-[10px] text-red-600 mt-1.5 font-medium">
                ⚠ Mindestens ein Typ muss aktiv sein.
              </p>
            )}
          </div>

          {/* Schweiz ein-/ausblenden Toggle */}
          <div className="p-3 border-b border-gray-100">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                  Schweiz (CH)
                </span>
              </div>
              <button
                onClick={() => onShowChTotaChange?.(!showChTota)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  showChTota ? "bg-orange-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    showChTota ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </label>
            <p className="text-[10px] text-gray-400 mt-1">
              {showChTota ? "Schweizer Antennen/Türme werden angezeigt" : "Schweizer Antennen/Türme sind ausgeblendet (Standard)"}
            </p>
          </div>

          {/* Country/Continent multi-select filter */}
          <CountryContinentFilter
            countries={countries}
            selectedCountries={filterCountries}
            onCountriesChange={onFilterCountriesChange}
            accentColor="orange"
          />

          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-gray-400" />
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                Über TOTA
              </h4>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              TOTA (Towers on the Air) ist ein internationales Programm für
              Aussichtstürme. In der Schweiz werden Antennen und Türme aus
              lokalen Datenquellen getrennt dargestellt. Weltweit Daten von
              wwtota.com (5300+ Türme in 17 Ländern).
            </p>
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>
                {visibleCount} von {pointCount} TOTA-Punkten
              </span>
              {noneOn && (
                <span className="text-red-600 font-medium">Kein Typ gewählt</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}