import React, { useState, useEffect } from "react";
import { Download, Upload, Loader2, CheckCircle2, Cloud, FileJson, Settings2, Link2, RefreshCw, AlertCircle } from "lucide-react";
import { createBackup, downloadBackup, restoreBackup, readBackupFile } from "@/lib/dataBackup";
import { useToast } from "@/components/ui/use-toast";
import CloudProviderCard from "@/components/settings/CloudProviderCard";

const GOOGLE_DRIVE_CONNECTOR_ID = "6a513a8f2e9f3bb9dadc9564";
const ONEDRIVE_CONNECTOR_ID = "6a513adebee7a531c23b3e6a";

export default function BackupSection() {
  const { toast } = useToast();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem("hb9om_last_backup"));

  // WebDAV state
  const [showWebdav, setShowWebdav] = useState(false);
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUser, setWebdavUser] = useState("");
  const [webdavPass, setWebdavPass] = useState("");
  const [webdavConfigured, setWebdavConfigured] = useState(false);
  const [webdavTesting, setWebdavTesting] = useState(false);
  const [webdavUploading, setWebdavUploading] = useState(false);
  const [webdavFiles, setWebdavFiles] = useState([]);
  const [webdavLoadingFiles, setWebdavLoadingFiles] = useState(false);
  const [webdavRestoring, setWebdavRestoring] = useState(false);
  const [webdavLastBackup, setWebdavLastBackup] = useState(() => localStorage.getItem("hb9om_last_cloud_backup"));
  const [webdavAuto, setWebdavAuto] = useState(() => localStorage.getItem("hb9om_auto_cloud_backup") === "true" && localStorage.getItem("hb9om_cloud_provider") === "webdav");

  useEffect(() => {
    (async () => {
      try {
        const { base44 } = await import("@/api/base44Client");
        const me = await base44.auth.me();
        if (me) {
          const url = me.webdav_url || "";
          const user = me.webdav_username || "";
          const pass = me.webdav_password || "";
          setWebdavUrl(url);
          setWebdavUser(user);
          setWebdavPass(pass);
          setWebdavConfigured(!!url && !!user && !!pass);
        }
      } catch {}
    })();
  }, []);

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const backup = await createBackup();
      downloadBackup(backup);
      const now = new Date().toISOString();
      localStorage.setItem("hb9om_last_backup", now);
      setLastBackup(now);
      toast({ title: "Backup erstellt", description: `${backup.logs.length} Logeinträge gesichert` });
    } catch (e) {
      toast({ title: "Backup fehlgeschlagen", description: e.message, variant: "destructive" });
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
      toast({ title: "Wiederherstellung abgeschlossen", description: `${result.logsRestored} Logs, ${result.settingsRestored} Einstellungen` });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast({ title: "Wiederherstellung fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  // ─── WebDAV handlers ───
  const handleSaveWebdav = async () => {
    try {
      const { base44 } = await import("@/api/base44Client");
      await base44.auth.updateMe({
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass
      });
      setWebdavConfigured(!!webdavUrl.trim() && !!webdavUser.trim() && !!webdavPass);
      toast({ title: "WebDAV-Zugangsdaten gespeichert" });
    } catch (e) {
      toast({ title: "Speichern fehlgeschlagen", description: e.message, variant: "destructive" });
    }
  };

  const handleTestWebdav = async () => {
    setWebdavTesting(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const res = await base44.functions.invoke("cloudBackup", {
        action: "test",
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass
      });
      if (res.data?.success) {
        toast({ title: "Verbindung erfolgreich", description: "WebDAV-Server erreichbar" });
      } else {
        toast({ title: "Verbindung fehlgeschlagen", description: res.data?.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Verbindung fehlgeschlagen", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setWebdavTesting(false);
    }
  };

  const handleWebdavBackup = async () => {
    setWebdavUploading(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const backup = await createBackup();
      const callsign = backup.settings?.hb9om_my_callsign || "hb9om";
      const filename = `hb9om_backup_${callsign}_${new Date().toISOString().slice(0, 10)}.json`;
      const res = await base44.functions.invoke("cloudBackup", {
        action: "upload",
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass,
        backup_data: backup,
        backup_filename: filename
      });
      if (res.data?.success) {
        const now = new Date().toISOString();
        localStorage.setItem("hb9om_last_cloud_backup", now);
        setWebdavLastBackup(now);
        toast({ title: "Cloud-Backup erstellt", description: `${backup.logs.length} Einträge hochgeladen` });
      } else {
        toast({ title: "Backup fehlgeschlagen", description: res.data?.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Backup fehlgeschlagen", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setWebdavUploading(false);
    }
  };

  const handleListWebdav = async () => {
    setWebdavLoadingFiles(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const res = await base44.functions.invoke("cloudBackup", {
        action: "list",
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass
      });
      setWebdavFiles(res.data?.files || []);
    } catch (e) {
      toast({ title: "Fehler beim Auflisten", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setWebdavLoadingFiles(false);
    }
  };

  const handleRestoreWebdav = async (file) => {
    if (!confirm(`Backup "${file.name}" wiederherstellen? Aktuelle Daten werden überschrieben.`)) return;
    setWebdavRestoring(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const res = await base44.functions.invoke("cloudBackup", {
        action: "download",
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass,
        file_url: file.url
      });
      if (res.data?.backup) {
        const result = await restoreBackup(res.data.backup);
        toast({ title: "Wiederhergestellt", description: `${result.logsRestored} Logs, ${result.settingsRestored} Einstellungen` });
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      toast({ title: "Fehler", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setWebdavRestoring(false);
    }
  };

  const handleToggleWebdavAuto = (enabled) => {
    setWebdavAuto(enabled);
    if (enabled) {
      localStorage.setItem("hb9om_auto_cloud_backup", "true");
      localStorage.setItem("hb9om_cloud_provider", "webdav");
    } else {
      localStorage.setItem("hb9om_auto_cloud_backup", "false");
      if (localStorage.getItem("hb9om_cloud_provider") === "webdav") {
        localStorage.removeItem("hb9om_cloud_provider");
      }
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
        <Cloud className="w-4 h-4" /> Datensicherung
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Sichern Sie Ihr Logbuch und Einstellungen – lokal als Datei oder direkt in Ihre Cloud.
      </p>

      {/* Local backup */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
          <FileJson className="w-3.5 h-3.5" /> Lokales Backup (Datei)
        </h3>
        {lastBackup && (
          <div className="mb-2 p-2 bg-green-50 rounded-lg text-xs text-green-700 flex items-center gap-1.5">
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
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100 my-3" />

      {/* Cloud backup providers */}
      <div>
        <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
          <Cloud className="w-3.5 h-3.5" /> Cloud-Backup
        </h3>
        <p className="text-xs text-gray-500 mb-3">
           Verbinden Sie Ihre Cloud – Backups werden automatisch erstellt. WebDAV ist bereits verfügbar, Google Drive und OneDrive folgen.
        </p>

        <div className="space-y-2 mb-3">
          {/* Google Drive – kommt in einer späteren Version */}
          <div className="border border-gray-200 rounded-lg p-3 opacity-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                  <Cloud className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500">Google Drive</p>
                  <p className="text-[10px] text-gray-400">Google-Konto verbinden</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full">Bald</span>
            </div>
            <button
              disabled
              className="w-full px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Link2 className="w-4 h-4" />
              Mit Google Drive verbinden
            </button>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Kommt in einer späteren Version der App.
            </p>
          </div>

          {/* OneDrive – kommt in einer späteren Version */}
          <div className="border border-gray-200 rounded-lg p-3 opacity-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                  <Cloud className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-500">OneDrive</p>
                  <p className="text-[10px] text-gray-400">Microsoft-Konto verbinden</p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 rounded-full">Bald</span>
            </div>
            <button
              disabled
              className="w-full px-3 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Link2 className="w-4 h-4" />
              Mit OneDrive verbinden
            </button>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Kommt in einer späteren Version der App.
            </p>
          </div>
        </div>

        {/* WebDAV (advanced) */}
        <button
          onClick={() => setShowWebdav(!showWebdav)}
          className="w-full px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1.5"
        >
          <Settings2 className="w-3.5 h-3.5" />
          {showWebdav ? "WebDAV ausblenden" : "WebDAV (erweitert)"}
        </button>

        {showWebdav && (
          <div className="mt-2 space-y-2 p-3 bg-gray-50 rounded-lg">
            {!webdavConfigured && (
              <div className="p-2 bg-blue-50 rounded text-xs text-blue-700 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Geben Sie Ihre WebDAV-Zugangsdaten ein (Nextcloud, ownCloud, Synology, etc.).</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">WebDAV-URL</label>
              <input
                type="url"
                value={webdavUrl}
                onChange={e => setWebdavUrl(e.target.value)}
                placeholder="https://cloud.example.com/remote.php/dav/files/user/"
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Benutzername</label>
              <input
                type="text"
                value={webdavUser}
                onChange={e => setWebdavUser(e.target.value)}
                placeholder="WebDAV-Benutzername"
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Passwort</label>
              <input
                type="password"
                value={webdavPass}
                onChange={e => setWebdavPass(e.target.value)}
                placeholder="WebDAV-Passwort / App-Token"
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveWebdav}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Speichern
              </button>
              <button
                onClick={handleTestWebdav}
                disabled={webdavTesting || !webdavUrl || !webdavUser}
                className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {webdavTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Testen
              </button>
            </div>

            {webdavConfigured && (
              <>
                {webdavLastBackup && (
                  <div className="p-2 bg-green-50 rounded text-xs text-green-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Letztes Cloud-Backup: {new Date(webdavLastBackup).toLocaleString('de-CH')}
                  </div>
                )}

                <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-900">Automatisches Backup</label>
                    <p className="text-[10px] text-gray-500">Bei jedem neuen QSO sichern</p>
                  </div>
                  <button
                    onClick={() => handleToggleWebdavAuto(!webdavAuto)}
                    className={`relative w-11 h-5 rounded-full transition-colors flex-shrink-0 ${webdavAuto ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${webdavAuto ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleWebdavBackup}
                    disabled={webdavUploading}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {webdavUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                    Backup
                  </button>
                  <button
                    onClick={handleListWebdav}
                    disabled={webdavLoadingFiles}
                    className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {webdavLoadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Dateien
                  </button>
                </div>

                {webdavFiles.length > 0 && (
                  <div className="space-y-1">
                    {webdavFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileJson className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          <span className="text-xs text-gray-700 truncate">{f.name}</span>
                        </div>
                        <button
                          onClick={() => handleRestoreWebdav(f)}
                          disabled={webdavRestoring}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 flex-shrink-0 ml-2"
                        >
                          {webdavRestoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          Wiederherstellen
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}