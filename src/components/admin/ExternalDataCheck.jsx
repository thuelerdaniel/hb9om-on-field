import React, { useState } from "react";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, AlertCircle, Clock, Database, MapPin, Globe, Link2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

function StatusPill({ status }) {
  if (status === 'ok') {
    return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-green-600 bg-green-50">Erreichbar</span>;
  }
  return <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-red-600 bg-red-50">Fehler</span>;
}

function SourceRow({ r }) {
  return (
    <div className="border border-gray-200 rounded-lg p-2.5">
      <div className="flex items-start gap-2">
        {r.status === 'ok'
          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-gray-900">{r.label}</span>
            <StatusPill status={r.status} />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 flex-wrap">
            <span className="flex items-center gap-0.5"><Link2 className="w-2.5 h-2.5" /> {r.source}</span>
            {r.auto_updated && <span className="text-green-500">· täglich auto.</span>}
            {r.http_status && <span>· HTTP {r.http_status}</span>}
            <span>· {(r.duration_ms / 1000).toFixed(1)}s</span>
          </div>
          {r.detail && (
            <p className={`text-[10px] mt-1 ${r.status === 'ok' ? 'text-gray-500' : 'text-red-500'}`}>
              {r.status === 'ok' ? '' : '⚠ '}{r.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExternalDataCheck() {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("checkExternalData", { action: "check" });
      setResult(res.data);
      const s = res.data?.summary;
      if (s) {
        toast({
          title: "Anbindung geprüft",
          description: `${s.sources_ok}/${s.sources_total} Quellen ok · ${s.geo_ok}/${s.geo_total} Geokodierung ok${s.gaps_without_coords > 0 ? ` · ${s.gaps_without_coords} Ref. ohne Koordinaten` : ''} – ${(res.data.duration_ms / 1000).toFixed(1)}s`,
        });
      }
    } catch (e) {
      toast({ title: "Fehler bei der Überprüfung", description: e?.message || "Unbekannt", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const hasSourceErrors = result?.sources?.some(r => r.status === 'error');
  const hasGeoErrors = result?.geocoding?.some(r => r.status === 'error');
  const hasGaps = result?.gaps?.length > 0;

  return (
    <section className="bg-white rounded-xl border-2 border-blue-200 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" /> Externe Daten prüfen
        </h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Prüft die Anbindung und korrekte Funktion aller Datenquellen, aus denen Referenzpunkte auf der
        Karte erstellt werden. Zudem werden Referenzen ohne Koordinaten (Datenlücken) angezeigt, die sich
        über «Daten aktualisieren» ergänzen lassen.
      </p>

      <button
        onClick={handleCheck}
        disabled={checking}
        className="w-full px-3 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5 mb-3"
      >
        {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        {checking ? "Prüft..." : "Anbindung prüfen"}
      </button>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-lg font-bold text-green-600">{result.summary.sources_ok}</p>
              <p className="text-[10px] text-green-700">Quellen ok</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-lg font-bold text-red-600">{result.summary.sources_errors}</p>
              <p className="text-[10px] text-red-700">Quellen-Fehler</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="text-lg font-bold text-amber-600">{result.summary.gaps_without_coords}</p>
              <p className="text-[10px] text-amber-700">Ohne Koord.</p>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Geprüft am {new Date(result.checked_at).toLocaleString('de-CH')} · {(result.duration_ms / 1000).toFixed(1)}s
          </div>

          {/* Reference data sources */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Database className="w-3 h-3" /> Referenzdaten-Quellen
            </h4>
            <div className="space-y-2">
              {result.sources.map((r, i) => <SourceRow key={i} r={r} />)}
            </div>
          </div>

          {/* Geocoding helper sources (for castle supplementation) */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Geokodierungs-Quellen (für Burgen)
            </h4>
            <div className="space-y-2">
              {result.geocoding.map((r, i) => <SourceRow key={i} r={r} />)}
            </div>
          </div>

          {/* References without coordinates (data gaps) */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Referenzen ohne Koordinaten
            </h4>
            {!hasGaps ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                Alle Referenzen besitzen Koordinaten und können als Kartenpunkte erstellt werden.
              </div>
            ) : (
              <div className="space-y-2">
                {result.gaps.map(g => (
                  <div key={g.type} className="border border-amber-200 bg-amber-50 rounded-lg p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-900">{g.label}</span>
                      <span className="text-[10px] text-amber-700 font-medium">
                        {g.without_coords} / {g.total} ohne Koordinaten
                      </span>
                    </div>
                    {g.references.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {g.references.slice(0, 20).map((r, i) => (
                          <span key={i} className="text-[10px] font-mono bg-white border border-amber-200 rounded px-1 py-0.5 text-gray-700" title={r.name}>
                            {r.code || r.name || '?'}
                          </span>
                        ))}
                        {g.references.length > 20 && (
                          <span className="text-[10px] text-amber-600">+{g.without_coords - 20} weitere</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Führen Sie «Daten aktualisieren» aus, um fehlende Koordinaten neu zu ermitteln. Bei Burgen ohne Treffer können manuelle Korrekturen im Bereich «Burgen ohne Zuordnung» vorgenommen werden.</span>
                </div>
              </div>
            )}
          </div>

          {hasSourceErrors && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-1.5">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Bei einigen Referenzquellen trat ein Fehler auf. Die «Daten aktualisieren»-Funktion kann diese Quellen möglicherweise nicht neu laden – später erneut prüfen.</span>
            </div>
          )}
          {hasGeoErrors && !hasSourceErrors && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Einige Geokodierungs-Quellen sind nicht erreichbar. Die Burg-Zuordnung kann dadurch unvollständig sein.</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}