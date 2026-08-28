import React, { useState, useEffect } from "react";
import { HardDrive, Download, Upload, Loader2, Check, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { safeGetItem, safeSetItem } from "@/lib/safeStorage";

// Fix 11: Monatliches Backup der User-Daten auf lokales Gerät.
// File System Access API (Chrome/Edge) mit Download-Fallback (Safari/Firefox).
// Automatische Auslösung beim App-Start wenn > 30 Tage seit letztem Backup.

export default function MonthlyBackup() {
  const [lastBackup, setLastBackup] = useState(null);
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const date = safeGetItem("hb9om_last_backup_date");
    setLastBackup(date);
    // Auto-backup if > 30 days
    if (date) {
      const days = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 30) handleBackup(true);
    }
  }, []);

  const handleBackup = async (auto = false) => {
    setBacking(true);
    setMessage(null);
    try {
      const me = await base44.auth.me();
      const logs = await base44.entities.Log.list("-created_date", 10000);
      const backupData = {
        backup_date: new Date().toISOString(),
        version: "v0.9014",
        user_data: {
          callsign: safeGetItem("hb9om_my_callsign") || me?.full_name,
          suffix: safeGetItem("hb9om_my_suffix"),
          license_class: safeGetItem("hb9om_my_license_class"),
          locator: safeGetItem("hb9om_station_locator"),
          club_callsign: safeGetItem("hb9om_club_callsign"),
        },
        qso_log: logs || [],
      };
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const fileName = `hb9om_backup_${new Date().toISOString().split("T")[0]}.json`;

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "JSON Backup", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      safeSetItem("hb9om_last_backup_date", new Date().toISOString());
      setLastBackup(new Date().toISOString());
      setMessage({ type: "success", text: auto ? "Automatisches Backup erstellt" : "Backup erstellt" });
    } catch (e) {
      if (e.name === "AbortError") {
        setMessage({ type: "info", text: "Backup abgebrochen" });
      } else {
        setMessage({ type: "error", text: e.message });
      }
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setMessage(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.backup_date) throw new Error("Ungültige Backup-Datei");

      if (data.user_data) {
        if (data.user_data.callsign) safeSetItem("hb9om_my_callsign", data.user_data.callsign);
        if (data.user_data.suffix) safeSetItem("hb9om_my_suffix", data.user_data.suffix);
        if (data.user_data.license_class) safeSetItem("hb9om_my_license_class", data.user_data.license_class);
        if (data.user_data.locator) safeSetItem("hb9om_station_locator", data.user_data.locator);
        if (data.user_data.club_callsign) safeSetItem("hb9om_club_callsign", data.user_data.club_callsign);
      }

      if (data.qso_log && Array.isArray(data.qso_log)) {
        for (const qso of data.qso_log) {
          try {
            await base44.entities.Log.create({
              ...qso,
              id: undefined,
              created_date: undefined,
              updated_date: undefined,
            });
          } catch {}
        }
      }

      setMessage({ type: "success", text: `Backup wiederhergestellt: ${data.qso_log?.length || 0} QSOs` });
    } catch (e) {
      setMessage({ type: "error", text: "Wiederherstellung fehlgeschlagen: " + e.message });
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "Nie";
    try {
      return new Date(dateStr).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return "Nie"; }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
            <HardDrive className="w-4 h-4" /> Monatliches Backup
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Letztes Backup: {formatDate(lastBackup)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleBackup(false)}
          disabled={backing}
          className="flex-1 px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {backing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {backing ? "Backup läuft…" : "Jetzt Backup erstellen"}
        </button>
        <label className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 cursor-pointer">
          {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {restoring ? "Wird geladen…" : "Backup wiederherstellen"}
          <input type="file" accept=".json" onChange={handleRestore} className="hidden" disabled={restoring} />
        </label>
      </div>

      {message && (
        <div className={`text-xs p-2 rounded-lg flex items-center gap-1.5 ${
          message.type === "success" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" :
          message.type === "error" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" :
          "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
        }`}>
          {message.type === "success" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {message.text}
        </div>
      )}

      <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
        Das Backup wird monatlich automatisch erstellt. Es enthält QSO-Logs und Station-Einstellungen.
        QRZ-Passwörter werden aus Sicherheitsgründen nicht im Backup gespeichert.
      </p>
    </div>
  );
}