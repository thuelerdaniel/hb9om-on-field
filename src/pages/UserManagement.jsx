import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Users, Loader2, Mail, KeyRound, Search, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const me = await base44.auth.me();
      if (!me || me.role !== "admin") {
        navigate("/");
        return;
      }
      setIsAdmin(true);
      const data = await base44.entities.User.list("-created_date", 200);
      setUsers(data || []);
    } catch (e) {
      navigate("/");
    } finally {
      setAuthChecked(true);
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

  if (!isAdmin) return null;

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
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Keine Benutzer gefunden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(user => (
              <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{user.full_name || "—"}</span>
                      {user.role === "admin" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-900 text-white rounded-full flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" /> Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Registriert: {new Date(user.created_date).toLocaleString("de-CH")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setResetTarget(user);
                      setResetResult(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 flex-shrink-0"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Passwort
                  </button>
                </div>
              </div>
            ))}
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
              Ein Reset-Link wird an <strong className="text-gray-700">{resetTarget.email}</strong> gesendet. Der Benutzer kann danach ein neues Passwort festlegen.
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

      <BottomNavigation />
    </div>
  );
}