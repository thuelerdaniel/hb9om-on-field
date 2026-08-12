import React, { useState, useMemo } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { CONTINENTS } from "@/lib/continents";
import { COUNTRIES, getCountriesByContinent } from "@/lib/countries";

// Reusable country/continent multi-select filter — embedded in layer filter panels.
// Used by RepeaterFilter, TotaFilter, AprsFilter, BrandMeisterFilter to provide
// consistent continent quick-toggle + country multi-select across all layers.
//
// Props:
// - countries: array of { code, name, count } from the layer's data
// - selectedCountries: array of ISO2 codes (empty = all)
// - onCountriesChange: callback(newArray)
// - accentColor: tailwind color name for UI accents (e.g. "blue", "purple", "teal", "orange")
export default function CountryContinentFilter({
  countries,
  selectedCountries,
  onCountriesChange,
  accentColor = "blue",
}) {
  const [showPanel, setShowPanel] = useState(false);

  const selected = Array.isArray(selectedCountries) ? selectedCountries : [];
  const isAllSelected = selected.length === 0;

  const toggleCountry = (code) => {
    if (selected.includes(code)) {
      onCountriesChange(selected.filter(c => c !== code));
    } else {
      onCountriesChange([...selected, code]);
    }
  };

  const toggleContinent = (continentId) => {
    const contCountries = getCountriesByContinent(continentId);
    const contCodes = contCountries.map(c => c.iso2);
    const allContinentSelected = contCodes.every(c => selected.includes(c));
    if (allContinentSelected) {
      onCountriesChange(selected.filter(c => !contCodes.includes(c)));
    } else {
      const newSet = new Set([...selected, ...contCodes]);
      onCountriesChange([...newSet]);
    }
  };

  const selectAll = () => onCountriesChange([]);

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

  if (!countries || countries.length <= 1) return null;

  const accentClasses = {
    blue: "bg-blue-600 text-white bg-blue-100 text-blue-700 text-blue-600 border-blue-400",
    purple: "bg-purple-600 text-white bg-purple-100 text-purple-700 text-purple-600 border-purple-400",
    teal: "bg-teal-600 text-white bg-teal-100 text-teal-700 text-teal-600 border-teal-400",
    orange: "bg-orange-600 text-white bg-orange-100 text-orange-700 text-orange-600 border-orange-400",
  };
  const [activeBg, activeText, hoverBg, accentText, borderClass] = (accentClasses[accentColor] || accentClasses.blue).split(" ");

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs hover:bg-gray-50"
      >
        <span className="flex items-center gap-1.5 font-bold text-gray-500 uppercase tracking-wide">
          <Globe className="w-3 h-3" /> Länder
        </span>
        <span className="flex items-center gap-1.5">
          {isAllSelected ? (
            <span className="text-[10px] text-gray-400">Alle</span>
          ) : (
            <span className={`text-[10px] ${accentText} font-medium`}>{selected.length} aktiv</span>
          )}
          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${showPanel ? "rotate-180" : ""}`} />
        </span>
      </button>
      {showPanel && (
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-blue-600 font-medium">
              Überschreibt globalen Filter · Mehrfachauswahl
            </span>
            <button
              onClick={selectAll}
              className={`text-[10px] ${isAllSelected ? "text-gray-400" : `${accentText} hover:underline`}`}
            >
              Alle
            </button>
          </div>
          {/* Continent quick-toggle */}
          <div className="grid grid-cols-3 gap-1 mb-2">
            {CONTINENTS.map(c => {
              const contCountries = getCountriesByContinent(c.id);
              const repCount = sortedCountries.filter(rc => contCountries.some(cc => cc.iso2 === rc.code)).reduce((sum, rc) => sum + rc.count, 0);
              if (repCount === 0) return null;
              const contCodes = contCountries.map(cc => cc.iso2);
              const allContinentSelected = contCodes.every(code => selected.includes(code));
              const someContinentSelected = contCodes.some(code => selected.includes(code));
              return (
                <button
                  key={c.id}
                  onClick={() => toggleContinent(c.id)}
                  className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors flex items-center justify-center gap-0.5 ${
                    allContinentSelected ? `${activeBg} ${activeText}` : someContinentSelected ? `${hoverBg} ${accentText}` : "bg-gray-50 text-gray-600 hover:bg-gray-100"
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
                    const isSelected = selected.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        onClick={() => toggleCountry(c.code)}
                        className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                          isSelected ? `${hoverBg} ${accentText} font-medium` : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected ? `${activeBg} border-${accentColor}-600` : "border-gray-300"
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
                  const isSelected = selected.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      onClick={() => toggleCountry(c.code)}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                        isSelected ? `${hoverBg} ${accentText} font-medium` : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? `${activeBg} border-${accentColor}-600` : "border-gray-300"
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
  );
}