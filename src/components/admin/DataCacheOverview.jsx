import React, { useState, useEffect } from "react";
import { Database, MapPin, AlertCircle, RefreshCw, Loader2, RadioTower, Signal, Link2, Mountain, Trees, Building, Castle, Anchor, Diamond, RadioTower as Tower, Waves } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CacheDetailView from "@/components/admin/CacheDetailView";

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

// Fix 3: UTC → Europe/Zurich timezone formatting
function formatLastSync(dateOrIso) {
  if (!dateOrIso) return 'Nie';
  const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  return new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date) + ' Uhr';
}

// Fix 2: Maidenhead Locator → lat/lng conversion
function locatorToLatLng(locator) {
  if (!locator || locator.length < 4) return null;
  const loc = locator.toUpperCase();
  const A = 'A'.charCodeAt(0);
  const lon1 = (loc.charCodeAt(0) - A) * 20 - 180;
  const lat1 = (loc.charCodeAt(1) - A) * 10 - 90;
  const lon2 = parseInt(loc[2]) * 2;
  const lat2 = parseInt(loc[3]) * 1;
  let lat = lat1 + lat2 + 0.5;
  let lng = lon1 + lon2 + 1;
  if (loc.length >= 6) {
    lat += (loc.charCodeAt(5) - A) * (10 / 24) - (10 / 48);
    lng += (loc.charCodeAt(4) - A) * (20 / 24) - (20 / 48);
  }
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 };
}

const REFERENCE_LAYERS = [
  { key: "sota", label: "SOTA", icon: Mountain, color: "text-red-500", tooltip: "Summits on the Air – Berggipfel ab 150 m Prominenz. Daten von sotadata.org.uk. Gesamtzahl aus ReferenceData.total_count (Backend). Koordinaten aus den Referenzdaten." },
  { key: "pota", label: "POTA", icon: Trees, color: "text-green-500", tooltip: "Parks on the Air – Nationalparks und Schutzgebiete. Daten von pota.app. Gesamtzahl aus ReferenceData.total_count (Backend)." },
  { key: "hbff", label: "WWFF", icon: Trees, color: "text-purple-500", tooltip: "Worldwide Flora & Fauna – Naturreservate weltweit. Daten von wwff.co. Gesamtzahl aus ReferenceData.total_count (Backend)." },
  { key: "wwbota", label: "WWBOTA", icon: Building, color: "text-amber-700", tooltip: "Worldwide Bunkers on the Air – Militärische Bunker. Daten von wwbota.net. Gesamtzahl aus ReferenceData.total_count (Backend)." },
  { key: "castle", label: "Burgen", icon: Castle, color: "text-orange-500", tooltip: "WCA/COTA – Burgen und Schlösser. Daten von Wikidata/OSM. Gesamtzahl aus ReferenceData.total_count (Backend)." },
  { key: "lighthouse", label: "Leuchttürme", icon: Anchor, color: "text-yellow-600", tooltip: "WLOTA/ARLHS – Leuchttürme weltweit. Daten von arlhs.net. Gesamtzahl aus ReferenceData.total_count (Backend)." },
  { key: "iota", label: "IOTA", icon: Diamond, color: "text-blue-500", tooltip: "Islands on the Air – Inseln weltweit. Daten von iota-world.org. Gesamtzahl aus ReferenceData.total_count (Backend)." },
  { key: "llota", label: "LLOTA", icon: Waves, color: "text-sky-500", tooltip: "Lakes on the Air – Seen weltweit. Daten von llota.app. Gesamtzahl aus ReferenceData.total_count (Backend). See-Konturen werden per Batch-Automation on-demand aus OSM/SwissTopo geladen." },
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

function LayerCard({ label, icon: Icon, color, count, withCoords, total, lastUpdated, status, source, layerKey, onClick, tooltip }) {
  const isStale = lastUpdated && (Date.now() - lastUpdated.getTime()) > STALE_THRESHOLD_MS;
  const withoutCoords = (total || count) - (withCoords || 0);

  return (
    <div
      onClick={onClick}
      title={tooltip}
      className={`rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow ${
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
        <span
          className="text-lg font-bold text-gray-900 dark:text-slate-100 flex-shrink-0"
          title={count >= 5000 ? `Achtung: ${count.toLocaleString("de-CH")} Einträge geladen – möglicherweise durch Plattform-Limit begrenzt. Die tatsächliche Gesamtzahl kann höher sein (siehe ReferenceData.total_count).` : `Anzahl gespeicherter Datensätze: ${count.toLocaleString("de-CH")}`}
        >
          {count != null ? count.toLocaleString("de-CH") : "—"}
        </span>
      </div>
      {withCoords != null && (total || count) > 0 && (
        <div className="flex items-center gap-2 mt-1 text-[10px]">
          <span
            className="text-green-600 flex items-center gap-0.5"
            title="Einträge mit geografischen Koordinaten (Breiten-/Längengrad). Nur diese werden auf der Karte angezeigt und für räumliche Abfragen verwendet."
          >
            <MapPin className="w-2.5 h-2.5" /> {withCoords.toLocaleString("de-CH")} geo
          </span>
          {withoutCoords > 0 && (
            <span
              className="text-amber-600 flex items-center gap-0.5"
              title="Einträge ohne Koordinaten – können nicht auf der Karte dargestellt werden. Ursachen: fehlende Koordinaten in der Quelldatei, fehlgeschlagene Geocodierung oder nur Maidenhead-Locator ohne Verfeinerung vorhanden."
            >
              <AlertCircle className="w-2.5 h-2.5" /> {withoutCoords.toLocaleString("de-CH")} offen
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-1">
        <p
          className={`text-[10px] truncate ${isStale ? "text-amber-600 font-medium" : "text-gray-400 dark:text-slate-500"}`}
          title={lastUpdated
            ? `Letzte Aktualisierung: ${lastUpdated.toLocaleString("de-CH", { dateStyle: "full", timeStyle: "short" })}.${isStale ? " Status: veraltet (>7 Tage). Eine erneute Aktualisierung wird empfohlen." : " Status: aktuell."}`
            : "Diese Layer wurde noch nie aktualisiert oder das Aktualisierungsdatum ist nicht gespeichert. Bitte manuell über die Daten-Cache-Verwaltung aktualisieren."}
        >
          {lastUpdated ? formatLastSync(lastUpdated) : "Nie"}
          {isStale ? " ⚠" : ""}
        </p>
        <p className="text-[9px] text-blue-500 dark:text-blue-400 truncate ml-1">→ Details</p>
      </div>
    </div>
  );
}

export default function DataCacheOverview({ cacheStatus, coverageProgress, aprsCache, onRefresh }) {
  const [extraCounts, setExtraCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLayer, setDetailLayer] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState(null);

  // Count ALL records in an entity, bypassing the 5000-record platform cap.
  // Uses deterministic _id-sorted skip/offset pagination. Only used as FALLBACK
  // when ReferenceData.total_count is not available (i.e. before the first refresh).
  async function countAllRecords(entityName, filter) {
    try {
      if (filter) {
        const results = await base44.entities[entityName].filter(filter);
        return { total: results ? results.length : 0, withCoords: 0 };
      }
      let count = 0;
      let withCoords = 0;
      const BATCH = 5000;
      for (let skip = 0; skip < 80000; skip += BATCH) {
        const batch = await base44.entities[entityName].list("id", BATCH, skip);
        if (!batch || batch.length === 0) break;
        count += batch.length;
        withCoords += batch.filter(r => {
          if (r.lat != null && r.lng != null && !isNaN(r.lat) && !isNaN(r.lng)) return true;
          if ((!r.lat || !r.lng) && r.locator && locatorToLatLng(r.locator)) return true;
          return false;
        }).length;
        if (batch.length < BATCH) break;
      }
      return { total: count, withCoords };
    } catch (e) {
      return { total: 0, withCoords: 0 };
    }
  }

  const fetchExtraCounts = async () => {
    try {
      const approvedLinks = await base44.entities.RepeaterLink.filter({ status: "approved" });

      // Repeater count: use ReferenceData.total_count (stable, set by backend during
      // refresh) as primary source. Only fall back to pagination if no stored count
      // exists (before the first refresh). This prevents the count from jumping
      // between paginated runs — the stored count is the authoritative total.
      // Always count withCoords from the DB — the metadata value (meta.withCoords) is
      // an approximation from regional updates that drifts over time. total_count from
      // ReferenceData is the authoritative total (stable, set by backend during refresh).
      const repRefEntry = (cacheStatus || []).find(e => e.type === "repeater");
      let repeaterStats;
      if (repRefEntry?.total_count) {
        // Use stable total_count from metadata, but count withCoords from the DB
        const dbStats = await countAllRecords("Repeater", null);
        repeaterStats = { total: repRefEntry.total_count, withCoords: dbStats?.withCoords || 0 };
      } else {
        repeaterStats = await countAllRecords("Repeater", null);
      }

      const totaStats = await countAllRecords("TotaPoint", null);
      const privateNodeStats = await countAllRecords("PrivateNode", null);
      setExtraCounts({
        tota: totaStats?.total || 0,
        repeaterLinks: approvedLinks?.length || 0,
        repeaters: repeaterStats?.total || 0,
        repeatersWithCoords: repeaterStats?.withCoords || 0,
        privateNodes: privateNodeStats?.total || 0,
      });
    } catch (e) {
      setExtraCounts({ tota: 0, repeaterLinks: 0, repeaters: 0, privateNodes: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Fix 2: Koordinaten nachschlagen — geocode repeaters without coordinates
  const handleGeocodeRepeaters = async () => {
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const res = await base44.functions.invoke("geocodeRepeaters", {});
      setGeocodeResult(res?.data || { message: "Geocodierung abgeschlossen" });
      fetchExtraCounts();
    } catch (e) {
      setGeocodeResult({ error: e.message });
    } finally {
      setGeocoding(false);
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

  // Fix 1: Build reference layer data — pick entry with highest total_count per type (deduplicate)
  const refDataMap = {};
  for (const entry of cacheStatus || []) {
    const existing = refDataMap[entry.type];
    if (!existing || (entry.total_count || 0) > (existing.total_count || 0)) {
      refDataMap[entry.type] = entry;
    }
  }

  // Build repeater data from coverageProgress (for coverage stats only, NOT for count)
  const repData = coverageProgress?.global || null;
  // Repeater count: total_count from ReferenceData is the authoritative total (set by backend).
  // withCoords: the metadata value is an APPROXIMATION from regional updates
  // (Math.round(oldWithCoords * remainingRatio) + withCoords) that drifts over time.
  // Use the actual DB count (extraCounts.repeatersWithCoords) as primary source —
  // it's computed by iterating all Repeater records and counting lat/lng != null.
  const repeaterRefEntry = refDataMap["repeater"];
  const repeaterMeta = repeaterRefEntry?.references?.[0] || {};
  const repeaterCount = repeaterRefEntry?.total_count ?? extraCounts?.repeaters ?? null;
  const repeatersWithCoords = extraCounts?.repeatersWithCoords ?? repeaterMeta.withCoords ?? null;
  const aprsCount = extraCounts?.privateNodes ?? aprsCache?.total ?? 0;

  // For layers with their own entities, use the most reliable count source.
  // SOTA/POTA/WWFF: filter({}) is capped at 5000, so use ReferenceData.total_count
  // (set by backend during refresh) as primary, with references array as fallback.
  // Repeater/PrivateNode/TOTA: use direct entity count (smaller, under 5000 cap).
  const getLayerCount = (layerKey, refEntry) => {
    if (layerKey === "repeater") return refEntry?.total_count ?? (extraCounts?.repeaters ?? 0);
    if (layerKey === "aprs") return extraCounts?.privateNodes ?? 0;
    if (layerKey === "tota") return extraCounts?.tota ?? 0;
    if (layerKey === "repeaterLinks") return extraCounts?.repeaterLinks ?? 0;
    // SOTA, POTA, WWFF, WWBOTA, castle, lighthouse, iota — use ReferenceData
    const refs = refEntry?.references || [];
    const refCount = refs.length;
    const totalCount = refEntry?.total_count || 0;
    // Use the larger of the two — total_count is set by backend, references array
    // may be truncated by storage limits. If total_count > 5000 (filter cap), trust it.
    return Math.max(refCount, totalCount);
  };

  // Compute overall status
  const allStatuses = [];
  for (const layer of REFERENCE_LAYERS) {
    const entry = refDataMap[layer.key];
    const refs = entry?.references || [];
    const total = getLayerCount(layer.key, entry);
    const hasCoordFields = refs.length > 0 && refs.some(r => r.lat != null || r.lng != null);
    const withCoords = hasCoordFields ? refs.filter(r => r.lat && r.lng).length : null;
    const lastUpdated = entry?.last_updated ? new Date(entry.last_updated) : null;
    const isCritical = ["sota", "pota", "castle"].includes(layer.key);
    allStatuses.push(computeLayerStatus(total, withCoords, total, lastUpdated, isCritical));
  }
  // Repeater status
  allStatuses.push(computeLayerStatus(repeaterCount ?? 0, repeatersWithCoords ?? 0, repeaterCount ?? 0, null, true));
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

  // Compute total count across ALL layers
  const layerCounts = REFERENCE_LAYERS.map(layer => getLayerCount(layer.key, refDataMap[layer.key]));
  layerCounts.push(repeaterCount ?? 0);
  layerCounts.push(aprsCount ?? 0);
  layerCounts.push(extraCounts?.tota ?? 0);
  layerCounts.push(extraCounts?.repeaterLinks ?? 0);
  const totalAllRecords = layerCounts.reduce((sum, c) => sum + (c || 0), 0);

  return (
    <div className="space-y-3">
      {/* Header with refresh + overall status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-600 dark:text-slate-300" />
          <span className="text-sm font-bold text-gray-900 dark:text-slate-100" title="Zeigt die Anzahl gespeicherter Datensätze pro Layer. Große Layer (SOTA, POTA, WWFF) verwenden ReferenceData.total_count vom Backend. Kleinere Layer (Relais, APRS, TOTA) verwenden direkte Entity-Counts.">Daten-Cache Übersicht</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            overallStatus === "ok" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
            overallStatus === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`} title="Grün: Alle Layer haben Daten und sind aktuell. Gelb: Mindestens ein Layer ist veraltet (>7 Tage) oder hat fehlende Koordinaten. Rot: Kritische Layer (SOTA, POTA, Burgen) sind leer.">
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

      {/* Total records counter */}
      <div
        className="flex items-center justify-between p-3 rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/15"
        title={`Gesamtanzahl aller gespeicherten Datensätze über alle Layer (SOTA, POTA, WWFF, WWBOTA, Burgen, Leuchttürme, IOTA, Relais, APRS, TOTA, Relais-Verlinkungen). ${loading ? "Wird geladen..." : "Stabiler Gesamtwert aus den autoritativen Counts pro Layer."}`}
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">Gesamt alle Layer</span>
        </div>
        <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
          {totalAllRecords.toLocaleString("de-CH")}
        </span>
      </div>

      {/* Reference layers grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {REFERENCE_LAYERS.map(layer => {
          const entry = refDataMap[layer.key];
          const refs = entry?.references || [];
          const total = getLayerCount(layer.key, entry);
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
              layerKey={layer.key}
              onClick={() => setDetailLayer({ key: layer.key, label: layer.label })}
            />
          );
        })}

        {/* Repeater layer */}
        <LayerCard
          label="Relais"
          icon={RadioTower}
          color="text-blue-500"
          tooltip="Amateurfunk-Relais weltweit (FM, DMR, D-STAR, Fusion etc.). Daten von RepeaterBook.com, ukrepeater.net, WIA, dstarusers.org. Gesamtzahl aus ReferenceData.total_count (vom Backend beim Refresh gesetzt — stabil, keine Pagination nötig)."
          count={repeaterCount ?? 0}
          withCoords={repeatersWithCoords}
          total={repeaterCount ?? 0}
          lastUpdated={null}
          status={computeLayerStatus(repeaterCount ?? 0, repeatersWithCoords ?? 0, repeaterCount ?? 0, null, true)}
          source="RepeaterBook + WIA + dstarusers"
          layerKey="repeater"
          onClick={() => setDetailLayer({ key: "repeater", label: "Relais" })}
        />

        {/* APRS layer */}
        <LayerCard
          label="APRS-Nodes"
          icon={Signal}
          color="text-purple-500"
          tooltip="APRS-Stationen weltweit: Digipeater, IGates, Wetter, Hotspots. Daten von aprs.fi und BrandMeister. Anzahl aus direktem Entity-Count (PrivateNode.list)."
          count={aprsCount}
          withCoords={null}
          total={null}
          lastUpdated={null}
          status={computeLayerStatus(aprsCount, null, null, null, false)}
          source="APRS.fi + BrandMeister"
          layerKey="aprs"
          onClick={() => setDetailLayer({ key: "aprs", label: "APRS-Nodes" })}
        />

        {/* TOTA layer */}
        <LayerCard
          label="TOTA"
          icon={Tower}
          color="text-orange-500"
          tooltip="Towers on the Air – Aussichtstürme und Antennen. Daten von wwtota.com und Swiss CSV. Anzahl aus direktem Entity-Count (TotaPoint.list)."
          count={extraCounts?.tota || 0}
          withCoords={null}
          total={null}
          lastUpdated={null}
          status={computeLayerStatus(extraCounts?.tota, null, null, null, false)}
          source="wwtota.com + Swiss CSV"
          layerKey="tota"
          onClick={() => setDetailLayer({ key: "tota", label: "TOTA" })}
        />

        {/* Repeater Links */}
        <LayerCard
          label="Relais-Verlinkungen"
          icon={Link2}
          color="text-teal-500"
          tooltip="Permanente Verlinkungen zwischen Relais (Crosslinks, EchoLink, BrandMeister). Daten von RepeaterBook, USKA und Admin-Erfassung. Anzahl aus RepeaterLink.filter({status:'approved'})."
          count={extraCounts?.repeaterLinks || 0}
          withCoords={null}
          total={null}
          lastUpdated={null}
          status={computeLayerStatus(extraCounts?.repeaterLinks, null, null, null, false)}
          source="RepeaterBook + USKA + Admin"
          layerKey="repeaterLinks"
          onClick={() => setDetailLayer({ key: "repeaterLinks", label: "Relais-Verlinkungen" })}
        />
      </div>

      {/* Fix 2: Koordinaten nachschlagen Button */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleGeocodeRepeaters}
          disabled={geocoding}
          className="text-[10px] px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
        >
          {geocoding ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
          Koordinaten nachschlagen
        </button>
        {geocodeResult && (
          <span className={`text-[10px] ${geocodeResult.error ? 'text-red-500' : 'text-green-600'}`}>
            {geocodeResult.error || geocodeResult.message}
          </span>
        )}
      </div>

      {/* Repeater coverage summary (compact) */}
      {repData && (
        <div className="p-3 bg-blue-50/30 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800/50">
          <div className="flex items-center gap-2 mb-2">
            <RadioTower className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold text-gray-900 dark:text-slate-100" title="Abdeckungsradius-Berechnung: Band-Schätzung (Standardwert pro Band) wird durch APRS-Daten verfeinert, wenn verfügbar. Gelände-Adjustierung berücksichtigt Standorthöhe und Hindernisse. Berechnet von der Funktion calculateRepeaterCoverage.">Relais-Abdeckung</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div title="Relais, deren Abdeckungsradius durch echte APRS-Positionsdaten verfeinert wurde (genauer als Band-Schätzung).">
              <div className="text-sm font-bold text-green-600">{repData.aprsRefined || 0}</div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">APRS-verfeinert</div>
            </div>
            <div title="Relais, deren Abdeckungsradius durch Standorthöhe und Geländefaktor (terrain_factor) adjustiert wurde.">
              <div className="text-sm font-bold text-teal-600">{repData.terrainAdjusted || 0}</div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">Gelände-adj.</div>
            </div>
            <div title="Durchschnittlicher Verfeinerungsgrad aller Relais: 0% = nur Band-Schätzung, 100% = alle durch APRS/Gelände verfeinert. Grün ≥60%, Gelb ≥30%.">
              <div className={`text-sm font-bold ${
                repData.avgRefinementPct >= 60 ? "text-green-600" :
                repData.avgRefinementPct >= 30 ? "text-amber-600" : "text-gray-400 dark:text-slate-500"
              }`}>{repData.avgRefinementPct}%</div>
              <div className="text-[9px] text-gray-400 dark:text-slate-500">Ø Verfeinerung</div>
            </div>
            <div title="Relais, die von einem Admin für die Neuberechnung markiert wurden (needs_recalc=true). Werden im nächsten Berechnungszyklus aktualisiert.">
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
            <span className="text-xs font-semibold text-gray-900 dark:text-slate-100" title="Aufschlüsselung der APRS-Stationen nach Typ. Daten von aprs.fi (API) und BrandMeister. Gespeichert in der PrivateNode-Entity.">APRS-Stationen</span>
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

      {/* Cache Detail View Modal */}
      {detailLayer && (
        <CacheDetailView
          layerKey={detailLayer.key}
          layerLabel={detailLayer.label}
          onClose={() => setDetailLayer(null)}
        />
      )}
    </div>
  );
}