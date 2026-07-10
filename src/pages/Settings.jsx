import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle, Settings as SettingsIcon, Database, Clock, Radio, User, Check, Search, HelpCircle, Trash2, AlertTriangle, Users, UserPlus, MapPin, Bell, Download, HardDrive, Wifi, WifiOff, ClipboardList, LogOut, KeyRound } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import UnmatchedCastles from "@/components/admin/UnmatchedCastles";
import { getOfflineAreas, deleteArea, clearAllTiles, getStorageEstimate } from "@/lib/offlineMapStore";

const TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
  castle: "Burgen/Schlösser", lighthouse: "Leuchttürme", iota: "IOTA"
};

export default function Settings() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [cacheStatus, setCacheStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [qrzLookups, setQrzLookups] = useState([]);

  // User profile
  const [myCallsign, setMyCallsign] = useState("");
  const [qrzEnabled, setQrzEnabled] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [qrzTesting, setQrzTesting] = useState(false);
  const [qrzTestResult, setQrzTestResult] = useState(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [autoUpdateLoading, setAutoUpdateLoading] = useState(false);
  const [notifyNewUser, setNotifyNewUser] = useState(true);
  const [notifyDbUpdate, setNotifyDbUpdate] = useState(true);
  const [notifyAppErrors, setNotifyAppErrors] = useState(true);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [demoSettingUp, setDemoSettingUp] = useState(false);
  const [offlineAreas, setOfflineAreas] = useState([]);
  const [storageInfo, setStorageInfo] = useState({ areas: 0, tiles: 0 });
  const [forceOffline, setForceOffline] = useState(() => localStorage.getItem("hb9om_force_offline") === "true");
  const [pendingChangeRequests, setPendingChangeRequests] = useState(0);
  const [adminPendingRequests, setAdminPendingRequests] = useState(0);
  const [demoSetupResult, setDemoSetupResult] = useState(null);
  const [demoOtpCode, setDemoOtpCode] = useState("");
  const [demoVerifying, setDemoVerifying] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    loadData();
    loadProfile();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, cacheData, qrzData, settingsData] = await Promise.all([
        base44.entities.SyncLog.list("-created_date", 10),
        base44.entities.ReferenceData.list(),
        base44.entities.QrzLookup.list("-created_date", 10),
        base44.entities.AppSetting.filter({ key: "auto_update" })
      ]);
      setLogs(logsData || []);
      setCacheStatus(cacheData || []);
      setQrzLookups(qrzData || []);
      getOfflineAreas().then(areas => setOfflineAreas(areas)).catch(() => {});
      getStorageEstimate().then(info => setStorageInfo(info)).catch(() => {});
      base44.entities.ReferenceChangeRequest.filter({ status: "pending" })
        .then(data => setPendingChangeRequests(data?.length || 0))
        .catch(() => {});
      // Admin: fetch ALL pending requests via backend function (bypasses RLS)
      base44.functions.invoke("adminManageUsers", { action: "checkStatus" })
        .then(res => {
          if (res.data?.isAdmin) {
            return Promise.all([
              base44.functions.invoke("manageChangeRequests", { action: "listAll" }),
              base44.auth.me()
            ]);
          }
          return null;
        })
        .then(res => {
          if (res) {
            const [reqRes, me] = res;
            const myId = me?.id;
            const pending = (reqRes?.data?.requests || []).filter(r => r.status === "pending" && r.created_by_id !== myId).length;
            setAdminPendingRequests(pending);
          }
        })
        .catch(() => {});
      if (settingsData && settingsData.length > 0) {
        setAutoUpdateEnabled(settingsData[0].enabled !== false);
      }
      // Load notification preferences
      const [newUserSettings, dbUpdateSettings, errorSettings] = await Promise.all([
        base44.entities.AppSetting.filter({ key: "notify_new_user" }),
        base44.entities.AppSetting.filter({ key: "notify_db_update" }),
        base44.entities.AppSetting.filter({ key: "notify_app_errors" })
      ]);
      if (newUserSettings?.length > 0) setNotifyNewUser(newUserSettings[0].enabled !== false);
      if (dbUpdateSettings?.length > 0) setNotifyDbUpdate(dbUpdateSettings[0].enabled !== false);
      if (errorSettings?.length > 0) setNotifyAppErrors(errorSettings[0].enabled !== false);
    } catch (e) {
      setLogs([]);
      setCacheStatus([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    setMyCallsign(localStorage.getItem("hb9om_my_callsign") || "");
    setQrzEnabled(localStorage.getItem("hb9om_qrz_enabled") !== "false");
    try {
      const me = await base44.auth.me();
      setCurrentUser(me);
      // Check admin status via backend function with fresh DB lookup
      try {
        const res = await base44.functions.invoke("adminManageUsers", { action: "checkStatus" });
        setIsAdmin(res.data?.isAdmin === true);
      } catch (e) {
        setIsAdmin(false);
      }
    } catch (e) { }
  };

  const handleQrzTest = async () => {
    setQrzTesting(true);
    setQrzTestResult(null);
    try {
      const res = await base44.functions.invoke("fetchQRZ", {
        callsign: "HB9OM"
      });
      if (res.data?.error) {
        setQrzTestResult({ success: false, message: res.data.error });
      } else if (res.data?.callsign) {
        setQrzTestResult({ success: true, message: `Erfolgreich: ${res.data.callsign} – ${res.data.name || 'kein Name'}`, data: res.data });
      } else {
        setQrzTestResult({ success: false, message: "Unerwartete Antwort von QRZ.com" });
      }
    } catch (e) {
      const detail = e?.response?.data?.error || e?.message || "unbekannt";
      setQrzTestResult({ success: false, message: "Fehler: " + detail });
    } finally {
      setQrzTesting(false);
    }
  };

  const handleSaveProfile = () => {
    setProfileSaving(true);
    localStorage.setItem("hb9om_my_callsign", myCallsign.toUpperCase().trim());
    localStorage.setItem("hb9om_qrz_enabled", String(qrzEnabled));
    localStorage.setItem("hb9om_setup_complete", "true");
    setTimeout(() => {
      setProfileSaving(false);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }, 500);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteAccountError("");
    try {
      const user = await base44.auth.me();
      if (user) {
        await base44.entities.User.delete(user.id);
      }
      await base44.auth.logout();
      window.location.href = "/login";
    } catch (e) {
      setDeleteAccountError("Fehler beim Löschen des Kontos: " + (e.message || "unbekannt"));
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteQrzLog = async () => {
    try {
      for (const entry of qrzLookups) {
        await base44.entities.QrzLookup.delete(entry.id);
      }
      setQrzLookups([]);
    } catch (e) { }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await base44.functions.invoke("refreshAllData", {});
      setRefreshResult(res.data);
      setTimeout(() => loadData(), 1000);
    } catch (e) {
      setRefreshResult({ error: e.message });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSetupDemo = async () => {
    setDemoSettingUp(true);
    setDemoSetupResult(null);
    try {
      const res = await base44.functions.invoke("adminManageUsers", { action: "setupDemoUser" });
      setDemoSetupResult({ message: res.data?.message || "Demo-Benutzer eingeladen" });
    } catch (e) {
      setDemoSetupResult({ error: e?.response?.data?.error || e?.message || "Fehler" });
    } finally {
      setDemoSettingUp(false);
    }
  };

  const handleVerifyDemoOtp = async () => {
    if (!demoOtpCode.trim()) return;
    setDemoVerifying(true);
    try {
      const res = await base44.functions.invoke("adminManageUsers", { action: "verifyDemoOtp", otpCode: demoOtpCode.trim() });
      setDemoSetupResult({ message: res.data?.message || "Verifiziert" });
      setDemoOtpCode("");
    } catch (e) {
      setDemoSetupResult({ error: e?.response?.data?.error || e?.message || "Fehler" });
    } finally {
      setDemoVerifying(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await base44.auth.logout("/login");
    } catch (e) {
      window.location.href = "/login";
    }
  };

  const handleToggleNotification = async (key, enabled, setter) => {
    setNotifyLoading(true);
    try {
      const existing = await base44.entities.AppSetting.filter({ key });
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, { enabled, value: String(enabled) });
      } else {
        await base44.entities.AppSetting.create({ key, enabled, value: String(enabled) });
      }
      setter(enabled);
    } catch (e) {
      setter(!enabled);
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleDeleteOfflineArea = async (id) => {
    await deleteArea(id);
    const areas = await getOfflineAreas();
    setOfflineAreas(areas);
    const info = await getStorageEstimate();
    setStorageInfo(info);
  };

  const handleClearAllOffline = async () => {
    await clearAllTiles();
    const areas = await getOfflineAreas();
    for (const a of areas) await deleteArea(a.id);
    setOfflineAreas([]);
    setStorageInfo({ areas: 0, tiles: 0 });
  };

  const handleToggleForceOffline = (enabled) => {
    setForceOffline(enabled);
    localStorage.setItem("hb9om_force_offline", String(enabled));
  };

  const handleToggleAutoUpdate = async (enabled) => {
    setAutoUpdateLoading(true);
    try {
      const existing = await base44.entities.AppSetting.filter({ key: "auto_update" });
      if (existing.length > 0) {
        await base44.entities.AppSetting.update(existing[0].id, { enabled, value: String(enabled) });
      } else {
        await base44.entities.AppSetting.create({ key: "auto_update", enabled, value: String(enabled) });
      }
      setAutoUpdateEnabled(enabled);
    } catch (e) {
      setAutoUpdateEnabled(!enabled);
    } finally {
      setAutoUpdateLoading(false);
    }
  };

  const StatusIcon = ({ status }) => {
    if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === 'partial') return <AlertCircle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <SettingsIcon className="w-5 h-5 text-gray-700" />
            <h1 className="text-sm font-bold text-gray-900">Einstellungen</h1>
          </div>
          <Link to="/help" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Hilfe">
            <HelpCircle className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
        {/* User Profile */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Mein Profil
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mein Rufzeichen</label>
              <input
                type="text"
                value={myCallsign}
                onChange={e => setMyCallsign(e.target.value)}
                placeholder="z.B. HB9XYZ"
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
              />
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <Radio className="w-4 h-4" /> QRZ.com Abfrage
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">Automatische Rufzeichen-Datenabfrage</p>
                </div>
                <button
                  onClick={() => setQrzEnabled(!qrzEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${qrzEnabled ? 'bg-gray-900' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${qrzEnabled ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              {qrzEnabled ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    QRZ.com XML-Subscription ist hinterlegt und einsatzbereit
                  </p>

                  <button
                    onClick={handleQrzTest}
                    disabled={qrzTesting}
                    className="w-full mt-2 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {qrzTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    QRZ-Verbindung testen
                  </button>
                  {qrzTestResult && (
                    <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${qrzTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {qrzTestResult.success
                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                      <span>{qrzTestResult.message}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  QRZ-Abfrage deaktiviert. Rufzeichen-Daten manuell im QSO-Formular eingeben.
                </p>
              )}
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {profileSaved ? <Check className="w-4 h-4" /> : profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {profileSaved ? "Gespeichert" : "Profil speichern"}
            </button>
          </div>
        </section>

        {/* QRZ Lookup Log */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Search className="w-4 h-4" /> QRZ-Abfrageprotokoll
            </h2>
            {qrzLookups.length > 0 && (
              <button
                onClick={handleDeleteQrzLog}
                className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Protokoll löschen
              </button>
            )}
          </div>
          {qrzLookups.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Search className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Noch keine QRZ-Abfragen durchgeführt</p>
            </div>
          ) : (
            <div className="space-y-2">
              {qrzLookups.map(entry => (
                <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.lookup_status === 'success'
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      }
                      <span className="font-mono font-bold text-sm text-gray-900">{entry.callsign}</span>
                      {entry.name && <span className="text-xs text-gray-500 truncate">{entry.name}</span>}
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {new Date(entry.created_date).toLocaleString('de-CH')}
                    </span>
                  </div>
                  {entry.lookup_status === 'success' ? (
                    <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                      {entry.address && <p>{entry.address}</p>}
                      <div className="flex gap-3 flex-wrap">
                        {entry.country && <span>{entry.country}</span>}
                        {entry.grid && <span className="font-mono">Grid: {entry.grid}</span>}
                        {entry.email && <span>{entry.email}</span>}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-red-500">{entry.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Offline Maps */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Download className="w-4 h-4" /> Offline-Modus
          </h2>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                {forceOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />} Manuelles Offline
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                {forceOffline ? "App wird offline betrieben – Karten aus Cache" : "Offline-Modus manuell aktivieren"}
              </p>
            </div>
            <button
              onClick={() => handleToggleForceOffline(!forceOffline)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${forceOffline ? 'bg-amber-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${forceOffline ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Heruntergeladene Karten</h3>
          {offlineAreas.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <Download className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Keine Offline-Karten heruntergeladen</p>
              <p className="text-xs text-gray-400 mt-1">Auf der Karte den Download-Button verwenden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {offlineAreas.map(area => (
                <div key={area.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{area.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-0.5"><HardDrive className="w-2.5 h-2.5" /> {area.tileCount} Kacheln</span>
                      <span>~{(area.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                      <span>Zoom {area.zoomLevels.join(", ")}</span>
                      <span>{new Date(area.downloadDate).toLocaleDateString('de-CH')}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteOfflineArea(area.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {storageInfo.tiles > 0 && (
                <button
                  onClick={handleClearAllOffline}
                  className="w-full px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Alle Offline-Daten löschen ({storageInfo.tiles} Kacheln)
                </button>
              )}
            </div>
          )}
        </section>

        {/* Change Requests - available for all users */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4" /> Meine Änderungsanträge
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Status eigener Positions-Korrekturen verfolgen oder zurückziehen
              </p>
              {pendingChangeRequests > 0 && (
                <p className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {pendingChangeRequests} Antrag{pendingChangeRequests !== 1 ? 'äge' : ''} in Prüfung
                </p>
              )}
            </div>
            <Link
              to="/change-requests"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              Anträge
            </Link>
          </div>
        </section>

        {isAdmin && (
        <>
        {/* Admin: Change Request Review */}
        <section className="bg-amber-50 rounded-xl border-2 border-amber-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-amber-600" /> Änderungsanträge prüfen
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Benutzer eingereichte Positions-Korrekturen genehmigen oder ablehnen
              </p>
              {adminPendingRequests > 0 && (
                <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {adminPendingRequests} Antrag{adminPendingRequests !== 1 ? 'äge' : ''} wartet{adminPendingRequests !== 1 ? 'en' : ''} auf Prüfung
                </p>
              )}
            </div>
            <Link
              to="/admin/change-requests"
              className="relative px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              Prüfen
              {adminPendingRequests > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {adminPendingRequests}
                </span>
              )}
            </Link>
          </div>
        </section>

        {/* Cache Status */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" /> Daten-Cache
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {cacheStatus.length === 0 && !loading ? (
              <div className="col-span-full bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
                Keine zwischengespeicherten Daten vorhanden
              </div>
            ) : (
              cacheStatus.map(entry => {
                const refs = entry.references || [];
                const withCoords = refs.filter(r => r.lat && r.lng).length;
                const total = entry.total_count || refs.length;
                const withoutCoords = total - withCoords;
                const lastUpdated = entry.last_updated ? new Date(entry.last_updated) : null;
                const isStale = lastUpdated && (Date.now() - lastUpdated.getTime()) > 7 * 24 * 60 * 60 * 1000;
                return (
                  <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-3 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-900 truncate">{TYPE_LABELS[entry.type] || entry.type}</span>
                      <span className="text-lg font-bold text-gray-900 flex-shrink-0">{total}</span>
                    </div>
                    {refs.length > 0 ? (
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className="text-green-600 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {withCoords} geo
                        </span>
                        {withoutCoords > 0 && (
                          <span className="text-amber-600 flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5" /> {withoutCoords} offen
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-300 mt-1">Keine Referenzdetails</p>
                    )}
                    <p className={`text-[10px] mt-1 truncate ${isStale ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                      {lastUpdated ? lastUpdated.toLocaleString('de-CH') : 'Nie'}
                      {isStale ? ' ⚠ veraltet' : ''}
                    </p>
                    {entry.source && (
                      <p className="text-[10px] text-gray-400 truncate" title={entry.source}>Quelle: {entry.source}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Refresh Button */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          {/* Auto-update toggle */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Tägliche Automatik
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                {autoUpdateEnabled ? "Referenzdaten werden täglich automatisch aktualisiert" : "Nur manuelle Aktualisierung – Automatik deaktiviert"}
              </p>
            </div>
            <button
              onClick={() => handleToggleAutoUpdate(!autoUpdateEnabled)}
              disabled={autoUpdateLoading}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${autoUpdateEnabled ? 'bg-gray-900' : 'bg-gray-300'} ${autoUpdateLoading ? 'opacity-40' : ''}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoUpdateEnabled ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Daten aktualisieren</h3>
              <p className="text-xs text-gray-500 mt-0.5">Alle Referenzdaten neu abrufen und zwischenspeichern</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 flex items-center gap-2"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {refreshing ? "Aktualisiert..." : "Jetzt aktualisieren"}
            </button>
          </div>
          {refreshResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${refreshResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {refreshResult.error
                ? `Fehler: ${refreshResult.error}`
                : `Aktualisierung abgeschlossen: ${refreshResult.results?.filter(r => r.status === 'success').length || 0}/${refreshResult.results?.length || 0} Quellen erfolgreich (${(refreshResult.total_duration_ms / 1000).toFixed(1)}s)`
              }
            </div>
          )}
        </section>

        {/* Admin: Notification Settings */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
            <Bell className="w-4 h-4" /> E-Mail-Benachrichtigungen
          </h3>
          <p className="text-xs text-gray-500 mb-3">Wählen Sie, über welche Ereignisse Sie per E-Mail informiert werden möchten.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Neue Benutzer
                </label>
                <p className="text-xs text-gray-500 mt-0.5">Bei neuer Registrierung</p>
              </div>
              <button
                onClick={() => handleToggleNotification("notify_new_user", !notifyNewUser, setNotifyNewUser)}
                disabled={notifyLoading}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${notifyNewUser ? 'bg-gray-900' : 'bg-gray-300'} ${notifyLoading ? 'opacity-40' : ''}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${notifyNewUser ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Datenbank-Updates
                </label>
                <p className="text-xs text-gray-500 mt-0.5">Nach Aktualisierung der Referenzdaten</p>
              </div>
              <button
                onClick={() => handleToggleNotification("notify_db_update", !notifyDbUpdate, setNotifyDbUpdate)}
                disabled={notifyLoading}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${notifyDbUpdate ? 'bg-gray-900' : 'bg-gray-300'} ${notifyLoading ? 'opacity-40' : ''}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${notifyDbUpdate ? 'translate-x-6' : ''}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> App-Fehler & Abstürze
                </label>
                <p className="text-xs text-gray-500 mt-0.5">Bei Laufzeitfehlern in der App</p>
              </div>
              <button
                onClick={() => handleToggleNotification("notify_app_errors", !notifyAppErrors, setNotifyAppErrors)}
                disabled={notifyLoading}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${notifyAppErrors ? 'bg-gray-900' : 'bg-gray-300'} ${notifyLoading ? 'opacity-40' : ''}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${notifyAppErrors ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Sync Log */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Aktualisierungsprotokoll
          </h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Noch keine Aktualisierungen protokolliert</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={log.overall_status} />
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(log.created_date).toLocaleString('de-CH')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{log.trigger === 'manual' ? 'Manuell' : 'Automatisch'}</span>
                      <span>{(log.total_duration_ms / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {log.results?.map((r, i) => (
                      <div key={i} className="flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          {r.status === 'success'
                            ? <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                            : <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                          }
                          <span className="text-gray-600">{TYPE_LABELS[r.type] || r.type}</span>
                          <span className="text-gray-400 font-medium">{r.count}</span>
                          {r.error && <span className="text-red-400 truncate" title={r.error}>({r.error.slice(0, 30)})</span>}
                        </div>
                        {r.castleStats && (
                          <div className="ml-5 flex items-center gap-2 text-[10px] text-gray-400">
                            <span className="text-green-600">{r.castleStats.matched} zugeordnet</span>
                            <span className="text-red-400">{r.castleStats.unmatched} offen</span>
                            {r.castleStats.bySource && Object.entries(r.castleStats.bySource).filter(([k]) => k !== 'unmatched' && k !== 'null').length > 0 && (
                              <span className="text-gray-400">
                                ({Object.entries(r.castleStats.bySource).filter(([k]) => k !== 'unmatched' && k !== 'null').map(([k, v]) => `${k}: ${v}`).join(', ')})
                              </span>
                            )}
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

        {/* Admin: Unmatched Castles Editor */}
        <UnmatchedCastles />

        {/* Admin: Demo User Setup */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <User className="w-4 h-4" /> Demo-Benutzer
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Login: demo@hb9om.ch / demo1234 · Daten werden täglich gelöscht
              </p>
            </div>
            <button
              onClick={handleSetupDemo}
              disabled={demoSettingUp}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-2"
            >
              {demoSettingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Demo einrichten
            </button>
          </div>
          {demoSetupResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${demoSetupResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {demoSetupResult.error || demoSetupResult.message}
            </div>
          )}

          {demoSetupResult && !demoSetupResult.error && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={demoOtpCode}
                onChange={e => setDemoOtpCode(e.target.value)}
                placeholder="OTP-Code aus E-Mail"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
              />
              <button
                onClick={handleVerifyDemoOtp}
                disabled={demoVerifying || !demoOtpCode.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-2"
              >
                {demoVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Verifizieren
              </button>
            </div>
          )}
        </section>

        </>
        )}
        {/* Admin: User Management */}
        {isAdmin && (
         <section className="bg-white rounded-xl border border-gray-200 p-4">
           <div className="flex items-center justify-between">
             <div>
               <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                 <Users className="w-4 h-4" /> Benutzerverwaltung
               </h3>
               <p className="text-xs text-gray-500 mt-0.5">Angemeldete Benutzer sehen und Passwörter zurücksetzen</p>
             </div>
             <Link
               to="/users"
               className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center gap-2"
             >
               <Users className="w-4 h-4" />
               Benutzer
             </Link>
           </div>
         </section>
        )}

        {/* Logout */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Abmelden</h3>
              <p className="text-xs text-gray-500 mt-0.5">Von der App abmelden</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-2"
            >
              {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Abmelden
            </button>
          </div>
        </section>

        {/* Delete Account */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Konto löschen</h3>
              <p className="text-xs text-gray-500 mt-0.5">Alle Daten werden unwiderruflich gelöscht</p>
            </div>
           <button
             onClick={() => setShowDeleteAccount(true)}
             className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-2"
           >
             <Trash2 className="w-4 h-4" />
             Konto löschen
           </button>
         </div>
        </section>
        </div>

        {showDeleteAccount && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeleteAccount(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900">Konto wirklich löschen?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Ihre QSO-Logs, Einstellungen und Daten werden unwiderruflich gelöscht.
            </p>
            {deleteAccountError && (
              <p className="text-xs text-red-600 text-center mt-2">{deleteAccountError}</p>
            )}
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowDeleteAccount(false); setDeleteAccountError(""); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}