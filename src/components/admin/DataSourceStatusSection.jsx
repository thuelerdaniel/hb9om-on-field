import React, { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff, Database, Radio, Clock, Cloud, Layers } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Admin Datenquellen-Status — zeigt ALLE Datenquellen der App:
// 1. Referenz-Daten (DailyRefreshSchedule): SOTA, POTA, WWFF, IOTA, Burgen, Leuchttürme, Relais, APRS, TOTA, etc.
// 2. Live-Spots & Propagation (DataSourceStatus): Spothole, DX-Cluster, GMA, etc.

function StatusBadge({ status }) {
  const config = {
    OK: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    CONNECTED: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Wifi },
    FAIL: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    WARN: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertCircle },
    DISCONNECTED: { color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: WifiOff },
  };
  const c = config[status] || config.DISCONNECTED;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.color}`}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
}

// Map DailyRefreshSchedule.last_status → badge status
function scheduleStatusToBadge(lastStatus, weeklyEnabled) {
  if (lastStatus === 'success') return 'OK';
  if (lastStatus === 'failed') return 'FAIL';
  if (lastStatus === 'timeout') return 'WARN';
  if (lastStatus === 'running') return 'CONNECTED';
  if (!weeklyEnabled) return 'DISCONNECTED';
  return 'DISCONNECTED';
}

function SourceTypeIcon({ type }) {
  if (type === 'API') return <Radio className="w-3.5 h-3.5 text-blue-500" />;
  if (type === 'DXCLUSTER') return <Wifi className="w-3.5 h-3.5 text-cyan-500" />;
  return <Database className="w-3.5 h-3.5 text-gray-500" />;
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `vor ${diff}s`;
    if (diff < 3600) return `vor ${Math.round(diff / 60)}min`;
    if (diff < 86400) return `vor ${Math.round(diff / 3600)}h`;
    return d.toLocaleDateString('de-CH');
  } catch { return '—'; }
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function DataSourceStatusSection() {
  const [schedules, setSchedules] = useState([]);
  const [liveSources, setLiveSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingSource, setRefreshingSource] = useState(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [sched, live] = await Promise.all([
        base44.entities.DailyRefreshSchedule.list('display_order', 100),
        base44.entities.DataSourceStatus.list('-last_check', 100),
      ]);
      setSchedules(sched || []);
      setLiveSources(live || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('refreshHuntingData', {});
      setTimeout(() => loadStatus(), 2000);
    } catch {} finally { setRefreshing(false); }
  };

  // Mapping: Source-Name → Backend-Funktion für manuelle Abfrage
  const getFunctionForSource = (sourceName) => {
    const name = (sourceName || '').toLowerCase();
    if (name.includes('spothole')) return 'fetchSpotholeSpots';
    if (name.includes('gma')) return 'fetchGmaSpots';
    if (name.includes('dx') || name.includes('cluster')) return 'fetchDxSpots';
    return null;
  };

  // Manuelle Abfrage für eine einzelne Live-Quelle (DX-Cluster, Spothole, GMA)
  const handleManualQuery = async (sourceName) => {
    const fnName = getFunctionForSource(sourceName);
    if (!fnName) return;
    setRefreshingSource(sourceName);
    try {
      await base44.functions.invoke(fnName, {});
      await loadStatus();
    } catch {} finally { setRefreshingSource(null); }
  };

  // Combined stats
  const allSchedStatuses = schedules.map(s => scheduleStatusToBadge(s.last_status, s.weekly_enabled));
  const allLiveStatuses = liveSources.map(s => s.status);
  const allStatuses = [...allSchedStatuses, ...allLiveStatuses];
  const okCount = allStatuses.filter(s => s === 'OK' || s === 'CONNECTED').length;
  const failCount = allStatuses.filter(s => s === 'FAIL').length;
  const warnCount = allStatuses.filter(s => s === 'WARN').length;
  const totalSources = allStatuses.length;

  return (
    <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
          <Database className="w-4 h-4" /> Datenquellen-Status
          <span className="text-[10px] font-normal text-gray-400">({totalSources} Quellen)</span>
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1.5"
        >
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Live-Spots aktualisieren
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{okCount}</div>
          <div className="text-[10px] text-gray-500">OK</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{warnCount}</div>
          <div className="text-[10px] text-gray-500">Warn</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{failCount}</div>
          <div className="text-[10px] text-gray-500">Fail</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-gray-500 dark:text-gray-400">{totalSources - okCount - warnCount - failCount}</div>
          <div className="text-[10px] text-gray-500">Inaktiv</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Lade Status…</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Section 1: Referenz-Daten (DailyRefreshSchedule) */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700 dark:text-slate-200">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Referenz-Daten ({schedules.length})
            </div>
            {schedules.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Keine Referenz-Quellen konfiguriert.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-gray-500">
                      <th className="py-1.5 pr-2 whitespace-nowrap">Quelle</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap">Status</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap text-right">Einträge</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap text-right">Dauer</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap">Letzte Ausführung</th>
                      <th className="py-1.5 whitespace-nowrap">Fehler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map(s => {
                      const badge = scheduleStatusToBadge(s.last_status, s.weekly_enabled);
                      return (
                        <tr key={s.id} className="border-b border-gray-100 dark:border-slate-700/50">
                          <td className="py-1.5 pr-2">
                            <div className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-1">
                              {s.label || s.source}
                              {!s.weekly_enabled && (
                                <span className="text-[9px] text-gray-400 bg-gray-100 dark:bg-slate-700 px-1 rounded">inaktiv</span>
                              )}
                            </div>
                            <div className="text-[9px] text-gray-400">{s.source}</div>
                          </td>
                          <td className="py-1.5 pr-2"><StatusBadge status={badge} /></td>
                          <td className="py-1.5 pr-2 text-right font-mono text-gray-700 dark:text-slate-200">
                            {s.last_count != null ? s.last_count.toLocaleString('de-CH') : '—'}
                          </td>
                          <td className="py-1.5 pr-2 text-right font-mono text-gray-500 text-[10px]">
                            {formatDuration(s.last_duration_ms)}
                          </td>
                          <td className="py-1.5 pr-2 text-gray-500 whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatTime(s.last_run_time)}
                            </span>
                          </td>
                          <td className="py-1.5 text-red-500 text-[10px] max-w-[150px] truncate" title={s.last_error || ''}>
                            {s.last_error || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Live-Spots & Propagation (DataSourceStatus) */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700 dark:text-slate-200">
              <Cloud className="w-3.5 h-3.5 text-cyan-500" />
              Live-Spots &amp; Propagation ({liveSources.length})
            </div>
            {liveSources.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                Noch keine Live-Quellen-Status verfügbar. Klicken Sie auf "Live-Spots aktualisieren".
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 text-left text-gray-500">
                      <th className="py-1.5 pr-2 whitespace-nowrap">Quelle</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap">Typ</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap">Status</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap text-right">Spots</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap">Letzte Prüfung</th>
                      <th className="py-1.5 pr-2 whitespace-nowrap">Fehler</th>
                      <th className="py-1.5 whitespace-nowrap text-right">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveSources.map(s => (
                      <tr key={s.id} className="border-b border-gray-100 dark:border-slate-700/50">
                        <td className="py-1.5 pr-2">
                          <div className="font-medium text-gray-900 dark:text-slate-100">{s.source_name}</div>
                          {s.url && <div className="text-[9px] text-gray-400 truncate max-w-[150px]">{s.url}</div>}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className="flex items-center gap-1 text-gray-600 dark:text-slate-300">
                            <SourceTypeIcon type={s.source_type} />
                            <span className="text-[10px]">{s.source_type}</span>
                          </span>
                        </td>
                        <td className="py-1.5 pr-2"><StatusBadge status={s.status} /></td>
                        <td className="py-1.5 pr-2 text-right font-mono text-gray-700 dark:text-slate-200">{s.spots_received || 0}</td>
                        <td className="py-1.5 pr-2 text-gray-500 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatTime(s.last_check)}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-red-500 text-[10px] max-w-[120px] truncate" title={s.error_message || ''}>
                          {s.error_message || '—'}
                        </td>
                        <td className="py-1.5 text-right">
                          {getFunctionForSource(s.source_name) && (
                            <button
                              onClick={() => handleManualQuery(s.source_name)}
                              disabled={refreshingSource === s.source_name}
                              title={`Manuelle Abfrage — ${s.source_name} neu laden`}
                              className="px-2 py-1 text-[10px] font-medium text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-700/50 rounded-md hover:bg-cyan-50 dark:hover:bg-cyan-900/20 disabled:opacity-40 inline-flex items-center gap-1"
                            >
                              {refreshingSource === s.source_name
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <RefreshCw className="w-3 h-3" />}
                              Abfragen
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}