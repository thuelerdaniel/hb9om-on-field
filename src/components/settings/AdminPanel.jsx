import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList, Database, Clock, RefreshCw, Loader2, CheckCircle2, XCircle,
  AlertCircle, Bell, UserPlus, AlertTriangle, Users, User, KeyRound, Lightbulb,
  RadioTower, Signal, Wrench, Shield, ChevronDown, Mail, Network, FileJson,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import UnmatchedCastles from "@/components/admin/UnmatchedCastles";
import UnmatchedRepeaters from "@/components/admin/UnmatchedRepeaters";
import UnmatchedLighthouses from "@/components/admin/UnmatchedLighthouses";
import AdminDataMaintains from "@/components/admin/AdminDataMaintains";
import ExternalDataCheck from "@/components/admin/ExternalDataCheck";
import RepeaterLinkManager from "@/components/admin/RepeaterLinkManager";
import RepeaterCorrectionManager from "@/components/admin/RepeaterCorrectionManager";
import ExternalSourcesList from "@/components/admin/ExternalSourcesList";
import IndividualSourceReload from "@/components/admin/IndividualSourceReload";
import ChangelogEmailSender from "@/components/admin/ChangelogEmailSender";
import RestorePointManager from "@/components/admin/RestorePointManager";
import TotaManager from "@/components/admin/TotaManager";
import AdminCollapsibleSection from "@/components/admin/AdminCollapsibleSection";
import DataCacheOverview from "@/components/admin/DataCacheOverview";
import SyncPlanManager from "@/components/admin/SyncPlanManager";
import ApiKeyManager from "@/components/admin/ApiKeyManager";
import AdminEmailSettings from "@/components/admin/AdminEmailSettings";
import JsonRepeaterImport from "@/components/admin/JsonRepeaterImport";
import CoverageScheduleManager from "@/components/admin/CoverageScheduleManager";
import MobileSelect from "@/components/ui/MobileSelect";

const TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "WWFF", wwbota: "WWBOTA",
  castle: "Burgen/Schlösser", lighthouse: "Leuchttürme", iota: "IOTA",
};

function StatusIcon({ status }) {
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "partial") return <AlertCircle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

export default function AdminPanel({
  cacheStatus, loading,
  refreshing, refreshResult, handleRefresh,
  autoUpdateEnabled, autoUpdateLoading, handleToggleAutoUpdate,
  notifyNewUser, notifyDbUpdate, notifyAppErrors, notifyDemoLogin, notifyLoading, handleToggleNotification,
  setNotifyNewUser, setNotifyDbUpdate, setNotifyAppErrors, setNotifyDemoLogin,
  logs,
  adminPendingRequests, adminPendingFeatureRequests,
  demoSettingUp, demoSetupResult, demoOtpCode, setDemoOtpCode, demoVerifying,
  handleSetupDemo, handleVerifyDemoOtp,
}) {
  const [aprsLoading, setAprsLoading] = useState(false);
  const [aprsResult, setAprsResult] = useState(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageResult, setCoverageResult] = useState(null);
  const [coverageProgress, setCoverageProgress] = useState(null);
  const [coverageScope, setCoverageScope] = useState("CH");
  const [progressLoading, setProgressLoading] = useState(false);
  const [markingRecalc, setMarkingRecalc] = useState(false);
  const [aprsCache, setAprsCache] = useState(null);
  const [repeaterCorrections, setRepeaterCorrections] = useState([]);
  const { toast } = useToast();

  const fetchAprsCache = async () => {
    try {
      const nodes = await base44.asServiceRole.entities.PrivateNode.list("-created_date", 5000);
      const byType = {};
      for (const n of nodes) {
        byType[n.node_type] = (byType[n.node_type] || 0) + 1;
      }
      setAprsCache({ total: nodes.length, byType });
    } catch {}
  };

  const fetchCoverageProgress = async () => {
    setProgressLoading(true);
    try {
      const res = await base44.functions.invoke("calculateRepeaterCoverage", { stats_only: true });
      setCoverageProgress(res?.data || res);
    } catch {
      // silent fail — progress is informational
    } finally {
      setProgressLoading(false);
    }
  };

  const fetchRepeaterCorrections = async () => {
    try {
      const data = await base44.entities.RepeaterCorrection.filter({ status: "pending" });
      setRepeaterCorrections(data || []);
    } catch {}
  };

  useEffect(() => {
    fetchCoverageProgress();
    fetchAprsCache();
    fetchRepeaterCorrections();
  }, []);

  const handleMarkForRecalc = async () => {
    setMarkingRecalc(true);
    try {
      const filter = coverageScope === "all" ? {} : { country_code: coverageScope };
      await base44.asServiceRole.entities.Repeater.updateMany(filter, { $set: { needs_recalc: true } });
      toast({
        title: "Zur Neuberechnung markiert",
        description: `Alle Relais in ${coverageScope === "all" ? "der Welt" : coverageScope} werden im nächsten Zyklus neu berechnet`,
        duration: 5000,
      });
      fetchCoverageProgress();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setMarkingRecalc(false);
    }
  };

  const handleCalcCoverage = async () => {
    setCoverageLoading(true);
    setCoverageResult(null);
    try {
      const res = await base44.functions.invoke("calculateRepeaterCoverage", { country_code: coverageScope, force: true });
      setCoverageResult(res.data);
      toast({ title: "Abdeckung berechnet", description: `${res.data?.updated || 0} Relais aktualisiert (${res.data?.aprsRefined || 0} APRS-verfeinert)`, duration: 5000 });
      fetchCoverageProgress();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setCoverageLoading(false);
    }
  };

  const handleFetchAprsFi = async () => {
    setAprsLoading(true);
    setAprsResult(null);
    try {
      const res = await base44.functions.invoke("fetchAprsFi", {});
      if (res.data?.error) throw new Error(res.data.error);
      setAprsResult(res.data);
      toast({ title: "APRS.fi aktualisiert", description: `${res.data?.private_nodes_saved || 0} Nodes, ${res.data?.repeaters_updated_with_coords || 0} Relais mit Koordinaten` });
      fetchAprsCache();
    } catch (err) {
      setAprsResult({ error: err.message });
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
    setAprsLoading(false);
  };

  // --- Traffic-light status computation per group ---

  // Group 1: Anträge & Benutzer
  const totalPending = (adminPendingRequests || 0) + (adminPendingFeatureRequests || 0);
  const groupRequestsStatus = totalPending > 10 ? "error" : totalPending > 0 ? "warning" : "ok";
  const groupRequestsLabel = totalPending > 0 ? `${totalPending} offen` : "Keine offenen";

  // Group 2: Daten-Cache & Aktualisierung
  const cacheLoading = cacheStatus == null;
  const cacheEntries = cacheStatus || [];
  const criticalLayers = ["sota", "pota", "castle"];
  const missingCritical = cacheLoading ? [] : criticalLayers.filter(key => {
    const entry = cacheEntries.find(e => e.type === key);
    const total = entry?.total_count || entry?.references?.length || 0;
    return total === 0;
  });
  const staleLayers = cacheEntries.filter(e => {
    if (!e.last_updated) return false;
    return (Date.now() - new Date(e.last_updated).getTime()) > 7 * 24 * 60 * 60 * 1000;
  });
  const repTotal = coverageProgress?.global?.totalRepeaters || 0;
  const groupCacheStatus = cacheLoading ? "warning" :
    missingCritical.length > 0 ? "error" :
    staleLayers.length > 0 || repTotal === 0 || (coverageProgress?.pendingRecalc || 0) > 100 ? "warning" : "ok";
  const groupCacheLabel = cacheLoading ? "Daten laden..." :
    missingCritical.length > 0 ? `${missingCritical.length} kritisch fehlen` :
    staleLayers.length > 0 ? `${staleLayers.length} veraltet` :
    repTotal === 0 ? "Relais laden" : "Alle aktuell";

  // Group 3: Relais & Verlinkungen
  const pendingCorrections = repeaterCorrections.length;
  const refinementPct = coverageProgress?.global?.avgRefinementPct || 0;
  const groupRepeaterStatus = pendingCorrections > 10 || refinementPct < 30 ? "error" :
    pendingCorrections > 0 || refinementPct < 60 ? "warning" : "ok";
  const groupRepeaterLabel = pendingCorrections > 0 ? `${pendingCorrections} Korrekturen` :
    refinementPct < 60 ? `${refinementPct}% Abdeckung` : "OK";

  // Group 4: Datenpflege — always neutral (no live metric without fetching)
  const groupMaintenanceStatus = "neutral";
  const groupMaintenanceLabel = "";

  // Group 5: System & Benachrichtigungen
  const recentFailedLog = logs.some(l => l.overall_status === "failed");
  const groupSystemStatus = recentFailedLog ? "error" : "warning";
  const groupSystemLabel = recentFailedLog ? "Fehler im Protokoll" : "Prüfen";

  // Group 6: API-Keys — neutral (no live metric)
  const groupApiKeysStatus = "neutral";
  const groupApiKeysLabel = "";

  // Group 7: E-Mail-Settings — neutral
  const groupEmailStatus = "neutral";
  const groupEmailLabel = "";

  return (
    <>
      {/* ====== GROUP 1: Anträge & Benutzer ====== */}
      <AdminCollapsibleSection
        title="Anträge & Benutzer"
        description="Änderungsanträge, Funktionsvorschläge, Benutzerverwaltung"
        icon={ClipboardList}
        status={groupRequestsStatus}
        statusLabel={groupRequestsLabel}
        defaultOpen={totalPending > 0}
      >
        {/* Change Request Review */}
        <section className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-amber-600" /> Änderungsanträge
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                Positions-Korrekturen genehmigen oder ablehnen
              </p>
              {adminPendingRequests > 0 && (
                <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {adminPendingRequests} wartet{adminPendingRequests !== 1 ? 'en' : ''} auf Prüfung
                </p>
              )}
            </div>
            <Link
              to="/admin/change-requests"
              className="relative px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 flex items-center gap-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Prüfen
              {adminPendingRequests > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {adminPendingRequests}
                </span>
              )}
            </Link>
          </div>
        </section>

        {/* Feature Requests Review */}
        <section className="bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800/50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-purple-600" /> Funktionsvorschläge
              </h3>
              <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">Vorschläge prüfen und beantworten</p>
              {adminPendingFeatureRequests > 0 && (
                <p className="text-xs text-purple-700 mt-1 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {adminPendingFeatureRequests} wartet{adminPendingFeatureRequests !== 1 ? 'en' : ''}
                </p>
              )}
            </div>
            <Link
              to="/admin/feature-requests"
              className="relative px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-1.5"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Prüfen
              {adminPendingFeatureRequests > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {adminPendingFeatureRequests}
                </span>
              )}
            </Link>
          </div>
        </section>

        {/* User Management */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Benutzerverwaltung
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Angemeldete Benutzer, Passwörter zurücksetzen</p>
            </div>
            <Link
              to="/admin/users"
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5" />
              Benutzer
            </Link>
          </div>
        </section>

        {/* Demo User Setup */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                <User className="w-4 h-4" /> Demo-Benutzer
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Login: demo@hb9om.ch / demo1234 · Daten werden täglich gelöscht
              </p>
            </div>
            <button
              onClick={handleSetupDemo}
              disabled={demoSettingUp}
              className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1.5"
            >
              {demoSettingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Demo einrichten
            </button>
          </div>
          {demoSetupResult && (
            <div className={`mt-2 p-2 rounded-lg text-xs ${demoSetupResult.error ? "bg-red-50 dark:bg-red-900/20 text-red-700" : "bg-green-50 dark:bg-green-900/20 text-green-700"}`}>
              {demoSetupResult.error || demoSetupResult.message}
            </div>
          )}
          {demoSetupResult && !demoSetupResult.error && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={demoOtpCode}
                onChange={e => setDemoOtpCode(e.target.value)}
                placeholder="OTP-Code aus E-Mail"
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
              />
              <button
                onClick={handleVerifyDemoOtp}
                disabled={demoVerifying || !demoOtpCode.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
              >
                {demoVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Verifizieren
              </button>
            </div>
          )}
        </section>
      </AdminCollapsibleSection>

      {/* ====== GROUP 2: Daten-Cache & Aktualisierung ====== */}
      <AdminCollapsibleSection
        title="Daten-Cache & Aktualisierung"
        description="Alle Layer-Statistiken, Wochen-Sync-Plan, manuelle Aktualisierung"
        icon={Database}
        status={groupCacheStatus}
        statusLabel={groupCacheLabel}
        defaultOpen={groupCacheStatus === "error"}
      >
        <DataCacheOverview
          cacheStatus={cacheStatus}
          coverageProgress={coverageProgress}
          aprsCache={aprsCache}
          onRefresh={fetchCoverageProgress}
        />

        {/* Weekly Sync Plan Manager */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <SyncPlanManager />
        </div>

        {/* Refresh / Auto-update */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100 dark:border-slate-700">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Tägliche Automatik
              </label>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {autoUpdateEnabled ? "Referenzdaten werden täglich automatisch aktualisiert" : "Nur manuelle Aktualisierung – Automatik deaktiviert"}
              </p>
            </div>
            <button
              onClick={() => handleToggleAutoUpdate(!autoUpdateEnabled)}
              disabled={autoUpdateLoading}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${autoUpdateEnabled ? "bg-gray-900" : "bg-gray-300"} ${autoUpdateLoading ? "opacity-40" : ""}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoUpdateEnabled ? "translate-x-6" : ""}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Alle Daten aktualisieren</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Alle Referenzdaten neu abrufen (langlaufend)</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1.5"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {refreshing ? "Aktualisiert..." : "Jetzt aktualisieren"}
            </button>
          </div>
          {refreshResult && (
            <div className={`mt-2 p-2 rounded-lg text-xs ${refreshResult.error ? "bg-red-50 dark:bg-red-900/20 text-red-700" : "bg-green-50 dark:bg-green-900/20 text-green-700"}`}>
              {refreshResult.error
                ? `Fehler: ${refreshResult.error}`
                : `Aktualisierung abgeschlossen: ${refreshResult.results?.filter(r => r.status === "success").length || 0}/${refreshResult.results?.length || 0} Quellen erfolgreich (${(refreshResult.total_duration_ms / 1000).toFixed(1)}s)`}
            </div>
          )}
        </section>

        {/* Individual Source Reload */}
        <IndividualSourceReload />
      </AdminCollapsibleSection>

      {/* ====== GROUP 3: Relais & Verlinkungen ====== */}
      <AdminCollapsibleSection
        title="Relais & Verlinkungen"
        description="Abdeckungsberechnung, APRS, Verlinkungs-Verwaltung, Korrekturen"
        icon={RadioTower}
        status={groupRepeaterStatus}
        statusLabel={groupRepeaterLabel}
      >
        {/* APRS.fi Data Fetch */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                <RadioTower className="w-4 h-4 text-purple-600" /> APRS.fi Daten
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                APRS-Stationen weltweit abrufen und Relais-Koordinaten ergänzen
              </p>
            </div>
            <button
              onClick={handleFetchAprsFi}
              disabled={aprsLoading}
              className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-40 flex items-center gap-1.5"
            >
              {aprsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RadioTower className="w-3.5 h-3.5" />}
              {aprsLoading ? "Lädt..." : "Abrufen"}
            </button>
          </div>
          {aprsResult && (
            <div className={`mt-2 p-2 rounded-lg text-xs ${aprsResult.error ? "bg-red-50 dark:bg-red-900/20 text-red-700" : "bg-purple-50 dark:bg-purple-900/20 text-purple-700"}`}>
              {aprsResult.error
                ? `Fehler: ${aprsResult.error}`
                : `${aprsResult.aprs_stations_found || 0} Stationen, ${aprsResult.private_nodes_saved || 0} Nodes gespeichert, ${aprsResult.repeaters_updated_with_coords || 0} Relais mit Koordinaten (${(aprsResult.duration_ms / 1000).toFixed(1)}s)`}
            </div>
          )}
        </section>

        {/* Repeater Coverage Calculator */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
            <Signal className="w-4 h-4 text-green-600" /> Relais-Abdeckung berechnen
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
            Terrain-LOS mit SRTM 30m Höhendaten, Fresnel-Zone & Link-Budget. Erstellt asymmetrische Abdeckungspolygone. Weltweite Relais: Band-Schätzung. CH-Relais: volle Terrain-Berechnung.
          </p>

          {/* Global progress indicator */}
          {coverageProgress?.global && (
            <div className="mb-3 p-2.5 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Globaler Fortschritt</span>
                <button
                  onClick={fetchCoverageProgress}
                  disabled={progressLoading}
                  className="text-[10px] text-blue-600 hover:underline disabled:opacity-40"
                >
                  {progressLoading ? "Aktualisiert..." : "Aktualisieren"}
                </button>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mb-2">
                <div className="text-center" title="Gesamtzahl aller Relais in der Datenbank (weltweit). Quelle: RepeaterBook, ukrepeater.net, WIA, dstarusers.org.">
                  <div className="text-sm font-bold text-gray-900 dark:text-slate-100">{coverageProgress.global.totalRepeaters}</div>
                  <div className="text-[9px] text-gray-400 dark:text-slate-500">Relais gesamt</div>
                </div>
                <div className="text-center" title="Relais mit geografischen Koordinaten (Breiten-/Längengrad). Nur diese werden auf der Karte angezeigt. Koordinaten stammen aus RepeaterBook-Detailseiten oder APRS-Daten.">
                  <div className="text-sm font-bold text-blue-600">{coverageProgress.global.withCoords}</div>
                  <div className="text-[9px] text-gray-400 dark:text-slate-500">Mit Koord.</div>
                </div>
                <div className="text-center" title="Relais, deren Abdeckungsradius durch echte APRS-Positionsdaten verfeinert wurde.">
                  <div className="text-sm font-bold text-green-600">{coverageProgress.global.aprsRefined}</div>
                  <div className="text-[9px] text-gray-400 dark:text-slate-500">APRS-verf.</div>
                </div>
                <div className="text-center" title="Relais mit asymmetrischem Abdeckungspolygon (terrain_los): berechnet mit SRTM 30m Höhenprofil, LOS-Sichtlinie, Fresnel-Zone und Link-Budget pro Radial.">
                  <div className="text-sm font-bold text-teal-600">{coverageProgress.global.terrainAdjusted || 0}</div>
                  <div className="text-[9px] text-gray-400 dark:text-slate-500">Terrain-LOS</div>
                </div>
                <div className="text-center" title="Durchschnittlicher Verfeinerungsgrad: 0% = nur Band-Schätzung, 100% = alle durch APRS/Gelände verfeinert. Grün ≥60%, Gelb ≥30%.">
                  <div className={`text-sm font-bold ${
                    coverageProgress.global.avgRefinementPct >= 60 ? "text-green-600" :
                    coverageProgress.global.avgRefinementPct >= 30 ? "text-amber-600" : "text-gray-400 dark:text-slate-500"
                  }`}>{coverageProgress.global.avgRefinementPct}%</div>
                  <div className="text-[9px] text-gray-400 dark:text-slate-500">Ø Verfein.</div>
                </div>
                <div className="text-center" title="Relais, die von einem Admin für die Neuberechnung markiert wurden (needs_recalc=true). Werden im nächsten Berechnungszyklus aktualisiert.">
                  <div className="text-sm font-bold text-amber-600">{coverageProgress.pendingRecalc || 0}</div>
                  <div className="text-[9px] text-gray-400 dark:text-slate-500">Neuberechn.</div>
                </div>
              </div>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    coverageProgress.global.avgRefinementPct >= 60 ? "bg-green-500" :
                    coverageProgress.global.avgRefinementPct >= 30 ? "bg-amber-500" : "bg-gray-400"
                  }`}
                  style={{ width: `${coverageProgress.global.avgRefinementPct}%` }}
                />
              </div>
              <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">
                {coverageProgress.global.countriesCovered || 0} Länder · {coverageProgress.global.calculated || 0} berechnet
              </p>
            </div>
          )}

          {/* Scope selector + calc button */}
          <div className="flex items-center gap-2">
            <div className="w-36 flex-shrink-0">
              <MobileSelect
                value={coverageScope}
                onValueChange={setCoverageScope}
                triggerClassName="text-xs"
                options={[
                  { value: "CH", label: "Schweiz" },
                  { value: "DE", label: "Deutschland" },
                  { value: "FR", label: "Frankreich" },
                  { value: "IT", label: "Italien" },
                  { value: "AT", label: "Österreich" },
                  { value: "GB", label: "Grossbritannien" },
                  { value: "ES", label: "Spanien" },
                  { value: "US", label: "USA" },
                  { value: "CA", label: "Kanada" },
                  { value: "JP", label: "Japan" },
                  { value: "AU", label: "Australien" },
                  { value: "BR", label: "Brasilien" },
                  { value: "all", label: "Weltweit (alle)" },
                ]}
              />
            </div>
            <button
              onClick={handleCalcCoverage}
              disabled={coverageLoading}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {coverageLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Signal className="w-3.5 h-3.5" />}
              {coverageLoading ? "Berechnet..." : "Berechnen"}
            </button>
            <button
              onClick={handleMarkForRecalc}
              disabled={markingRecalc}
              className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 rounded-lg hover:bg-amber-100 disabled:opacity-40 flex items-center gap-1"
              title="Alle Relais im ausgewählten Land für nächsten Zyklus neu berechnen"
            >
              {markingRecalc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Neu markieren
            </button>
          </div>
          {coverageResult && (
            <div className="mt-2 p-2 rounded-lg text-xs bg-green-50 dark:bg-green-900/20 text-green-700">
              {coverageResult.scope === "worldwide" ? "Weltweit" : coverageResult.scope}: {coverageResult.total} Relais · {coverageResult.bandEstimated} Band-Schätzungen · {coverageResult.aprsRefined} APRS-verfeinert · {coverageResult.updated} aktualisiert
            </div>
          )}

          {/* Coverage Cron-Job Schedule Manager */}
          <CoverageScheduleManager />
        </section>

        {/* Repeater Link Management */}
        <RepeaterLinkManager />

        {/* Repeater Correction Reports */}
        <RepeaterCorrectionManager />

        {/* JSON Repeater Import */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 mb-2">
            <FileJson className="w-4 h-4 text-blue-600" /> JSON Repeater Import
          </h3>
          <JsonRepeaterImport />
        </section>
      </AdminCollapsibleSection>

      {/* ====== GROUP 4: Datenpflege ====== */}
      <AdminCollapsibleSection
        title="Datenpflege"
        description="Burgen-Matching, Wiederherstellungspunkte, TOTA-Verwaltung"
        icon={Wrench}
        status={groupMaintenanceStatus}
        statusLabel={groupMaintenanceLabel}
      >
        {/* Unmatched Castles Editor */}
        <UnmatchedCastles />

        {/* Unmatched Lighthouses — admin can manually add/refine coordinates */}
        <UnmatchedLighthouses />

        {/* Unmatched Repeaters — admin can manually add/refine coordinates */}
        <UnmatchedRepeaters />

        {/* Data Maintenance */}
        <AdminDataMaintains />

        {/* Restore Point Manager */}
        <RestorePointManager />

        {/* TOTA Manager */}
        <TotaManager />
      </AdminCollapsibleSection>

      {/* ====== GROUP 5: System & Benachrichtigungen ====== */}
      <AdminCollapsibleSection
        title="System & Benachrichtigungen"
        description="E-Mail-Settings, Protokoll, externe Quellen, Changelog"
        icon={Bell}
        status={groupSystemStatus}
        statusLabel={groupSystemLabel}
      >
        {/* Notification Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
            <Bell className="w-4 h-4" /> E-Mail-Benachrichtigungen
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">Wählen Sie, über welche Ereignisse Sie informiert werden möchten.</p>
          <div className="space-y-2">
            {[
              { key: "notify_new_user", label: "Neue Benutzer", icon: UserPlus, value: notifyNewUser, setter: setNotifyNewUser },
              { key: "notify_db_update", label: "Datenbank-Updates", icon: Database, value: notifyDbUpdate, setter: setNotifyDbUpdate },
              { key: "notify_app_errors", label: "App-Fehler & Abstürze", icon: AlertTriangle, value: notifyAppErrors, setter: setNotifyAppErrors },
              { key: "notify_demo_login", label: "Demo-Login", icon: User, value: notifyDemoLogin, setter: setNotifyDemoLogin },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-900 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5" /> {item.label}
                  </label>
                </div>
                <button
                  onClick={() => handleToggleNotification(item.key, !item.value, item.setter)}
                  disabled={notifyLoading}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${item.value ? "bg-gray-900" : "bg-gray-300"} ${notifyLoading ? "opacity-40" : ""}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${item.value ? "translate-x-6" : ""}`} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Sync Log */}
        <section>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Aktualisierungsprotokoll
          </h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300 dark:text-slate-600" />
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center">
              <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400 dark:text-slate-500">Noch keine Aktualisierungen protokolliert</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={log.overall_status} />
                      <span className="text-xs font-medium text-gray-900 dark:text-slate-100">
                        {new Date(log.created_date).toLocaleString("de-CH")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-slate-500">
                      <span>{log.trigger === "manual" ? "Manuell" : "Automatisch"}</span>
                      <span>{(log.total_duration_ms / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                    {log.results?.map((r, i) => (
                      <div key={i} className="flex flex-col gap-0.5 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          {r.status === "success"
                            ? <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                            : <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                          <span className="text-gray-600 dark:text-slate-400">{TYPE_LABELS[r.type] || r.type}</span>
                          <span className="text-gray-400 dark:text-slate-500 font-medium">{r.count}</span>
                          {r.error && <span className="text-red-400 truncate" title={r.error}>({r.error.slice(0, 30)})</span>}
                        </div>
                        {r.castleStats && (
                          <div className="ml-5 flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-500">
                            <span className="text-green-600">{r.castleStats.matched} zugeordnet</span>
                            <span className="text-red-400">{r.castleStats.unmatched} offen</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Changelog Email to All Users */}
        <ChangelogEmailSender />

        {/* External Data Check */}
        <ExternalDataCheck />

        {/* External Sources List with PDF Export */}
        <ExternalSourcesList />
      </AdminCollapsibleSection>

      {/* ====== GROUP 6: API-Keys ====== */}
      <AdminCollapsibleSection
        title="API-Keys"
        description="Globale und persönliche API-Keys für QRZ, APRS.fi, BrandMeister"
        icon={KeyRound}
        status={groupApiKeysStatus}
        statusLabel={groupApiKeysLabel}
      >
        <ApiKeyManager />
      </AdminCollapsibleSection>

      {/* ====== GROUP 7: E-Mail-Settings ====== */}
      <AdminCollapsibleSection
        title="E-Mail-Report Einstellungen"
        description="Täglichen Report anpassen, separate E-Mail definieren, Test-Report auslösen"
        icon={Mail}
        status={groupEmailStatus}
        statusLabel={groupEmailLabel}
      >
        <AdminEmailSettings />
      </AdminCollapsibleSection>
    </>
  );
}