import React, { useState, useEffect } from "react";
import {
  Mail, Loader2, CheckCircle2, XCircle, AlertCircle, Send,
  Save, Shield, Bell, BellOff, KeyRound, Clock,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function AdminEmailSettings() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailOverride, setEmailOverride] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [reportConfig, setReportConfig] = useState({
    showSources: true,
    showUsage: true,
    showCache: true,
    showCountries: true,
    showRefTypes: true,
    showVideo: true,
  });
  const [configLoading, setConfigLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setCurrentUser(me);
        setEmailEnabled(me?.admin_email_enabled !== false);
        setEmailOverride(me?.admin_email_override || "");
        setEmailVerified(me?.admin_email_verified === true);
      } catch {}
      // Load report content config
      try {
        const existing = await base44.entities.AppSetting.filter({ key: "admin_report_config" });
        if (existing && existing.length > 0 && existing[0].value) {
          setReportConfig(prev => ({ ...prev, ...JSON.parse(existing[0].value) }));
        }
      } catch {}
      setConfigLoading(false);
    })();
  }, []);

  const handleSaveReportConfig = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.AppSetting.filter({ key: "admin_report_config" });
      if (existing && existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, { value: JSON.stringify(reportConfig) });
      } else {
        await base44.entities.AppSetting.create({ key: "admin_report_config", value: JSON.stringify(reportConfig), enabled: true });
      }
      toast({ title: "Gespeichert", description: "Report-Inhalt-Konfiguration gespeichert" });
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        admin_email_enabled: emailEnabled,
      });
      toast({ title: "Gespeichert", description: "E-Mail-Einstellungen gespeichert" });
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Speichern fehlgeschlagen", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    if (!emailOverride || !emailOverride.includes("@")) {
      toast({ title: "Fehler", description: "Gültige E-Mail-Adresse eingeben", variant: "destructive" });
      return;
    }
    setSendingCode(true);
    try {
      await base44.functions.invoke("manageApiKeys", { action: "verifyAdminEmail", email: emailOverride });
      toast({ title: "Code gesendet", description: `Verifikations-Code an ${emailOverride} gesendet` });
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Code konnte nicht gesendet werden", variant: "destructive" });
    } finally {
      setSendingCode(false);
    }
  };

  const handleConfirmVerification = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    try {
      await base44.functions.invoke("manageApiKeys", { action: "confirmAdminEmail", code: verifyCode.trim() });
      toast({ title: "Verifiziert", description: "E-Mail-Adresse erfolgreich verifiziert" });
      setEmailVerified(true);
      setVerifyCode("");
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Verifikation fehlgeschlagen", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleSendTestReport = async () => {
    setSendingTest(true);
    try {
      const res = await base44.functions.invoke("manageApiKeys", { action: "sendTestReport" });
      toast({ title: "Test-Report gesendet", description: "Täglicher Report wurde an Ihre E-Mail gesendet" });
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Test-Report konnte nicht gesendet werden", variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  const targetEmail = emailOverride && emailVerified ? emailOverride : currentUser?.email;

  return (
    <div className="space-y-3">
      {/* Enable/Disable toggle */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
              {emailEnabled ? <Bell className="w-4 h-4 text-green-600" /> : <BellOff className="w-4 h-4 text-gray-400" />}
              Täglichen Report erhalten
            </label>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {emailEnabled ? "Sie erhalten den täglichen Daten-Report per E-Mail" : "Kein täglicher Report — Sie können jederzeit einen Test-Report auslösen"}
            </p>
          </div>
          <button
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${emailEnabled ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${emailEnabled ? "translate-x-6" : ""}`} />
          </button>
        </div>
      </div>

      {/* Separate email address */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
          <Mail className="w-4 h-4" /> Separate E-Mail-Adresse
        </h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
          Optional: Definieren Sie eine separate E-Mail-Adresse für den täglichen Report.
          Ohne Angabe wird Ihre Account-E-Mail verwendet: <span className="font-mono">{currentUser?.email || "—"}</span>
        </p>

        <div className="space-y-2">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Separate E-Mail</label>
            <div className="flex gap-2 mt-1">
              <input
                type="email"
                value={emailOverride}
                onChange={e => { setEmailOverride(e.target.value); setEmailVerified(false); }}
                placeholder="z.B. hb9om@beispiel.ch"
                autoComplete="off"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button
                onClick={handleSendVerification}
                disabled={sendingCode || !emailOverride || !emailOverride.includes("@")}
                className="px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
              >
                {sendingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Code senden
              </button>
            </div>
          </div>

          {emailOverride && !emailVerified && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
              <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Die separate E-Mail-Adresse muss verifiziert werden, bevor sie verwendet wird.
                  Geben Sie den erhaltenen Code ein:
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value)}
                  placeholder="6-stelliger Code"
                  maxLength={6}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono text-center tracking-widest"
                />
                <button
                  onClick={handleConfirmVerification}
                  disabled={verifying || !verifyCode.trim()}
                  className="px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 flex items-center gap-1.5"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Bestätigen
                </button>
              </div>
            </div>
          )}

          {emailOverride && emailVerified && (
            <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/50 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">
                Verifiziert — tägliche Reports werden an <span className="font-mono">{emailOverride}</span> gesendet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Report content configuration */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-gray-600" /> Report-Inhalt festlegen
        </h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
          Wählen Sie, welche Bereiche im täglichen Report angezeigt werden.
        </p>
        {configLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : (
          <div className="space-y-2">
            {[
              { key: "showSources", label: "Quellen-Status", desc: "Aktualisierungs-Status aller Datenquellen" },
              { key: "showCache", label: "Daten-Cache Speicherung", desc: "Anzahl Einträge pro Layer (SOTA, POTA, Relais, etc.)" },
              { key: "showUsage", label: "App-Nutzung", desc: "Benutzer, QSOs, Relais, APRS-Stats" },
              { key: "showCountries", label: "QSOs nach Land", desc: "Top 10 Länder der QSO-Partner" },
              { key: "showRefTypes", label: "Referenz-Typen", desc: "Häufigste Referenz-Typen in QSOs" },
              { key: "showVideo", label: "Demo-Video", desc: "Link zum Demo-Video" },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-900 rounded-lg">
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-semibold text-gray-900 dark:text-slate-100">{item.label}</label>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">{item.desc}</p>
                </div>
                <button
                  onClick={() => setReportConfig(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${reportConfig[item.key] ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${reportConfig[item.key] ? "translate-x-5" : ""}`} />
                </button>
              </div>
            ))}
            <button
              onClick={handleSaveReportConfig}
              disabled={saving}
              className="w-full mt-2 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Report-Inhalt speichern
            </button>
          </div>
        )}
      </div>

      {/* Save settings */}
      <button
        onClick={handleSaveSettings}
        disabled={saving}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Einstellungen speichern
      </button>

      {/* Test report */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
          <Send className="w-4 h-4 text-blue-600" /> Test-Report auslösen
        </h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
          Sendet den aktuellen täglichen Report sofort an: <span className="font-mono">{targetEmail || "—"}</span>
        </p>
        <button
          onClick={handleSendTestReport}
          disabled={sendingTest}
          className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sendingTest ? "Wird gesendet..." : "Test-Report jetzt senden"}
        </button>
      </div>
    </div>
  );
}