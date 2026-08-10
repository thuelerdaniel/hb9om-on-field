import React, { useState, useMemo } from "react";
import { Radio, Search, Link2, ChevronDown, X, Globe, MapPin, Signal } from "lucide-react";
import { MODE_COLORS, MODE_LABELS, FILTER_MODES } from "@/lib/repeaterModes";

export default function RepeaterFilter({
  filterModes,
  onFilterModesChange,
  searchQuery,
  onSearchQueryChange,
  showLinks,
  onShowLinksChange,
  showCoverage,
  onShowCoverageChange,
  filterCountry,
  onFilterCountryChange,
  countries,
  repeaterCount,
  visibleCount,
  radiusKm,
  onRadiusKmChange,
  userPosition,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMode = (mode) => {
    if (filterModes.includes(mode)) {
      onFilterModesChange(filterModes.filter(m => m !== mode));
    } else {
      onFilterModesChange([...filterModes, mode]);
    }
  };

  const allOn = filterModes.length === FILTER_MODES.length;
  const noneOn = filterModes.length === 0;

  const sortedCountries = useMemo(() => {
    return [...(countries || [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [countries]);

  return (
    <div className="absolute top-3 left-3 z-[1005]">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white shadow-lg rounded-lg p-2.5 transition-colors border flex items-center gap-1.5 ${
          isOpen ? "border-blue-400" : "border-gray-200 hover:bg-gray-50"
        }`}
        title="Relais-Filter"
      >
        <Radio className="w-5 h-5 text-blue-600" />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">Relais</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-600" /> Relais-Filter
            </h3>
            <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-gray-100 rounded text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => onSearchQueryChange(e.target.value)}
                placeholder="Rufzeichen, Ort, Frequenz..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
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

          {/* Country filter */}
          {sortedCountries.length > 1 && (
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Land
                </h4>
                {filterCountry !== "all" && (
                  <button
                    onClick={() => onFilterCountryChange("all")}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    Alle
                  </button>
                )}
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                <button
                  onClick={() => onFilterCountryChange("all")}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                    filterCountry === "all" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>Alle Länder</span>
                  <span className="text-[10px] text-gray-400">{repeaterCount}</span>
                </button>
                {sortedCountries.map(c => (
                  <button
                    key={c.code}
                    onClick={() => onFilterCountryChange(c.code)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                      filterCountry === c.code ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1">{c.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode filters */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Modulationsart</h4>
              <button
                onClick={() => onFilterModesChange(allOn ? [] : [...FILTER_MODES])}
                className="text-[10px] text-blue-600 hover:underline"
              >
                {allOn ? "Keine" : "Alle"}
              </button>
            </div>
            <div className="space-y-1">
              {FILTER_MODES.map(mode => {
                const isActive = filterModes.includes(mode);
                const color = MODE_COLORS[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => toggleMode(mode)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isActive ? "bg-gray-50" : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow"
                      style={{ backgroundColor: color }}
                    />
                    <span className={`flex-1 text-left ${isActive ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {MODE_LABELS[mode]}
                    </span>
                    {isActive && <span className="text-[10px] text-gray-400">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Radius filter from user position */}
          {userPosition && (
            <div className="p-3 border-b border-gray-100">
              <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                <MapPin className="w-3 h-3" /> Radius-Filter
              </h4>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="5"
                  value={radiusKm || 0}
                  onChange={e => onRadiusKmChange(parseInt(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs font-mono text-gray-600 w-14 text-right">
                  {radiusKm > 0 ? `${radiusKm} km` : "Alle"}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                Nur Relais innerhalb dieses Radius von Ihrer Position anzeigen
              </p>
              {radiusKm > 0 && (
                <button
                  onClick={() => onRadiusKmChange(0)}
                  className="text-[10px] text-blue-600 hover:underline mt-1"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          )}

          {/* Coverage circles toggle */}
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={() => onShowCoverageChange(!showCoverage)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-gray-700">
                <Signal className="w-3.5 h-3.5 text-green-500" />
                Abdeckung anzeigen
              </span>
              <span className={`relative w-9 h-5 rounded-full transition-colors ${showCoverage ? "bg-green-500" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showCoverage ? "translate-x-4" : ""}`} />
              </span>
            </button>
            <p className="text-[10px] text-gray-400 mt-1 ml-2">
              Geschätzte Reichweite pro Relais (basierend auf Band: 2m ~35 km, 70cm ~25 km). Für exakte RadioMobile-Abdeckung siehe iz8wnh.it.
            </p>
          </div>

          {/* Linking lines toggle */}
          <div className="p-3 border-b border-gray-100">
            <button
              onClick={() => onShowLinksChange(!showLinks)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 text-gray-700">
                <Link2 className="w-3.5 h-3.5 text-blue-500" />
                Verlinkungen anzeigen
              </span>
              <span className={`relative w-9 h-5 rounded-full transition-colors ${showLinks ? "bg-blue-500" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showLinks ? "translate-x-4" : ""}`} />
              </span>
            </button>
            <p className="text-[10px] text-gray-400 mt-1 ml-2">
              Permanente Verlinkungen: echte Crosslinks aus RepeaterBook + admin-bestätigte Verlinkungen. Temporäre Verlinkungen werden nicht angezeigt.
            </p>
          </div>

          {/* Stats */}
          <div className="p-3">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{visibleCount} von {repeaterCount} Relais sichtbar</span>
              {noneOn && <span className="text-amber-600">Alle Filter deaktiviert</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}