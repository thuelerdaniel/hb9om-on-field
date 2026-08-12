import React, { useState, useMemo } from "react";
import { Radio, Search, Link2, ChevronDown, X, Globe, MapPin, Signal, ExternalLink, Check, SlidersHorizontal } from "lucide-react";
import { MODE_COLORS, MODE_LABELS, FILTER_MODES, FEATURE_MODES } from "@/lib/repeaterModes";
import { CONTINENTS } from "@/lib/continents";
import { COUNTRIES, getCountriesByContinent } from "@/lib/countries";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

export default function RepeaterFilter({
  filterModes,
  onFilterModesChange,
  searchQuery,
  onSearchQueryChange,
  showLinks,
  onShowLinksChange,
  showCoverage,
  onShowCoverageChange,
  showOnlyLinked,
  onShowOnlyLinkedChange,
  filterCountries,
  onFilterCountriesChange,
  countries,
  repeaterCount,
  visibleCount,
  radiusKm,
  onRadiusKmChange,
  userPosition,
  leftOffsetClass = "left-3",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCountryPanel, setShowCountryPanel] = useState(false);
  const { containerRef } = useDraggablePosition("drag-repeater-filter");

  const toggleMode = (mode) => {
    if (filterModes.includes(mode)) {
      onFilterModesChange(filterModes.filter(m => m !== mode));
    } else {
      onFilterModesChange([...filterModes, mode]);
    }
  };

  const allOn = filterModes.length === FILTER_MODES.length;
  const noneOn = filterModes.length === 0;

  const selectedCountries = Array.isArray(filterCountries) ? filterCountries : [];
  const isAllSelected = selectedCountries.length === 0;

  const toggleCountry = (code) => {
    if (selectedCountries.includes(code)) {
      onFilterCountriesChange(selectedCountries.filter(c => c !== code));
    } else {
      onFilterCountriesChange([...selectedCountries, code]);
    }
  };

  const toggleContinent = (continentId) => {
    // Use the actual repeater country data grouped by continent (countriesByContinent),
    // not the static COUNTRIES array — repeaters may have country codes not in COUNTRIES
    // (e.g., countries added to RepeaterBook but not yet in our static list).
    const contCountries = countriesByContinent[continentId] || [];
    const contCodes = contCountries.map(c => c.code);
    if (contCodes.length === 0) return;
    const allContinentSelected = contCodes.every(c => selectedCountries.includes(c));
    if (allContinentSelected) {
      onFilterCountriesChange(selectedCountries.filter(c => !contCodes.includes(c)));
    } else {
      const newSet = new Set([...selectedCountries, ...contCodes]);
      onFilterCountriesChange([...newSet]);
    }
  };

  const selectAll = () => onFilterCountriesChange([]);

  const sortedCountries = useMemo(() => {
    return [...(countries || [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [countries]);

  const countriesByContinent = useMemo(() => {
    const groups = {};
    for (const rc of sortedCountries) {
      const country = COUNTRIES.find(c => c.iso2 === rc.code);
      const cont = country?.continent || 'other';
      if (!groups[cont]) groups[cont] = [];
      groups[cont].push(rc);
    }
    return groups;
  }, [sortedCountries]);

  const hasActiveAdvanced = !isAllSelected || showCoverage || showOnlyLinked || (radiusKm > 0);

  return (
    <div ref={containerRef} className={`absolute top-16 ${leftOffsetClass} z-[1005]`} style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}>
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
        {!isAllSelected && (
          <span className="px-1 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold">
            {selectedCountries.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-600" /> Relais-Filter
            </h3>
            <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-gray-100 rounded text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search — always visible */}
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

          {/* Mode filters — always visible (essential) */}
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
            <div className="grid grid-cols-2 gap-1">
              {FILTER_MODES.map(mode => {
                const isActive = filterModes.includes(mode);
                const color = MODE_COLORS[mode];
                const isFeature = FEATURE_MODES.includes(mode);
                return (
                  <button
                    key={mode}
                    onClick={() => toggleMode(mode)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isActive ? "bg-gray-50" : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    <span
                      className={`w-3 h-3 flex-shrink-0 border-2 border-white shadow ${isFeature ? "rounded-sm" : "rounded-full"}`}
                      style={{ backgroundColor: color }}
                    />
                    <span className={`truncate ${isActive ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {MODE_LABELS[mode]}
                    </span>
                  </button>
                );
              })}
            </div>
            {noneOn && (
              <p className="text-[10px] text-red-600 mt-1.5 font-medium">
                ⚠ Keine Modulation gewählt — keine Relais sichtbar.
              </p>
            )}
          </div>

          {/* Stats — always visible */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{visibleCount} von {repeaterCount} Relais sichtbar</span>
              {!isAllSelected && (
                <span className="text-blue-600 font-medium">{selectedCountries.length} Länder</span>
              )}
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors ${
              showAdvanced ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Erweiterte Optionen
            </span>
            <span className="flex items-center gap-1.5">
              {hasActiveAdvanced && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </span>
          </button>

          {/* Advanced options — collapsible */}
          {showAdvanced && (
            <div className="border-t border-gray-100">
              {/* Country filter */}
              {sortedCountries.length > 1 && (
                <div className="border-b border-gray-100">
                  <button
                    onClick={() => setShowCountryPanel(!showCountryPanel)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-xs hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-1.5 font-bold text-gray-500 uppercase tracking-wide">
                      <Globe className="w-3 h-3" /> Länder
                    </span>
                    <span className="flex items-center gap-1.5">
                      {isAllSelected ? (
                        <span className="text-[10px] text-gray-400">Alle</span>
                      ) : (
                        <span className="text-[10px] text-blue-600 font-medium">{selectedCountries.length} aktiv</span>
                      )}
                      <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showCountryPanel ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {showCountryPanel && (
                    <div className="px-3 pb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-blue-600 font-medium">
                          Überschreibt globalen Filter · Mehrfachauswahl
                        </span>
                        <button
                          onClick={selectAll}
                          className={`text-[10px] ${isAllSelected ? "text-gray-400" : "text-blue-600 hover:underline"}`}
                        >
                          Alle
                        </button>
                      </div>
                      {/* Continent quick-toggle */}
                      <div className="grid grid-cols-3 gap-1 mb-2">
                        {CONTINENTS.map(c => {
                          const contCountries = countriesByContinent[c.id] || [];
                          const repCount = contCountries.reduce((sum, rc) => sum + rc.count, 0);
                          if (repCount === 0) return null;
                          const contCodes = contCountries.map(cc => cc.code);
                          const allContinentSelected = contCodes.every(code => selectedCountries.includes(code));
                          const someContinentSelected = contCodes.some(code => selectedCountries.includes(code));
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleContinent(c.id)}
                              className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors flex items-center justify-center gap-0.5 ${
                                allContinentSelected ? "bg-blue-600 text-white" : someContinentSelected ? "bg-blue-100 text-blue-700" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              {allContinentSelected && <Check className="w-2.5 h-2.5" />}
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                      {/* Country list */}
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {CONTINENTS.map(cont => {
                          const contCountries = countriesByContinent[cont.id];
                          if (!contCountries || contCountries.length === 0) return null;
                          return (
                            <div key={cont.id}>
                              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide px-1 py-0.5 sticky top-0 bg-white">
                                {cont.name}
                              </div>
                              {contCountries.map(c => {
                                const isSelected = selectedCountries.includes(c.code);
                                return (
                                  <button
                                    key={c.code}
                                    onClick={() => toggleCountry(c.code)}
                                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                                      isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                                    }`}
                                  >
                                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                      isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                                    }`}>
                                      {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </span>
                                    <span className="truncate flex-1 text-left">{c.name}</span>
                                    <span className="text-[10px] text-gray-400 flex-shrink-0">{c.count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                        {countriesByContinent.other && countriesByContinent.other.length > 0 && (
                          <div>
                            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide px-1 py-0.5 sticky top-0 bg-white">
                              Andere
                            </div>
                            {countriesByContinent.other.map(c => {
                              const isSelected = selectedCountries.includes(c.code);
                              return (
                                <button
                                  key={c.code}
                                  onClick={() => toggleCountry(c.code)}
                                  className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                                    isSelected ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                                  }`}
                                >
                                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                    isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                                  }`}>
                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                  </span>
                                  <span className="truncate flex-1 text-left">{c.name}</span>
                                  <span className="text-[10px] text-gray-400 flex-shrink-0">{c.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Radius filter */}
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
                  {radiusKm > 0 && (
                    <button
                      onClick={() => onRadiusKmChange(0)}
                      className="text-[10px] text-blue-600 hover:underline mt-1"
                    >
                      Zurücksetzen
                    </button>
                  )}
                </div>
              )}

              {/* Toggle: Coverage */}
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
              </div>

              {/* Toggle: Links */}
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
              </div>

              {/* Toggle: Only linked */}
              <div className="p-3 border-b border-gray-100">
                <button
                  onClick={() => onShowOnlyLinkedChange(!showOnlyLinked)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2 text-gray-700">
                    <Link2 className="w-3.5 h-3.5 text-purple-500" />
                    Nur verlinkte Relais
                  </span>
                  <span className={`relative w-9 h-5 rounded-full transition-colors ${showOnlyLinked ? "bg-purple-500" : "bg-gray-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${showOnlyLinked ? "translate-x-4" : ""}`} />
                  </span>
                </button>
              </div>

              {/* Help link */}
              <div className="p-3">
                <p className="text-[10px] text-gray-400">
                  Geschätzte Abdeckung pro Relais. Exakte RadioMobile-Abdeckung via{" "}
                  <a href="https://www.iz8wnh.it/rpts/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                    iz8wnh.it <ExternalLink className="w-2.5 h-2.5" />
                  </a>.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}