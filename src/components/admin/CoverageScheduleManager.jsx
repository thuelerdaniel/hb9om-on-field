import React, { useState, useEffect, useCallback } from "react";
import { Clock, RefreshCw, Loader2, Calendar, Globe, ChevronDown, ChevronUp, Radio, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

// Admin component to view repeater coverage calculation status and trigger manual calculation.
// The cron job runs daily (platform scheduled automation) and processes the oldest
// uncalculated repeaters worldwide. This component shows progress statistics.
export default function CoverageScheduleManager() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const { toast } = useToast();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("calculateRepeaterCoverage", { stats_only: true });
      setStats(res.data?.global || null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleManualBatch = async () => {
    setCalculating(true);
    setCalcResult(null);
    try {
      const res = await base44.functions.invoke("calculateRepeaterCoverage", {
        country_code: "all",
        batch_limit: 30,
        delay_ms: 1000,
      });
      setCalcResult(res.data);
      toast({
        title: "Batch berechnet",
        description: `${res.data?.calculated || 0} Relais berechnet, ${res.data?.skipped || 0} übersprungen`,
      });
      fetchStats();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setCalculating(false);
    }
  };

  const pct = stats && stats.totalRepeaters > 0
    ? Math.round((stats.calculated / stats.totalRepeaters) * 100)
    : 0;

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Abdeckungs-Cron-Job</h3>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {!expanded && (
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Tägliche Terrain-LOS Berechnung weltweit — {pct}% abgedeckt
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : stats ? (
            <>
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-slate-400">Berechnet</span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {stats.calculated?.toLocaleString()} / {stats.totalRepeaters?.toLocaleString()} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
                  <div className="text-gray-400 text-[10px]">Mit Koordinaten</div>
                  <div className="font-semibold text-gray-900 dark:text-slate-100">{stats.withCoords?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
                  <div className="text-gray-400 text-[10px]">Terrain-LOS</div>
                  <div className="font-semibold text-teal-600">{stats.terrainAdjusted?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
                  <div className="text-gray-400 text-[10px]">APRS-verfeinert</div>
                  <div className="font-semibold text-blue-600">{stats.aprsRefined?.toLocaleString() || 0}</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
                  <div className="text-gray-400 text-[10px]">Wartet auf Neuberechnung</div>
                  <div className="font-semibold text-amber-600">{stats.pendingRecalc?.toLocaleString() || 0}</div>
                </div>
              </div>

              {/* Cron info */}
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-2.5 text-xs">
                <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-semibold mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Cron-Job: Täglich 05:00 UTC
                </div>
                <p className="text-[10px] text-teal-600 dark:text-teal-400 leading-relaxed">
                  Verarbeitet weltweit die ältesten/unkalkulierten Relais zuerst (50 pro Lauf).
                  Bei ~10'000 Relais dauert eine vollständige Abdeckung ca. 200 Tage.
                </p>
              </div>

              {/* Manual trigger */}
              <button
                onClick={handleManualBatch}
                disabled={calculating}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-40"
              >
                {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                {calculating ? "Berechne..." : "Manuellen Batch starten (30 Relais)"}
              </button>

              {calcResult && (
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2 text-xs text-gray-600 dark:text-slate-400">
                  <div>Berechnet: {calcResult.calculated} · Übersprungen: {calcResult.skipped} · Fehler: {calcResult.errors}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Dauer: {(calcResult.duration_ms / 1000).toFixed(1)}s</div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">Statistiken nicht verfügbar</p>
          )}

          <button
            onClick={fetchStats}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Aktualisieren
          </button>
        </div>
      )}
    </section>
  );
}