import React, { useState } from "react";
import { Network, Search, ChevronDown, X, Hash, Radio, Zap } from "lucide-react";
import CountryContinentFilter from "@/components/map/CountryContinentFilter";

// BrandMeister DMR node types — simpler than APRS since BrandMeister is a DMR network
// (repeaters and hotspots), not a positioning system with diverse station types.
const BM_TYPES = [
  { id: "repeater_node", label: "DMR-Relais", icon: Radio },
  { id: "hotspot", label: "DMR-Hotspot / Pi-Star", icon: Zap },
  { id: "other", label: "Sonstige DMR-Nodes", icon: Hash },
];

const BM_TYPE_IDS = BM_TYPES.map(t => t.id);

export default function BrandMeisterFilter({
  filterTypes,
  onFilterTypesChange,
  searchQuery,
  onSearchQueryChange,
  nodeCount,
  visibleCount,
  countries = [],
  filterCountries = [],
  onFilterCountriesChange,
  leftOffsetClass = "left-16",
}) {
  const [isOpen, setIsOpen] = useState(false);

  // null or all = no filter (show everything); array = filter by selected types
  const allOn = !filterTypes || filterTypes.length === BM_TYPE_IDS.length;
  const noneOn = filterTypes && filterTypes.length === 0;

  const toggleType = (type) => {
    const current = filterTypes || BM_TYPE_IDS;
    if (current.includes(type)) {
      onFilterTypesChange(current.filter(t => t !== type));
    } else {
      onFilterTypesChange([...current, type]);
    }
  };

  return (
    <div className={`absolute top-3 ${leftOffsetClass} z-[1005]`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white shadow-lg rounded-lg p-2.5 transition-colors border flex items-center gap-1.5 ${
          isOpen ? "border-teal-400" : "border-gray-200 hover:bg-gray-50"
        }`}
        title="BrandMeister-Filter"
      >
        <Network className="w-5 h-5 text-teal-600" />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">BrandMeister</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        {filterCountries.length > 0 && (
          <span className="px-1 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[9px] font-bold">
            {filterCountries.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-teal-600" /> BrandMeister DMR
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
                onChange={e => onSearchQueryChange(e.target.value)}
                placeholder="Rufzeichen, Ort, DMR-ID..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300"
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
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">DMR-Typ</h4>
              <button
                onClick={() => onFilterTypesChange(allOn ? [] : null)}
                className="text-[10px] text-teal-600 hover:underline"
              >
                {allOn ? "Keine" : "Alle"}
              </button>
            </div>
            <div className="space-y-1">
              {BM_TYPES.map(type => {
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
                    <Icon className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                    <span className={`flex-1 text-left ${isActive ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {type.label}
                    </span>
                    {isActive && <span className="text-[10px] text-gray-400">✓</span>}
                  </button>
                );
              })}
            </div>
            {noneOn && (
              <p className="text-[10px] text-red-600 mt-1.5 font-medium">
                ⚠ Mindestens ein DMR-Typ muss aktiv sein.
              </p>
            )}
          </div>

          {/* Country/Continent multi-select filter */}
          <CountryContinentFilter
            countries={countries}
            selectedCountries={filterCountries}
            onCountriesChange={onFilterCountriesChange}
            accentColor="teal"
          />

          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Hash className="w-3.5 h-3.5 text-gray-400" />
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Über BrandMeister</h4>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              BrandMeister ist ein weltweites DMR-Netzwerk, das Relais und Hotspots über Talkgroups (TG) verbindet.
              Im Gegensatz zu APRS (Positionierung) überträgt BrandMeister Sprach- und Datendienste über das DMR-Protokoll.
              Jede Node hat eine eindeutige DMR-ID.
            </p>
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{visibleCount} von {nodeCount} BrandMeister-Nodes</span>
              {noneOn && <span className="text-red-600 font-medium">Kein Typ gewählt</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}