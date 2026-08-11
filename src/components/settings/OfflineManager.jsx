import React, { useState, useEffect, useCallback } from "react";
import {
  Wifi, WifiOff, Download, Loader2, CheckCircle2, AlertCircle, Trash2,
  Database, HardDrive, MapPin, Radio, Zap, Search, Layers, ChevronDown, Info, X, Globe,
  Mountain, Trees, Castle, Anchor, Building, RadioTower
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { getOfflineAreas, deleteArea, clearAllTiles, getStorageEstimate } from "@/lib/offlineMapStore";
import {
  cacheTypeFromServer, cacheRepeatersFromServer, cachePrivateNodesFromServer,
  cacheFromServer, getReferenceTypeStats, clearReferenceType,
  getServerDataCounts, getOfflineReadiness, isOfflineReady, getCachedAt,
  getLocalCacheStats, clearLocalReferenceCache,
  getOfflineCountryFilter, getTruncatedFlag, getStoredServerCounts,
  getCachedCountriesForType
} from "@/lib/offlineDataCache";
import CountryFilterDialog from "@/components/settings/CountryFilterDialog";

const TYPE_LABELS = {
  sota: "SOTA – Berggipfel",
  pota: "POTA – Parks",
  hbff: "WWFF – Flora & Fauna",
  wwbota: "WWBOTA – Bunker",
  castle: "Burgen & Schlösser",
  iota: "IOTA – Inseln",
  lighthouse: "Leuchttürme",
  repeater: "Amateurfunk-Relais",
  private_nodes: "APRS & BrandMeister Nodes",
  tota: "TOTA – Türme & Antennen",
  qrz: "QRZ.com Abfragen",
};

const TYPE_ICONS = {
  sota: Mountain, pota: Trees, hbff: Trees, wwbota: Building,
  castle: Castle, iota: MapPin, lighthouse: Anchor,
  repeater: Radio, private_nodes: Wifi, tota: RadioTower, qrz: Search,
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
};

export default function OfflineManager() {
  const { toast } = useToast();
  const [forceOffline, setForceOffline] = useState(() => localStorage.getItem("hb9om_force_offline") === "true");
  const [localStats, setLocalStats] = useState(() => getReferenceTypeStats());
  const [serverCounts, setServerCounts] = useState(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [downloadingTypes, setDownloadingTypes] = useState(new Set());
  const [offlineAreas, setOfflineAreas] = useState([]);
  const [storageInfo, setStorageInfo] = useState({ areas: 0, tiles: 0 });
  const [offlineReady, setOfflineReady] = useState(() => isOfflineReady());
  const [offlineCachedAt, setOfflineCachedAt] = useState(() => getCachedAt());
  const [expandedLayers, setExpandedLayers] = useState(false);
  const [missingHint, setMissingHint] = useState(null);
  const [countryFilterType, setCountryFilterType] = useState(null);

  const refreshStats = useCallback(() => {
    setLocalStats(getReferenceTypeStats());
    setOfflineReady(isOfflineReady());
    setOfflineCachedAt(getCachedAt());
  }, []);

  const loadData = useCallback(async () => {
    const areas = await getOfflineAreas().catch(() => []);
    setOfflineAreas(areas);
    const info = await getStorageEstimate().catch(() => ({ areas: 0, tiles: 0 }));
    setStorageInfo(info);
    // Check map tiles readiness
    const readiness = getOfflineReadiness();
    readiness.mapTiles = areas.length > 0;
    // Build missing hint
    const missing = [];
    if (!readiness.sota) missing.push("SOTA");
    if (!readiness.pota) missing.push("POTA");
    if (!readiness.hbff) missing.push("WWFF");
    if (!readiness.wwbota) missing.push("WWBOTA");
    if (!readiness.castle) missing.push("Burgen");
    if (!readiness.iota) missing.push("IOTA");
    if (!readiness.lighthouse) missing.push("Leuchttürme");
    if (!readiness.repeater) missing.push("Relais");
    if (!readiness.private_nodes) missing.push("APRS/BrandMeister");
    if (!readiness.tota) missing.push("TOTA");
    if (!readiness.mapTiles) missing.push("Offline-Karten");
    setMissingHint(missing);
  }, []);

  useEffect(() => {
    refreshStats();
    loadData();
  }, [refreshStats, loadData]);

  // Fetch server counts (how many records are available per type)
  const handleFetchCounts = async () => {
    setLoadingCounts(true);
    // Show stored counts immediately (from last download — no API call needed)
    setServerCounts(prev => ({ ...getStoredServerCounts(), ...prev }));
    try {
      const counts = await getServerDataCounts();
      setServerCounts(counts);
    } catch (e) { /* silent */ }
    finally { setLoadingCounts(false); }
  };

  useEffect(() => {
    if (!serverCounts && !loadingCounts) handleFetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleForceOffline = async (enabled) => {
    setForceOffline(enabled);
    localStorage.setItem("hb9om_force_offline", String(enabled));
    if (enabled) {
      const success = await cacheFromServer();
      if (success) {
        refreshStats();
        loadData();
        toast({ title: "Offline-Modus aktiviert", description: "Daten für Offline-Nutzung gespeichert", duration: 3000 });
      }
    } else {
      toast({ title: "Online-Modus aktiviert", duration: 2000 });
    }
  };

  const handleDownloadType = async (type) => {
    setDownloadingTypes(prev => new Set(prev).add(type));
    try {
      let result;
      if (type === "repeater") result = await cacheRepeatersFromServer();
      else if (type === "private_nodes") result = await cachePrivateNodesFromServer();
      else if (type === "tota") {
        const { cacheTotaFromServer } = await import("@/lib/offlineDataCache");
        result = await cacheTotaFromServer();
      }
      else result = await cacheTypeFromServer(type);

      if (result.success) {
        const total = result.total || result.count;
        const stored = result.count;
        let desc = `${TYPE_LABELS[type]}: ${stored.toLocaleString("de-CH")} Einträge gespeichert`;
        let duration = 3000;
        if (result.truncated && total > stored) {
          desc = `${TYPE_LABELS[type]}: ${stored.toLocaleString("de-CH")} von ${total.toLocaleString("de-CH")} gespeichert (Speicherlimit – Schweiz-Priorität)`;
          duration = 6000;
        } else if (result.slimmed && total > stored) {
          desc = `${TYPE_LABELS[type]}: ${stored.toLocaleString("de-CH")} von ${total.toLocaleString("de-CH")} gespeichert (reduziert – Speicherplatz)`;
          duration = 5000;
        } else if (result.slimmed) {
          desc = `${TYPE_LABELS[type]}: ${stored.toLocaleString("de-CH")} Einträge gespeichert (reduzierte Felder)`;
          duration = 4000;
        }
        toast({
          title: result.truncated ? "Teilweise geladen" : "Geladen",
          description: desc,
          duration,
        });
        // Update server counts immediately so truncation hints show right away
        setServerCounts(prev => ({ ...prev, [type]: total }));
        refreshStats();
        loadData();
      } else {
        toast({ title: "Fehler", description: result.error || "Laden fehlgeschlagen", variant: "destructive", duration: 5000 });
      }
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Laden fehlgeschlagen", variant: "destructive", duration: 3000 });
    } finally {
      setDownloadingTypes(prev => { const n = new Set(prev); n.delete(type); return n; });
    }
  };

  const handleDownloadAll = async () => {
    const types = ["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse", "repeater", "private_nodes"];
    for (const type of types) {
      await handleDownloadType(type);
    }
    toast({ title: "Alle Daten geladen", description: "App ist bereit für Offline-Nutzung", duration: 3000 });
  };

  const handleClearType = (type) => {
    clearReferenceType(type);
    refreshStats();
    loadData();
    toast({ title: "Gelöscht", description: `${TYPE_LABELS[type]} aus lokalem Speicher entfernt`, duration: 2000 });
  };

  const handleDeleteOfflineArea = async (id) => {
    await deleteArea(id);
    loadData();
  };

  const handleClearAllOffline = async () => {
    await clearAllTiles();
    const areas = await getOfflineAreas();
    for (const a of areas) await deleteArea(a.id);
    clearLocalReferenceCache();
    localStorage.removeItem("hb9om_refs_repeater");
    localStorage.removeItem("hb9om_refs_private_nodes");
    refreshStats();
    loadData();
    toast({ title: "Alle Offline-Daten gelöscht", duration: 2000 });
  };

  // Total local storage
  const totalLocalSize = Object.values(localStats).reduce((sum, s) => sum + (s.size || 0), 0);
  const totalRefCount = Object.values(localStats).reduce((sum, s) => sum + (s.count || 0), 0);
  const allRefsReady = localStats.sota?.count > 0 && localStats.pota?.count > 0 && localStats.hbff?.count > 0 &&
    localStats.wwbota?.count > 0 && localStats.castle?.count > 0 && localStats.iota?.count > 0 && localStats.lighthouse?.count > 0;
  const fullyReady = allRefsReady && offlineAreas.length > 0;

  const allTypes = ["sota", "pota", "hbff", "wwbota", "castle", "iota", "lighthouse", "repeater", "private_nodes", "tota"];

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Download className="w-4 h-4" /> Offline-Modus & lokaler Speicher
      </h2>

      {/* Force Offline Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
        <div className="flex-1">
          <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            {forceOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />} Manuelles Offline
          </label>
          <p className="text-xs text-gray-500 mt-0.5">
            {forceOffline ? "App läuft offline – alle Daten aus lokalem Cache" : "Offline-Modus erzwingen (Daten aus Cache)"}
          </p>
        </div>
        <button
          onClick={() => handleToggleForceOffline(!forceOffline)}
          className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${forceOffline ? 'bg-amber-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${forceOffline ? 'translate-x-6' : ''}`} />
        </button>
      </div>

      {/* Offline Readiness Indicator */}
      <div className={`p-3 rounded-lg flex items-start gap-2 mb-3 ${fullyReady ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
        {fullyReady
          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />}
        <div className="text-xs flex-1">
          <p className={`font-semibold ${fullyReady ? 'text-green-700' : 'text-amber-700'}`}>
            {fullyReady ? 'App zu 100% offline bereit' : 'App noch nicht vollständig offline bereit'}
          </p>
          {offlineCachedAt && (
            <p className={`mt-0.5 ${fullyReady ? 'text-green-600' : 'text-amber-600'}`}>
              Zuletzt aktualisiert: {new Date(offlineCachedAt).toLocaleString('de-CH')}
            </p>
          )}
          {!fullyReady && missingHint && missingHint.length > 0 && (
            <div className="mt-1.5">
              <p className="text-amber-700 font-medium flex items-center gap-1">
                <Info className="w-3 h-3" /> Für 100% Offline fehlen noch:
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {missingHint.map(m => (
                  <span key={m} className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-medium">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Storage Overview */}
      <div className="p-3 bg-gray-50 rounded-lg mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" /> Lokaler Speicher gesamt
          </span>
          <span className="text-xs font-bold text-gray-900">{formatBytes(totalLocalSize)}</span>
        </div>
        <div className="text-[11px] text-gray-500">
          {totalRefCount.toLocaleString("de-CH")} Referenzen · {offlineAreas.length} Kartenbereiche · {storageInfo.tiles} Kacheln
        </div>
      </div>

      {/* Per-Layer Download Switches */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Daten pro Layer
          </h3>
          <button
            onClick={handleDownloadAll}
            className="px-2.5 py-1 text-[11px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center gap-1"
          >
            <Download className="w-3 h-3" /> Alle laden
          </button>
        </div>

        <div className="space-y-1.5">
          {allTypes.map(type => {
            const Icon = TYPE_ICONS[type] || Database;
            const local = localStats[type] || { count: 0, size: 0 };
            const serverCount = serverCounts?.[type];
            const isDownloading = downloadingTypes.has(type);
            const hasLocal = local.count > 0;
            const countryFilter = getOfflineCountryFilter(type);
            const supportsCountryFilter = true;
            const isTruncated = getTruncatedFlag(type);
            const autoSplitCountries = (!countryFilter || countryFilter.length === 0) ? getCachedCountriesForType(type) : [];

            return (
              <div key={type} className={`flex items-center gap-2 p-2.5 rounded-lg border ${hasLocal ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200'}`}>
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${hasLocal ? 'text-green-500' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-900 truncate">{TYPE_LABELS[type]}</span>
                    {hasLocal && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                  </div>
                  <div className="text-[10px] text-gray-500 flex items-center gap-2 flex-wrap">
                    <span className={hasLocal ? "text-green-600 font-medium" : ""}>
                      {hasLocal ? `${local.count.toLocaleString("de-CH")} lokal` : "nicht gespeichert"}
                    </span>
                    {hasLocal && <span>· {formatBytes(local.size)}</span>}
                    {serverCount != null && serverCount > 0 && (
                      <span className="text-gray-400">· Server: {serverCount.toLocaleString("de-CH")}</span>
                    )}
                    {serverCount != null && serverCount > local.count && (isTruncated || autoSplitCountries.length > 0) && (
                      <span className="text-red-500 font-medium">· Speicherlimit erreicht</span>
                    )}
                    {serverCount != null && serverCount > local.count && !isTruncated && autoSplitCountries.length === 0 && (!countryFilter || countryFilter.length === 0) && (
                      <span className="text-amber-500">· Update verfügbar</span>
                    )}
                    {countryFilter && countryFilter.length > 0 && (
                      <span className="text-blue-500">· {countryFilter.length} Länder</span>
                    )}
                    {autoSplitCountries.length > 0 && (
                      <span className="text-gray-400">· {autoSplitCountries.length} Länder (auto)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {supportsCountryFilter && (
                    <button
                      onClick={() => setCountryFilterType(type)}
                      className={`p-1.5 rounded-lg ${countryFilter ? 'text-blue-500 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'}`}
                      title="Nach Ländern filtern"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadType(type)}
                    disabled={isDownloading}
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40"
                    title={hasLocal ? "Aktualisieren" : "Laden"}
                  >
                    {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  </button>
                  {hasLocal && (
                    <button
                      onClick={() => handleClearType(type)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {loadingCounts && (
          <p className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Lade Server-Zahlen…
          </p>
        )}
      </div>

      {/* Offline Map Tiles */}
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> Offline-Karten
        </h3>
        {offlineAreas.length === 0 ? (
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <MapPin className="w-6 h-6 text-gray-300 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Keine Offline-Karten</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Auf der Karte den Download-Button verwenden</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {offlineAreas.map(area => (
              <div key={area.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{area.name}</p>
                  <div className="text-[10px] text-gray-400 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-0.5"><HardDrive className="w-2.5 h-2.5" /> {area.tileCount} Kacheln</span>
                    <span>~{(area.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                    <span>Zoom {area.zoomLevels.join(", ")}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteOfflineArea(area.id)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear All */}
      {(totalRefCount > 0 || offlineAreas.length > 0) && (
        <button
          onClick={handleClearAllOffline}
          className="w-full px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> Alle Offline-Daten löschen
        </button>
      )}

      {countryFilterType && (
        <CountryFilterDialog
          type={countryFilterType}
          typeLabel={TYPE_LABELS[countryFilterType] || countryFilterType}
          onClose={() => setCountryFilterType(null)}
          onDownloaded={() => { refreshStats(); loadData(); }}
        />
      )}
    </section>
  );
}