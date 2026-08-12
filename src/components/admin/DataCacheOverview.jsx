import React, { useState, useEffect } from "react";
import { Database, MapPin, AlertCircle, RefreshCw, Loader2, RadioTower, Signal, Link2, Mountain, Trees, Building, Castle, Anchor, Diamond, RadioTower as Tower } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Unified data cache overview for the admin panel.
// Shows ALL map layers with their actual server-side record counts,
// coordinate coverage, and staleness — with traffic-light status per layer.
//
// Data sources:
// - cacheStatus (ReferenceData entity): sota, pota, hbff, wwbota, castle, lighthouse, iota
// - coverageProgress (calculateRepeaterCoverage function): repeater stats
// - aprsCache (PrivateNode entity): APRS node stats
// - Direct fetches: TotaPoint count, RepeaterLink count

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const REFERENCE_LAYERS = [
  { key: "sota", label: "SOTA", icon: Mountain, color: "text-red-500" },
  { key: "pota", label: "POTA", icon: Trees, color: "text-green-500" },
  { key: "hbff", label: "HBFF", icon: Trees, color: "text-purple-500" },
  { key: "wwbota", label: "WWBOTA", icon: Building, color: "text-amber-700" },
  { key: "castle", label: "Burgen", icon: Castle, color: "text-orange-500" },
  { key: "lighthouse", label: "Leuchttürme", icon: Anchor, color: "text-yellow-600" },
  { key: "iota", label: "IOTA", icon: Diamond, color: "text-blue-500" },
];

// Compute traffic-light status for a single layer entry.
// Returns: "ok" | "warning" | "error"
// withCoords=null means coordinates aren't stored in this format (skip coord check)
function computeLayerStatus(count, withCoords, total, lastUpdated, isCritical) {
  if (!count || count === 0) {
    return isCritical ? "error" : "warning";
  }
  const isStale = lastUpdated && (Date.now() - lastUpdated.getTime()) > STALE_THRESHOLD_MS;
  if (isStale && isCritical) return "warning";
  // Only check coordinate coverage when withCoords is a real number (not null)
  if (withCoords != null && total > 0) {
    const coordPct = (withCoords / total) * 100;
    if (coordPct < 50) return "warning";
  }
  return "ok";
}

function LayerCard({ label, icon: Icon, color, count, withCoords, total, lastUpdated, status, source }) {
  const isStale = lastUpdated && (Date.now() - lastUpdated.getTime()) > STALE_THRESHOLD_MS;
  const withoutCoords = (total || count) - (withCoords || 0);

  return (
    <div className={`rounded-lg border p-3 ${
      status === "ok" ? "border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-900/10" :
      status === "warning" ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/10" :
      status === "error" ? "border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/10" :
      "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800"
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`w-3.5 h-3.5 ${color} flex-shrink-0`} />
          <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate">{label}</span>
        </div>
        <span className="text-lg font-bold text-gray-900 dark:text-slate-100 flex-shrink-0">
          {count != null ? count.toLocaleString("de-CH") : "—"}
        </span>
      </div>
      {withCoords != null && (total || count) > 0 && (
        <div className="flex items-center gap-2 mt-1 text-[10px]">
          <span className="text-green-600 flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5" /> {withCoords.toLocaleString("de-CH")} geo
          </span>
          {withoutCoords > 0 && (
            <span className="text-amber-600 flex items-center gap-0.5">
              <AlertCircle className="w-2.5 h-2.5" /> {withoutCoords.toLocaleString("de-CH")} offen
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-1">
        <p className={`text-[10px] truncate ${isStale ? "text-amber-600 font-medium" : "text-gray-400 dark:text-slate-500"}`}>
          {lastUpdated ? lastUpdated.toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Nie"}
          {isStale ? " ⚠" : ""}
        </p>
        {source && (
          <p className="text-[9px] text-gray-300 dark:text-slate-600 truncate ml-1" title={source}>·</p>
        )}
      </div>
    </div>
  );
}

export default function DataCacheOverview({ cacheStatus, coverageProgress, aprsCache, onRefresh }) {
  const [extraCounts, setExtraCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExtraCounts = async () => {
    try {
      // Fetch direct entity counts for layers that don't have ReferenceData entries.
      // All these entities have public read access (read: true), so base44.entities works.
      const [totaPoints, approvedLinks, repeaters, privateNodes] = await Promise.all([
        base44.entities.TotaPoint.list("-created_date", 10000),
        base44.entities.RepeaterLink.filter({ status: "approved" }),
        base44.entities.Repeater.list("-created_date", 5000),
        base44.entities.PrivateNode.list("-created_date", 5000),
      ]);
      setExtraCounts({
        tota: totaPoints?.length || 0,
        repeaterLinks: approvedLinks?.length || 0,
        repeaters: repeaters?.length || 0,
        privateNodes: privateNodes?.length || 0,
      });
    } catch (e) {
      setExtraCounts({ tota: 0, repeaterLinks: 0, repeaters: 0, privateNodes: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtraCounts();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchExtraCounts();
      if (onRefresh) onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Build reference layer data from cacheStatus
  const refDataMap = {};
  for (const entry of cacheStatus || []) {
    refDataMap[entry.type] = entry;
  }

  // Build repeater data from coverageProgress
  const repData = coverageProgress?.global || null;
  // Direct counts from entity queries (more reliable than coverageProgress which may not have loaded)
  const repeaterCount = extraCounts?.repeaters ?? repData?.totalRepeaters ?? 0;
  const aprsCount = extraCounts?.privateNodes ?? aprsCache?.total ?? 0;

  // Compute overall status
  const allStatuses = [];
  for (const layer of REFERENCE_LAYERS) {
    const entry = refDataMap[layer.key];
    const refs = entry?.references || [];
    const total = entry?.total_count || refs.length;
    const hasCoordFields = refs.length > 0 && refs.some(r => r.lat != null || r.lng != null);
    const withCoords = hasCoordFields ? refs.filter(r => r.lat && r.lng).length : null;
    const lastUpdated = entry?.last_updated ? new Date(entry.last_updated) : null;
    const isCritical = ["sota", "pota", "castle"].includes(layer.key);
    allStatuses.push(computeLayerStatus(total, withCoords, total, lastUpdated, isCritical));
  }
  // Repeater status
  allStatuses.push(computeLayerStatus(repeaterCount, repData?.withCoords, repeaterCount, null, true));
  // APRS status
  allStatuses.push(computeLayerStatus(aprsCount, null, null, null, false));
  // TOTA status
  allStatuses.push(computeLayerStatus(extraCounts?.tota, null, null, null, false));
  // Repeater links
  allStatuses.push(computeLayerStatus(extraCounts?.repeaterLinks, null, null, null, false));

  const hasError = allStatuses.includes("error");
  const hasWarning = allStatuses.includes("warning");
  const overallStatus = hasError ? "error" : hasWarning ? "warning" : "ok";
  const overallLabel = hasError ? "Aktion nötig" : hasWarning ? "Prüfen" : "Alle OK";

  return (
    <div className="space-y-3">
      {/* Header with refresh + overall status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-600 dark:text-slate-300" />
          <span className="text-sm font-bold text-gray-900 dark:text-slate-100">Daten-Cache Übersicht</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            overallStatus === "ok" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
            overallStatus === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {overallLabel}
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="text-[10px] text-blue-600 hover:underline disabled:opacity-40 flex items-center gap-1"
        >
          {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {refreshing ? "Aktualisiert..." : "Aktualisieren"}
        </button>
      </div>

      {/* Reference layers grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {REFERENCE_LAYERS.map(layer => {
          const entry = refDataMap[layer.key];
          const refs = entry?.references || [];
          const total = entry?.total_count || refs.length;
          // ReferenceData.references array may not contain lat/lng (coords are in
          // individual point entities like SotaPoint, PotaPoint). Only show geo/offen
          // when the references actually contain coordinate fields.
          const hasCoordFields = refs.length > 0 && refs.some(r => r.lat != null || r.lng != null);
          const withCoords = hasCoordFields ? refs.filter(r => r.lat && r.lng).length : null;
          const lastUpdated = entry?.last_updated ? new Date(entry.last_updated) : null;
          const isCritical = ["sota", "pota", "castle"].includes(layer.key);
          const status = computeLayerStatus(total, withCoords, total, lastUpdated, isCritical);
          return (
            <LayerCard
              key={layer.key}
              label={layer.label}
              icon={layer.icon}
              color={layer.color}
              count={total}
              withCoords={withCoords}
              total={total}
              lastUpdated={lastUpdated}
              status={status}
              source={entry?.source}
            />
          );
        })}

        {/* Repeater layer */}
        <LayerCard
          label="Relais"
          icon={RadioTower}
          color="text-blue-500"
          count={repeaterCount}
          withCoords={repData?.withCoords || 0}
          total={repeaterCount}
          lastUpdated={null}
          status={computeLayerStatus(repeaterCount, repData?.withCoords, repeaterCount, null, true)}
          source="RepeaterBook + WIA + dstarusers"
        />

        {/* APRS layer */}
        <LayerCard
          label="APRS-Nodes"
          icon={Signal}
          color="text-purple-500"
          count={aprsCount}
          withCoords={null}
          total={null}
          lastUpdated={null}
          status={computeLayerStatus(aprsCount, null, null, null, false)}
          source="APRS.fi + BrandMeister"
        />

        {/* TOTA layer */}
        <LayerCard
          label="TOTA"
          icon={Tower}
          color="text-orange-500"
          count={extraCounts?.tota || 0}
          withCoords={null}
          total={null}
          lastUpdated={null}
          status={computeLayerStatus(extraCounts?.tota, null, null, null, false)}
          source="wwtota.com + Swiss CSV"
        />

        {/* Repeater Links */}
        <LayerCard
          label="Relais-Verlinkungen"
          icon={Link2}
          color="text-teal-500"
          count={extraCounts?.repeaterLinks || 0}
          withCoords={null}
          total={null}
          lastUpdated={null}
          status={computeLayerStatus(extraCounts?.repeaterLinks, null, null, null, false)}
          source="RepeaterBook + USKA + Admin"
        />
      </div>

      {/* Repeater coverage summary (compact) */}
      {repData && (
        <div className="p-3 bg-blue-50/30 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800/50">
          <div className="flex items-center gap-2 mb-2">
            <RadioTower className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">Relais-Abdeckung</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-sm font-bold text-green-600">{repData.aprsRefined || 0}</div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">APRS-verfeinert</div>
            </div>
            <div>
              <div className="text-sm font-bold text-teal-600">{repData.terrainAdjusted || 0}</div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">Gelände-adj.</div>
            </div>
            <div>
              <div className={`text-sm font-bold ${
                repData.avgRefinementPct >= 60 ? "text-green-600" :
                repData.avgRefinementPct >= 30 ? "text-amber-600" : "text-gray-400 dark:text-slate-500"
              }`}>{repData.avgRefinementPct}%</div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">Ø Verfeinerung</div>
            </div>
            <div>
              <div className="text-sm font-bold text-amber-600">{coverageProgress?.pendingRecalc || 0}</div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">Neuberechnung offen</div>
            </div>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full ${
                repData.avgRefinementPct >= 60 ? "bg-green-500" :
                repData.avgRefinementPct >= 30 ? "bg-amber-500" : "bg-gray-400"
              }`}
              style={{ width: `${repData.avgRefinementPct}%` }}
            />
          </div>
          <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">
            {repData.countriesCovered || 0} Länder · {repData.calculated || 0} berechnet
          </p>
        </div>
      )}

      {/* APRS breakdown (compact) */}
      {aprsCache && aprsCache.total > 0 && (
        <div className="p-3 bg-purple-50/30 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Signal className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">APRS-Stationen</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aprsCache.byType?.repeater_node > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Digipeater: {aprsCache.byType.repeater_node}</span>}
            {aprsCache.byType?.echolink_node > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">IGates: {aprsCache.byType.echolink_node}</span>}
            {aprsCache.byType?.weather_station > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Wetter: {aprsCache.byType.weather_station}</span>}
            {aprsCache.byType?.hotspot > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">Hotspots: {aprsCache.byType.hotspot}</span>}
            {aprsCache.byType?.simplex_node > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">Simplex: {aprsCache.byType.simplex_node}</span>}
            {aprsCache.byType?.allstar_node > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">AllStar: {aprsCache.byType.allstar_node}</span>}
            {aprsCache.byType?.other > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300">Sonstige: {aprsCache.byType.other}</span>}
          </div>
        </div>
      )}
    </div>
  );
}