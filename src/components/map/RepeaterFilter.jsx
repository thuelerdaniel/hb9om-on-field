import React, { useState, useMemo } from "react";
import { Radio, Search, Link2, ChevronDown, X, Globe, MapPin, Signal, ExternalLink, Check } from "lucide-react";
import { MODE_COLORS, MODE_LABELS, FILTER_MODES, FEATURE_MODES } from "@/lib/repeaterModes";
import { CONTINENTS } from "@/lib/continents";
import { COUNTRIES, getCountriesByContinent } from "@/lib/countries";

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

  const toggleMode = (mode) => {
    if (filterModes.includes(mode)) {
      onFilterModesChange(filterModes.filter(m => m !== mode));
    } else {
      onFilterModesChange([...filterModes, mode]);
    }
  };

  const allOn = filterModes.length === FILTER_MODES.length;
  const noneOn = filterModes.length === 0;

  // filterCountries is an array of ISO2 codes. Empty = all (no filter).
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
    const contCountries = getCountriesByContinent(continentId);
    const contCodes = contCountries.map(c => c.iso2);
    const allContinentSelected = contCodes.every(c => selectedCountries.includes(c));
    if (allContinentSelected) {
      // Remove all countries of this continent
      onFilterCountriesChange(selectedCountries.filter(c => !contCodes.includes(c)));
    } else {
      // Add all countries of this continent
      const newSet = new Set([...selectedCountries, ...contCodes]);
      onFilterCountriesChange([...newSet]);
    }
  };

  const selectAll = () => onFilterCountriesChange([]);
  const clearAll = () => onFilterCountriesChange([]);

  const sortedCountries = useMemo(() => {
    return [...(countries || [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [countries]);

  // Group countries by continent for display
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

  return (
    <div className={`absolute top-3 ${leftOffsetClass} z-[1005]`}>
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

          {/* Country multi-select filter */}
          {sortedCountries.length > 1 && (
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Länder (Mehrfachauswahl)
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className={`text-[10px] ${isAllSelected ? "text-gray-400" : "text-blue-600 hover:underline"}`}
                  >
                    Alle
                  </button>
                  {!isAllSelected && (
                    <button
                      onClick={clearAll}
                      className="text-[10px] text-red-500 hover:underline"
                    >
                      Leeren
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-blue-600 mb-1.5 font-medium">
                ℹ Überschreibt den globalen Länder-Filter. Mehrere Länder wählbar.
              </p>
              {/* Continent quick-toggle buttons */}
              <div className="grid grid-cols-3 gap-1 mb-2">
                {CONTINENTS.map(c => {
                  const contCountries = getCountriesByContinent(c.id);
                  const repCount = sortedCountries.filter(rc => contCountries.some(cc => cc.iso2 === rc.code)).reduce((sum, rc) => sum + rc.count, 0);
                  if (repCount === 0) return null;
                  const contCodes = contCountries.map(cc => cc.iso2);
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
              {/* Country list with checkboxes — grouped by continent */}
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
                {/* Countries not in any continent (e.g. unknown) */}
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
                const isFeature = FEATURE_MODES.includes(mode);
                return (
                  <button
                    key={mode}
                    onClick={() => toggleMode(mode)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isActive ? "bg-gray-50" : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    <span
                      className={`w-3 h-3 flex-shrink-0 border-2 border-white shadow ${isFeature ? "rounded-sm" : "rounded-full"}`}
                      style={{ backgroundColor: color }}
                    />
                    <span className={`flex-1 text-left ${isActive ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {MODE_LABELS[mode]}
                      {isFeature && <span className="text-[9px] text-gray-400 ml-1">(Feature)</span>}
                    </span>
                    {isActive && <span className="text-[10px] text-gray-400">✓</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
              ⚠ Mindestens eine Modulationsart muss aktiv sein, sonst werden keine Relais angezeigt.
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              EchoLink ist ein Feature-Filter: zeigt alle Relais mit EchoLink-Zugang unabhängig vom Hauptmodus.
            </p>
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
              Geschätzte Reichweite pro Relais. Für exakte RadioMobile-Abdeckung siehe{" "}
              <a href="https://www.iz8wnh.it/rpts/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                iz8wnh.it <ExternalLink className="w-2.5 h-2.5" />
              </a>.
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
              Permanente Verlinkungen: echte Crosslinks aus RepeaterBook + admin-bestätigte Verlinkungen.
            </p>
          </div>

          {/* Only linked repeaters toggle */}
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
            <p className="text-[10px] text-gray-400 mt-1 ml-2">
              Blendet alle unverlinkten Relais aus.
            </p>
          </div>

          {/* Stats */}
          <div className="p-3">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{visibleCount} von {repeaterCount} Relais sichtbar</span>
              {noneOn && <span className="text-red-600 font-medium">Keine Modulation gewählt</span>}
            </div>
            {!isAllSelected && (
              <div className="text-[10px] text-blue-600 mt-1">
                {selectedCountries.length} Länder ausgewählt
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}