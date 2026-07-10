import React, { useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink, Clock, Database } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function ExternalDataCheck() {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("checkExternalData", { action: "check" });
      setResult(res.data);
      const s = res.data?.summary;
      if (s) {
        toast({
          title: "Überprüfung abgeschlossen",
          description: `${s.up_to_date} aktuell, ${s.new_data} mit neuen Daten, ${s.errors} Fehler – ${(res.data.duration_ms / 1000).toFixed(1)}s`,
        });
      }
    } catch (e) {
      toast({ title: "Fehler bei der Überprüfung", description: e?.message || "Unbekannt", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke("refreshAllData", {});
      toast({ title: "Aktualisierung gestartet", description: "Alle externen Daten werden neu geladen" });
      setTimeout(() => handleCheck(), 3000);
    } catch (e) {
      toast({ title: "Fehler", description: e?.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const StatusIcon = ({ status }) => {
    if (status === 'up_to_date') return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
    if (status === 'new_data') return <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    if (status === 'check_needed') return <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  };

  const statusLabel = (status) => {
    const map = {
      up_to_date: "Aktuell",
      new_data: "Neue Daten verfügbar",
      check_needed: "Überprüfung nötig",
      error: "Fehler"
    };
    return map[status] || status;
  };

  const statusColor = (status) => {
    const map = {
      up_to_date: "text-green-600 bg-green-50",
      new_data: "text-amber-600 bg-amber-50",
      check_needed: "text-blue-600 bg-blue-50",
      error: "text-red-600 bg-red-50"
    };
    return map[status] || "text-gray-600 bg-gray-50";
  };

  const hasNewData = result?.results?.some(r => r.status === 'new_data');
  const hasErrors = result?.results?.some(r => r.status === 'error');

  return (
    <section className="bg-white rounded-xl border-2 border-blue-200 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Externe Daten überprüfen
        </h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Überprüft alle externen Datenquellen (SOTA, POTA, HBFF, WWBOTA, Burgen, Leuchttürme, Bandplan, Gefahrenlayer, QRZ.com) auf Aktualität.
        Bei neuen Daten kann eine Aktualisierung ausgelöst werden.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          onClick={handleCheck}
          disabled={checking}
          className="flex-1 px-3 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {checking ? "Prüft..." : "Alle Daten prüfen"}
        </button>
        {hasNewData && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Daten aktualisieren
          </button>
        )}
      </div>

      {result && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-lg font-bold text-green-600">{result.summary.up_to_date}</p>
              <p className="text-[10px] text-green-700">Aktuell</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="text-lg font-bold text-amber-600">{result.summary.new_data}</p>
              <p className="text-[10px] text-amber-700">Neue Daten</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-lg font-bold text-red-600">{result.summary.errors}</p>
              <p className="text-[10px] text-red-700">Fehler</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-lg font-bold text-blue-600">{result.summary.check_needed}</p>
              <p className="text-[10px] text-blue-700">Zu prüfen</p>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Geprüft am {new Date(result.checked_at).toLocaleString('de-CH')} · {(result.duration_ms / 1000).toFixed(1)}s
          </div>

          {/* Results list */}
          <div className="space-y-2">
            {result.results.map((r, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-2.5">
                <div className="flex items-start gap-2">
                  <StatusIcon status={r.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-900">{r.label}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColor(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                      <span className="flex items-center gap-0.5"><Database className="w-2.5 h-2.5" /> {r.source}</span>
                      {r.auto_updated && <span className="text-green-500">· täglich auto.</span>}
                    </div>
                    {r.cached_count !== undefined && r.external_count !== undefined && (
                      <div className="text-[10px] text-gray-500 mt-1">
                        Cache: <span className="font-mono font-semibold">{r.cached_count}</span>
                        {" → "}
                        Extern: <span className="font-mono font-semibold">{r.external_count}</span>
                        {r.difference > 0 && <span className="text-amber-600 font-medium"> (+{r.difference} neu)</span>}
                      </div>
                    )}
                    {r.note && <p className="text-[10px] text-gray-400 mt-1">{r.note}</p>}
                    {r.error && <p className="text-[10px] text-red-500 mt-1">⚠ {r.error}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasNewData && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Neue Daten verfügbar! Klicken Sie auf «Daten aktualisieren», um die Referenzdaten zu erneuern. Daten, die täglich automatisch aktualisiert werden, sind bereits auf dem neuesten Stand.</span>
            </div>
          )}
          {hasErrors && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-1.5">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Bei einigen Quellen trat ein Fehler auf. Dies kann an temporären Server-Problemen liegen. Versuchen Sie es später erneut.</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}