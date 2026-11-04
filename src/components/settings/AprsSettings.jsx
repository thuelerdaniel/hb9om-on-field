import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Wifi, Loader2, Check, Trash2, KeyRound, AlertCircle, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import PasswordInput from "@/components/settings/PasswordInput";

// APRS-Einstellungen pro Nutzer (Einstellungen → APRS).
// API-Key liegt in der User-Entity (aprs_fi_api_key), die Karten-Voreinstellungen
// (Radius, Zentrum, mobile Stationen) ebenfalls — sie werden auf der Karte angewendet.

const RADIUS_OPTIONS = [50, 100, 200, 500];

export default function AprsSettings() {
  const [apiKey, setApiKey] = useState("");
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [radiusKm, setRadiusKm] = useState(200);
  const [center, setCenter] = useState("own");
  const [showMobile, setShowMobile] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!me) return;
        setApiKey(me.aprs_fi_api_key || "");
        setKeyConfigured(!!me.aprs_fi_api_key);
        setRadiusKm(me.aprs_radius_km ?? 200);
        setCenter(me.aprs_center || "own");
        setShowMobile(me.aprs_show_mobile !== false);
      } catch (e) {
        // ohne Anmeldung bleiben die Defaults stehen
      }
    })();
  }, []);

  const flashPrefsSaved = () => {
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 1500);
  };

  const savePreferences = async (partial) => {
    try {
      await base44.auth.updateMe(partial);
      flashPrefsSaved();
    } catch (e) {
      // Fehler bleiben sichtbar über den Toast des SDK
    }
  };

  const handleSaveKey = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const trimmed = apiKey.trim();
      await base44.auth.updateMe({ aprs_fi_api_key: trimmed });
      setApiKey(trimmed);
      setKeyConfigured(!!trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    setClearing(true);
    setTestResult(null);
    try {
      await base44.auth.updateMe({ aprs_fi_api_key: "" });
      setApiKey("");
      setKeyConfigured(false);
    } finally {
      setClearing(false);
    }
  };

  // Testet ausschliesslich den gespeicherten persönlichen Key — der Key selbst
  // verlässt den Server nicht und wird nie im Klartext angezeigt.
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke("testCredentials", { service: "aprs", scope: "personal" });
      const data = res?.data || {};
      const rateLimited = /rate-limit/i.test(data.message || "");
      setTestResult({
        success: data.success === true,
        rateLimited,
        message: data.message || "Keine Antwort vom APRS.fi-Server",
      });
    } catch (e) {
      setTestResult({ success: false, message: "Test fehlgeschlagen: " + (e?.message || "unbekannter Fehler") });
    } finally {
      setTesting(false);
    }
  };

  const Toggle = ({ enabled, onChange, label, description }) => (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-gray-900" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled ? "translate-x-6" : ""}`} />
      </button>
    </div>
  );

  return (
    <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <KeyRound className="w-4 h-4" /> aprs.fi API-Key
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">Persönlicher Key für Detailabfragen bei aprs.fi</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">API-Key (persönlich)</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${keyConfigured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {keyConfigured ? "aktiv" : "nicht gesetzt"}
          </span>
        </div>
        <PasswordInput
          value={apiKey}
          onChange={setApiKey}
          placeholder="APRS.fi API-Key einfügen"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSaveKey}
          disabled={saving || !apiKey.trim()}
          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saved ? "Gespeichert" : "Key speichern"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !keyConfigured}
          className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
          Key testen
        </button>
        {keyConfigured && (
          <button
            onClick={handleDeleteKey}
            disabled={clearing}
            className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Löschen
          </button>
        )}
      </div>

      {!keyConfigured && (
        <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p>Ohne API-Key werden nur APRS-IS-Daten ohne aprs.fi-Detailabfrage angezeigt.</p>
            <a
              href="https://aprs.fi/page/api"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-amber-900 underline hover:no-underline"
            >
              Key auf aprs.fi erstellen <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {testResult && (
        <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
          testResult.success
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-700"
        }`}>
          {testResult.success
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <div>
            <p className="font-medium">
              {testResult.success ? (testResult.rateLimited ? "Key gültig — Rate-Limit erreicht" : "Key gültig") : "Key ungültig"}
            </p>
            <p className="opacity-80 mt-0.5">{testResult.message}</p>
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Wifi className="w-4 h-4" /> Karten-Voreinstellungen
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">Gelten beim Öffnen der Karte für den APRS-Layer</p>
      </div>

      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Standard-Radius</span>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {RADIUS_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => { setRadiusKm(r); savePreferences({ aprs_radius_km: r }); }}
              className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                radiusKm === r ? "bg-purple-600 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zentrum</span>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          {[
            { value: "own", label: "Eigene Position" },
            { value: "map", label: "Kartenmitte" },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setCenter(opt.value); savePreferences({ aprs_center: opt.value }); }}
              className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                center === opt.value ? "bg-purple-600 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Toggle
        enabled={showMobile}
        onChange={(val) => { setShowMobile(val); savePreferences({ aprs_show_mobile: val }); }}
        label="Mobile Stationen einblenden"
        description="Fahrzeuge, Handgeräte und tragbare Stationen auf der Karte zeigen"
      />

      {prefsSaved && (
        <p className="text-[11px] text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" /> Einstellungen gespeichert
        </p>
      )}
    </section>
  );
}