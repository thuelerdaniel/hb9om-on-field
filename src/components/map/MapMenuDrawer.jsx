import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Settings, HelpCircle, RefreshCw, LogOut, X, Radio, Cloud, CloudOff, ChevronRight, User } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function MapMenuDrawer({ open, onClose, isLoading, loadingMessage }) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [checkingSync, setCheckingSync] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setIsAdmin(me?.role === "admin");
      } catch {}
    })();
  }, []);

  // Fetch sync status when drawer opens or user requests refresh
  const fetchSyncStatus = async () => {
    setCheckingSync(true);
    try {
      const schedules = await base44.entities.DailyRefreshSchedule.list("display_order", 50);
      const total = schedules.length;
      const success = schedules.filter(s => s.last_status === "success").length;
      const failed = schedules.filter(s => s.last_status === "failed").length;
      const running = schedules.filter(s => s.last_status === "running").length;
      const pending = schedules.filter(s => s.last_status === "pending").length;
      const lastSync = schedules
        .map(s => s.last_run_time)
        .filter(Boolean)
        .sort()
        .pop();
      setSyncStatus({ total, success, failed, running, pending, lastSync, schedules });
    } catch {
      setSyncStatus(null);
    }
    setCheckingSync(false);
  };

  useEffect(() => {
    if (open) fetchSyncStatus();
  }, [open]);

  const handleLogout = async () => {
    try {
      await base44.auth.logout("/login");
    } catch {
      window.location.href = "/login";
    }
  };

  if (!open) return null;

  const formatLastSync = (iso) => {
    if (!iso) return "Nie";
    try {
      const d = new Date(iso);
      return d.toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 left-0 bottom-0 z-[10001] w-80 max-w-[85vw] bg-white dark:bg-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
          <div className="flex items-center gap-2">
            <img
              src="https://files.designer.hoststar.ch/f7/57/f75700fb-91da-4797-8c19-551f569930d2.png"
              alt="HB9OM"
              className="w-7 h-7 rounded object-contain"
            />
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">HB9OM On Field</h2>
              <p className="text-[10px] text-gray-400 dark:text-slate-500">Menu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu items */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Sync Status */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700/50">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-slate-400 ${checkingSync ? "animate-spin" : ""}`} />
              <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">Sync-Status</span>
              <button
                onClick={fetchSyncStatus}
                className="ml-auto p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400"
                title="Aktualisieren"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingSync ? "animate-spin" : ""}`} />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>{loadingMessage || "Daten werden geladen..."}</span>
              </div>
            ) : syncStatus ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  {syncStatus.failed > 0 ? (
                    <CloudOff className="w-3.5 h-3.5 text-red-500" />
                  ) : syncStatus.running > 0 ? (
                    <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-green-500" />
                  )}
                  <span className="text-gray-600 dark:text-slate-400">
                    {syncStatus.success}/{syncStatus.total} Quellen OK
                    {syncStatus.failed > 0 && `, ${syncStatus.failed} Fehler`}
                    {syncStatus.running > 0 && `, ${syncStatus.running} läuft`}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 pl-5">
                  Letzte Sync: {formatLastSync(syncStatus.lastSync)}
                </p>
                {isAdmin && syncStatus.schedules && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {syncStatus.schedules.slice(0, 8).map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 text-[10px] pl-5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          s.last_status === "success" ? "bg-green-500" :
                          s.last_status === "failed" ? "bg-red-500" :
                          s.last_status === "running" ? "bg-blue-500 animate-pulse" :
                          "bg-gray-300"
                        }`} />
                        <span className="text-gray-500 dark:text-slate-400 truncate">{s.label || s.source}</span>
                        {s.last_count != null && (
                          <span className="text-gray-400 ml-auto">{s.last_count.toLocaleString()}</span>
                        )}
                      </div>
                    ))}
                    {syncStatus.schedules.length > 8 && (
                      <Link to="/settings" onClick={onClose} className="text-[10px] text-blue-500 hover:underline pl-5">
                        Alle {syncStatus.schedules.length} anzeigen...
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-slate-500 pl-5">Status nicht verfügbar</p>
            )}
          </div>

          {/* Menu links */}
          <MenuLink to="/settings" onClose={onClose} icon={Settings} label="Einstellungen" desc="Menu-Band, Anzeige, Konto" />
          <MenuLink to="/help" onClose={onClose} icon={HelpCircle} label="Hilfe / Datenquellen" desc="Referenz & Anleitung" />

          {isAdmin && (
            <MenuLink to="/settings" onClose={onClose} icon={RefreshCw} label="Admin: Sync-Verwaltung" desc="Datenquellen aktualisieren" />
          )}

          {/* Account / Logout */}
          <div className="px-4 py-3 mt-auto border-t border-gray-100 dark:border-slate-700/50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <div className="text-left">
                <p className="text-sm font-medium">Abmelden</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500">Aus dem Konto ausloggen</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function MenuLink({ to, onClose, icon: Icon, label, desc }) {
  return (
    <Link
      to={to}
      onClick={onClose}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group"
    >
      <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-slate-600">
        <Icon className="w-4 h-4 text-gray-600 dark:text-slate-300" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{label}</p>
        <p className="text-[10px] text-gray-400 dark:text-slate-500">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-gray-400" />
    </Link>
  );
}