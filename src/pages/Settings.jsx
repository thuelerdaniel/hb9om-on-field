import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle, Settings as SettingsIcon, Database, Clock, Radio, User, Check, Search, HelpCircle, Trash2, AlertTriangle } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

const TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
  castle: "Burgen/Schlösser", lighthouse: "Leuchttürme", iota: "IOTA"
};

export default function Settings() {
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

  useEffect(() => {
    loadData();
    loadProfile();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, cacheData, qrzData] = await Promise.all([
        base44.entities.SyncLog.list("-created_date", 50),
        base44.entities.ReferenceData.list(),
        base44.entities.QrzLookup.list("-created_date", 10)
      ]);
      setLogs(logsData || []);
      setCacheStatus(cacheData || []);
      setQrzLookups(qrzData || []);
    } catch (e) {
      setLogs([]);
      setCacheStatus([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = () => {
    setMyCallsign(localStorage.getItem("hb9om_my_callsign") || "");
    setQrzEnabled(localStorage.getItem("hb9om_qrz_enabled") !== "false");
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

  const StatusIcon = ({ status }) => {
    if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (status === 'partial') return <AlertCircle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
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
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
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
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4" /> QRZ-Abfrageprotokoll
          </h2>
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
              cacheStatus.map(entry => (
                <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-900">{TYPE_LABELS[entry.type] || entry.type}</span>
                    <span className="text-lg font-bold text-gray-900">{entry.total_count}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {entry.last_updated ? new Date(entry.last_updated).toLocaleString('de-CH') : 'Nie'}
                  </p>
                  <p className="text-[10px] text-gray-400">Quelle: {entry.source}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Refresh Button */}
        <section className="bg-white rounded-xl border border-gray-200 p-4">
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
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        {r.status === 'success'
                          ? <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                          : <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                        }
                        <span className="text-gray-600">{TYPE_LABELS[r.type] || r.type}</span>
                        <span className="text-gray-400 font-medium">{r.count}</span>
                        {r.error && <span className="text-red-400 truncate" title={r.error}>({r.error.slice(0, 30)})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

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