import React, { useState } from "react";
import {
  Play, Loader2, CheckCircle2, XCircle, AlertCircle, Clock, Power,
  RefreshCw, ChevronDown, ChevronRight, Zap, Calendar, Repeat, Cpu,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-600", label: "Erfolg" },
  error: { icon: XCircle, color: "text-red-600", label: "Fehler" },
  timeout: { icon: Clock, color: "text-red-500", label: "Timeout" },
  partial: { icon: AlertCircle, color: "text-amber-600", label: "Teilweise" },
};

const MODE_LABELS = { daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich" };

function formatTime(isoStr) {
  if (!isoStr) return "—";
  try {
    return new Date(isoStr).toLocaleString("de-CH", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

export default function SourceConfigCard({ source, schedule, config, onConfigChange }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);
  const { toast } = useToast();

  const status = STATUS_CONFIG[localConfig.last_result] || null;
  const isAuto = !localConfig.admin_override;
  const firstLoadDone = localConfig.first_full_load_done;

  const updateField = (field, value) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageSyncSchedule", {
        action: "updateSourceConfig",
        source,
        config: {
          schedule_mode: localConfig.schedule_mode,
          incremental: localConfig.incremental,
          repeat_enabled: localConfig.repeat_interval_minutes > 0,
          repeat_interval_minutes: localConfig.repeat_interval_minutes,
          enabled: localConfig.enabled,
          auto_incremental_after_full: localConfig.auto_incremental_after_full,
        },
      });
      const newCfg = res.data?.config || res.config;
      setLocalConfig(newCfg);
      onConfigChange?.(source, newCfg);
      toast({ title: "Gespeichert", description: `${schedule?.label || source} konfiguriert`, duration: 3000 });
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAuto = async () => {
    setSaving(true);
    try {
      const newAutoVal = !isAuto;
      const res = await base44.functions.invoke("manageSyncSchedule", {
        action: "toggleAutoMode",
        source,
        enabled: newAutoVal,
      });
      const updated = { ...localConfig, admin_override: res.data?.admin_override ?? !newAutoVal };
      setLocalConfig(updated);
      onConfigChange?.(source, updated);
      toast({
        title: newAutoVal ? "Auto-Modus aktiviert" : "Manuell-Modus aktiviert",
        description: newAutoVal ? "System verwaltet diese Quelle automatisch" : "Admin-Override aktiv",
        duration: 3000,
      });
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await base44.functions.invoke("manageSyncSchedule", {
        action: "triggerSource",
        source,
      });
      const data = res.data || res;
      const count = data?.count ?? data?.total_saved ?? data?.result?.count ?? 0;
      toast({ title: `${schedule?.label || source} gestartet`, description: `${count} Einträge verarbeitet`, duration: 5000 });
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className={`px-3 py-2.5 border-b border-gray-100 dark:border-slate-700 ${
      localConfig.last_result === "error" ? "bg-red-50/30 dark:bg-red-900/10" : ""
    }`}>
      {/* Row 1: name + status + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 flex-shrink-0"
          >
            {expanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
          </button>
          <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate">
            {schedule?.label || source}
          </span>
          {status && (
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${status.color}`}>
              <status.icon className="w-3 h-3" />
              {status.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Auto/Manual badge */}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
            isAuto
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          }`}>
            {isAuto ? "Auto" : "Manuell"}
          </span>
          {/* Enabled toggle */}
          <button
            onClick={() => updateField("enabled", !localConfig.enabled)}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              localConfig.enabled ? "bg-green-500" : "bg-gray-300 dark:bg-slate-600"
            }`}
            title={localConfig.enabled ? "Aktiviert" : "Deaktiviert"}
          >
            <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
              localConfig.enabled ? "translate-x-4" : ""
            }`} />
          </button>
          {/* Manual trigger */}
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-40"
            title="Jetzt starten"
          >
            {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Row 2: summary details */}
      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 dark:text-slate-500 flex-wrap ml-4">
        <span className="text-gray-500 dark:text-slate-400">{MODE_LABELS[localConfig.schedule_mode] || localConfig.schedule_mode}</span>
        <span>{localConfig.incremental ? "Inkrementell" : "Voll"}</span>
        {localConfig.repeat_interval_minutes > 0 && (
          <span className="flex items-center gap-0.5">
            <Repeat className="w-2.5 h-2.5" /> alle {localConfig.repeat_interval_minutes}min
          </span>
        )}
        {firstLoadDone && (
          <span className="text-green-600 flex items-center gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" /> 1x komplett
          </span>
        )}
        {localConfig.last_run && <span>Letzte: {formatTime(localConfig.last_run)}</span>}
        {localConfig.last_records > 0 && <span>{localConfig.last_records.toLocaleString("de-CH")} Sätze</span>}
        {localConfig.last_duration_seconds > 0 && <span>{localConfig.last_duration_seconds}s</span>}
        {localConfig.next_run && (
          <span className="text-blue-500">Nächste: {formatTime(localConfig.next_run)}</span>
        )}
        {!localConfig.enabled && <span className="text-red-500">deaktiviert</span>}
      </div>

      {/* Row 3: error display */}
      {localConfig.last_error && (
        <div className="mt-1 ml-4 text-[10px] text-red-600 dark:text-red-400 truncate" title={localConfig.last_error}>
          ⚠ {localConfig.last_error}
        </div>
      )}

      {/* Expanded config editor */}
      {expanded && (
        <div className="mt-2 ml-4 p-2.5 bg-gray-50 dark:bg-slate-900 rounded-lg space-y-2.5">
          {/* Auto mode toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-medium text-gray-700 dark:text-slate-300">Auto-Modus</span>
            </div>
            <button
              onClick={handleToggleAuto}
              disabled={saving}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                isAuto ? "bg-blue-500" : "bg-gray-300 dark:bg-slate-600"
              } ${saving ? "opacity-40" : ""}`}
              title={isAuto ? "System verwaltet automatisch" : "Manuell konfiguriert"}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                isAuto ? "translate-x-5" : ""
              }`} />
            </button>
          </div>
          <p className="text-[9px] text-gray-400 dark:text-slate-500">
            {isAuto
              ? "System verwaltet — nach erstem Full-Load automatisch auf inkrementell/woechentlich umgestellt"
              : "Manuell konfiguriert durch Admin — Auto-Logik deaktiviert"}
          </p>

          {/* Schedule mode */}
          <div className={isAuto ? "opacity-50 pointer-events-none" : ""}>
            <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-1">Schedule-Mode</label>
            <select
              value={localConfig.schedule_mode}
              onChange={e => updateField("schedule_mode", e.target.value)}
              className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
            >
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
            </select>
          </div>

          {/* Incremental toggle */}
          <div className={`flex items-center justify-between ${isAuto ? "opacity-50 pointer-events-none" : ""}`}>
            <label className="text-[10px] text-gray-500 dark:text-slate-400">Inkrementell (nur Deltas)</label>
            <button
              onClick={() => updateField("incremental", !localConfig.incremental)}
              className={`relative w-8 h-4 rounded-full transition-colors ${
                localConfig.incremental ? "bg-green-500" : "bg-gray-300 dark:bg-slate-600"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                localConfig.incremental ? "translate-x-4" : ""
              }`} />
            </button>
          </div>

          {/* Repeat interval */}
          <div className={isAuto ? "opacity-50 pointer-events-none" : ""}>
            <label className="block text-[10px] text-gray-500 dark:text-slate-400 mb-1">
              Wiederholungs-Intervall (Minuten)
            </label>
            <input
              type="number"
              min="0"
              value={localConfig.repeat_interval_minutes || ""}
              onChange={e => updateField("repeat_interval_minutes", parseInt(e.target.value) || 0)}
              placeholder="0 = nur 1x pro Zyklus"
              className="w-full text-xs px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
            />
            <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">
              {localConfig.repeat_interval_minutes > 0
                ? `Sync wird alle ${localConfig.repeat_interval_minutes} Min wiederholt (übersteuert Schedule-mode)`
                : "Leer = Sync läuft nur 1x pro Zyklus"}
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || isAuto}
            className="w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Speichern
          </button>
          {isAuto && (
            <p className="text-[9px] text-gray-400 dark:text-slate-500 text-center">
              Auto-Modus aktiv — zum Bearbeiten zuerst auf Manuell umschalten
            </p>
          )}
        </div>
      )}
    </div>
  );
}