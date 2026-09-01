import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Radio, Plus, Download, Archive, Trash2, Filter, Loader2, CheckCircle2, ArchiveRestore, Pencil, Building, HelpCircle, BarChart3, List, Cloud, CloudOff, Upload, CheckSquare, Square, User, Pause, Play } from "lucide-react";
import LogEntryForm from "@/components/map/LogEntryForm";
import AdifImportDialog from "@/components/log/AdifImportDialog";
import BulkEditDialog from "@/components/log/BulkEditDialog";
import PullToRefresh from "@/components/log/PullToRefresh";
import DeleteProgressOverlay from "@/components/log/DeleteProgressOverlay";
import { toast } from "@/components/ui/use-toast";
import MobileSelect from "@/components/ui/MobileSelect";
import BottomNavigation from "@/components/BottomNavigation";
import DonationPopup from "@/components/DonationPopup";
import LogStats from "@/components/log/LogStats";
import WavelogSyncButtons from "@/components/log/WavelogSyncButtons";
import { importFromWavelog, processWavelogOfflineQueue } from "@/lib/wavelogSync";
import { DEMO_EMAIL } from "@/lib/constants";
import { loadLocal, saveLocal, syncFromServer, createEntry, updateEntry, deleteEntry, deleteMany, getLastSync, syncPending, getPendingCount } from "@/lib/localLogStore";

const REF_TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
  castle: "Burg/Schloss", iota: "IOTA", lighthouse: "Leuchtturm",
  swiss_protected: "Bundesinventar", generell: "Generell",   custom: "Eigene"
};

export default function Log() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [filterSource, setFilterSource] = useState("all"); // all | club | personal
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmDeleteSingle, setShowConfirmDeleteSingle] = useState(null);
  const [showConfirmArchive, setShowConfirmArchive] = useState(null);
  const [deletingSingle, setDeletingSingle] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [sortBy, setSortBy] = useState("date_desc");
  const [showQsoForm, setShowQsoForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [view, setView] = useState("list");
  const [lastSync, setLastSync] = useState(getLastSync());
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [qrzUploading, setQrzUploading] = useState(false);
  const [qrzUploadResult, setQrzUploadResult] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clubSyncLoading, setClubSyncLoading] = useState(false);
  const [clubEntries, setClubEntries] = useState([]);
  const [clubLogLoading, setClubLogLoading] = useState(false);
  const [clubLogUploading, setClubLogUploading] = useState(false);
  const [loggingBackend, setLoggingBackend] = useState("qrz");
  const [syncPaused, setSyncPaused] = useState(false);
  const [syncPauseLoading, setSyncPauseLoading] = useState(false);
  const [hasWavelogConfig, setHasWavelogConfig] = useState(false);
  // v0.9018 FORTSCHRITSANZEIGE: Delete progress overlay state
  const [deleteProgress, setDeleteProgress] = useState(null); // { phase, count, total, message }

  // v0.9018 NACHFOLGE: Load per-user sync-pause status on mount
  const loadSyncPauseStatus = async () => {
    try {
      const res = await base44.functions.invoke("manageSyncPause", { action: "get" });
      if (res.data) setSyncPaused(res.data.paused === true);
    } catch {}
  };

  // v0.9018 NACHFOLGE: Toggle per-user sync-pause flag
  const toggleSyncPause = async () => {
    setSyncPauseLoading(true);
    try {
      const res = await base44.functions.invoke("manageSyncPause", { action: "set", paused: !syncPaused });
      if (res.data) {
        const nowPaused = res.data.paused === true;
        setSyncPaused(nowPaused);
        // v0.9018 FORTSCHRITSANZEIGE: Toast confirmation for sync start/stop
        toast({
          title: nowPaused ? "Sync gestoppt" : "Sync gestartet",
          description: nowPaused
            ? "Wavelog-Import wurde pausiert."
            : "Wavelog-Import läuft wieder.",
          duration: 4000,
        });
      }
    } catch {
      toast({
        title: "Fehler",
        description: "Sync-Status konnte nicht geändert werden.",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setSyncPauseLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    loadSyncPauseStatus();
    // Check if demo account (point 13)
    base44.auth.me().then(me => {
      setIsDemo(me?.email === DEMO_EMAIL);
      setIsAdmin(me?.role === "admin");
    }).catch(() => {});
    // Load logging_backend setting + Wavelog config (Wahlschalter: qrz oder wavelog)
    base44.entities.UserHuntingSettings.list()
      .then(data => {
        if (data && data.length > 0) {
          const s = data[0];
          setLoggingBackend(s.logging_backend || "qrz");
          // v0.9018 NACHFOLGE: Sync-Stop button visible for users with Wavelog config
          setHasWavelogConfig(!!(s.wavelog_enabled && s.wavelog_api_key && (s.wavelog_lan_url || s.wavelog_wan_url)));
        }
      })
      .catch(() => {});
    // Wavelog: Auto-Import + Offline Queue beim Öffnen des Logbuches
    // v0.9018 BUGFIX 1: Skip auto-import if sync is paused
    (async () => {
      try {
        const me = await base44.auth.me();
        if (!me) return;
        // Check sync_paused flag before importing
        const pauseRes = await base44.functions.invoke("manageSyncPause", { action: "get" });
        if (pauseRes.data?.paused === true) return; // Sync paused — skip auto-import
        const hs = await base44.entities.UserHuntingSettings.list();
        if (hs && hs.length > 0) {
          const s = hs[0];
          if (s.wavelog_enabled && s.logging_backend === "wavelog" && navigator.onLine) {
            const config = {
              wavelog_enabled: s.wavelog_enabled,
              wavelog_lan_url: s.wavelog_lan_url,
              wavelog_wan_url: s.wavelog_wan_url,
              wavelog_api_key: s.wavelog_api_key,
              wavelog_station_id: s.wavelog_station_id,
              wavelog_last_fetch_id: s.wavelog_last_fetch_id || 0,
              wavelog_auto_sync: s.wavelog_auto_sync,
            };
            // Delta-Import
            const r = await importFromWavelog(config);
            if (r.success && r.imported > 0) {
              await base44.entities.UserHuntingSettings.update(s.id, {
                wavelog_last_fetch_id: r.lastfetchedid,
              });
              loadEntries(); // neu laden
            }
            // Offline Queue abarbeiten
            await processWavelogOfflineQueue(config);
          }
        }
      } catch (e) { /* silent */ }
    })();
  }, []);

  // React to background log-store changes (optimistic sync completions)
  useEffect(() => {
    const handler = () => {
      setEntries(loadLocal());
      setLastSync(getLastSync());
      setPendingCount(getPendingCount());
    };
    window.addEventListener("log-cache-changed", handler);
    // Wavelog: Offline Queue bei "online" Event abarbeiten
    const onlineHandler = async () => {
      try {
        const hs = await base44.entities.UserHuntingSettings.list();
        if (hs && hs.length > 0) {
          const s = hs[0];
          if (s.wavelog_enabled && s.wavelog_auto_sync) {
            const config = {
              wavelog_enabled: s.wavelog_enabled,
              wavelog_lan_url: s.wavelog_lan_url,
              wavelog_wan_url: s.wavelog_wan_url,
              wavelog_api_key: s.wavelog_api_key,
              wavelog_station_id: s.wavelog_station_id,
              wavelog_auto_sync: s.wavelog_auto_sync,
            };
            await processWavelogOfflineQueue(config);
          }
        }
      } catch (e) { /* silent */ }
    };
    window.addEventListener("online", onlineHandler);
    return () => {
      window.removeEventListener("log-cache-changed", handler);
      window.removeEventListener("online", onlineHandler);
    };
  }, []);

  // v0.9003: Load club entries via getClubLog (service-role, bypasses RLS)
  const loadClubEntries = async () => {
    setClubLogLoading(true);
    try {
      const res = await base44.functions.invoke("getClubLog", { limit: 500, skip: 0 });
      if (res.data?.success) {
        setClubEntries(res.data.records || []);
      }
    } catch {} finally {
      setClubLogLoading(false);
    }
  };

  // Reload club entries when club filter is activated
  useEffect(() => {
    if (filterSource === "club") {
      loadClubEntries();
    }
  }, [filterSource]);

  const loadEntries = async () => {
    const local = loadLocal();
    if (local.length > 0) {
      setEntries(local);
      setLoading(false);
    }
    await syncPending();
    const data = await syncFromServer();
    setEntries(data || []);
    setLastSync(getLastSync());
    setPendingCount(getPendingCount());
    setLoading(false);
  };

  const filtered = useMemo(() => {
    // v0.9018 FIX: Filter by log_type with backward compat for legacy entries (is_clubstation fallback)
    const getLogType = (e) => e.log_type || (e.is_clubstation ? "club" : "private");
    // v0.9003 Problem 6: When club filter is active, use clubEntries (from getClubLog service-role)
    let result = filterSource === "club" ? [...clubEntries] : [...entries];
    if (filterType !== "all") result = result.filter(e => e.my_reference_type === filterType);
    if (filterStatus !== "all") result = result.filter(e => e.status === filterStatus);
    // v0.9018 FIX: Filter by log_type — "private" shows only private, "club" shows only club
    if (filterSource === "private") result = result.filter(e => getLogType(e) === "private");
    if (filterSource === "club") result = result.filter(e => getLogType(e) === "club");
    if (filterDateFrom) result = result.filter(e => (e.qso_date || "") >= filterDateFrom);
    if (filterDateTo) result = result.filter(e => (e.qso_date || "") <= filterDateTo);
    if (sortBy === "date_desc") result.sort((a, b) => (b.qso_date || "").localeCompare(a.qso_date || ""));
    if (sortBy === "date_asc") result.sort((a, b) => (a.qso_date || "").localeCompare(b.qso_date || ""));
    if (sortBy === "callsign") result.sort((a, b) => (a.callsign || "").localeCompare(b.callsign || ""));
    return result;
  }, [entries, clubEntries, filterType, filterStatus, sortBy, filterSource, filterDateFrom, filterDateTo]);

  const handleExport = () => {
    const header = "HB9OM On Field - ADIF Export\n<adif_ver:5>3.1.4\n<programid:14>HB9OM On Field\n<eoh>\n\n";
    const records = filtered.map(e => {
      const fullCall = (e.callsign || "") + (e.callsign_suffix || "");
      const fields = [
        `<call:${fullCall.length}>${fullCall}`,
        `<qso_date:8>${(e.qso_date || "").replace(/-/g, "")}`,
        `<time_on:4>${(e.time_start || "").replace(":", "")}`,
        `<band:${(e.band || "").length}>${e.band || ""}`,
        `<mode:${(e.mode || "").length}>${e.mode || ""}`,
        e.frequency ? `<freq:${String(e.frequency).length}>${e.frequency}` : "",
        `<rst_sent:${(e.rst_sent || "").length}>${e.rst_sent || ""}`,
        `<rst_rcvd:${(e.rst_received || "").length}>${e.rst_received || ""}`,
        e.my_reference ? `<my_sig_info:${(e.my_reference).length}>${e.my_reference}` : "",
        e.operator_name ? `<name:${(e.operator_name).length}>${e.operator_name}` : "",
        e.operator_grid ? `<gridsquare:${(e.operator_grid).length}>${e.operator_grid}` : "",
        e.operator_country ? `<country:${(e.operator_country).length}>${e.operator_country}` : "",
        e.my_grid ? `<my_gridsquare:${(e.my_grid).length}>${e.my_grid}` : "",
        e.is_clubstation && e.club_callsign ? `<station_callsign:${(e.club_callsign).length}>${e.club_callsign}` : "",
        e.is_clubstation && e.club_operator_callsign ? `<operator:${(e.club_operator_callsign).length}>${e.club_operator_callsign}` : "",
        e.notes ? `<notes:${(e.notes).length}>${e.notes}` : "",
        e.power != null ? `<tx_pwr:${String(e.power).length}>${e.power}` : "",
      ].filter(Boolean).join(" ");
      return fields + " <eor>";
    }).join("\n");

    const blob = new Blob([header + records], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hb9om_log_${new Date().toISOString().slice(0, 10)}.adi`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // v0.9003 Problem 2: Upload filtered QSOs to QRZ.com — club target ONLY uploads is_clubstation: true
  const handleQrzUpload = async (target) => {
    // Filter: club target only uploads club QSOs, private target only uploads private QSOs
    let qsoToUpload = filtered;
    if (target === 'club') {
      qsoToUpload = filtered.filter(e => e.is_clubstation === true);
    } else if (target === 'personal') {
      qsoToUpload = filtered.filter(e => !e.is_clubstation);
    }
    if (qsoToUpload.length === 0) {
      setQrzUploadResult({ success: false, message: target === 'club' ? 'Keine Club-QSOs (is_clubstation: true) zum Hochladen' : 'Keine privaten QSOs zum Hochladen' });
      setTimeout(() => setQrzUploadResult(null), 5000);
      return;
    }
    setQrzUploading(true);
    setQrzUploadResult(null);
    try {
      const header = "<adif_ver:5>3.1.4\n<programid:14>HB9OM On Field\n<eoh>\n\n";
      const records = qsoToUpload.map(e => {
        const fullCall = (e.callsign || "") + (e.callsign_suffix || "");
        const fields = [
          `<call:${fullCall.length}>${fullCall}`,
          `<qso_date:8>${(e.qso_date || "").replace(/-/g, "")}`,
          `<time_on:4>${(e.time_start || "").replace(":", "")}`,
          `<band:${(e.band || "").length}>${e.band || ""}`,
          `<mode:${(e.mode || "").length}>${e.mode || ""}`,
          e.frequency ? `<freq:${String(e.frequency).length}>${e.frequency}` : "",
          `<rst_sent:${(e.rst_sent || "").length}>${e.rst_sent || ""}`,
          `<rst_rcvd:${(e.rst_received || "").length}>${e.rst_received || ""}`,
          e.my_reference ? `<my_sig_info:${(e.my_reference).length}>${e.my_reference}` : "",
          e.operator_name ? `<name:${(e.operator_name).length}>${e.operator_name}` : "",
          e.operator_grid ? `<gridsquare:${(e.operator_grid).length}>${e.operator_grid}` : "",
          e.operator_country ? `<country:${(e.operator_country).length}>${e.operator_country}` : "",
          e.my_grid ? `<my_gridsquare:${(e.my_grid).length}>${e.my_grid}` : "",
          e.is_clubstation && e.club_callsign ? `<station_callsign:${(e.club_callsign).length}>${e.club_callsign}` : "",
          e.is_clubstation && e.club_operator_callsign ? `<operator:${(e.club_operator_callsign).length}>${e.club_operator_callsign}` : "",
          e.notes ? `<notes:${(e.notes).length}>${e.notes}` : "",
          e.power != null ? `<tx_pwr:${String(e.power).length}>${e.power}` : "",
        ].filter(Boolean).join(" ");
        return fields + " <eor>";
      }).join("\n");

      const adif = header + records;
      const res = await base44.functions.invoke("uploadToQrz", { adif_data: adif, target });
      if (res.data?.error) {
        setQrzUploadResult({ success: false, message: res.data.error });
        toast({ title: "QRZ Upload Fehler", description: res.data.error, variant: "destructive", duration: 5000 });
      } else {
        const msg = res.data?.message || "Upload erfolgreich";
        setQrzUploadResult({ success: true, message: msg });
        toast({ title: "QRZ Upload", description: msg, duration: 5000 });
      }
    } catch (e) {
      const msg = e.message || "Fehler beim Upload";
      setQrzUploadResult({ success: false, message: msg });
      toast({ title: "QRZ Upload Fehler", description: msg, variant: "destructive", duration: 5000 });
    } finally {
      setQrzUploading(false);
      setTimeout(() => setQrzUploadResult(null), 5000);
    }
  };

  // v0.9003 Problem 2: Club-Log-Sync — backend now parses ADIF + saves with is_clubstation=true
  const handleClubLogSync = async () => {
    setClubSyncLoading(true);
    setQrzUploadResult(null);
    try {
      const res = await base44.functions.invoke("fetchQrzClubLog", {});
      if (res.data?.error) {
        setQrzUploadResult({ success: false, message: res.data.error });
        toast({ title: "QRZ Club Fehler", description: res.data.error, variant: "destructive", duration: 5000 });
      } else if (res.data?.status === "success") {
        const msg = res.data.message || `QRZ Club: ${res.data.imported || 0} Einträge importiert`;
        setQrzUploadResult({ success: true, message: msg });
        toast({ title: "QRZ Club", description: msg, duration: 5000 });
        loadEntries();
        if (filterSource === "club") loadClubEntries();
      } else {
        setQrzUploadResult({ success: false, message: "Keine QSOs im Club-Logbuch gefunden" });
        toast({ title: "QRZ Club", description: "Keine QSOs im Club-Logbuch gefunden", variant: "destructive", duration: 5000 });
      }
    } catch (e) {
      const msg = e.message || "Fehler beim QRZ Club Download";
      setQrzUploadResult({ success: false, message: msg });
      toast({ title: "QRZ Club Fehler", description: msg, variant: "destructive", duration: 5000 });
    } finally {
      setClubSyncLoading(false);
      setTimeout(() => setQrzUploadResult(null), 5000);
    }
  };

  // v0.9003 Problem 4: ClubLog Upload — uploads private QSOs to clublog.org
  const handleClubLogUpload = async () => {
    setClubLogUploading(true);
    setQrzUploadResult(null);
    try {
      const res = await base44.functions.invoke("syncClubLog", {});
      if (res.data?.error) {
        setQrzUploadResult({ success: false, message: res.data.error });
        toast({ title: "Club Sync Fehler", description: res.data.error, variant: "destructive", duration: 5000 });
      } else if (res.data?.status === "success") {
        const msg = res.data.message || `${res.data.uploaded || 0} QSOs an ClubLog gesendet`;
        setQrzUploadResult({ success: true, message: msg });
        toast({ title: "Club Sync", description: msg, duration: 5000 });
        loadEntries();
      } else {
        setQrzUploadResult({ success: false, message: "ClubLog-Upload fehlgeschlagen" });
        toast({ title: "Club Sync Fehler", description: "ClubLog-Upload fehlgeschlagen", variant: "destructive", duration: 5000 });
      }
    } catch (e) {
      const msg = e.message || "Fehler beim Club Sync";
      setQrzUploadResult({ success: false, message: msg });
      toast({ title: "Club Sync Fehler", description: msg, variant: "destructive", duration: 5000 });
    } finally {
      setClubLogUploading(false);
      setTimeout(() => setQrzUploadResult(null), 5000);
    }
  };

  const handleArchive = async (id) => {
    try {
      await updateEntry(id, { status: "archived" });
      setShowConfirmArchive(null);
      loadEntries();
    } catch (e) { }
  };

  const handleDeleteAll = async () => {
    const toDelete = filtered.map(e => e.id);
    const total = toDelete.length;
    // v0.9018 FORTSCHRITSANZEIGE: Show progress overlay
    setDeleteProgress({ phase: "deleting", count: 0, total });
    try {
      const res = await base44.functions.invoke("deleteUserLogEntries", { ids: toDelete });
      const deletedCount = res.data?.deletedCount || total;
      // Remove from local cache immediately
      const local = loadLocal();
      saveLocal(local.filter(e => !toDelete.includes(e.id)));
      setShowConfirmDelete(false);
      // Show success state in overlay
      setDeleteProgress({ phase: "done", count: deletedCount, total, message: `${deletedCount} Einträge erfolgreich gelöscht` });
      loadEntries();
    } catch (e) {
      setDeleteProgress({ phase: "error", message: e.message || "Löschen fehlgeschlagen" });
    }
  };

  const handleDeleteSingle = async (entry) => {
    setShowConfirmDeleteSingle(entry);
  };

  const confirmDeleteSingle = async () => {
    if (!showConfirmDeleteSingle) return;
    setDeletingSingle(true);
    setDeleteProgress({ phase: "deleting", count: 0, total: 1 });
    try {
      const res = await base44.functions.invoke("deleteUserLogEntries", { ids: [showConfirmDeleteSingle.id] });
      const deletedCount = res.data?.deletedCount || 1;
      // Also remove from local cache immediately
      const local = loadLocal();
      saveLocal(local.filter(e => e.id !== showConfirmDeleteSingle.id));
      setShowConfirmDeleteSingle(null);
      setDeleteProgress({ phase: "done", count: deletedCount, total: 1, message: `QSO erfolgreich gelöscht` });
      loadEntries();
    } catch (e) {
      setDeleteProgress({ phase: "error", message: e.message || "Löschen fehlgeschlagen" });
    } finally {
      setDeletingSingle(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const total = selectedIds.length;
    setDeletingSelected(true);
    setDeleteProgress({ phase: "deleting", count: 0, total });
    try {
      const res = await base44.functions.invoke("deleteUserLogEntries", { ids: selectedIds });
      const deletedCount = res.data?.deletedCount || total;
      // Also remove from local cache immediately
      const local = loadLocal();
      saveLocal(local.filter(e => !selectedIds.includes(e.id)));
      setSelectedIds([]);
      setSelectMode(false);
      setDeleteProgress({ phase: "done", count: deletedCount, total, message: `${deletedCount} Einträge erfolgreich gelöscht` });
      loadEntries();
    } catch (e) {
      setDeleteProgress({ phase: "error", message: e.message || "Löschen fehlgeschlagen" });
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await updateEntry(id, { status: "active" });
      loadEntries();
    } catch (e) { }
  };

  const handleEdit = (entry) => {
    setEditEntry(entry);
    setShowQsoForm(true);
  };

  const handleCloseForm = () => {
    setShowQsoForm(false);
    setEditEntry(null);
  };

  const typeCounts = useMemo(() => {
    const counts = {};
    entries.forEach(e => {
      const t = e.my_reference_type || "custom";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [entries]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">QSO-Logbuch</h1>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-gray-400">{entries.length} Einträge</p>
                {pendingCount > 0 ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-500" title={`${pendingCount} Eintrag${pendingCount !== 1 ? 'en' : ''} wartet auf Synchronisation`}>
                    <CloudOff className="w-2.5 h-2.5" /> {pendingCount} ausstehend
                  </span>
                ) : lastSync ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-green-500" title={`Zuletzt synchronisiert: ${new Date(lastSync).toLocaleString('de-CH')}`}>
                    <Cloud className="w-2.5 h-2.5" /> synchronisiert
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                    <CloudOff className="w-2.5 h-2.5" /> lokal
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setView(view === "list" ? "stats" : "list")}
            className={`p-1.5 rounded-lg ${view === "stats" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
            title={view === "list" ? "Statistik anzeigen" : "Liste anzeigen"}
          >
            {view === "list" ? <BarChart3 className="w-5 h-5" /> : <List className="w-5 h-5" />}
          </button>
          <button
            onClick={() => {
              setSelectMode(!selectMode);
              setSelectedIds([]);
            }}
            className={`p-1.5 rounded-lg ${selectMode ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
            title={selectMode ? "Auswahl beenden" : "Mehrfachauswahl"}
          >
            <CheckSquare className="w-5 h-5" />
          </button>
          {hasWavelogConfig && (
            <button
              onClick={toggleSyncPause}
              disabled={syncPauseLoading}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                syncPaused
                  ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
                  : "bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
              } ${syncPauseLoading ? "opacity-50" : ""}`}
              title={syncPaused ? "Sync ist pausiert — Klick zum Starten" : "Sync läuft — Klick zum Stoppen"}
            >
              {syncPauseLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : syncPaused ? (
                <Play className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
              {syncPaused ? "Sync Starten" : "Sync Stoppen"}
            </button>
          )}
          <Link to="/help" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Hilfe">
            <HelpCircle className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 pb-24">
        {view === "stats" && <LogStats entries={entries} />}
        {view === "list" && (
        <PullToRefresh onRefresh={loadEntries}>
        {/* Bulk action bar (select mode) */}
        {selectMode && (
          <div className="bg-blue-600 text-white rounded-xl p-3 mb-4 flex items-center gap-2">
            <button
              onClick={() => {
                const allIds = filtered.map(e => e.id);
                setSelectedIds(selectedIds.length === allIds.length ? [] : allIds);
              }}
              className="px-3 py-1.5 text-sm font-medium bg-white/20 rounded-lg hover:bg-white/30 flex items-center gap-1.5"
            >
              {selectedIds.length === filtered.length && filtered.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectedIds.length === filtered.length && filtered.length > 0 ? "Alle abwählen" : "Alle auswählen"}
            </button>
            <span className="text-sm font-medium flex-1">{selectedIds.length} ausgewählt</span>
            <button
              onClick={() => setShowBulkEdit(true)}
              disabled={selectedIds.length === 0}
              className="px-3 py-1.5 text-sm font-medium bg-white text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <User className="w-4 h-4" /> Umbuchen
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0 || deletingSelected}
              className="px-3 py-1.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              {deletingSelected ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Löschen ({selectedIds.length})
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className={`bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-3 mb-4 flex flex-wrap items-center gap-2`}>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          <MobileSelect
            value={filterType}
            onValueChange={setFilterType}
            triggerClassName="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
            options={[
              { value: "all", label: "Alle Typen" },
              ...Object.entries(REF_TYPE_LABELS).map(([v, l]) => ({ value: v, label: `${l} (${typeCounts[v] || 0})` }))
            ]}
          />
          <MobileSelect
            value={filterStatus}
            onValueChange={setFilterStatus}
            triggerClassName="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
            options={[
              { value: "active", label: "Aktiv" },
              { value: "archived", label: "Archiviert" },
              { value: "all", label: "Alle" }
            ]}
          />
          <MobileSelect
            value={sortBy}
            onValueChange={setSortBy}
            triggerClassName="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
            options={[
              { value: "date_desc", label: "Datum (neueste zuerst)" },
              { value: "date_asc", label: "Datum (älteste zuerst)" },
              { value: "callsign", label: "Rufzeichen (A-Z)" }
            ]}
          />
          {/* v0.9018: Toggle-Buttons Alle | Privat | Club */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
            {[
              { value: "all", label: "Alle" },
              { value: "private", label: "Privat" },
              { value: "club", label: "Club" }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterSource(opt.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filterSource === opt.value
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              title="Datum von"
              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
            />
            <span className="text-gray-400 text-xs">–</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              title="Datum bis"
              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
            />
            {(filterDateFrom || filterDateTo) && (
              <button
                onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                title="Datum zurücksetzen"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex-1" />

          <span className="text-xs text-gray-400">{filtered.length} Einträge</span>

          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" /> Import
          </button>

          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export (ADIF)
          </button>

          {filtered.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {isDemo ? (
                <span className="px-3 py-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1.5" title="QRZ-Upload im Demo-Konto gesperrt">
                  <Upload className="w-4 h-4 opacity-40" />
                  <span className="opacity-60">QRZ-Upload (Demo gesperrt)</span>
                </span>
              ) : (
                <>
                  {/* QRZ Club — immer sichtbar (Ausnahme: Club-Log kann immer QRZ verwenden) */}
                  <button
                    onClick={() => handleQrzUpload('club')}
                    disabled={qrzUploading}
                    className="px-3 py-1.5 text-sm font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 disabled:opacity-40 flex items-center gap-1.5"
                    title="Gefilterte QSOs zu QRZ.com Club-Logbuch hochladen"
                  >
                    {qrzUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} QRZ Club Upload
                  </button>
                  {/* QRZ Personal — nur wenn Wahlschalter auf "qrz" (nicht "wavelog") */}
                  {loggingBackend !== "wavelog" && (
                    <button
                      onClick={() => handleQrzUpload('personal')}
                      disabled={qrzUploading}
                      className="px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-40 flex items-center gap-1.5"
                      title="Gefilterte QSOs zu persönlichem QRZ-Logbuch hochladen"
                    >
                      {qrzUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} QRZ Pers.
                    </button>
                  )}
                  {/* PUNKT 5: Club-Log-Sync — nur für Admins */}
                </>
              )}
            </div>
          )}
          {qrzUploadResult && (
            <div className={`text-xs font-medium px-2 py-1 rounded ${qrzUploadResult.success ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {qrzUploadResult.message}
            </div>
          )}
        </div>

        {/* Action Buttons Group — v0.9018 — 6 Buttons ALWAYS visible, no conditional rendering */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3 mb-4">
          {syncPaused && (
            <div className="mb-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Pause className="w-3.5 h-3.5" /> Sync ist gestoppt — Import/Sync-Buttons sind deaktiviert
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. QRZ Club — fetchQrzClubLog (Download from QRZ Club Logbook) */}
            <button
              onClick={handleClubLogSync}
              disabled={syncPaused || clubSyncLoading}
              className="px-3 py-2 text-sm font-medium text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              title={syncPaused ? "Sync ist gestoppt" : "QSOs vom QRZ Club-Logbuch herunterladen und importieren"}
            >
              {clubSyncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              QRZ Club
            </button>
            {/* 2. Club Sync — syncClubLog (Upload to clublog.org) */}
            <button
              onClick={handleClubLogUpload}
              disabled={syncPaused || clubLogUploading}
              className="px-3 py-2 text-sm font-medium text-cyan-700 border border-cyan-200 rounded-lg hover:bg-cyan-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              title={syncPaused ? "Sync ist gestoppt" : "Private QSOs zu ClubLog (clublog.org) hochladen"}
            >
              {clubLogUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Club Sync
            </button>
            {/* 3-5. Wavelog: Club Log Wavelog + Wavelog Import + Wavelog Voll Import */}
            <WavelogSyncButtons onSynced={loadEntries} syncPaused={syncPaused} />
            {/* 6. Löschen — always active, even when sync is paused */}
            <button
              onClick={() => setShowConfirmDelete(true)}
              disabled={filtered.length === 0}
              className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ml-auto"
              title={filtered.length === 0 ? "Keine Einträge zum Löschen" : "Alle gefilterten Log-Einträge löschen"}
            >
              <Trash2 className="w-4 h-4" /> Löschen
            </button>
          </div>
        </div>

        {/* Entries */}
        {view === "stats" ? null : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Radio className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Keine Log-Einträge gefunden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => (
              <div
                key={entry.id}
                onClick={() => {
                  if (!selectMode) return;
                  setSelectedIds(prev =>
                    prev.includes(entry.id) ? prev.filter(id => id !== entry.id) : [...prev, entry.id]
                  );
                }}
                className={`bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border p-4 ${entry.status === "archived" ? "border-gray-100 dark:border-slate-800 opacity-60" : "border-gray-200 dark:border-slate-700"} ${selectMode && selectedIds.includes(entry.id) ? "ring-2 ring-blue-500 border-blue-400" : ""} ${selectMode ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {selectMode && (
                    <button
                      onClick={() => {
                        setSelectedIds(prev =>
                          prev.includes(entry.id) ? prev.filter(id => id !== entry.id) : [...prev, entry.id]
                        );
                      }}
                      className="flex-shrink-0 mt-0.5"
                    >
                      {selectedIds.includes(entry.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-300" />
                      )}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900 text-sm">{entry.callsign}{entry.callsign_suffix}</span>
                      {entry.operator_name && <span className="text-xs text-gray-500">{entry.operator_name}</span>}
                      {entry.is_clubstation && entry.club_callsign && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1">
                          <Building className="w-2.5 h-2.5" /> {entry.club_callsign}
                          {entry.club_operator_callsign && ` · Op: ${entry.club_operator_callsign}`}
                        </span>
                      )}
                      {entry.is_clubstation && !entry.club_callsign && entry.club_operator_callsign && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">Op: {entry.club_operator_callsign}{entry.club_operator_name && ` · ${entry.club_operator_name}`}</span>
                      )}
                      {entry.status === "archived" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">Archiviert</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>{entry.qso_date} {entry.time_start && `· ${entry.time_start} UTC`}</span>
                      <span className="font-medium">{entry.band} {entry.mode}</span>
                      {entry.frequency && <span>{entry.frequency} MHz</span>}
                      <span>RST {entry.rst_sent}/{entry.rst_received}</span>
                      {entry.my_suffix && <span className="text-blue-600 font-medium">{entry.my_suffix}</span>}
                    </div>
                    {entry.my_reference && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs">
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                          {REF_TYPE_LABELS[entry.my_reference_type] || entry.my_reference_type}
                        </span>
                        <span className="font-mono text-gray-700">{entry.my_reference}</span>
                        {entry.my_reference_name && <span className="text-gray-400">· {entry.my_reference_name}</span>}
                      </div>
                    )}
                    {!entry.my_reference && entry.my_grid && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs">
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-medium">Locator</span>
                        <span className="font-mono text-gray-700">{entry.my_grid}</span>
                      </div>
                    )}
                    {(entry.operator_address || entry.operator_country || entry.operator_email) && (
                      <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                        {entry.operator_address && <p>{entry.operator_address}</p>}
                        <p>{entry.operator_country}{entry.operator_grid && ` · Grid: ${entry.operator_grid}`}{entry.operator_email && ` · ${entry.operator_email}`}</p>
                      </div>
                    )}
                    {entry.notes && <p className="text-xs text-gray-400 mt-1 italic">{entry.notes}</p>}
                  </div>
                  {!selectMode && (
                  <div className="flex flex-col gap-1">
                    {entry.status !== "archived" && (
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                        title="Bearbeiten"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {entry.status === "archived" ? (
                      <button
                        onClick={() => handleUnarchive(entry.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                        title="Wiederherstellen"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowConfirmArchive(entry.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                        title="Archivieren"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSingle(entry)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PullToRefresh>
      )}
      </div>

      {showQsoForm && (
        <LogEntryForm
          mapCenter={null}
          allMarkers={[]}
          editEntry={editEntry}
          onClose={handleCloseForm}
          onSaved={loadEntries}
        />
      )}

      {showImport && (
        <AdifImportDialog
          onClose={() => setShowImport(false)}
          onImported={loadEntries}
        />
      )}

      {showBulkEdit && (
        <BulkEditDialog
          selectedIds={selectedIds}
          entries={entries}
          onClose={() => setShowBulkEdit(false)}
          onApplied={() => {
            setShowBulkEdit(false);
            setSelectMode(false);
            setSelectedIds([]);
            loadEntries();
          }}
        />
      )}

      {/* Confirm Delete All Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowConfirmDelete(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-slate-100">Log-Einträge löschen?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center mt-2">
              Möchten Sie wirklich <strong>{filtered.length}</strong> gefilterte{filterType !== "all" ? ` (${REF_TYPE_LABELS[filterType]})` : ""} Einträge unwiderruflich löschen?
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowConfirmDelete(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                Abbrechen
              </button>
              <button onClick={handleDeleteAll} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Archive Modal */}
      {showConfirmArchive && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowConfirmArchive(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-slate-100">Eintrag archivieren?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center mt-2">
              Der Eintrag wird archiviert und kann jederzeit wiederhergestellt werden.
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowConfirmArchive(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                Abbrechen
              </button>
              <button onClick={() => handleArchive(showConfirmArchive)} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600">
                Archivieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Single Modal — v0.9004 BUG 1 */}
      {showConfirmDeleteSingle && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => !deletingSingle && setShowConfirmDeleteSingle(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-slate-100">QSO löschen?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center mt-2">
              QSO mit <strong className="text-gray-900 dark:text-slate-100">{showConfirmDeleteSingle.callsign}{showConfirmDeleteSingle.callsign_suffix || ''}</strong> am <strong className="text-gray-900 dark:text-slate-100">{showConfirmDeleteSingle.qso_date}</strong> unwiderruflich löschen?
            </p>
            {showConfirmDeleteSingle.is_clubstation && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-700">Dies ist ein Club-Log-Eintrag ({showConfirmDeleteSingle.club_callsign || 'Clubstation'})</span>
              </div>
            )}
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowConfirmDeleteSingle(null)} disabled={deletingSingle} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">
                Abbrechen
              </button>
              <button onClick={confirmDeleteSingle} disabled={deletingSingle} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {deletingSingle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* v0.9018 FORTSCHRITSANZEIGE: Delete progress overlay */}
      <DeleteProgressOverlay
        phase={deleteProgress?.phase}
        count={deleteProgress?.count}
        total={deleteProgress?.total}
        message={deleteProgress?.message}
        onClose={() => setDeleteProgress(null)}
      />

      <DonationPopup />
      <BottomNavigation />
    </div>
  );
}