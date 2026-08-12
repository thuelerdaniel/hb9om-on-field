import React, { useState, useEffect, useCallback } from "react";
import { Clock, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle, Play, ChevronDown, ChevronRight, Calendar, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

// Status badge for a single schedule entry.
function ScheduleStatusBadge({ status }) {
  const config = {
    pending: { icon: Clock, color: "text-gray-400 dark:text-slate-500", bg: "bg-gray-100 dark:bg-slate-700", label: "Wartet" },
    running: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Läuft", spin: true },
    success: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30", label: "OK" },
    failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", label: "Fehler" },
    skipped: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Übersprungen" },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.color}`}>
      <Icon className={`w-3 h-3 ${c.spin ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}

// Format UTC time for display in local timezone
function formatTime(utcStr) {
  if (!utcStr) return "—";
  try {
    return new Date(utcStr).toLocaleString("de-CH", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function formatDuration(ms) {
  if (!ms || ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function DailyRefreshScheduleManager() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(null);
  const [expandedError, setExpandedError] = useState(null);
  const { toast } = useToast();

  const fetchSchedules = useCallback(async () => {
    try {
      const data = await base44.entities.DailyRefreshSchedule.list("display_order", 50);
      setSchedules(data || []);
    } catch (e) {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
    // Refresh every 30 seconds to catch running/updated states
    const interval = setInterval(fetchSchedules, 30000);
    return () => clearInterval(interval);
  }, [fetchSchedules]);

  const handleTrigger = async (schedule) => {
    setTriggering(schedule.source);
    try {
      const res = await base44.functions.invoke(schedule.function_name, {
        ...(schedule.function_payload || {}),
        scheduled: false,
      });
      if (res.data?.error) {
        toast({ title: "Fehler", description: res.data.error, variant: "destructive" });
      } else {
        toast({
          title: `${schedule.label} gestartet`,
          description: `${res.data?.count || res.data?.saved || res.data?.total || 0} Einträge verarbeitet`,
          duration: 5000,
        });
      }
      // Wait a moment then refresh schedule status
      setTimeout(fetchSchedules, 2000);
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setTriggering(null);
    }
  };

  const handleToggleEnabled = async (schedule) => {
    try {
      await base44.entities.DailyRefreshSchedule.update(schedule.id, { enabled: !schedule.enabled });
      setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, enabled: !s.enabled } : s));
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  // Compute overall status
  const hasFailed = schedules.some(s => s.last_status === "failed");
  const hasRunning = schedules.some(s => s.last_status === "running");
  const hasPending = schedules.some(s => s.enabled && s.last_status === "pending");
  const overallStatus = hasFailed ? "error" : hasRunning ? "warning" : hasPending ? "warning" : "ok";
  const overallLabel = hasFailed ? "Fehler aufgetreten" : hasRunning ? "Aktualisierung läuft" : hasPending ? "Wartet auf Ausführung" : "Alle OK";

  const enabledCount = schedules.filter(s => s.enabled).length;
  const successCount = schedules.filter(s => s.last_status === "success").length;
  const failedCount = schedules.filter(s => s.last_status === "failed").length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-600 dark:text-slate-300" />
          <span className="text-sm font-bold text-gray-900 dark:text-slate-100">Tages-Aktualisierungsplan</span>
        </div>
        <button
          onClick={fetchSchedules}
          disabled={loading}
          className="text-[10px] text-blue-600 hover:underline disabled:opacity-40 flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Aktualisieren
        </button>
      </div>

      {/* Summary bar */}
      {!loading && schedules.length > 0 && (
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500 dark:text-slate-400">
            <Zap className="w-3 h-3 inline mr-1" />
            {enabledCount}/{schedules.length} aktiv
          </span>
          <span className="text-green-600">{successCount} OK</span>
          {failedCount > 0 && <span className="text-red-600">{failedCount} Fehler</span>}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            overallStatus === "ok" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
            overallStatus === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {overallLabel}
          </span>
        </div>
      )}

      {/* Schedule list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300 dark:text-slate-600" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-400 dark:text-slate-500">
          Kein Zeitplan vorhanden — wird beim nächsten Orchestrator-Lauf erstellt
        </div>
      ) : (
        <div className="space-y-1.5">
          {schedules.map(s => (
            <div
              key={s.id}
              className={`rounded-lg border p-2.5 ${
                s.last_status === "failed" ? "border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/10" :
                s.last_status === "running" ? "border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10" :
                s.enabled ? "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800" :
                "border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ScheduleStatusBadge status={s.last_status} />
                  <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate">{s.label}</span>
                  {!s.enabled && (
                    <span className="text-[9px] text-gray-400 dark:text-slate-500">(deaktiviert)</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 hidden sm:inline">
                    {s.scheduled_time_utc ? `${s.scheduled_time_utc} UTC` : ""}
                  </span>
                  <button
                    onClick={() => handleToggleEnabled(s)}
                    className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${s.enabled ? "bg-green-500" : "bg-gray-300 dark:bg-slate-600"}`}
                    title={s.enabled ? "Deaktivieren" : "Aktivieren"}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${s.enabled ? "translate-x-4" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleTrigger(s)}
                    disabled={triggering === s.source}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-40"
                    title="Jetzt ausführen"
                  >
                    {triggering === s.source ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Details row */}
              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 dark:text-slate-500">
                {s.last_count != null && (
                  <span>{s.last_count.toLocaleString("de-CH")} Einträge</span>
                )}
                {s.last_duration_ms > 0 && (
                  <span>{formatDuration(s.last_duration_ms)}</span>
                )}
                {s.last_run_time && (
                  <span>Letzte: {formatTime(s.last_run_time)}</span>
                )}
                {s.next_run_utc && s.enabled && (
                  <span className="text-blue-500">Nächste: {formatTime(s.next_run_utc)}</span>
                )}
              </div>

              {/* Error details (expandable) */}
              {s.last_status === "failed" && s.last_error && (
                <div className="mt-1.5">
                  <button
                    onClick={() => setExpandedError(expandedError === s.id ? null : s.id)}
                    className="flex items-center gap-1 text-[10px] text-red-600 hover:underline"
                  >
                    {expandedError === s.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Fehlerdetails anzeigen
                  </button>
                  {expandedError === s.id && (
                    <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-[10px] text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {s.last_error_detail || s.last_error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-gray-400 dark:text-slate-500">
        Der Orchestrator verteilt alle Quellen zufällig zwischen 00:00–06:00 UTC. Der Checker läuft alle 5 Minuten und führt fällige Quellen aus.
      </p>
    </div>
  );
}