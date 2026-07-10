import React, { useState } from "react";
import { Download, Upload, Loader2, CheckCircle2, AlertCircle, Cloud } from "lucide-react";
import { createBackup, downloadBackup, restoreBackup, readBackupFile } from "@/lib/dataBackup";
import { useToast } from "@/components/ui/use-toast";

export default function BackupSection() {
  const { toast } = useToast();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem("hb9om_last_backup"));

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const backup = await createBackup();
      downloadBackup(backup);
      const now = new Date().toISOString();
      localStorage.setItem("hb9om_last_backup", now);
      setLastBackup(now);
      toast({ title: "Backup erstellt", description: `${backup.logs.length} Logeinträge, ${Object.keys(backup.settings).length} Einstellungen gesichert` });
    } catch (e) {
      toast({ title: "Backup fehlgeschlagen", description: e.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!confirm("Wirklich wiederherstellen? Aktuelle Daten werden überschrieben.")) return;

    setRestoring(true);
    try {
      const backup = await readBackupFile(file);
      const result = await restoreBackup(backup);
      toast({
        title: "Wiederherstellung abgeschlossen",
        description: `${result.logsRestored} Logs, ${result.settingsRestored} Einstellungen, ${result.qrzRestored} QRZ-Einträge`
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast({ title: "Wiederherstellung fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
        <Cloud className="w-4 h-4" /> Datensicherung
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Sichern Sie Ihr Logbuch, Einstellungen und QRZ-Abfragen als Datei oder stellen Sie sie wieder her.
      </p>

      {lastBackup && (
        <div className="mb-3 p-2.5 bg-green-50 rounded-lg text-xs text-green-700 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Letztes Backup: {new Date(lastBackup).toLocaleString('de-CH')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleBackup}
          disabled={backingUp}
          className="px-3 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Backup
        </button>
        <label className="px-3 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5 cursor-pointer">
          {restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Wiederherstellen
          <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
        </label>
      </div>

      <div className="mt-3 p-2.5 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>Das Backup enthält alle Logeinträge, Einstellungen, QRZ-Abfragen und Anträge. Speichern Sie die Datei an einem sicheren Ort (z.B. OneDrive oder Google Drive).</span>
      </div>
    </section>
  );
}