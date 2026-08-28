import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Radio, MapPin, Crosshair, Settings as SettingsIcon, HardDrive } from "lucide-react";
import { safeGetItem, safeSetItem } from "@/lib/safeStorage";
import MobileSelect from "@/components/ui/MobileSelect";

// Fix 12: Setup-Wizard für erste Einrichtung.
// 8 Schritte: Willkommen, Station, Club, QRZ, GPS, Hunting-Filter, App-Settings, Fertig.
// Erscheint beim ersten Login (kein hb9om_wizard_completed in localStorage).
// In Hilfe erneut startbar.

const SUFFIXES = [
  { value: "", label: "—" },
  { value: "/P", label: "/P (portabel)" },
  { value: "/M", label: "/M (mobil)" },
  { value: "/MM", label: "/MM (maritim)" },
];

const TOTAL_STEPS = 8;

export default function SetupWizard({ onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    callsign: "",
    suffix: "",
    licenseClass: "full",
    locator: "",
    useClub: false,
    clubCallsign: "",
    clubSuffix: "",
    useQrz: false,
    qrzUsername: "",
    qrzPassword: "",
    useGps: true,
    activities: ["SOTA", "POTA", "WWFF", "WWBOTA"],
    wakeLock: true,
    monthlyBackup: false,
  });

  useEffect(() => {
    setData(prev => ({
      ...prev,
      callsign: (safeGetItem("hb9om_my_callsign") || "").toUpperCase(),
      suffix: safeGetItem("hb9om_my_suffix") || "",
      licenseClass: safeGetItem("hb9om_my_license_class") || "full",
      locator: safeGetItem("hb9om_station_locator") || "",
      clubCallsign: (safeGetItem("hb9om_club_callsign") || "").toUpperCase(),
    }));
  }, []);

  const handleFinish = () => {
    safeSetItem("hb9om_my_callsign", data.callsign.toUpperCase().trim());
    safeSetItem("hb9om_my_suffix", data.suffix);
    safeSetItem("hb9om_my_license_class", data.licenseClass);
    if (data.locator) safeSetItem("hb9om_station_locator", data.locator.toUpperCase());
    if (data.useClub) safeSetItem("hb9om_club_callsign", data.clubCallsign.toUpperCase().trim());
    safeSetItem("hb9om_wizard_completed", "true");
    safeSetItem("hb9om_setup_complete", "true");
    if (onClose) onClose();
    else navigate("/");
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!data.callsign.trim();
      case 2: return !data.useClub || !!data.clubCallsign.trim();
      case 3: return !data.useQrz || (!!data.qrzUsername.trim() && !!data.qrzPassword.trim());
      default: return true;
    }
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="fixed inset-0 z-[10002] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-t-2xl overflow-hidden">
          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="px-6 py-3 text-center text-xs text-gray-500 dark:text-slate-400">
          Schritt {step + 1} von {TOTAL_STEPS}
        </div>

        <div className="px-6 pb-6 space-y-4">
          {step === 0 && (
            <div className="text-center space-y-3 pt-4">
              <Radio className="w-12 h-12 text-blue-600 mx-auto" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Willkommen!</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                Willkommen bei HB9OM On Field! Dieser Wizard hilft dir, die App in wenigen Schritten einzurichten.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Meine Station</h2>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Rufzeichen</label>
                <input type="text" value={data.callsign} onChange={e => setData({ ...data, callsign: e.target.value.toUpperCase() })} placeholder="z.B. HB9ABC" className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg font-mono uppercase bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Suffix</label>
                <MobileSelect value={data.suffix} onValueChange={v => setData({ ...data, suffix: v })} triggerClassName="w-full mt-1" options={SUFFIXES} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Lizenzklasse</label>
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setData({ ...data, licenseClass: "full" })} className={`flex-1 px-3 py-2 text-xs rounded-lg ${data.licenseClass === "full" ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"}`}>Full</button>
                  <button onClick={() => setData({ ...data, licenseClass: "novice" })} className={`flex-1 px-3 py-2 text-xs rounded-lg ${data.licenseClass === "novice" ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"}`}>Novice</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">QTH-Locator</label>
                <input type="text" value={data.locator} onChange={e => setData({ ...data, locator: e.target.value.toUpperCase() })} placeholder="z.B. JN47" className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg font-mono uppercase bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Clubrufzeichen (optional)</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">Nutzt du ein Clubrufzeichen?</p>
              <div className="flex gap-2">
                <button onClick={() => setData({ ...data, useClub: true })} className={`flex-1 px-4 py-2 text-sm rounded-lg ${data.useClub ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"}`}>Ja</button>
                <button onClick={() => setData({ ...data, useClub: false })} className={`flex-1 px-4 py-2 text-sm rounded-lg ${!data.useClub ? "bg-gray-300 text-gray-700" : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"}`}>Nein</button>
              </div>
              {data.useClub && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Clubrufzeichen</label>
                    <input type="text" value={data.clubCallsign} onChange={e => setData({ ...data, clubCallsign: e.target.value.toUpperCase() })} placeholder="z.B. HB9OM" className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg font-mono uppercase bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Club-Suffix</label>
                    <MobileSelect value={data.clubSuffix} onValueChange={v => setData({ ...data, clubSuffix: v })} triggerClassName="w-full mt-1" options={SUFFIXES} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">QRZ (optional)</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">Möchtest du QRZ-Abfragen nutzen?</p>
              <div className="flex gap-2">
                <button onClick={() => setData({ ...data, useQrz: true })} className={`flex-1 px-4 py-2 text-sm rounded-lg ${data.useQrz ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"}`}>Ja</button>
                <button onClick={() => setData({ ...data, useQrz: false })} className={`flex-1 px-4 py-2 text-sm rounded-lg ${!data.useQrz ? "bg-gray-300 text-gray-700" : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"}`}>Nein</button>
              </div>
              {data.useQrz && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">QRZ-Username</label>
                    <input type="text" value={data.qrzUsername} onChange={e => setData({ ...data, qrzUsername: e.target.value })} placeholder="QRZ.com Benutzername" className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">QRZ-Password</label>
                    <input type="password" value={data.qrzPassword} onChange={e => setData({ ...data, qrzPassword: e.target.value })} placeholder="QRZ.com Passwort" className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">GPS</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">Darf die App deinen GPS-Standort verwenden?</p>
              <div className="flex gap-2">
                <button onClick={() => setData({ ...data, useGps: true })} className={`flex-1 px-4 py-2 text-sm rounded-lg ${data.useGps ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"}`}>Ja</button>
                <button onClick={() => setData({ ...data, useGps: false })} className={`flex-1 px-4 py-2 text-sm rounded-lg ${!data.useGps ? "bg-gray-300 text-gray-700" : "bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-300"}`}>Nein</button>
              </div>
              {!data.useGps && (
                <p className="text-xs text-amber-600">Distanzberechnung nicht verfügbar — wird vom Stations-Locator abgeschätzt.</p>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Hunting-Filter</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">Welche Aktivitäten interessieren dich?</p>
              <div className="grid grid-cols-2 gap-2">
                {["SOTA", "POTA", "WWFF", "WWBOTA", "WCA", "IOTA"].map(act => (
                  <label key={act} className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
                    <input type="checkbox" checked={data.activities.includes(act)} onChange={e => {
                      const next = e.target.checked ? [...data.activities, act] : data.activities.filter(a => a !== act);
                      setData({ ...data, activities: next });
                    }} className="w-4 h-4" />
                    {act}
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">App-Einstellungen</h2>
              <label className="flex items-center justify-between text-sm text-gray-700 dark:text-slate-300">
                <span>Bildschirm aktiv halten (Wake Lock)</span>
                <button onClick={() => setData({ ...data, wakeLock: !data.wakeLock })} className={`relative w-12 h-6 rounded-full ${data.wakeLock ? "bg-blue-600" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${data.wakeLock ? "translate-x-6" : ""}`} />
                </button>
              </label>
              <label className="flex items-center justify-between text-sm text-gray-700 dark:text-slate-300">
                <span>Monatliches Backup einrichten</span>
                <button onClick={() => setData({ ...data, monthlyBackup: !data.monthlyBackup })} className={`relative w-12 h-6 rounded-full ${data.monthlyBackup ? "bg-blue-600" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${data.monthlyBackup ? "translate-x-6" : ""}`} />
                </button>
              </label>
            </div>
          )}

          {step === 7 && (
            <div className="text-center space-y-3 pt-4">
              <Check className="w-12 h-12 text-green-600 mx-auto" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Einrichtung abgeschlossen!</h2>
              <p className="text-sm text-gray-600 dark:text-slate-300">Die App ist bereit.</p>
              <div className="text-left bg-gray-50 dark:bg-slate-900 rounded-lg p-3 text-xs space-y-1 text-gray-600 dark:text-slate-400">
                <div>Rufzeichen: <strong className="text-gray-900 dark:text-slate-100">{data.callsign || "—"}</strong></div>
                <div>Lizenz: <strong className="text-gray-900 dark:text-slate-100">{data.licenseClass === "full" ? "Full" : "Novice"}</strong></div>
                <div>Club: <strong className="text-gray-900 dark:text-slate-100">{data.useClub ? data.clubCallsign : "Nein"}</strong></div>
                <div>QRZ: <strong className="text-gray-900 dark:text-slate-100">{data.useQrz ? "Ja" : "Nein"}</strong></div>
                <div>GPS: <strong className="text-gray-900 dark:text-slate-100">{data.useGps ? "Ja" : "Nein"}</strong></div>
                <div>Aktivitäten: <strong className="text-gray-900 dark:text-slate-100">{data.activities.join(", ")}</strong></div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 rounded-lg flex items-center gap-1.5">
                <ChevronLeft className="w-4 h-4" /> Zurück
              </button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
                Weiter <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleFinish} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> Fertig → zur App
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}