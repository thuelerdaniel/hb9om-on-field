import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Database, Radio, Landmark, Lightbulb, Globe, Mountain, TreePine, Shield, Flower } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const SOURCES = [
  { key: "sota", label: "SOTA", icon: Mountain, color: "text-red-500" },
  { key: "pota", label: "POTA", icon: TreePine, color: "text-green-500" },
  { key: "hbff", label: "HBFF", icon: Flower, color: "text-purple-500" },
  { key: "wwbota", label: "WWBOTA", icon: Shield, color: "text-amber-700" },
  { key: "castle", label: "Burgen/Schlösser (Welt)", icon: Landmark, color: "text-orange-500" },
  { key: "lighthouse", label: "Leuchttürme", icon: Lightbulb, color: "text-yellow-500" },
  { key: "iota", label: "IOTA (Welt)", icon: Globe, color: "text-blue-500" },
  { key: "repeater", label: "Relais", icon: Radio, color: "text-cyan-500" },
];

export default function IndividualSourceReload() {
  const [loadingSource, setLoadingSource] = useState(null);
  const [results, setResults] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("hb9om_source_reload_log");
      if (saved) setResults(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const trimmed = results.slice(0, 20);
      localStorage.setItem("hb9om_source_reload_log", JSON.stringify(trimmed));
    } catch {}
  }, [results]);

  const handleReload = useCallback(async (sourceKey) => {
    setLoadingSource(sourceKey);
    const startTime = Date.now();
    try {
      const res = await base44.functions.invoke("refreshDataSource", { source: sourceKey });
      const data = res.data;
      const duration = Date.now() - startTime;

      const entry = {
        source: sourceKey,
        label: data.label || sourceKey,
        status: data.status || (data.error ? "failed" : "success"),
        count: data.count,
        withCoords: data.withCoords,
        withoutCoords: data.withoutCoords,
        error: data.error,
        duration_ms: data.duration_ms || duration,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      setResults(prev => [entry, ...prev].slice(0, 20));

      if (entry.status === "success") {
        toast({
          title: `${entry.label} aktualisiert`,
          description: `${entry.count} Einträge · ${entry.withCoords} mit Koordinaten · ${(entry.duration_ms / 1000).toFixed(1)}s`,
          duration: 5000,
        });
      } else {
        toast({
          title: `${entry.label} fehlgeschlagen`,
          description: entry.error || "Unbekannter Fehler",
          variant: "destructive",
          duration: 8000,
        });
      }
    } catch (e) {
      const entry = {
        source: sourceKey,
        label: sourceKey,
        status: "failed",
        error: e.message || "Unbekannter Fehler",
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
      setResults(prev => [entry, ...prev].slice(0, 20));
      toast({
        title: "Fehler",
        description: e.message || "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setLoadingSource(null);
    }
  }, [toast]);

  const clearLog = useCallback(() => {
    setResults([]);
    localStorage.removeItem("hb9om_source_reload_log");
  }, []);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" /> Einzelne Datenquelle neu laden
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Jede externe Datenquelle einzeln aktualisieren — Ergebnisse werden im Log angezeigt
          </p>
        </div>
        {results.length > 0 && (
          <button
            onClick={clearLog}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Log leeren
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {SOURCES.map(src => {
          const Icon = src.icon;
          const isLoading = loadingSource === src.key;
          return (
            <button
              key={src.key}
              onClick={() => handleReload(src.key)}
              disabled={loadingSource !== null}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 ${
                isLoading
                  ? "bg-blue-50 border-blue-300 text-blue-600"
                  : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Icon className={`w-3.5 h-3.5 ${src.color}`} />
              )}
              <span className="truncate">{src.label}</span>
            </button>
          );
        })}
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                r.status === "success" ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"
              }`}
            >
              {r.status === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              )}
              <span className="font-semibold text-gray-900 min-w-[80px]">{r.label}</span>
              {r.status === "success" ? (
                <span className="text-gray-600">
                  {r.count} Einträge · {r.withCoords} geo · {r.withoutCoords} offen
                </span>
              ) : (
                <span className="text-red-600 truncate">{r.error}</span>
              )}
              <span className="ml-auto flex items-center gap-2 text-gray-400 flex-shrink-0">
                <span>{(r.duration_ms / 1000).toFixed(1)}s</span>
                <Clock className="w-3 h-3" />
                <span>{new Date(r.timestamp).toLocaleTimeString('de-CH')}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}