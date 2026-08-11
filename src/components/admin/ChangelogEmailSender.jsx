import React, { useState, useEffect } from "react";
import { Mail, Loader2, Send, CheckCircle2, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { APP_VERSION } from "@/lib/constants";
import { VERSION_CHANGELOG } from "@/components/map/VersionChangelogPopup";

export default function ChangelogEmailSender() {
  const [sentVersion, setSentVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const fetchSentVersion = async () => {
    setLoading(true);
    try {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: "changelog_email_version" });
      if (settings.length > 0) setSentVersion(settings[0].value);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchSentVersion(); }, []);

  const currentChangelog = VERSION_CHANGELOG[0];
  const alreadySent = sentVersion === APP_VERSION;
  const canSend = !loading && !alreadySent && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setResult(null);
    try {
      const changelogText = currentChangelog.changes.map(c => `  • ${c}`).join("\n");
      const res = await base44.functions.invoke("sendChangelogEmail", {
        version: APP_VERSION,
        changelog_title: currentChangelog.title,
        changelog_text: changelogText,
      });
      const data = res.data;
      if (data.already_sent) {
        setResult({ already_sent: true, message: data.message });
        setSentVersion(APP_VERSION);
        toast({ title: "Bereits verschickt", description: data.message, duration: 5000 });
      } else if (data.error) {
        setResult({ error: data.error });
        toast({ title: "Fehler", description: data.error, variant: "destructive" });
      } else {
        setResult({ success: true, sent: data.sent, failed: data.failed, total: data.total_recipients });
        setSentVersion(APP_VERSION);
        toast({
          title: "Changelog-E-Mail verschickt",
          description: `${data.sent} E-Mails erfolgreich gesendet${data.failed > 0 ? `, ${data.failed} fehlgeschlagen` : ""}`,
          duration: 6000,
        });
      }
    } catch (e) {
      setResult({ error: e.message || "Unbekannter Fehler" });
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-blue-600" /> Changelog-E-Mail an alle Benutzer
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Sendet die Änderungen von v{APP_VERSION} an alle registrierten Benutzer — einmalig pro Version.
          </p>
        </div>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${
            alreadySent
              ? "bg-gray-100 text-gray-400 dark:text-slate-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          }`}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : alreadySent ? <Lock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {sending ? "Sendet..." : alreadySent ? "Bereits verschickt" : "Jetzt verschicken"}
        </button>
      </div>

      {/* Status info */}
      <div className="mt-3 text-xs">
        {loading ? (
          <span className="text-gray-400 dark:text-slate-500">Status wird geladen...</span>
        ) : alreadySent ? (
          <span className="text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Changelog für v{APP_VERSION} wurde bereits an alle Benutzer verschickt.
          </span>
        ) : (
          <span className="text-amber-600">
            Neue Version v{APP_VERSION} erkannt — Changelog kann verschickt werden.
          </span>
        )}
      </div>

      {/* Changelog preview */}
      {!alreadySent && currentChangelog && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs font-semibold text-gray-700 mb-1">v{currentChangelog.version} – {currentChangelog.title}</p>
          <ul className="text-[11px] text-gray-600 space-y-0.5 max-h-24 overflow-y-auto">
            {currentChangelog.changes.map((c, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-gray-400 dark:text-slate-500 flex-shrink-0">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Result */}
      {result && result.success && (
        <div className="mt-3 p-3 rounded-lg text-sm bg-green-50 dark:bg-green-900/20 text-green-700">
          E-Mail verschickt: {result.sent} von {result.total} Empfänger(n) erfolgreich{result.failed > 0 ? `, ${result.failed} fehlgeschlagen` : ""}.
        </div>
      )}
      {result && result.error && (
        <div className="mt-3 p-3 rounded-lg text-sm bg-red-50 text-red-700">
          Fehler: {result.error}
        </div>
      )}
      {result && result.already_sent && !result.success && (
        <div className="mt-3 p-3 rounded-lg text-sm bg-gray-50 text-gray-600">
          {result.message}
        </div>
      )}
    </section>
  );
}