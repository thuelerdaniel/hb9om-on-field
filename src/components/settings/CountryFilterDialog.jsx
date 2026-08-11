import React, { useState, useMemo } from "react";
import { X, Globe, Loader2, Download, CheckCheck, Square, AlertCircle } from "lucide-react";
import { getCountriesByContinent } from "@/lib/countries";
import { useToast } from "@/components/ui/use-toast";
import {
  cacheTypeFromServerByCountries, cacheRepeatersFromServerByCountries,
  cachePrivateNodesFromServerByCountries, cacheTotaFromServerByCountries,
  getCountryCountsForType, getOfflineCountryFilter
} from "@/lib/offlineDataCache";

const CONTINENT_LABELS = {
  eu: "Europa",
  na: "Nordamerika",
  sa: "Südamerika",
  as: "Asien",
  af: "Afrika",
  oc: "Ozeanien",
};

const CONTINENT_ORDER = ["eu", "na", "sa", "as", "af", "oc"];
const DEFAULT_COUNTRIES = ["CH", "DE", "AT", "FR", "IT", "LI"];

export default function CountryFilterDialog({ type, typeLabel, onClose, onDownloaded }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState(() => getOfflineCountryFilter(type) || DEFAULT_COUNTRIES);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const countryCounts = useMemo(() => getCountryCountsForType(type), [type]);

  const handleToggle = (iso2) => {
    setError(null);
    setSelected(prev => prev.includes(iso2) ? prev.filter(c => c !== iso2) : [...prev, iso2]);
  };

  const handleSelectAll = (continentCountries) => {
    const allSelected = continentCountries.every(c => selected.includes(c.iso2));
    if (allSelected) {
      setSelected(prev => prev.filter(c => !continentCountries.some(co => co.iso2 === c)));
    } else {
      setSelected(prev => [...new Set([...prev, ...continentCountries.map(c => c.iso2)])]);
    }
  };

  const handleDownload = async () => {
    if (selected.length === 0) return;
    setError(null);
    setDownloading(true);
    try {
      let result;
      if (type === "repeater") result = await cacheRepeatersFromServerByCountries(selected);
      else if (type === "private_nodes") result = await cachePrivateNodesFromServerByCountries(selected);
      else if (type === "tota") result = await cacheTotaFromServerByCountries(selected);
      else result = await cacheTypeFromServerByCountries(type, selected);

      if (result.success) {
        const total = result.allTotal || result.total;
        let desc = `${typeLabel}: ${result.count.toLocaleString("de-CH")} von ${total.toLocaleString("de-CH")} für ${selected.length} Länder gespeichert`;
        if (result.truncated) desc += " (Speicherlimit)";
        toast({
          title: result.truncated ? "Teilweise geladen" : "Geladen",
          description: desc,
          duration: 5000,
        });
        onDownloaded();
        onClose();
      } else {
        setError(result.error || "Laden fehlgeschlagen");
      }
    } catch (e) {
      setError(e.message || "Laden fehlgeschlagen");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" /> {typeLabel} – nach Ländern
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Info */}
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-[11px] text-blue-700">
            Wählen Sie Länder für den Offline-Download. Andere Länder bleiben nur online verfügbar.
          </p>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700">Keine Daten gefunden</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Country list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {CONTINENT_ORDER.map(cont => {
            const countries = getCountriesByContinent(cont);
            if (countries.length === 0) return null;
            const allSelected = countries.every(c => selected.includes(c.iso2));
            const someSelected = countries.some(c => selected.includes(c.iso2));
            const continentCount = countries.reduce((sum, c) => sum + (countryCounts[c.iso2] || 0), 0);

            return (
              <div key={cont}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    {CONTINENT_LABELS[cont]}
                    {continentCount > 0 && <span className="ml-1 text-gray-300">{continentCount.toLocaleString("de-CH")}</span>}
                  </p>
                  <button
                    onClick={() => handleSelectAll(countries)}
                    className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                  >
                    {allSelected ? <Square className="w-3 h-3" /> : <CheckCheck className="w-3 h-3" />}
                    {allSelected ? "Keine" : "Alle"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {countries.map(c => {
                    const checked = selected.includes(c.iso2);
                    const count = countryCounts[c.iso2];
                    return (
                      <label
                        key={c.iso2}
                        className={`flex items-center gap-1.5 p-1.5 rounded cursor-pointer text-xs transition-colors ${checked ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50 text-gray-700'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggle(c.iso2)}
                          className="w-3.5 h-3.5 accent-blue-500 flex-shrink-0"
                        />
                        <span className="flex-1 truncate">{c.name}</span>
                        {count != null && count > 0 && (
                          <span className={`text-[10px] flex-shrink-0 ${checked ? 'text-blue-400' : 'text-gray-400'}`}>
                            {count.toLocaleString("de-CH")}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">
            {selected.length} Länder ausgewählt
          </span>
          <button
            onClick={handleDownload}
            disabled={downloading || selected.length === 0}
            className="px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1.5"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {downloading ? "Lädt…" : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}