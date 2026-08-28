import React, { useState, useEffect } from "react";
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, Wifi, WifiOff, Database, Radio } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Admin Datenquellen-Status — zeigt den Verbindungsstatus aller Datenquellen.
// Quelle: DataSourceStatus Entity (nur Admins).

function StatusBadge({ status }) {
  const config = {
    OK: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    CONNECTED: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Wifi },
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

export default function DataSourceStatusSection() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.DataSourceStatus.list('-last_check', 100);
      setSources(data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('refreshHuntingData', {});
      setTimeout(() => loadStatus(), 2000);
    } catch {} finally { setRefreshing(false); }
  };

  const okCount = sources.filter(s => s.status === 'OK' || s.status === 'CONNECTED').length;
  const failCount = sources.filter(s => s.status === 'FAIL').length;
  const warnCount = sources.filter(s => s.status === 'WARN').length;

  return (
    <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
          <Database className="w-4 h-4" /> Datenquellen-Status
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1.5"
        >
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Alle aktualisieren
        </button>
      </div>

      {/* Summary */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">{okCount}</div>
          <div className="text-[10px] text-gray-500">OK</div>
        </div>
        <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{warnCount}</div>
          <div className="text-[10px] text-gray-500">Warn</div>
        </div>
        <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-red-600 dark:text-red-400">{failCount}</div>
          <div className="text-[10px] text-gray-500">Fail</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Lade Status…</span>
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-400">
          Noch keine Datenquellen-Status verfügbar. Klicken Sie auf "Alle aktualisieren".
        </div>
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
                <th className="py-1.5 whitespace-nowrap">Fehler</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => (
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
                  <td className="py-1.5 pr-2 text-gray-500 whitespace-nowrap">{formatTime(s.last_check)}</td>
                  <td className="py-1.5 text-red-500 text-[10px] max-w-[120px] truncate" title={s.error_message || ''}>
                    {s.error_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}