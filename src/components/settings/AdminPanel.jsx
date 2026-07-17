import React from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Database, Clock, RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle, Bell, UserPlus, AlertTriangle, Users, User, KeyRound, Lightbulb, MapPin } from "lucide-react";
import UnmatchedCastles from "@/components/admin/UnmatchedCastles";
import AdminDataMaintains from "@/components/admin/AdminDataMaintains";
import ExternalDataCheck from "@/components/admin/ExternalDataCheck";

const TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
  castle: "Burgen/Schlösser", lighthouse: "Leuchttürme", iota: "IOTA"
};

function StatusIcon({ status }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === 'partial') return <AlertCircle className="w-4 h-4 text-amber-500" />;
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
  return (
    <>
      {/* Change Request Review */}
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

      {/* Feature Requests Review */}
      <section className="bg-purple-50 rounded-xl border-2 border-purple-300 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-purple-600" /> Funktionsvorschläge prüfen
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">Benutzer eingereichte Vorschläge prüfen und beantworten</p>
            {adminPendingFeatureRequests > 0 && (
              <p className="text-xs text-purple-700 mt-1 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> {adminPendingFeatureRequests} Vorschlag{adminPendingFeatureRequests !== 1 ? 'äge' : ''} wartet{adminPendingFeatureRequests !== 1 ? 'en' : ''} auf Prüfung
              </p>
            )}
          </div>
          <Link
            to="/admin/feature-requests"
            className="relative px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            Prüfen
            {adminPendingFeatureRequests > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {adminPendingFeatureRequests}
              </span>
            )}
          </Link>
        </div>
      </section>

      {/* User Management */}
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

      {/* Refresh / Auto-update */}
      <section className="bg-white rounded-xl border border-gray-200 p-4">
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

      {/* Notification Settings */}
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
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Demo-Login
              </label>
              <p className="text-xs text-gray-500 mt-0.5">Wenn sich jemand als Demo-Benutzer anmeldet</p>
            </div>
            <button
              onClick={() => handleToggleNotification("notify_demo_login", !notifyDemoLogin, setNotifyDemoLogin)}
              disabled={notifyLoading}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${notifyDemoLogin ? 'bg-gray-900' : 'bg-gray-300'} ${notifyLoading ? 'opacity-40' : ''}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${notifyDemoLogin ? 'translate-x-6' : ''}`} />
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

      {/* External Data Check */}
      <ExternalDataCheck />

      {/* Unmatched Castles Editor */}
      <UnmatchedCastles />

      {/* Data Maintenance */}
      <AdminDataMaintains />

      {/* Demo User Setup */}
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
  );
}