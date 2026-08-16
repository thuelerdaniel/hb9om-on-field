import React, { useState, useEffect, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle, Info, Settings as SettingsIcon, Database, Clock, Radio, User, Check, Search, HelpCircle, Trash2, AlertTriangle, Users, UserPlus, MapPin, Bell, Download, HardDrive, Wifi, WifiOff, ClipboardList, LogOut, KeyRound, Lightbulb, Gauge, Zap, Shield, Crosshair, ChevronDown, Network } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import BackupSection from "@/components/settings/BackupSection";
import { DEMO_EMAIL } from "@/lib/constants";
import OfflineManager from "@/components/settings/OfflineManager";
import MobileSelect from "@/components/ui/MobileSelect";
import ThemeToggle from "@/components/settings/ThemeToggle";
import ClubCallsignManager from "@/components/settings/ClubCallsignManager";
import AppFeaturesSection from "@/components/settings/AppFeaturesSection";
import { useAppFeatures, syncFeaturesFromUser } from "@/lib/appFeatures";
import { clearRememberedDecisions, hasRememberedDecisions } from "@/components/map/HeavyLoadConfirmDialog";
import DonationPopup from "@/components/DonationPopup";
import PasswordInput from "@/components/settings/PasswordInput";
import CollapsibleSection from "@/components/settings/CollapsibleSection";
import ConfigCompletenessBar from "@/components/settings/ConfigCompletenessBar";
import GpsPublicConfig from "@/components/settings/GpsPublicConfig";
import MyStationSection from "@/components/settings/MyStationSection";

// Lazy-load admin-only component — reduces bundle size for non-admin users
const AdminPanel = lazy(() => import("@/components/settings/AdminPanel"));

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
  const [qrzUsername, setQrzUsername] = useState("");
  const [qrzPassword, setQrzPassword] = useState("");
  const [usesClubCredentials, setUsesClubCredentials] = useState(false);
  const [qrzConfigured, setQrzConfigured] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [qrzTesting, setQrzTesting] = useState(false);
  const [qrzTestResult, setQrzTestResult] = useState(null);
  const [aprsApiKey, setAprsApiKey] = useState("");
  const [aprsKeyConfigured, setAprsKeyConfigured] = useState(false);
  const [qrzApiKey, setQrzApiKey] = useState("");
  // RepeaterBook API-Token (seit März 2026: Cloudflare blockt Login, Token erforderlich)
  const [repeaterbookApiToken, setRepeaterbookApiToken] = useState("");
  // BrandMeister API-Key (statt Login-Formular)
  const [bmApiKey, setBmApiKey] = useState("");
  const [bmConfigured, setBmConfigured] = useState(false);
  // Credential source selector (point 4): 'auto' | 'personal' | 'club'
  const [credentialSource, setCredentialSource] = useState("auto");
  const [isDemo, setIsDemo] = useState(false);
  // Test results
  const [aprsTestResult, setAprsTestResult] = useState(null);
  const [aprsTesting, setAprsTesting] = useState(false);
  const [repeaterbookTesting, setRepeaterbookTesting] = useState(false);
  const [repeaterbookTestResult, setRepeaterbookTestResult] = useState(null);
  const [bmTesting, setBmTesting] = useState(false);
  const [bmTestResult, setBmTestResult] = useState(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [autoUpdateLoading, setAutoUpdateLoading] = useState(false);
  const [notifyNewUser, setNotifyNewUser] = useState(true);
  const [notifyDbUpdate, setNotifyDbUpdate] = useState(true);
  const [notifyAppErrors, setNotifyAppErrors] = useState(true);
  const [notifyDemoLogin, setNotifyDemoLogin] = useState(true);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [demoSettingUp, setDemoSettingUp] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(() => localStorage.getItem("hb9om_performance_mode") === "true");
  const [autoModeOverride, setAutoModeOverride] = useState(() => localStorage.getItem("hb9om_auto_mode_override") === "true");
  const [pendingChangeRequests, setPendingChangeRequests] = useState(0);
  const [adminPendingRequests, setAdminPendingRequests] = useState(0);
  const [adminPendingFeatureRequests, setAdminPendingFeatureRequests] = useState(0);
  const [demoSetupResult, setDemoSetupResult] = useState(null);
  const [demoOtpCode, setDemoOtpCode] = useState("");
  const [demoVerifying, setDemoVerifying] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [perfSuggestionReset, setPerfSuggestionReset] = useState(false);
  const [heavyLoadReset, setHeavyLoadReset] = useState(false);
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(() => localStorage.getItem("hb9om_gps_tracking_enabled") !== "false");
  const [gpsTrackingInterval, setGpsTrackingInterval] = useState(() => parseInt(localStorage.getItem("hb9om_gps_tracking_interval") || "60"));
  const [gpsPublicEnabled, setGpsPublicEnabled] = useState(() => localStorage.getItem("hb9om_gps_public_enabled") !== "false");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  // Offline management is now handled by <OfflineManager /> component
  const { features: appFeatures } = useAppFeatures();

  useEffect(() => {
    loadData();
    loadProfile();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Check admin status FIRST — avoids firing admin-only API calls for non-admins
      let admin = false;
      try {
        const adminRes = await base44.functions.invoke("adminManageUsers", { action: "checkStatus" });
        admin = adminRes.data?.isAdmin === true;
        setIsAdmin(admin);
      } catch (e) { setIsAdmin(false); }

      // Common calls for all users (QRZ log is shown to everyone)
      const [qrzData] = await Promise.all([
        base44.entities.QrzLookup.list("-created_date", 10),
      ]);
      setQrzLookups(qrzData || []);

      // User's own pending change requests (for badge counter)
      base44.entities.ReferenceChangeRequest.filter({ status: "pending" })
        .then(data => setPendingChangeRequests(data?.length || 0))
        .catch(() => {});

      // Admin-only calls — skipped entirely for non-admins (saves 6-8 API calls)
      if (admin) {
        const [logsData, cacheData, autoUpdateRes] = await Promise.all([
          base44.entities.SyncLog.list("-created_date", 10),
          base44.entities.ReferenceData.list(),
          base44.functions.invoke("manageAutoUpdate", { action: "get" })
        ]);
        setLogs(logsData || []);
        setCacheStatus(cacheData || []);
        setAutoUpdateEnabled(autoUpdateRes?.data?.enabled !== false);

        // Admin pending requests + feature requests count
        const [reqRes, featRes] = await Promise.all([
          base44.functions.invoke("manageChangeRequests", { action: "listAll" }),
          base44.functions.invoke("manageFeatureRequests", { action: "countPending" })
        ]);
        setAdminPendingRequests((reqRes?.data?.requests || []).filter(r => r.status === "pending").length);
        setAdminPendingFeatureRequests(featRes?.data?.count || 0);

        // Notification settings (admin only)
        const [newUserSettings, dbUpdateSettings, errorSettings, demoLoginSettings] = await Promise.all([
          base44.entities.AppSetting.filter({ key: "notify_new_user" }),
          base44.entities.AppSetting.filter({ key: "notify_db_update" }),
          base44.entities.AppSetting.filter({ key: "notify_app_errors" }),
          base44.entities.AppSetting.filter({ key: "notify_demo_login" })
        ]);
        if (newUserSettings?.length > 0) setNotifyNewUser(newUserSettings[0].enabled !== false);
        if (dbUpdateSettings?.length > 0) setNotifyDbUpdate(dbUpdateSettings[0].enabled !== false);
        if (errorSettings?.length > 0) setNotifyAppErrors(errorSettings[0].enabled !== false);
        if (demoLoginSettings?.length > 0) setNotifyDemoLogin(demoLoginSettings[0].enabled !== false);
      }
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
      let admin = false;
      try {
        const res = await base44.functions.invoke("adminManageUsers", { action: "checkStatus" });
        admin = res.data?.isAdmin === true;
        setIsAdmin(admin);
      } catch (e) {
        setIsAdmin(false);
      }
      // Determine QRZ credential source:
      // - Demo account: uses club/admin-entered credentials (no personal inputs)
      // - Admins: can enter personal credentials, with fallback to club entries → code secrets
      // - Regular users: must enter their own personal credentials
      const demo = me?.email === DEMO_EMAIL;
      setIsDemo(demo);
      const clubCreds = demo; // Only demo uses club creds exclusively
      setUsesClubCredentials(clubCreds);
      if (clubCreds) {
        setQrzConfigured(true);
        setQrzUsername("");
        setQrzPassword("");
      } else {
        const u = me?.qrz_username || "";
        const p = me?.qrz_password || "";
        setQrzUsername(u);
        setQrzPassword(p);
        setQrzConfigured(!!u && !!p);
      }
      // Load credential source preference (point 4)
      setCredentialSource(me?.credential_source || "auto");
      // Load APRS.fi API key (personal — admins can override club key)
      const aprsKey = me?.aprs_fi_api_key || "";
      setAprsApiKey(aprsKey);
      setAprsKeyConfigured(!!aprsKey);
      setQrzApiKey(me?.qrz_api_key || "");
      setRepeaterbookApiToken(me?.repeaterbook_api_token || "");
      // Load BrandMeister API-Key
      setBmApiKey(me?.brandmeister_api_key || "");
      setBmConfigured(!!(me?.brandmeister_api_key));
      // Sync feature flags from User entity (User entity wins)
      syncFeaturesFromUser();
    } catch (e) { }
  };

  // Central credential test — uses testCredentials backend function for all services.
  // Returns source response so users see what the API actually returned (point 5).
  const handleQrzTest = async () => {
    setQrzTesting(true);
    setQrzTestResult(null);
    try {
      const res = await base44.functions.invoke("testCredentials", {
        service: "qrz",
        callsign: myCallsign.trim() || "HB9OM",
        scope: credentialSource,
      });
      setQrzTestResult(res.data);
    } catch (e) {
      setQrzTestResult({ success: false, message: "Fehler: " + (e?.message || "unbekannt") });
    } finally {
      setQrzTesting(false);
    }
  };

  const handleQrzApiKeyTest = async () => {
    return base44.functions.invoke("testCredentials", {
      service: "qrz_apikey",
      scope: credentialSource,
    }).then(res => res.data).catch(e => ({ success: false, message: e?.message || "Fehler" }));
  };

  const handleAprsTest = async () => {
    return base44.functions.invoke("testCredentials", {
      service: "aprs",
      scope: credentialSource,
    }).then(res => res.data).catch(e => ({ success: false, message: e?.message || "Fehler" }));
  };

  const handleRepeaterbookTest = async () => {
    return base44.functions.invoke("testCredentials", {
      service: "repeaterbook",
      scope: credentialSource,
    }).then(res => res.data).catch(e => ({ success: false, message: e?.message || "Fehler" }));
  };

  const handleBmTest = async () => {
    return base44.functions.invoke("testCredentials", {
      service: "brandmeister",
      scope: credentialSource,
    }).then(res => res.data).catch(e => ({ success: false, message: e?.message || "Fehler" }));
  };

  // Config completeness items (point 10)
  const configItems = [
    { label: "Mein Rufzeichen", configured: !!myCallsign.trim(), link: "/settings", helpText: "Für QSO-Logs und QRZ-Abfragen erforderlich" },
    { label: "QRZ.com Login", configured: qrzConfigured || usesClubCredentials, link: "/settings", helpText: usesClubCredentials ? "Club-Zugang aktiv (Demo)" : "Für automatische Rufzeichen-Datenabfrage" },
    { label: "QRZ API-Key (Logbuch-Upload)", configured: !!qrzApiKey.trim() || usesClubCredentials, link: "/settings", helpText: usesClubCredentials ? "Club-Zugang aktiv (Demo)" : "Für Upload ins QRZ-Logbuch" },
    { label: "APRS.fi API-Key", configured: aprsKeyConfigured || usesClubCredentials, link: "/settings", helpText: usesClubCredentials ? "Club-Key aktiv (Demo)" : "Für APRS-Daten (Private Nodes & Relais-Koordinaten)" },
    { label: "RepeaterBook API-Token", configured: !!repeaterbookApiToken.trim() || usesClubCredentials, link: "/settings", helpText: "Für automatischen Relais-Sync (optional, JSON-Import als Fallback)" },
    { label: "BrandMeister API-Key", configured: bmConfigured || usesClubCredentials, link: "/settings", helpText: "Für BrandMeister-DMR-Daten (Repeater-Liste auch ohne Key)" },
  ];

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    localStorage.setItem("hb9om_my_callsign", myCallsign.toUpperCase().trim());
    localStorage.setItem("hb9om_qrz_enabled", String(qrzEnabled));
    localStorage.setItem("hb9om_setup_complete", "true");
    // Save personal credentials for non-demo users (admins + regular users)
    // Demo account: inputs are disabled, nothing to save
    if (!usesClubCredentials && !isDemo) {
      try {
        await base44.auth.updateMe({
          qrz_username: qrzUsername.trim(),
          qrz_password: qrzPassword,
          aprs_fi_api_key: aprsApiKey.trim(),
          qrz_api_key: qrzApiKey.trim(),
          repeaterbook_api_token: repeaterbookApiToken.trim(),
          brandmeister_api_key: bmApiKey.trim(),
          credential_source: credentialSource,
        });
        setQrzConfigured(!!qrzUsername.trim() && !!qrzPassword);
        setAprsKeyConfigured(!!aprsApiKey.trim());
        setBmConfigured(!!(bmApiKey.trim()));
      } catch (e) { }
    }
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

  const handleTogglePerformanceMode = (enabled) => {
    setPerformanceMode(enabled);
    localStorage.setItem("hb9om_performance_mode", String(enabled));
  };

  const handleToggleAutoModeOverride = (enabled) => {
    setAutoModeOverride(enabled);
    localStorage.setItem("hb9om_auto_mode_override", String(enabled));
  };

  const handleToggleGpsTracking = (enabled) => {
    setGpsTrackingEnabled(enabled);
    localStorage.setItem("hb9om_gps_tracking_enabled", String(enabled));
    window.dispatchEvent(new CustomEvent("gps-tracking-changed"));
  };

  const handleGpsIntervalChange = (seconds) => {
    setGpsTrackingInterval(seconds);
    localStorage.setItem("hb9om_gps_tracking_interval", String(seconds));
    window.dispatchEvent(new CustomEvent("gps-tracking-changed"));
  };

  const handleToggleAutoUpdate = async (enabled) => {
    setAutoUpdateLoading(true);
    try {
      await base44.functions.invoke("manageAutoUpdate", { action: "set", enabled });
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
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
        <ThemeToggle />

        {/* MEINE STATION / LIZENZ — ganz oben (Praefix, Lizenzklasse, Suffix) */}
        <MyStationSection />

        {/* Config Completeness Bar (point 10) */}
        <ConfigCompletenessBar items={configItems} />

        {isAdmin && (
          <div className="rounded-xl border-2 border-slate-700 overflow-hidden">
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="w-full bg-slate-800 text-white p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2 font-bold text-sm">
                <Shield className="w-5 h-5" /> Admin-Bereich
              </span>
              <ChevronDown className={`w-5 h-5 transition-transform ${showAdminPanel ? 'rotate-180' : ''}`} />
            </button>
            {showAdminPanel && (
              <div className="space-y-6 p-4 bg-slate-50 dark:bg-slate-900">
                <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
                <AdminPanel
                  cacheStatus={cacheStatus}
                  loading={loading}
                  refreshing={refreshing}
                  refreshResult={refreshResult}
                  handleRefresh={handleRefresh}
                  autoUpdateEnabled={autoUpdateEnabled}
                  autoUpdateLoading={autoUpdateLoading}
                  handleToggleAutoUpdate={handleToggleAutoUpdate}
                  notifyNewUser={notifyNewUser}
                  notifyDbUpdate={notifyDbUpdate}
                  notifyAppErrors={notifyAppErrors}
                  notifyDemoLogin={notifyDemoLogin}
                  notifyLoading={notifyLoading}
                  handleToggleNotification={handleToggleNotification}
                  setNotifyNewUser={setNotifyNewUser}
                  setNotifyDbUpdate={setNotifyDbUpdate}
                  setNotifyAppErrors={setNotifyAppErrors}
                  setNotifyDemoLogin={setNotifyDemoLogin}
                  logs={logs}
                  adminPendingRequests={adminPendingRequests}
                  adminPendingFeatureRequests={adminPendingFeatureRequests}
                  demoSettingUp={demoSettingUp}
                  demoSetupResult={demoSetupResult}
                  demoOtpCode={demoOtpCode}
                  setDemoOtpCode={setDemoOtpCode}
                  demoVerifying={demoVerifying}
                  handleSetupDemo={handleSetupDemo}
                  handleVerifyDemoOtp={handleVerifyDemoOtp}
                />
                </Suspense>
              </div>
            )}
          </div>
        )}

        <div className="pt-2"><h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">Profil & QRZ</h2></div>
        {/* User Profile */}
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
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
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
              />
            </div>

            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <Radio className="w-4 h-4" /> QRZ.com Abfrage
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">Automatische Rufzeichen-Datenabfrage</p>
                </div>
                <button
                  onClick={() => { if (qrzConfigured) setQrzEnabled(!qrzEnabled); }}
                  disabled={!qrzConfigured}
                  className={`relative w-12 h-6 rounded-full transition-colors ${!qrzConfigured ? 'bg-gray-200 cursor-not-allowed opacity-50' : qrzEnabled ? 'bg-gray-900' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${qrzEnabled && qrzConfigured ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              {!qrzConfigured && !usesClubCredentials && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Keine QRZ.com-Anmeldedaten hinterlegt – bitte unten Benutzername &amp; Passwort erfassen
                </p>
              )}

              {usesClubCredentials ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    QRZ.com XML-Subscription des Clubs ist hinterlegt und einsatzbereit
                  </p>
                  {isDemo && (
                    <p className="text-xs text-blue-600 flex items-start gap-1">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>Demo-Konto: HB9OM hat einen Account für Demo-Zwecke hinterlegt. Eigene Eingaben sind gesperrt.</span>
                    </p>
                  )}
                </div>
              ) : isAdmin ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-blue-600 flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>Optional: Persönliche QRZ.com-Zugangsdaten erfassen. Ohne Angabe werden die Club-Daten (Club-Rufzeichen-Verwaltung) oder die im Code hinterlegten Secrets verwendet.</span>
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">QRZ-Benutzername (persönlich)</label>
                    <input
                      type="text"
                      value={qrzUsername}
                      onChange={e => { setQrzUsername(e.target.value); }}
                      placeholder="Persönlicher QRZ.com-Benutzername (optional)"
                      autoComplete="off"
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <PasswordInput
                    label="QRZ-Passwort (persönlich)"
                    value={qrzPassword}
                    onChange={setQrzPassword}
                    placeholder="Persönliches QRZ.com-Passwort (optional)"
                    autoComplete="new-password"
                    helpLink={<Link to="/help#qrz-konfiguration" onClick={e => e.stopPropagation()} className="text-gray-400 hover:text-blue-500"><HelpCircle className="w-3.5 h-3.5" /></Link>}
                  />
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Fallback-Reihenfolge: Persönliche Angaben → Club-Konfiguration → Code-Secrets. Bei leerem Feld werden die Club-Daten verwendet.
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">QRZ-Benutzername</label>
                    <input
                      type="text"
                      value={qrzUsername}
                      onChange={e => { setQrzUsername(e.target.value); }}
                      placeholder="Ihr QRZ.com-Benutzername"
                      autoComplete="off"
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <PasswordInput
                    label="QRZ-Passwort"
                    value={qrzPassword}
                    onChange={setQrzPassword}
                    placeholder="Ihr QRZ.com-Passwort"
                    autoComplete="new-password"
                    helpLink={<Link to="/help#qrz-konfiguration" onClick={e => e.stopPropagation()} className="text-gray-400 hover:text-blue-500"><HelpCircle className="w-3.5 h-3.5" /></Link>}
                  />
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Ihre QRZ.com-Zugangsdaten werden sicher gespeichert und ausschliesslich für Abfragen verwendet. Sie benötigen eine QRZ.com-XML-Subscription. <Link to="/help#qrz-konfiguration" className="text-blue-500 hover:underline">Hilfe zur QRZ-Konfiguration</Link>.
                  </p>
                </div>
              )}

              {qrzEnabled && (qrzConfigured || isAdmin) && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleQrzTest}
                    disabled={qrzTesting}
                    className="w-full px-3 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {qrzTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    QRZ-Verbindung testen
                  </button>
                  {qrzTestResult && (
                    <div className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 ${qrzTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {qrzTestResult.success
                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <span>{qrzTestResult.message}</span>
                        {qrzTestResult.source && (
                          <span className="block text-[10px] opacity-60 mt-0.5">Quelle: {qrzTestResult.source}</span>
                        )}
                        {qrzTestResult.sourceResponse && (
                          <details className="mt-1">
                            <summary className="text-[10px] opacity-50 cursor-pointer select-none">Antwort der Quelle</summary>
                            <pre className="text-[9px] mt-1 p-1.5 bg-black/5 dark:bg-white/5 rounded overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap break-all">{typeof qrzTestResult.sourceResponse === 'string' ? qrzTestResult.sourceResponse : JSON.stringify(qrzTestResult.sourceResponse, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(!qrzEnabled || (!qrzConfigured && !isAdmin)) && (
                <p className="text-xs text-gray-500 mt-2">
                  QRZ-Abfrage {!qrzConfigured ? 'nicht konfiguriert' : 'deaktiviert'}. Rufzeichen-Daten manuell im QSO-Formular eingeben.
                </p>
              )}
            </div>

            {/* Credential Source Selector (point 4) — admins get all 3 options (incl. Code fallback),
                regular users get only personal + club, demo is greyed out */}
            <div className={`p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg ${isDemo ? 'opacity-50' : ''}`}>
              <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-500" /> Zugangsdaten-Priorität
              </label>
              <p className="text-xs text-gray-500 mt-0.5">Welche Zugangsdaten sollen für App-Abfragen verwendet werden?</p>
              {isDemo ? (
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Demo-Konto: verwendet immer Club-Zugangsdaten — Auswahl gesperrt
                </p>
              ) : (
                <>
                  <MobileSelect
                    value={credentialSource}
                    onValueChange={setCredentialSource}
                    triggerClassName="w-full mt-2 text-sm"
                    options={
                      isAdmin
                        ? [
                            { value: "auto", label: "Auto (Fallback: Persönlich → Club → Code)" },
                            { value: "personal", label: "Persönliche Zugangsdaten" },
                            { value: "club", label: "Club-Zugangsdaten" },
                          ]
                        : [
                            { value: "personal", label: "Persönliche Zugangsdaten" },
                            { value: "club", label: "Club-Zugangsdaten" },
                          ]
                    }
                  />
                  <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                    {isAdmin
                      ? 'Bei "Auto" werden persönliche Angaben bevorzugt, falls vorhanden. Fehlen diese, werden Club-Daten oder die im Code hinterlegten Secrets verwendet.'
                      : 'Persönliche Angaben werden bevorzugt. Fehlen diese, werden die Club-Daten verwendet.'}
                  </p>
                </>
              )}
            </div>

            {/* APRS.fi API Key */}
            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> APRS.fi API-Key
                </label>
                <Link to="/help#aprs-konfiguration" className="text-gray-400 hover:text-blue-500"><HelpCircle className="w-4 h-4" /></Link>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Für APRS-Datenabfrage (Private Nodes & Relais-Koordinaten)</p>
              {usesClubCredentials ? (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Globaler API-Key des Clubs ist hinterlegt und einsatzbereit
                </p>
              ) : (
                <div className="mt-2">
                  <PasswordInput
                    value={aprsApiKey}
                    onChange={setAprsApiKey}
                    placeholder={isAdmin ? "Persönlicher APRS.fi API-Key (optional — Fallback: Club/Secrets)" : "Ihr persönlicher APRS.fi API-Key"}
                    autoComplete="off"
                    disabled={isDemo}
                    onTest={aprsApiKey.trim() ? handleAprsTest : null}
                    testLabel="APRS-Key testen"
                    testDisabled={!aprsApiKey.trim()}
                  />
                  {aprsTestResult && (
                    <div className={`mt-1.5 p-2 rounded-lg text-xs flex items-start gap-1.5 ${aprsTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {aprsTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                      <span>{aprsTestResult.message}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                    Kostenloser API-Key unter <a href="https://aprs.fi/page/api" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">aprs.fi/page/api</a> erhältlich. <Link to="/help#aprs-konfiguration" className="text-blue-500 hover:underline">Hilfe zur APRS-Konfiguration</Link>.
                  </p>
                </div>
              )}
            </div>

            {/* QRZ API Key (personal) — for QRZ logbook upload (point 8) */}
            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> QRZ API-Key (persönlich)
                </label>
                <Link to="/help#qrz-konfiguration" className="text-gray-400 hover:text-blue-500"><HelpCircle className="w-4 h-4" /></Link>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Für Upload ins persönliche QRZ-Logbuch</p>
              {isDemo ? (
                <p className="text-xs text-blue-600 mt-2 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Demo-Konto: Eingabe gesperrt. HB9OM hat einen Account für Demo-Zwecke hinterlegt.</span>
                </p>
              ) : (
                <PasswordInput
                  value={qrzApiKey}
                  onChange={setQrzApiKey}
                  placeholder="Persönlicher QRZ.com API-Key (für Logbuch-Upload)"
                  autoComplete="off"
                  onTest={qrzApiKey.trim() ? handleQrzApiKeyTest : null}
                  testLabel="QRZ API-Key testen"
                  testDisabled={!qrzApiKey.trim()}
                />
              )}
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                Der API-Key wird für den Upload von QSO-Einträgen ins QRZ-Logbuch verwendet. <a href="https://www.qrz.com/page/current_spec.html" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">QRZ.com API-Info</a>.
              </p>
            </div>

            {/* RepeaterBook API-Token — seit März 2026: Cloudflare blockt Login, Token erforderlich */}
            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Radio className="w-4 h-4" /> RepeaterBook API-Token
                </label>
                <Link to="/help#repeaterbook-konfiguration" className="text-gray-400 hover:text-blue-500"><HelpCircle className="w-4 h-4" /></Link>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Für automatischen Relais-Sync (Cloudflare blockt Login)</p>
              {isDemo ? (
                <p className="text-xs text-blue-600 mt-2 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Demo-Konto: Eingabe gesperrt. HB9OM hat einen Token für Demo-Zwecke hinterlegt.</span>
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  <PasswordInput
                    value={repeaterbookApiToken}
                    onChange={setRepeaterbookApiToken}
                    placeholder="rbuapp_... (im RepeaterBook Dashboard generieren)"
                    autoComplete="off"
                    onTest={repeaterbookApiToken.trim() ? handleRepeaterbookTest : null}
                    testLabel="Token testen"
                    testDisabled={!repeaterbookApiToken.trim()}
                  />
                  {repeaterbookTestResult && (
                    <div className={`p-2 rounded-lg text-xs flex items-start gap-1.5 ${repeaterbookTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {repeaterbookTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                      <span>{repeaterbookTestResult.message}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                Token im RepeaterBook Dashboard generieren: <a href="https://www.repeaterbook.com/user/api_apps.php" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">repeaterbook.com/user/api_apps.php</a>. App muss freigeschaltet sein. Kein Token? Manuellen JSON-Export verwenden (Admin → JSON Repeater Import). <Link to="/help#repeaterbook-konfiguration" className="text-blue-500 hover:underline">Hilfe</Link>.
              </p>
            </div>

            {/* BrandMeister API-Key — statt Login-Formular */}
            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Network className="w-4 h-4" /> BrandMeister API-Key
                </label>
                <Link to="/help#brandmeister-konfiguration" className="text-gray-400 hover:text-blue-500"><HelpCircle className="w-4 h-4" /></Link>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Für BrandMeister-DMR-Daten (Repeater-Liste auch ohne Key)</p>
              {isDemo ? (
                <p className="text-xs text-blue-600 mt-2 flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Demo-Konto: Eingabe gesperrt. HB9OM hat einen Key für Demo-Zwecke hinterlegt.</span>
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  <PasswordInput
                    value={bmApiKey}
                    onChange={setBmApiKey}
                    placeholder="BrandMeister API-Key (langer Hex-String)"
                    autoComplete="off"
                    onTest={bmApiKey.trim() ? handleBmTest : null}
                    testLabel="Key testen"
                    testDisabled={!bmApiKey.trim()}
                  />
                  {bmTestResult && (
                    <div className={`p-2 rounded-lg text-xs flex items-start gap-1.5 ${bmTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {bmTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                      <span>{bmTestResult.message}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                Key im BrandMeister Dashboard generieren: <a href="https://brandmeister.network" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">brandmeister.network</a> → Profile → API. Repeater-Liste ist auch ohne Key öffentlich verfügbar. <Link to="/help#brandmeister-konfiguration" className="text-blue-500 hover:underline">Hilfe</Link>.
              </p>
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
            <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
              <Search className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Noch keine QRZ-Abfragen durchgeführt</p>
            </div>
          ) : (
            <div className="space-y-2">
              {qrzLookups.map(entry => (
                <div key={entry.id} className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.lookup_status === 'success'
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      }
                      <a href={`https://www.qrz.com/db/${entry.callsign}`} target="_blank" rel="noopener noreferrer" className="font-mono font-bold text-sm text-blue-600 hover:underline">{entry.callsign}</a>
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
                        {entry.email && <a href={`mailto:${entry.email}`} className="text-blue-600 hover:underline">{entry.email}</a>}
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

        <div className="pt-2"><h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">Club-Rufzeichen</h2></div>
        {/* Club Callsign Manager — admin only, but component handles its own visibility */}
        <ClubCallsignManager />

        <div className="pt-2"><h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">Karte & Anzeige</h2></div>
        <CollapsibleSection title="Karte & Anzeige" icon={MapPin} defaultOpen={false} helpAnchor="#karte-anzeige" helpLabel="Hilfe zu Karte & Anzeige">
        {/* Performance Mode */}
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
            <Gauge className="w-4 h-4" /> Performance-Modus
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-900">Kreis-Marker erzwingen</label>
              <p className="text-xs text-gray-500 mt-0.5">Reduziert Rendering-Last bei vielen Stationen</p>
            </div>
            <button
              onClick={() => handleTogglePerformanceMode(!performanceMode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${performanceMode ? "bg-gray-900" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${performanceMode ? "translate-x-6" : ""}`} />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-900">Auto-Modus überschreiben</label>
              <p className="text-xs text-gray-500 mt-0.5">Performance-Modus auch bei wenigen Stationen aktiv</p>
            </div>
            <button
              onClick={() => handleToggleAutoModeOverride(!autoModeOverride)}
              className={`relative w-12 h-6 rounded-full transition-colors ${autoModeOverride ? "bg-gray-900" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoModeOverride ? "translate-x-6" : ""}`} />
            </button>
          </div>
        </section>

        {/* GPS Tracking — toggle is on the map (floating button). Settings keeps interval + public position. */}
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
            <Crosshair className="w-4 h-4" /> GPS-Tracking
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            <strong>Meine GPS-Position</strong> (Fadenkreuz) wird ein- und ausgeschaltet über den Button <em>„Auf meine Position zentrieren"</em> (links auf der Karte). Hier stellen Sie das Aktualisierungs-Intervall und die öffentliche Freigabe ein.
          </p>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktualisierungs-Intervall</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {[30, 60, 300, 600, 1800, 3600].map(sec => (
                <button
                  key={sec}
                  onClick={() => handleGpsIntervalChange(sec)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${gpsTrackingInterval === sec ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                >
                  {sec < 60 ? `${sec}s` : sec < 3600 ? `${sec / 60}min` : `${sec / 3600}h`}
                </button>
              ))}
            </div>
          </div>
          {/* Öffentliche GPS-Position — unabhängig vom lokalen GPS-Toggle */}
          <GpsPublicConfig />
        </section>
        </CollapsibleSection>

        <div className="pt-2"><h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">App-Funktionen</h2></div>
        <AppFeaturesSection isAdmin={isAdmin} />

        <div className="pt-2"><h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">Offline & Sicherung</h2></div>
        <CollapsibleSection title="Offline-Modus" icon={WifiOff} defaultOpen={false} helpAnchor="#offline-modus" helpLabel="Hilfe zum Offline-Modus">
          <OfflineManager />
        </CollapsibleSection>

        <CollapsibleSection title="Datensicherung (Backup & Restore)" icon={HardDrive} defaultOpen={false} helpAnchor="#datensicherung" helpLabel="Hilfe zur Datensicherung"
          rightContent={isDemo ? <span className="ml-2 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Demo — gesperrt</span> : null}
        >
          {isDemo ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
              <Info className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Backup & Restore im Demo-Konto gesperrt</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">HB9OM hat keine Berechtigung, Demo-Daten zu sichern oder wiederherzustellen.</p>
            </div>
          ) : (
            <BackupSection />
          )}
        </CollapsibleSection>

        {(appFeatures.tools.change_requests !== false || appFeatures.tools.feature_requests !== false) && (
          <div className="pt-2"><h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">Anträge & Feedback</h2></div>
        )}
        {/* Change Requests - available for all users */}
        {appFeatures.tools.change_requests !== false && (
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
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
        )}

        {/* Feature Requests - available for all users */}
        {appFeatures.tools.feature_requests !== false && (
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" /> Funktionsvorschläge
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Neue Funktionen vorschlagen und Status verfolgen
              </p>
            </div>
            <Link
              to="/help"
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center gap-2"
            >
              <Lightbulb className="w-4 h-4" />
              Zur Hilfe
            </Link>
          </div>
        </section>
        )}

        <div className="pt-2"><h2 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">Konto</h2></div>
        {/* Logout */}
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
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

        {/* Delete Account — hidden for demo user (admins delete via user management) */}
        {currentUser?.email !== DEMO_EMAIL && (
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
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
        )}
        </div>

        {showDeleteAccount && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDeleteAccount(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-slate-100">Konto wirklich löschen?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center mt-2">
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

      <DonationPopup />
      <BottomNavigation />
    </div>
  );
}