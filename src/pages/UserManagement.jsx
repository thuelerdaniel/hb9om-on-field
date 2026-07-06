import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Users, Loader2, Mail, KeyRound, Search, Shield, CheckCircle2, AlertCircle, Trash2, UserCog, Clock, ShieldCheck, ShieldOff } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleChanging, setRoleChanging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    setAuthChecked(true);
    setLoading(true);
    try {
      // Try to load users — the server checks the actual database role,
      // not the (possibly stale) JWT token. Returns 403 for non-admins.
      const data = await base44.entities.User.list("-created_date", 200);
      setUsers(data || []);
      setIsAdmin(true);
      try {
        const me = await base44.auth.me();
        setCurrentUser(me);
      } catch (e) { }
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) {
        setIsAdmin(false);
      } else {
        setLoadError(e?.response?.data?.detail || e?.message || "unbekannt");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (user) => {
    setResetSending(true);
    setResetResult(null);
    try {
      await base44.auth.resetPasswordRequest(user.email);
      setResetResult({ success: true, email: user.email });
    } catch (e) {
      setResetResult({ success: false, email: user.email, error: e.message || "unbekannt" });
    } finally {
      setResetSending(false);
    }
  };

  const handleRoleChange = async () => {
    if (!roleTarget) return;
    setRoleChanging(true);
    setActionError("");
    const newRole = roleTarget.role === "admin" ? "user" : "admin";
    try {
      await base44.entities.User.update(roleTarget.id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === roleTarget.id ? { ...u, role: newRole } : u));
      setRoleTarget(null);
    } catch (e) {
      setActionError(e?.response?.data?.detail || e.message || "unbekannt");
    } finally {
      setRoleChanging(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError("");
    try {
      await base44.entities.User.delete(deleteTarget.id);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      setActionError(e?.response?.data?.detail || e.message || "unbekannt");
    } finally {
      setDeleting(false);
    }
  };

  const formatLastLogin = (ts) => {
    if (!ts) return "Nie";
    try {
      return new Date(ts).toLocaleString("de-CH");
    } catch {
      return "Unbekannt";
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.email || "").toLowerCase().includes(q) || (u.full_name || "").toLowerCase().includes(q);
  });

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!loading && !isAdmin && !loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Kein Zugriff</h2>
          <p className="text-sm text-gray-500 mb-4">
            Sie benötigen Administrator-Rechte, um auf die Benutzerverwaltung zuzugreifen.
          </p>
          <button
            onClick={() => navigate("/settings")}
            className="px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
          >
            Zurück zu Einstellungen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/settings")} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Benutzerverwaltung</h1>
              <p className="text-[10px] text-gray-400">{users.length} angemeldete Benutzer</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 pb-24">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Benutzer suchen..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : loadError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-red-700 mb-1">Benutzerliste konnte nicht geladen werden</p>
            <p className="text-xs text-red-500 mb-3">{loadError}</p>
            <p className="text-xs text-gray-500">
              Falls Sie kürzlich zum Admin befördert wurden, melden Sie sich bitte einmal ab und wieder an, um die Sitzung zu aktualisieren.
            </p>
            <button
              onClick={() => base44.auth.logout(window.location.href)}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 inline-flex items-center gap-2"
            >
              Abmelden und neu anmelden
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Keine Benutzer gefunden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(user => {
              const isSelf = currentUser && user.id === currentUser.id;
              return (
                <div key={user.id} className={`bg-white rounded-xl border p-4 ${isSelf ? "border-blue-200 bg-blue-50/30" : "border-gray-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{user.full_name || "—"}</span>
                        {user.role === "admin" ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-900 text-white rounded-full flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" /> Admin
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">User</span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full">Du</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>Login: {formatLastLogin(user.last_login)}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Registriert: {new Date(user.created_date).toLocaleString("de-CH")}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => { setResetTarget(user); setResetResult(null); }}
                      className="px-2.5 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Passwort
                    </button>

                    <button
                      onClick={() => { setRoleTarget(user); setActionError(""); }}
                      disabled={isSelf}
                      className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg flex items-center gap-1.5 ${
                        isSelf
                          ? "opacity-30 cursor-not-allowed border-gray-200 text-gray-400"
                          : user.role === "admin"
                            ? "text-amber-700 border-amber-200 hover:bg-amber-50"
                            : "text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                      title={isSelf ? "Du kannst deine eigene Rolle nicht ändern" : ""}
                    >
                      {user.role === "admin"
                        ? <><ShieldOff className="w-3.5 h-3.5" /> Zu User</>
                        : <><ShieldCheck className="w-3.5 h-3.5" /> Zu Admin</>
                      }
                    </button>

                    <div className="flex-1" />

                    <button
                      onClick={() => { setDeleteTarget(user); setActionError(""); }}
                      disabled={isSelf}
                      className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg flex items-center gap-1.5 ${
                        isSelf
                          ? "opacity-30 cursor-not-allowed border-gray-200 text-gray-400"
                          : "text-red-600 border-red-200 hover:bg-red-50"
                      }`}
                      title={isSelf ? "Du kannst dich nicht selbst löschen" : ""}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Löschen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Password Reset Confirmation Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setResetTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900">Passwort zurücksetzen?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              Ein Reset-Link wird an <strong className="text-gray-700">{resetTarget.email}</strong> gesendet.
            </p>

            {resetResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${resetResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {resetResult.success
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span>
                  {resetResult.success
                    ? `Reset-Link wurde an ${resetResult.email} gesendet.`
                    : `Fehler: ${resetResult.error}`}
                </span>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setResetTarget(null); setResetResult(null); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {resetResult?.success ? "Schliessen" : "Abbrechen"}
              </button>
              {!resetResult && (
                <button
                  onClick={() => handleResetPassword(resetTarget)}
                  disabled={resetSending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {resetSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Reset-Link senden
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => !roleChanging && setRoleTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${roleTarget.role === "admin" ? "bg-amber-100" : "bg-gray-100"}`}>
              {roleTarget.role === "admin"
                ? <ShieldOff className="w-6 h-6 text-amber-500" />
                : <ShieldCheck className="w-6 h-6 text-gray-600" />}
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900">
              {roleTarget.role === "admin" ? "Admin-Rechte entfernen?" : "Zum Admin machen?"}
            </h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              <strong className="text-gray-700">{roleTarget.full_name || roleTarget.email}</strong>
              {roleTarget.role === "admin"
                ? " erhält dann nur noch Benutzer-Rechte."
                : " erhält dann volle Administrator-Rechte inkl. Benutzerverwaltung."}
            </p>

            {actionError && (
              <p className="text-xs text-red-600 text-center mt-2">{actionError}</p>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setRoleTarget(null)}
                disabled={roleChanging}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Abbrechen
              </button>
              <button
                onClick={handleRoleChange}
                disabled={roleChanging}
                className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-40 flex items-center justify-center gap-2 ${
                  roleTarget.role === "admin" ? "bg-amber-500 hover:bg-amber-600" : "bg-gray-900 hover:bg-gray-800"
                }`}
              >
                {roleChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900">Benutzer löschen?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              <strong className="text-gray-700">{deleteTarget.full_name || deleteTarget.email}</strong> wird unwiderruflich gelöscht. Alle zugehörigen Daten (Logs, Einstellungen) gehen verloren.
            </p>

            {actionError && (
              <p className="text-xs text-red-600 text-center mt-2">{actionError}</p>
            )}

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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