import React, { useState, useEffect } from "react";
import {
  Building, Loader2, CheckCircle2, Save, KeyRound, Search, Radio,
  AlertCircle, Shield,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import PasswordInput from "@/components/settings/PasswordInput";

// Helper: call testCredentials backend function for club credential tests
function testClub(service) {
  return base44.functions.invoke("testCredentials", { service })
    .then(res => res.data)
    .catch(e => ({ success: false, message: e?.message || "Fehler beim Testen" }));
}

export default function ClubCallsignManager() {
  const [config, setConfig] = useState({
    club_callsign: "",
    club_name: "",
    qrz_username: "",
    qrz_password: "",
    qrz_api_key: "",
    aprs_fi_api_key: "",
    brandmeister_api_key: "",
  });
  const [maskedFields, setMaskedFields] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      const admin = me?.role === "admin";
      setIsAdmin(admin);
      if (admin) {
        const res = await base44.functions.invoke("manageApiKeys", { action: "getClubCallsign" });
        const cfg = res.data?.config || {};
        setConfig({
          club_callsign: cfg.club_callsign || "",
          club_name: cfg.club_name || "",
          qrz_username: cfg.qrz_username || "",
          qrz_password: cfg.qrz_password === "***" ? "***" : (cfg.qrz_password || ""),
          qrz_api_key: cfg.qrz_api_key === "***" ? "***" : (cfg.qrz_api_key || ""),
          aprs_fi_api_key: cfg.aprs_fi_api_key === "***" ? "***" : (cfg.aprs_fi_api_key || ""),
          brandmeister_api_key: cfg.brandmeister_api_key === "***" ? "***" : (cfg.brandmeister_api_key || ""),
        });
        setMaskedFields({
          qrz_password: cfg.qrz_password === "***",
          qrz_api_key: cfg.qrz_api_key === "***",
          aprs_fi_api_key: cfg.aprs_fi_api_key === "***",
          brandmeister_api_key: cfg.brandmeister_api_key === "***",
        });
        if (cfg.club_callsign) {
          localStorage.setItem("hb9om_club_callsign", cfg.club_callsign);
        }
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveConfig = { ...config };
      await base44.functions.invoke("manageApiKeys", { action: "setClubCallsign", config: saveConfig });
      if (config.club_callsign) {
        localStorage.setItem("hb9om_club_callsign", config.club_callsign);
      }
      toast({ title: "Gespeichert", description: "Club-Rufzeichen-Konfiguration gespeichert" });
      fetchConfig();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-center">
        <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Die Club-Rufzeichen-Verwaltung ist nur für Administratoren zugänglich.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Building className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Club-Rufzeichen</h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
        Zentrale Verwaltung des Club-Rufzeichens (z.B. HB9OM). Diese Konfiguration wird an allen Orten verwendet,
        an denen das Club-Rufzeichen benötigt wird (QSO-Logbuch, Filter, Statistiken).
      </p>

      {/* Club Callsign */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Club-Rufzeichen</label>
        <input
          type="text"
          value={config.club_callsign}
          onChange={e => setConfig({ ...config, club_callsign: e.target.value.toUpperCase().trim() })}
          placeholder="z.B. HB9OM"
          className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
        />
      </div>

      {/* Club Name */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Club-Name</label>
        <input
          type="text"
          value={config.club_name}
          onChange={e => setConfig({ ...config, club_name: e.target.value })}
          placeholder="z.B. Funkamateure Oberwallis"
          className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
        <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">QRZ.com Club-Zugang</h3>
        <div className="space-y-2">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">QRZ-Benutzername (Club)</label>
            <input
              type="text"
              value={config.qrz_username}
              onChange={e => setConfig({ ...config, qrz_username: e.target.value })}
              placeholder="QRZ.com-Benutzername des Clubs"
              autoComplete="off"
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <PasswordInput
            label="QRZ-Passwort (Club)"
            value={config.qrz_password}
            onChange={(v) => setConfig({ ...config, qrz_password: v })}
            placeholder={maskedFields.qrz_password ? "*** (überschreiben zum Ändern)" : "QRZ.com-Passwort des Clubs"}
            autoComplete="off"
            onTest={config.qrz_username && config.qrz_password ? () => testClub("club_qrz") : null}
            testLabel="Club QRZ-Login testen"
            testDisabled={!config.qrz_username || !config.qrz_password}
          />
          <PasswordInput
            label="QRZ API-Key (Club-Rufzeichen)"
            value={config.qrz_api_key}
            onChange={(v) => setConfig({ ...config, qrz_api_key: v })}
            placeholder={maskedFields.qrz_api_key ? "*** (überschreiben zum Ändern)" : "API-Key für Club-Rufzeichen"}
            autoComplete="off"
            onTest={config.qrz_api_key && config.qrz_api_key !== "***" ? () => testClub("club_qrz_apikey") : (maskedFields.qrz_api_key ? () => testClub("club_qrz_apikey") : null)}
            testLabel="Club QRZ API-Key testen"
            testDisabled={!config.qrz_api_key && !maskedFields.qrz_api_key}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Dieser API-Key wird für QRZ-Abfragen des Club-Rufzeichens verwendet (z.B. beim Clubstation-Modus im QSO-Logbuch).
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
        <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">Weitere Club API-Keys</h3>
        <div className="space-y-2">
          <PasswordInput
            label="APRS.fi API-Key (Club)"
            value={config.aprs_fi_api_key}
            onChange={(v) => setConfig({ ...config, aprs_fi_api_key: v })}
            placeholder={maskedFields.aprs_fi_api_key ? "*** (überschreiben zum Ändern)" : "APRS.fi API-Key des Clubs"}
            autoComplete="off"
            onTest={(config.aprs_fi_api_key || maskedFields.aprs_fi_api_key) ? () => testClub("club_aprs") : null}
            testLabel="Club APRS-Key testen"
            testDisabled={!config.aprs_fi_api_key && !maskedFields.aprs_fi_api_key}
          />
          <PasswordInput
            label="BrandMeister API-Key (Club)"
            value={config.brandmeister_api_key}
            onChange={(v) => setConfig({ ...config, brandmeister_api_key: v })}
            placeholder={maskedFields.brandmeister_api_key ? "*** (überschreiben zum Ändern)" : "BrandMeister API-Key des Clubs"}
            autoComplete="off"
            onTest={(config.brandmeister_api_key || maskedFields.brandmeister_api_key) ? () => testClub("club_bm") : null}
            testLabel="Club BM-Key testen"
            testDisabled={!config.brandmeister_api_key && !maskedFields.brandmeister_api_key}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Club-Konfiguration speichern
      </button>
    </div>
  );
}