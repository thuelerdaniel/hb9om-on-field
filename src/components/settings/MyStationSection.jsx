import React, { useState, useEffect } from "react";
import { Radio, Check, AlertTriangle, Info, ChevronDown, Building } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CEPT_COUNTRIES, HOME_COUNTRY } from "@/lib/ceptCountries";
import { safeSetItem, safeGetItem } from "@/lib/safeStorage";
import MobileSelect from "@/components/ui/MobileSelect";

const SUFFIXES = [
  { value: "", label: "—" },
  { value: "/P", label: "/P (portabel)" },
  { value: "/M", label: "/M (mobil)" },
  { value: "/MM", label: "/MM (maritim mobil)" },
  { value: "/AM", label: "/AM (aeronautical)" },
  { value: "/QRP", label: "/QRP (low power)" },
  { value: "/A", label: "/A (alternativ)" },
];

/**
 * "MEINE STATION / LIZENZ" — ganz oben in den Einstellungen.
 * Speichert Lizenzklasse, Gastland und Suffix in AppSetting + localStorage.
 * Das Log-Formular liest diese Werte aus localStorage (funktioniert auch offline).
 */
export default function MyStationSection() {
  const [myCallsign, setMyCallsign] = useState("");
  const [licenseClass, setLicenseClass] = useState("full");
  const [countryCode, setCountryCode] = useState("");
  const [suffix, setSuffix] = useState("/P");
  const [clubCallsign, setClubCallsign] = useState("");
  const [clubOperatorName, setClubOperatorName] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMyCallsign((safeGetItem("hb9om_my_callsign") || "").toUpperCase());
    setLicenseClass(safeGetItem("hb9om_my_license_class") || "full");
    setCountryCode(safeGetItem("hb9om_my_operating_country") || "");
    setSuffix(safeGetItem("hb9om_my_suffix") || "/P");
    setClubCallsign((safeGetItem("hb9om_club_callsign") || "").toUpperCase());
    setClubOperatorName(safeGetItem("hb9om_club_operator_name") || "");
    // Club-Call aus Backend laden (admin-set global default)
    base44.functions.invoke("manageApiKeys", { action: "getClubCallsign" })
      .then(res => {
        const cc = res.data?.config?.club_callsign;
        if (cc) {
          safeSetItem("hb9om_club_callsign", cc);
          setClubCallsign(prev => prev || cc.toUpperCase());
        }
      })
      .catch(() => {});
  }, []);

  const saveSetting = async (key, value) => {
    safeSetItem(key, value);
    try {
      const existing = await base44.entities.AppSetting.filter({ key });
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, { value, enabled: true });
      } else {
        await base44.entities.AppSetting.create({ key, value, enabled: true });
      }
    } catch {}
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleLicenseChange = (val) => {
    setLicenseClass(val);
    saveSetting("hb9om_my_license_class", val);
    // Bei Novice: prüfen ob aktuelles Land Novice akzeptiert
    if (val === "novice" && countryCode) {
      const c = CEPT_COUNTRIES.find(c => c.code === countryCode);
      if (c && !c.cept_novice && !c.non_cept) {
        setCountryCode("");
        saveSetting("hb9om_my_operating_country", "");
      }
    }
    showSaved();
  };

  const handleCountrySelect = (country) => {
    const code = country.code === HOME_COUNTRY.code ? "" : country.code;
    setCountryCode(code);
    saveSetting("hb9om_my_operating_country", code);
    setCountryOpen(false);
    setCountrySearch("");
    showSaved();
  };

  const handleSuffixChange = (val) => {
    setSuffix(val);
    saveSetting("hb9om_my_suffix", val);
    showSaved();
  };

  const handleClubCallsignChange = (val) => {
    const upper = val.toUpperCase().trim();
    setClubCallsign(upper);
    saveSetting("hb9om_club_callsign", upper);
    showSaved();
  };

  const handleClubOperatorNameChange = (val) => {
    setClubOperatorName(val);
    saveSetting("hb9om_club_operator_name", val);
    showSaved();
  };

  const selected = countryCode ? CEPT_COUNTRIES.find(c => c.code === countryCode) : null;
  const prefix = selected && selected.code !== HOME_COUNTRY.code ? selected.prefix : "";
  const previewCall = `${prefix}${myCallsign || "HB9XYZ"}${suffix || ""}`;
  const clubPreviewCall = clubCallsign ? `${prefix}${clubCallsign}${suffix || ""}` : "";
  const isNonCept = selected?.non_cept;
  const isNoviceBlocked = selected && licenseClass === "novice" && !selected.cept_novice && !selected.non_cept;

  const filteredCountries = (() => {
    let list = CEPT_COUNTRIES;
    if (licenseClass === "novice") {
      list = list.filter(c => c.cept_novice || c.non_cept);
    }
    if (countrySearch) {
      const q = countrySearch.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.prefix.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  return (
    <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border-2 border-blue-200 dark:border-blue-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <Radio className="w-4 h-4 text-blue-500" /> Meine Station / Lizenz
        </h2>
        {saved && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Gespeichert
          </span>
        )}
      </div>

      {/* Rufzeichen (read-only) */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mein Rufzeichen</label>
        <p className="mt-1 text-2xl font-bold font-mono text-gray-900 dark:text-slate-100">
          {myCallsign || <span className="text-gray-300 dark:text-slate-600 text-base font-normal">Nicht gesetzt</span>}
        </p>
      </div>

      {/* Lizenz-Klasse Toggle */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lizenz-Klasse</label>
        <div className="flex gap-1 mt-1.5">
          <button
            type="button"
            onClick={() => handleLicenseChange("full")}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              licenseClass === "full"
                ? "bg-blue-600 text-white"
                : "bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
            }`}
          >
            Full License (CEPT T/R 61-01)
          </button>
          <button
            type="button"
            onClick={() => handleLicenseChange("novice")}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              licenseClass === "novice"
                ? "bg-amber-500 text-white"
                : "bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
            }`}
          >
            Novice (ECC/REC 05/06)
          </button>
        </div>
        {licenseClass === "novice" && (
          <p className="text-[10px] text-amber-600 mt-1">Eingeschränkte Privilegien in einigen Ländern</p>
        )}
      </div>

      {/* Ich funke aus — Länder-Auswahl mit Flagge */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ich funke aus</label>
        <button
          type="button"
          onClick={() => setCountryOpen(!countryOpen)}
          className="w-full mt-1.5 flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
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
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${countryOpen ? "rotate-180" : ""}`} />
        </button>

        {countryOpen && (
          <div className="mt-1 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col z-10">
            <input
              type="text"
              value={countrySearch}
              onChange={e => setCountrySearch(e.target.value)}
              placeholder="Land suchen..."
              className="w-full px-3 py-2 text-sm border-b border-gray-100 dark:border-slate-700 bg-transparent focus:outline-none"
              autoFocus
            />
            <div className="overflow-y-auto flex-1">
              <button
                type="button"
                onClick={() => handleCountrySelect(HOME_COUNTRY)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-800 text-left ${!selected ? "bg-blue-50 dark:bg-slate-800" : ""}`}
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
                      onClick={() => !isBlocked && handleCountrySelect(country)}
                      disabled={isBlocked}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left ${isBlocked ? "opacity-40 cursor-not-allowed" : "hover:bg-blue-50 dark:hover:bg-slate-800"} ${selected?.code === country.code ? "bg-blue-50 dark:bg-slate-800" : ""}`}
                    >
                      <span className="text-lg">{country.flag}</span>
                      <span className="flex-1">{country.name}</span>
                      {country.cept_full && !country.non_cept && <span className="text-[9px] text-green-600 font-medium">CEPT</span>}
                      {country.non_cept && <span className="text-[9px] text-red-600 font-medium">Gast</span>}
                      {isBlocked && <span className="text-[9px] text-red-500">✗</span>}
                      <span className="font-mono text-xs text-blue-600 font-semibold">{country.prefix}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Warnungen */}
        {selected && selected.code !== HOME_COUNTRY.code && isNonCept && (
          <div className="flex items-start gap-1.5 mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span><strong>Gastlizenz erforderlich!</strong> {selected.notes || "Siehe Hilfe → Im Ausland funken"}</span>
          </div>
        )}
        {isNoviceBlocked && (
          <div className="flex items-start gap-1.5 mt-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg text-xs text-red-800 dark:text-red-200">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span><strong>Novice nicht akzeptiert in {selected.name}.</strong> Auf Full License wechseln.</span>
          </div>
        )}
      </div>

      {/* Suffix */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Suffix (Betriebsart)</label>
        <MobileSelect
          value={suffix}
          onValueChange={handleSuffixChange}
          triggerClassName="w-full mt-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
          options={SUFFIXES.map(s => ({ value: s.value, label: s.label }))}
        />
      </div>

      {/* Präfix-Vorschau */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
        <label className="text-[10px] text-gray-500 uppercase font-semibold">Vollständiger Call</label>
        <p className="text-lg font-mono font-bold text-gray-900 dark:text-slate-100">{previewCall}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {licenseClass === "full" ? "Full License" : "Novice"} · {selected ? selected.name : HOME_COUNTRY.name}{suffix ? ` · ${suffix}` : ""}
        </p>
      </div>

      {/* Club-Call Sektion — Präfix/Land geteilt mit Personal-Call */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
        <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5 text-blue-500" /> Club-Call (optional)
        </h3>

        <div className="space-y-2">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Club-Rufzeichen</label>
            <input
              type="text"
              value={clubCallsign}
              onChange={e => handleClubCallsignChange(e.target.value)}
              placeholder="z.B. HB9OM"
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Club-Operator-Name (wer funkt)</label>
            <input
              type="text"
              value={clubOperatorName}
              onChange={e => handleClubOperatorNameChange(e.target.value)}
              placeholder="z.B. Daniel"
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {clubCallsign ? (
          <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <label className="text-[10px] text-gray-500 uppercase font-semibold">Club-Call Vorschau</label>
            <p className="text-base font-mono font-bold text-gray-900 dark:text-slate-100">{clubPreviewCall}</p>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
              <Info className="w-3 h-3" /> Präfix und Land gelten für beide Calls (Personal + Club)
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-gray-400 mt-2">Kein Club-Call konfiguriert — wird im Log-Formular ausgeblendet.</p>
        )}
      </div>

      {/* Gesamtvorschau */}
      <div className="mt-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-500">Personal:</span>
          <span className="font-mono font-bold text-gray-900 dark:text-slate-100">{previewCall}</span>
        </div>
        {clubPreviewCall && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Club:</span>
            <span className="font-mono font-bold text-gray-900 dark:text-slate-100">{clubPreviewCall}</span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 leading-relaxed flex items-start gap-1">
        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <span>Präfix und Land gelten für beide Calls (Personal + Club). Beim Auslandsbetrieb: Land hier ändern. CEPT-Regeln: max 3 Monate pro Gastland.</span>
      </p>
    </section>
  );
}