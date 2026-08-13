import React, { useState, useEffect, useCallback } from "react";
import { Clock, RefreshCw, Loader2, Calendar, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

// Admin component to view and configure the repeater coverage calculation schedule.
// Shows the weekly cron schedule and allows incremental configuration.
export default function CoverageScheduleManager() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch DailyRefreshSchedule entries for repeater coverage sources
      const schedules = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({
        source: "ch_repeater_links",
      });
      setAutomations(schedules || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const handleToggleDay = async (scheduleId, currentDays, day) => {
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    try {
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(scheduleId, {
        weekly_days: newDays,
      });
      toast({ title: "Aktualisiert", description: `Wochentage geändert: ${newDays.join(", ") || "Keine"}` });
      fetchAutomations();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleEnabled = async (scheduleId, currentEnabled) => {
    try {
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(scheduleId, {
        weekly_enabled: !currentEnabled,
      });
      toast({ title: !currentEnabled ? "Aktiviert" : "Deaktiviert", description: "Cron-Job Status aktualisiert" });
      fetchAutomations();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const DAY_LABELS = { Monday: "Mo", Tuesday: "Di", Wednesday: "Mi", Thursday: "Do", Friday: "Fr", Saturday: "Sa", Sunday: "So" };

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
          Wöchentliche Terrain-LOS Berechnung für CH-Relais (Montag 07:00 UTC)
        </p>
      )}

      {expanded && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : automations.length === 0 ? (
            <div className="text-center py-4">
              <Calendar className="w-6 h-6 text-gray-200 mx-auto mb-1" />
              <p className="text-xs text-gray-400">Kein Cron-Job für Abdeckungsberechnung konfiguriert</p>
              <p className="text-[10px] text-gray-400 mt-1">
                Der Cron-Job wird automatisch erstellt wenn die Abdeckungsberechnung zum ersten Mal ausgelöst wird.
              </p>
            </div>
          ) : (
            automations.map(sched => (
              <div key={sched.id} className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">
                      {sched.label || sched.source}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleEnabled(sched.id, sched.weekly_enabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${sched.weekly_enabled ? "bg-teal-600" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${sched.weekly_enabled ? "translate-x-5" : ""}`} />
                  </button>
                </div>

                <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">
                  Funktion: <span className="font-mono">{sched.function_name}</span>
                </div>

                {sched.last_run_time && (
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">
                    Letzte Ausführung: {new Date(sched.last_run_time).toLocaleString("de-CH")} · Status: {sched.last_status || "unbekannt"}
                    {sched.last_count != null && ` · ${sched.last_count} Relais`}
                  </div>
                )}

                <div>
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-1">Wochentage:</div>
                  <div className="flex gap-1 flex-wrap">
                    {DAYS.map(day => {
                      const active = (sched.weekly_days || ["Monday"]).includes(day);
                      return (
                        <button
                          key={day}
                          onClick={() => handleToggleDay(sched.id, sched.weekly_days || [], day)}
                          className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                            active
                              ? "bg-teal-600 text-white"
                              : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                          }`}
                        >
                          {DAY_LABELS[day]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                  <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-1">Inkrementelle Konfiguration:</div>
                  <div className="text-[10px] text-gray-400">
                    Sync-Typ: <span className="font-mono">{sched.sync_type || "full_batch"}</span>
                  </div>
                  {sched.incremental_enabled && (
                    <div className="text-[10px] text-green-600 mt-0.5">
                      Inkrementeller Sync aktiv — nur Deltas werden berechnet
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          <button
            onClick={fetchAutomations}
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