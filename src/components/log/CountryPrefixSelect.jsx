import React, { useState, useMemo } from "react";
import { Globe, AlertTriangle, ChevronDown } from "lucide-react";
import { CEPT_COUNTRIES, HOME_COUNTRY } from "@/lib/ceptCountries";

/**
 * Laender-Praefix-Auswahl fuer CEPT-Betrieb im Ausland.
 * Zeigt Flagge, Landname und Praefix. Toggle zwischen Full/Novice Lizenz.
 * Bei Novice werden nur Novice-akzeptierende Laender angezeigt.
 * Bei Nicht-CEPT-Laendern erscheint eine Warnung.
 */
export default function CountryPrefixSelect({ value, onChange, myCallsign = "", licenseClass = "full", onLicenseClassChange }) {
  const setLicenseClass = onLicenseClassChange || (() => {});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = value ? CEPT_COUNTRIES.find(c => c.code === value) : null;

  // Gefilterte Laender-Liste je nach Lizenz-Klasse und Suche
  const filteredCountries = useMemo(() => {
    let list = CEPT_COUNTRIES;
    if (licenseClass === "novice") {
      list = list.filter(c => c.cept_novice || c.non_cept);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.prefix.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [licenseClass, search]);

  const handleSelect = (country) => {
    onChange(country.code === HOME_COUNTRY.code ? null : country.code);
    setOpen(false);
    setSearch("");
  };

  // Vorschau des kompletten Calls
  const previewCall = useMemo(() => {
    const baseCall = myCallsign || "HB9XYZ";
    if (!selected || selected.code === HOME_COUNTRY.code) return baseCall;
    return selected.prefix + baseCall;
  }, [selected, myCallsign]);

  const isNonCept = selected?.non_cept;
  const isNoviceBlocked = selected && licenseClass === "novice" && !selected.cept_novice && !selected.non_cept;

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
          <Globe className="w-3.5 h-3.5" /> Ich funke aus
        </label>
        {selected && (
          <span className="text-[10px] text-gray-400">
            {selected.code === HOME_COUNTRY.code ? "Heimat (kein Präfix)" : `Präfix: ${selected.prefix}`}
          </span>
        )}
      </div>

      {/* Dropdown-Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {selected ? (
          <>
            <span className="text-lg">{selected.flag}</span>
            <span className="flex-1 text-left">{selected.name}</span>
            {selected.code !== HOME_COUNTRY.code && (
              <span className="font-mono text-xs text-blue-600 font-semibold">{selected.prefix}</span>
            )}
          </>
        ) : (
          <>
            <span className="text-lg">{HOME_COUNTRY.flag}</span>
            <span className="flex-1 text-left">{HOME_COUNTRY.name} (kein Präfix)</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown-Inhalt */}
      {open && (
        <div className="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col">
          {/* Lizenz-Klassen Toggle */}
          <div className="flex gap-1 p-2 border-b border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setLicenseClass("full")}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                licenseClass === "full"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100"
              }`}
            >
              Full License (CEPT T/R 61-01)
            </button>
            <button
              type="button"
              onClick={() => setLicenseClass("novice")}
              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                licenseClass === "novice"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-100"
              }`}
            >
              Novice (ECC/REC 05/06)
            </button>
          </div>

          {/* Suchfeld */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Land suchen..."
            className="w-full px-3 py-2 text-sm border-b border-gray-100 dark:border-slate-700 bg-transparent focus:outline-none"
            autoFocus
          />

          {/* Laender-Liste */}
          <div className="overflow-y-auto flex-1">
            {/* Heimatland immer zuerst */}
            <button
              type="button"
              onClick={() => handleSelect(HOME_COUNTRY)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-800 text-left ${
                !selected ? "bg-blue-50 dark:bg-slate-800" : ""
              }`}
            >
              <span className="text-lg">{HOME_COUNTRY.flag}</span>
              <span className="flex-1">{HOME_COUNTRY.name}</span>
              <span className="text-[10px] text-gray-400">Heimat</span>
            </button>

            {filteredCountries
              .filter(c => !c.is_home)
              .map(country => {
                const isBlocked = licenseClass === "novice" && !country.cept_novice && !country.non_cept;
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => !isBlocked && handleSelect(country)}
                    disabled={isBlocked}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${
                      isBlocked
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-blue-50 dark:hover:bg-slate-800"
                    } ${selected?.code === country.code ? "bg-blue-50 dark:bg-slate-800" : ""}`}
                  >
                    <span className="text-lg">{country.flag}</span>
                    <span className="flex-1">{country.name}</span>
                    {country.cept_full && !country.non_cept && (
                      <span className="text-[9px] text-green-600 font-medium">CEPT</span>
                    )}
                    {country.cept_novice && licenseClass === "novice" && (
                      <span className="text-[9px] text-amber-600 font-medium">Nov</span>
                    )}
                    {country.non_cept && (
                      <span className="text-[9px] text-red-600 font-medium">Gast</span>
                    )}
                    {isBlocked && (
                      <span className="text-[9px] text-red-500">✗</span>
                    )}
                    <span className="font-mono text-xs text-blue-600 font-semibold">{country.prefix}</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Vorschau und Warnungen */}
      {selected && selected.code !== HOME_COUNTRY.code && (
        <div className="space-y-1">
          {/* Call-Vorschau */}
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Call-Vorschau: </span>
            <span className="font-mono font-bold text-gray-900 dark:text-slate-100">{previewCall}</span>
            <span className="text-[10px] text-gray-500 ml-1">
              ({licenseClass === "full" ? "Full License" : "Novice"}, {selected.name})
            </span>
          </div>

          {/* Warnung bei Nicht-CEPT */}
          {isNonCept && (
            <div className="flex items-start gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Gastlizenz erforderlich!</strong> {selected.notes || "Für Nicht-CEPT-Länder muss eine Gastlizenz beantragt werden."} Siehe Hilfe → "Im Ausland funken".
              </span>
            </div>
          )}

          {/* Warnung bei Novice-blockiert */}
          {isNoviceBlocked && (
            <div className="flex items-start gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-xs text-red-800 dark:text-red-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Novice nicht akzeptiert in {selected.name}.</strong> Wechseln Sie auf Full License für dieses Land.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}