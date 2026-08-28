import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar, Clock, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle,
  Play, ChevronDown, ChevronRight, Zap, Power, Settings2, Radio,
  Database, Mountain, TreePine, Flower, Shield, Landmark, Lightbulb,
  Globe, RadioTower, Signal, Link2, Headphones, Layers,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import SyncLogViewer from "@/components/admin/SyncLogViewer";
import SourceConfigCard from "@/components/admin/SourceConfigCard";

// ─── Source metadata: icon + color + sync type per source key ───
const SOURCE_META = {
  sota:               { icon: Mountain,    color: "text-red-500",     syncType: "full_batch", schedule: "Mo 01:00 UTC" },
  pota:               { icon: TreePine,    color: "text-green-500",   syncType: "full_batch", schedule: "Mo 01:00 UTC" },
  hbff:               { icon: Flower,      color: "text-purple-500",  syncType: "full_batch", schedule: "Mo 01:00 UTC" },
  wwbota:             { icon: Shield,      color: "text-amber-700",   syncType: "full_batch", schedule: "Mo 01:00 UTC" },
  castle:             { icon: Landmark,    color: "text-orange-500",  syncType: "full_batch", schedule: "Mo 01:00 UTC" },
  iota:               { icon: Globe,       color: "text-blue-500",    syncType: "full_batch", schedule: "Mo 01:00 UTC" },
  tota:               { icon: RadioTower,  color: "text-orange-500",  syncType: "full_batch", schedule: "Mo 01:00 UTC" },
  fm_funknetz:        { icon: Headphones,  color: "text-green-500",   syncType: "partial",    schedule: "Mo+Do 03:00 UTC" },
  ch_repeater_links:  { icon: Link2,       color: "text-indigo-500",  syncType: "partial",    schedule: "Mo+Do 03:00 UTC" },
  aprs:               { icon: Signal,      color: "text-purple-500",  syncType: "daily",      schedule: "Täglich 06:30 UTC" },
};

function getMeta(source) {
  if (SOURCE_META[source]) return SOURCE_META[source];
  if (source.startsWith("repeater")) return { icon: Radio, color: "text-cyan-500", syncType: "partial", schedule: "Mo+Do 03:00 UTC" };
  if (source.startsWith("lighthouse")) return { icon: Lightbulb, color: "text-yellow-500", syncType: "full_batch", schedule: "Mo 01:00 UTC" };
  return { icon: Database, color: "text-gray-500", syncType: "full_batch", schedule: "Mo 01:00 UTC" };
}

const SYNC_TYPE_LABELS = {
  full_batch: "Voll-Batch (Mo)",
  partial: "Teil-Sync (Do)",
  daily: "Täglich",
};

const STATUS_CONFIG = {
  pending:  { icon: Clock,        color: "text-gray-400",   bg: "bg-gray-100 dark:bg-slate-700",           label: "Geplant" },
  running:  { icon: Loader2,      color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/30",         label: "Läuft", spin: true },
  success:  { icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-100 dark:bg-green-900/30",       label: "OK" },
  failed:   { icon: XCircle,      color: "text-red-600",    bg: "bg-red-100 dark:bg-red-900/30",           label: "Fehler" },
  skipped:  { icon: AlertCircle,  color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30",       label: "Übersprungen" },
  timeout:  { icon: Clock,        color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/30",           label: "Timeout" },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.color}`}>
      <Icon className={`w-3 h-3 ${c.spin ? "animate-spin" : ""}`} />
      {c.label}
    </span>
  );
}

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
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_LABELS = {
  Monday: "Montag", Tuesday: "Dienstag", Wednesday: "Mittwoch",
  Thursday: "Donnerstag", Friday: "Freitag", Saturday: "Samstag", Sunday: "Sonntag",
};

export default function SyncPlanManager() {
  const [schedules, setSchedules] = useState([]);
  const [sourceConfig, setSourceConfig] = useState({});
  const [config, setConfig] = useState(null);
  const [globalAutoSync, setGlobalAutoSync] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggeringBatch, setTriggeringBatch] = useState(null);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [confirmBatch, setConfirmBatch] = useState(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("manageSyncSchedule", { action: "getSettings" });
      const data = res.data || res;
      setSchedules(data.sources || []);
      setSourceConfig(data.source_config || {});
      setConfig(data.config || null);
      setGlobalAutoSync(data.global_auto_sync !== false);
    } catch {
      try {
        const scheds = await base44.entities.DailyRefreshSchedule.list("display_order", 100);
        setSchedules(scheds || []);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggleGlobal = async () => {
    const newVal = !globalAutoSync;
    setGlobalAutoSync(newVal);
    try {
      await base44.functions.invoke("manageSyncSchedule", { action: "toggleGlobalAutoSync", enabled: newVal });
      toast({ title: `Auto-Sync ${newVal ? "aktiviert" : "deaktiviert"}`, duration: 3000 });
    } catch (e) {
      setGlobalAutoSync(!newVal);
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const handleTriggerBatch = async (mode) => {
    setTriggeringBatch(mode);
    setConfirmBatch(null);
    try {
      await base44.functions.invoke("manageSyncSchedule", { action: "triggerBatch", mode });
      toast({ title: "Batch gestartet", description: mode === "full" ? "Voll-Sync läuft" : mode === "repeater" ? "Relais-Sync läuft" : "APRS-Stream läuft", duration: 5000 });
      setTimeout(fetchData, 3000);
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setTriggeringBatch(null);
    }
  };

  const handleSaveSchedule = async (newConfig) => {
    setSaving(true);
    try {
      await base44.functions.invoke("manageSyncSchedule", { action: "saveSettings", ...newConfig });
      setConfig(newConfig);
      setShowScheduleEditor(false);
      toast({ title: "Schedule gespeichert", description: "Cron-Jobs werden beim nächsten Lauf übernommen", duration: 5000 });
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Computed stats ───
  const enabledCount = schedules.filter(s => s.weekly_enabled).length;
  const successCount = schedules.filter(s => s.last_status === "success").length;
  const failedCount = schedules.filter(s => s.last_status === "failed").length;
  const runningCount = schedules.filter(s => s.last_status === "running").length;
  const totalCount = schedules.length;

  // Group sources by sync type
  const fullBatchSources = schedules.filter(s => getMeta(s.source).syncType === "full_batch");
  const partialSources = schedules.filter(s => getMeta(s.source).syncType === "partial");
  const dailySources = schedules.filter(s => getMeta(s.source).syncType === "daily");

  // ─── Overview cards data ───
  const overviewCards = [
    {
      title: "Montag Voll-Batch",
      subtitle: `${config?.full_batch_time || "01:00"}–${config?.full_batch_end_time || "05:00"} UTC`,
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200 dark:border-blue-800/50",
      sources: fullBatchSources,
    },
    {
      title: "Donnerstag Teil-Sync",
      subtitle: `${config?.partial_sync_time || "03:00"}–${config?.partial_sync_end_time || "04:00"} UTC · Relais-Daten`,
      icon: Radio,
      color: "text-cyan-600",
      bg: "bg-cyan-50 dark:bg-cyan-900/20",
      border: "border-cyan-200 dark:border-cyan-800/50",
      sources: partialSources,
    },
    {
      title: "Täglich APRS-IS",
      subtitle: `${config?.aprs_stream_time || "06:30"} UTC · Stationäre APRS-Daten`,
      icon: Signal,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-200 dark:border-purple-800/50",
      sources: dailySources,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ─── Header with global toggle ─── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-slate-300" />
          <span className="text-sm font-bold text-gray-900 dark:text-slate-100">Aktualisierungsplan</span>
          <span className="text-[10px] text-gray-400 dark:text-slate-500">(Wochen-Sync)</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScheduleEditor(!showScheduleEditor)}
            className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
          >
            <Settings2 className="w-3 h-3" /> Schedule anpassen
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-[10px] text-blue-600 hover:underline disabled:opacity-40 flex items-center gap-1"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Aktualisieren
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-slate-400">Auto-Sync</span>
            <button
              onClick={handleToggleGlobal}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${globalAutoSync ? "bg-green-500" : "bg-gray-300 dark:bg-slate-600"}`}
              title={globalAutoSync ? "Alle Auto-Syncs aktiviert" : "Alle Auto-Syncs deaktiviert"}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${globalAutoSync ? "translate-x-5" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Summary bar ─── */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-gray-500 dark:text-slate-400 flex items-center gap-1">
            <Power className="w-3 h-3" />
            {enabledCount}/{totalCount} aktiv
          </span>
          <span className="text-green-600">{successCount} OK</span>
          {failedCount > 0 && <span className="text-red-600">{failedCount} Fehler</span>}
          {runningCount > 0 && <span className="text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{runningCount} läuft</span>}
        </div>
      )}

      {/* ─── Live status banner ─── */}
      {runningCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Sync läuft gerade</span>
          </div>
          <div className="space-y-1">
            {schedules.filter(s => s.last_status === "running").map(s => {
              const meta = getMeta(s.source);
              const Icon = meta.icon;
              return (
                <div key={s.id} className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <span className="font-medium">{s.label}</span>
                  {s.last_error && <span className="text-blue-500 truncate">— {s.last_error}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Overview cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {overviewCards.map(card => {
          const Icon = card.icon;
          const cardSuccess = card.sources.filter(s => s.last_status === "success").length;
          const cardFailed = card.sources.filter(s => s.last_status === "failed").length;
          const cardRunning = card.sources.filter(s => s.last_status === "running").length;
          const cardEnabled = card.sources.filter(s => s.weekly_enabled).length;
          return (
            <div key={card.title} className={`${card.bg} ${card.border} border rounded-xl p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${card.color}`} />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">{card.title}</h4>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400">{card.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-slate-400 flex-wrap">
                <span>{card.sources.length} Quellen</span>
                <span className="text-green-600">{cardSuccess} OK</span>
                {cardFailed > 0 && <span className="text-red-600">{cardFailed} Fehler</span>}
                {cardRunning > 0 && <span className="text-blue-600">{cardRunning} läuft</span>}
                <span className="text-gray-400">{cardEnabled} aktiv</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Schedule editor ─── Fix 3: Editor öffnet auch ohne config (mit Defaults) */}
      {showScheduleEditor && (
        <ScheduleEditor
          config={config || { full_batch_day: "Monday", full_batch_time: "01:00", full_batch_end_time: "05:00", partial_sync_day: "Thursday", partial_sync_time: "03:00", partial_sync_end_time: "04:00", aprs_stream_time: "06:30" }}
          onSave={handleSaveSchedule}
          saving={saving}
          onCancel={() => setShowScheduleEditor(false)}
        />
      )}

      {/* ─── Global manual trigger buttons ─── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
        <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" /> Manueller Sync
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => setConfirmBatch("full")}
            disabled={triggeringBatch !== null}
            className="px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {triggeringBatch === "full" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
            Voll-Sync (alle 34)
          </button>
          <button
            onClick={() => setConfirmBatch("repeater")}
            disabled={triggeringBatch !== null}
            className="px-3 py-2 text-xs font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {triggeringBatch === "repeater" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
            Relais-Sync
          </button>
          <button
            onClick={() => setConfirmBatch("aprs")}
            disabled={triggeringBatch !== null}
            className="px-3 py-2 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {triggeringBatch === "aprs" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Signal className="w-3.5 h-3.5" />}
            APRS-Stream
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2">
          Manuelles Anstossen funktioniert auch bei deaktiviertem Auto-Sync. Bestätigung erforderlich.
        </p>
      </div>

      {/* ─── Source detail table with per-source config ─── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-600 dark:text-slate-300" />
          <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100">Quellen-Konfiguration ({totalCount})</h4>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300 dark:text-slate-600" />
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500">
            Keine Quellen im Zeitplan — wird beim nächsten Orchestrator-Lauf erstellt
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {schedules.map(s => (
              <SourceConfigCard
                key={s.id}
                source={s.source}
                schedule={s}
                config={sourceConfig[s.source] || {}}
                onConfigChange={(src, newCfg) => {
                  setSourceConfig(prev => ({ ...prev, [src]: newCfg }));
                  setTimeout(fetchData, 3000);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Sync Log Viewer ─── */}
      <SyncLogViewer />

      {/* ─── Confirm batch dialog ─── */}
      {confirmBatch && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => triggeringBatch ? null : setConfirmBatch(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-slate-100">
              {confirmBatch === "full" ? "Voll-Sync starten?" : confirmBatch === "repeater" ? "Relais-Sync starten?" : "APRS-Stream starten?"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center mt-2">
              {confirmBatch === "full" ? "Alle 34 Quellen werden sequenziell synchronisiert. Dies kann mehrere Minuten dauern." : confirmBatch === "repeater" ? "Alle Relais-Regionen werden synchronisiert (~2-5 Min)." : "APRS-Stationen werden abgerufen (~1-2 Min)."}
            </p>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setConfirmBatch(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleTriggerBatch(confirmBatch)}
                disabled={triggeringBatch !== null}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {triggeringBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Starten
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 dark:text-slate-500">
        Der Wochen-Sync läuft automatisch: Montag 01:00–05:00 UTC (Voll-Batch, alle Quellen), Donnerstag 03:00 UTC (Relais-Daten), täglich 06:30 UTC (APRS-IS).
        Manuelles Anstossen bleibt auch bei deaktiviertem Auto-Sync möglich.
      </p>
    </div>
  );
}

// ─── Schedule Editor sub-component ───
function ScheduleEditor({ config, onSave, saving, onCancel }) {
  const [fullDay, setFullDay] = useState(config.full_batch_day || "Monday");
  const [fullTime, setFullTime] = useState(config.full_batch_time || "01:00");
  const [fullEnd, setFullEnd] = useState(config.full_batch_end_time || "05:00");
  const [partialDay, setPartialDay] = useState(config.partial_sync_day || "Thursday");
  const [partialTime, setPartialTime] = useState(config.partial_sync_time || "03:00");
  const [partialEnd, setPartialEnd] = useState(config.partial_sync_end_time || "04:00");
  const [aprsTime, setAprsTime] = useState(config.aprs_stream_time || "06:30");

  const handleSave = () => {
    onSave({
      full_batch_day: fullDay,
      full_batch_time: fullTime,
      full_batch_end_time: fullEnd,
      partial_sync_day: partialDay,
      partial_sync_time: partialTime,
      partial_sync_end_time: partialEnd,
      aprs_stream_time: aprsTime,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
      <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
        <Settings2 className="w-3.5 h-3.5 text-blue-600" /> Schedule anpassen
      </h4>
      <div className="space-y-3">
        {/* Full batch */}
        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-2">Montag Voll-Batch</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 dark:text-slate-400">Tag</label>
              <select value={fullDay} onChange={e => setFullDay(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
                {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 dark:text-slate-400">Start UTC</label>
              <input type="time" value={fullTime} onChange={e => setFullTime(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 dark:text-slate-400">Ende UTC</label>
              <input type="time" value={fullEnd} onChange={e => setFullEnd(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
            </div>
          </div>
        </div>

        {/* Partial sync */}
        <div className="p-2.5 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
          <p className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 mb-2">Donnerstag Teil-Sync (Relais)</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 dark:text-slate-400">Tag</label>
              <select value={partialDay} onChange={e => setPartialDay(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
                {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 dark:text-slate-400">Start UTC</label>
              <input type="time" value={partialTime} onChange={e => setPartialTime(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 dark:text-slate-400">Ende UTC</label>
              <input type="time" value={partialEnd} onChange={e => setPartialEnd(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
            </div>
          </div>
        </div>

        {/* APRS */}
        <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 mb-2">Täglich APRS-IS</p>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 dark:text-slate-400">Uhrzeit UTC</label>
              <input type="time" value={aprsTime} onChange={e => setAprsTime(e.target.value)} className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100" />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Speichern
          </button>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-slate-500">
          Hinweis: Die Cron-Jobs müssen separat in den Automatisierungen angepasst werden. Diese Einstellungen dienen als Referenz für die Admin-Anzeige.
        </p>
      </div>
    </div>
  );
}