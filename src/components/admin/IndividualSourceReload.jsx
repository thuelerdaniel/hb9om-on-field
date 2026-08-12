import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Database, Radio, Landmark, Lightbulb, Globe, Mountain, TreePine, Shield, Flower, Link2, Headphones, RadioTower, Signal, ChevronDown, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

// Lighthouse regions — individual buttons for sequential scraping.
const LIGHTHOUSE_REGION_SOURCES = [
  { id: 'eu_north', label: 'LH Nordeuropa' },
  { id: 'eu_central', label: 'LH Mitteleuropa' },
  { id: 'eu_south', label: 'LH Südeuropa' },
  { id: 'eu_east', label: 'LH Osteuropa' },
  { id: 'na_east', label: 'LH NA-Ost' },
  { id: 'na_west', label: 'LH NA-West' },
  { id: 'na_central', label: 'LH NA-Mitte' },
  { id: 'caribbean', label: 'LH Karibik' },
  { id: 'sa', label: 'LH Südamerika' },
  { id: 'africa', label: 'LH Afrika' },
  { id: 'meast', label: 'LH Naher Osten' },
  { id: 'sasia', label: 'LH Südasien' },
  { id: 'easia', label: 'LH Ostasien' },
  { id: 'seasia', label: 'LH Südostasien' },
  { id: 'oceania', label: 'LH Ozeanien' },
].map(r => ({
  key: `lighthouse_${r.id}`,
  label: r.label,
  icon: Lightbulb,
  color: "text-yellow-500",
  customFunction: "fetchLighthouses",
  customPayload: { region: r.id },
}));

// Repeater regions — individual buttons for sequential scraping.
const REPEATER_REGION_SOURCES = [
  { id: 'eu_priority1', label: 'Relais Europa (CH+Nachbarn)' },
  { id: 'eu_priority2', label: 'Relais Europa (Übrige)' },
  { id: 'uk', label: 'Relais UK' },
  { id: 'na_us', label: 'Relais USA' },
  { id: 'na_ca', label: 'Relais Kanada' },
  { id: 'world', label: 'Relais Weltweit' },
].map(r => ({
  key: `repeater_${r.id}`,
  label: r.label,
  icon: Radio,
  color: "text-cyan-500",
  customFunction: "fetchRepeaters",
  customPayload: { region: r.id },
}));

// Main sources (always visible, not collapsible)
const MAIN_SOURCES = [
  { key: "sota", label: "SOTA", icon: Mountain, color: "text-red-500" },
  { key: "pota", label: "POTA", icon: TreePine, color: "text-green-500" },
  { key: "hbff", label: "WWFF", icon: Flower, color: "text-purple-500" },
  { key: "wwbota", label: "WWBOTA", icon: Shield, color: "text-amber-700" },
  { key: "castle", label: "Burgen/Schlösser (Welt)", icon: Landmark, color: "text-orange-500" },
  { key: "lighthouse", label: "Leuchttürme (Alle)", icon: Lightbulb, color: "text-yellow-500", customFunction: "fetchLighthouses", customPayload: { region: "all" } },
  { key: "iota", label: "IOTA (Welt)", icon: Globe, color: "text-blue-500" },
  { key: "tota", label: "TOTA (Welt)", icon: RadioTower, color: "text-orange-500", customFunction: "fetchTota", customPayload: { action: "fetchWorldwide" } },
  { key: "repeater", label: "Relais (Alle)", icon: Radio, color: "text-cyan-500", customFunction: "fetchRepeaters", customPayload: { region: "all" } },
  { key: "aprs", label: "APRS.fi", icon: Signal, color: "text-purple-500", customFunction: "fetchAprsFi" },
  { key: "ch_repeater_links", label: "CH-Relais-Links", icon: Link2, color: "text-indigo-500", customFunction: "fetchCHRepeaterLinks" },
  { key: "fm_funknetz", label: "FM-Funknetz TGs", icon: Headphones, color: "text-green-500", customFunction: "fetchFmFunknetz" },
];

// Collapsible groups for regional sub-sources
const COLLAPSIBLE_GROUPS = [
  { title: "Leuchttürme (Regionen)", icon: Lightbulb, color: "text-yellow-500", sources: LIGHTHOUSE_REGION_SOURCES },
  { title: "Relais (Regionen)", icon: Radio, color: "text-cyan-500", sources: REPEATER_REGION_SOURCES },
];

export default function IndividualSourceReload() {
  const [loadingSource, setLoadingSource] = useState(null);
  const [results, setResults] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
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
    // Search in all source lists
    const allSources = [...MAIN_SOURCES, ...COLLAPSIBLE_GROUPS.flatMap(g => g.sources)];
    const source = allSources.find(s => s.key === sourceKey);
    setLoadingSource(sourceKey);
    const startTime = Date.now();
    try {
      const functionName = source?.customFunction || "refreshDataSource";
      const payload = source?.customFunction ? (source.customPayload || {}) : { source: sourceKey };
      const res = await base44.functions.invoke(functionName, payload);
      const data = res.data;
      const duration = Date.now() - startTime;

      const entry = {
        source: sourceKey,
        label: data.label || source?.label || sourceKey,
        status: data.status || (data.error ? "failed" : "success"),
        count: data.count ?? data.total_saved,
        withCoords: data.withCoords ?? data.with_coordinates,
        withoutCoords: data.withoutCoords,
        error: data.error,
        duration_ms: data.duration_ms || duration,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      setResults(prev => [entry, ...prev].slice(0, 20));

      if (entry.status === "success") {
        toast({
          title: `${entry.label} aktualisiert`,
          description: `${entry.count != null ? entry.count : '?'} Einträge · ${entry.withCoords != null ? entry.withCoords : '?'} geo · ${(entry.duration_ms / 1000).toFixed(1)}s`,
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

  const toggleGroup = useCallback((title) => {
    setExpandedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  }, []);

  const renderSourceButton = (src) => {
    const Icon = src.icon;
    const isLoading = loadingSource === src.key;
    return (
      <button
        key={src.key}
        onClick={() => handleReload(src.key)}
        disabled={loadingSource !== null}
        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors disabled:opacity-40 ${
          isLoading
            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 text-blue-600"
            : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100"
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
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" /> Einzelne Datenquelle neu laden
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Jede externe Datenquelle einzeln aktualisieren — Ergebnisse werden im Log angezeigt
          </p>
        </div>
        {results.length > 0 && (
          <button
            onClick={clearLog}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:text-slate-400"
          >
            Log leeren
          </button>
        )}
      </div>

      {/* Main sources grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        {MAIN_SOURCES.map(renderSourceButton)}
      </div>

      {/* Collapsible regional groups */}
      {COLLAPSIBLE_GROUPS.map(group => {
        const isExpanded = expandedGroups[group.title];
        const GroupIcon = group.icon;
        return (
          <div key={group.title} className="mb-2">
            <button
              onClick={() => toggleGroup(group.title)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900 rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <GroupIcon className={`w-3.5 h-3.5 ${group.color}`} />
              <span>{group.title}</span>
              <span className="text-[10px] text-gray-400 ml-1">({group.sources.length})</span>
            </button>
            {isExpanded && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5 pl-6">
                {group.sources.map(renderSourceButton)}
              </div>
            )}
          </div>
        );
      })}

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto mt-3">
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                r.status === "success" ? "bg-green-50 dark:bg-green-900/20 border border-green-100" : "bg-red-50 dark:bg-red-900/20 border border-red-100"
              }`}
            >
              {r.status === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              )}
              <span className="font-semibold text-gray-900 dark:text-slate-100 min-w-[80px]">{r.label}</span>
              {r.status === "success" ? (
                <span className="text-gray-600 dark:text-slate-400">
                  {r.count != null ? `${r.count} Einträge` : ''}
                  {r.withCoords != null ? ` · ${r.withCoords} geo` : ''}
                  {r.withoutCoords != null ? ` · ${r.withoutCoords} offen` : ''}
                </span>
              ) : (
                <span className="text-red-600 truncate">{r.error}</span>
              )}
              <span className="ml-auto flex items-center gap-2 text-gray-400 dark:text-slate-500 flex-shrink-0">
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