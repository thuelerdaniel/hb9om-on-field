import React, { useState, useEffect, useCallback } from "react";
import {
  Clock, Loader2, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight,
  Filter, RotateCw,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: "text-green-500", label: "Erfolg" },
  partial: { icon: AlertCircle, color: "text-amber-500", label: "Teilweise" },
  failed:  { icon: XCircle, color: "text-red-500", label: "Fehler" },
};

function formatDuration(ms) {
  if (!ms || ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

export default function SyncLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expanded, setExpanded] = useState(new Set());

  const fetchLogs = useCallback(async () => {
    try {
      const data = await base44.entities.SyncLog.list("-created_date", 50);
      setLogs(data || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Collect all unique source names from log results for filter
  const allSources = new Set();
  logs.forEach(log => {
    (log.results || []).forEach(r => {
      if (r.source || r.type) allSources.add(r.source || r.type);
    });
  });
  const sourceOptions = Array.from(allSources).sort();

  // Apply filters
  const filtered = logs.filter(log => {
    if (filterStatus && log.overall_status !== filterStatus) return false;
    if (filterSource) {
      const hasSource = (log.results || []).some(r => (r.source || r.type) === filterSource);
      if (!hasSource) return false;
    }
    return true;
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-600 dark:text-slate-300" />
          <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100">Sync-Protokoll</h4>
          <span className="text-[10px] text-gray-400 dark:text-slate-500">(letzte 50)</span>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="text-[10px] text-blue-600 hover:underline disabled:opacity-40 flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
          Aktualisieren
        </button>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2 flex-wrap">
        <Filter className="w-3 h-3 text-gray-400" />
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="text-[10px] px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
        >
          <option value="">Alle Quellen</option>
          {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-[10px] px-2 py-1 border border-gray-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
        >
          <option value="">Alle Status</option>
          <option value="success">Erfolg</option>
          <option value="partial">Teilweise</option>
          <option value="failed">Fehler</option>
        </select>
        {(filterSource || filterStatus) && (
          <button
            onClick={() => { setFilterSource(""); setFilterStatus(""); }}
            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300 dark:text-slate-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-400 dark:text-slate-500">
          {logs.length === 0 ? "Noch keine Sync-Protokolle vorhanden" : "Keine Einträge mit diesem Filter"}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
          {filtered.map(log => {
            const isExpanded = expanded.has(log.id);
            const statusConf = STATUS_CONFIG[log.overall_status] || STATUS_CONFIG.failed;
            const StatusIcon = statusConf.icon;
            const results = log.results || [];
            const successCount = results.filter(r => r.status === "success").length;
            const failedCount = results.filter(r => r.status === "failed" || r.status === "timeout").length;
            const totalRecords = results.reduce((sum, r) => sum + (r.count || 0), 0);

            return (
              <div key={log.id} className="px-3 py-2">
                {/* Summary row */}
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="w-full flex items-center justify-between gap-2 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                    <StatusIcon className={`w-3.5 h-3.5 ${statusConf.color} flex-shrink-0`} />
                    <span className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">
                      {new Date(log.created_date).toLocaleString("de-CH")}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 hidden sm:inline">
                      {log.trigger === "manual" ? "Manuell" : "Automatisch"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">
                    <span>{results.length} Quellen</span>
                    <span className="text-green-600">{successCount} OK</span>
                    {failedCount > 0 && <span className="text-red-600">{failedCount} Fehler</span>}
                    <span>{formatDuration(log.total_duration_ms)}</span>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-2 ml-5 space-y-1">
                    {totalRecords > 0 && (
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        Gesamtdatensätze: {totalRecords.toLocaleString("de-CH")}
                      </p>
                    )}
                    {results.map((r, i) => {
                      const RIcon = r.status === "success" ? CheckCircle2 : r.status === "partial" ? AlertCircle : XCircle;
                      const rColor = r.status === "success" ? "text-green-500" : r.status === "partial" ? "text-amber-500" : "text-red-500";
                      return (
                        <div key={i} className="flex items-start gap-2 text-[10px] py-0.5">
                          <RIcon className={`w-3 h-3 ${rColor} flex-shrink-0 mt-0.5`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-gray-700 dark:text-slate-300 font-medium">{r.label || r.source || r.type}</span>
                            {r.count != null && <span className="text-gray-400 dark:text-slate-500 ml-1">· {r.count} Einträge</span>}
                            {r.duration_ms > 0 && <span className="text-gray-400 dark:text-slate-500 ml-1">· {formatDuration(r.duration_ms)}</span>}
                            {r.error && <span className="text-red-500 ml-1">· {r.error}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}