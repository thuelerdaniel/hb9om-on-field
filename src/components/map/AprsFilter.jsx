import React, { useState } from "react";
import { Wifi, Search, ChevronDown, X, Info } from "lucide-react";
import { NODE_TYPE_LABELS, NODE_COLORS } from "@/components/map/PrivateNodeLayer";
import { APRS_SYMBOLS } from "@/lib/aprsSymbols";
import CountryContinentFilter from "@/components/map/CountryContinentFilter";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

const ALL_TYPES = Object.keys(NODE_TYPE_LABELS);

export default function AprsFilter({
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
  defaultOpen = true,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { containerRef } = useDraggablePosition("drag-aprs-filter");

  // null or all = no filter (show everything); array = filter by selected types
  const allOn = !filterTypes || filterTypes.length === ALL_TYPES.length;
  const noneOn = filterTypes && filterTypes.length === 0;

  const toggleType = (type) => {
    const current = filterTypes || ALL_TYPES;
    if (current.includes(type)) {
      onFilterTypesChange(current.filter(t => t !== type));
    } else {
      onFilterTypesChange([...current, type]);
    }
  };

  return (
    <div ref={containerRef} className={`absolute top-16 ${leftOffsetClass} z-[1005]`} style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white shadow-lg rounded-lg p-2.5 transition-colors border flex items-center gap-1.5 ${
          isOpen ? "border-purple-400" : "border-gray-200 hover:bg-gray-50"
        }`}
        title="APRS-Filter"
      >
        <Wifi className="w-5 h-5 text-purple-600" />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">APRS</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        {filterCountries.length > 0 && (
          <span className="px-1 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-bold">
            {filterCountries.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-purple-600" /> APRS-Filter
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
                placeholder="Rufzeichen, Ort, Netzwerk..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
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
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Node-Typ</h4>
              <button
                onClick={() => onFilterTypesChange(allOn ? [] : null)}
                className="text-[10px] text-purple-600 hover:underline"
              >
                {allOn ? "Keine" : "Alle"}
              </button>
            </div>
            <div className="space-y-1">
              {ALL_TYPES.map(type => {
                const isActive = !filterTypes || filterTypes.includes(type);
                const color = NODE_COLORS[type] || NODE_COLORS.other;
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isActive ? "bg-gray-50" : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    <span
                      className="w-6 h-6 flex-shrink-0"
                      dangerouslySetInnerHTML={{ __html: (APRS_SYMBOLS[type] || APRS_SYMBOLS.other).svg(color) }}
                    />
                    <span className={`flex-1 text-left ${isActive ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {NODE_TYPE_LABELS[type]}
                    </span>
                    {isActive && <span className="text-[10px] text-gray-400">✓</span>}
                  </button>
                );
              })}
            </div>
            {noneOn && (
              <p className="text-[10px] text-red-600 mt-1.5 font-medium">
                ⚠ Mindestens ein Node-Typ muss aktiv sein.
              </p>
            )}
          </div>

          {/* Country/Continent multi-select filter */}
          <CountryContinentFilter
            countries={countries}
            selectedCountries={filterCountries}
            onCountriesChange={onFilterCountriesChange}
            accentColor="purple"
          />

          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Info className="w-3.5 h-3.5 text-gray-400" />
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">APRS-Symbole</h4>
            </div>
            <p className="text-[10px] text-gray-400 mb-2">Symbole nach APRS-Standard (aprs.org). Auf der Karte wird pro Node-Typ das entsprechende Symbol angezeigt.</p>
            <div className="grid grid-cols-2 gap-1">
              {ALL_TYPES.map(type => {
                const color = NODE_COLORS[type] || NODE_COLORS.other;
                const symbol = APRS_SYMBOLS[type] || APRS_SYMBOLS.other;
                return (
                  <div key={type} className="flex items-center gap-1.5 px-1.5 py-1 bg-gray-50 rounded">
                    <span className="w-5 h-5 flex-shrink-0" dangerouslySetInnerHTML={{ __html: symbol.svg(color) }} />
                    <span className="text-[10px] text-gray-600 truncate">{NODE_TYPE_LABELS[type]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{visibleCount} von {nodeCount} APRS-Stationen</span>
              {noneOn && <span className="text-red-600 font-medium">Kein Typ gewählt</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}