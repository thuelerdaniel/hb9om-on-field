import React, { useState, useEffect } from "react";
import { Download, Upload, Loader2, CheckCircle2, AlertCircle, Cloud, CloudUpload, Settings2, Link2, RefreshCw, FileJson, Trash2 } from "lucide-react";
import { createBackup, downloadBackup, restoreBackup, readBackupFile } from "@/lib/dataBackup";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function BackupSection() {
  const { toast } = useToast();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem("hb9om_last_backup"));
  const [showCloudSettings, setShowCloudSettings] = useState(false);

  // Cloud backup state
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUser, setWebdavUser] = useState("");
  const [webdavPass, setWebdavPass] = useState("");
  const [autoCloudBackup, setAutoCloudBackup] = useState(false);
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [cloudTesting, setCloudTesting] = useState(false);
  const [cloudUploading, setCloudUploading] = useState(false);
  const [lastCloudBackup, setLastCloudBackup] = useState(() => localStorage.getItem("hb9om_last_cloud_backup"));
  const [cloudFiles, setCloudFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [cloudRestoring, setCloudRestoring] = useState(false);

  useEffect(() => {
    loadCloudConfig();
  }, []);

  const loadCloudConfig = async () => {
    try {
      const me = await base44.auth.me();
      if (me) {
        const url = me.webdav_url || "";
        const user = me.webdav_username || "";
        const pass = me.webdav_password || "";
        setWebdavUrl(url);
        setWebdavUser(user);
        setWebdavPass(pass);
        setCloudConfigured(!!url && !!user && !!pass);
        setAutoCloudBackup(localStorage.getItem("hb9om_auto_cloud_backup") === "true");
      }
    } catch {}
  };

  const handleSaveCloudConfig = async () => {
    try {
      await base44.auth.updateMe({
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass
      });
      setCloudConfigured(!!webdavUrl.trim() && !!webdavUser.trim() && !!webdavPass);
      toast({ title: "Cloud-Zugangsdaten gespeichert" });
    } catch (e) {
      toast({ title: "Speichern fehlgeschlagen", description: e.message, variant: "destructive" });
    }
  };

  const handleTestCloud = async () => {
    setCloudTesting(true);
    try {
      const res = await base44.functions.invoke("cloudBackup", {
        action: "test",
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass
      });
      if (res.data?.success) {
        toast({ title: "Verbindung erfolgreich", description: "WebDAV-Server erreichbar" });
      } else {
        toast({ title: "Verbindung fehlgeschlagen", description: res.data?.error || "Unbekannt", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Verbindung fehlgeschlagen", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setCloudTesting(false);
    }
  };

  const handleCloudBackup = async () => {
    setCloudUploading(true);
    try {
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
        setLastCloudBackup(now);
        toast({ title: "Cloud-Backup erstellt", description: `${backup.logs.length} Einträge in die Cloud hochgeladen` });
      } else {
        toast({ title: "Cloud-Backup fehlgeschlagen", description: res.data?.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Cloud-Backup fehlgeschlagen", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setCloudUploading(false);
    }
  };

  const handleListCloudBackups = async () => {
    setLoadingFiles(true);
    try {
      const res = await base44.functions.invoke("cloudBackup", {
        action: "list",
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass
      });
      setCloudFiles(res.data?.files || []);
    } catch (e) {
      toast({ title: "Fehler beim Auflisten", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleRestoreFromCloud = async (file) => {
    if (!confirm(`Backup "${file.name}" aus der Cloud wiederherstellen? Aktuelle Daten werden überschrieben.`)) return;
    setCloudRestoring(true);
    try {
      const res = await base44.functions.invoke("cloudBackup", {
        action: "download",
        webdav_url: webdavUrl.trim(),
        webdav_username: webdavUser.trim(),
        webdav_password: webdavPass,
        file_url: file.url
      });
      if (res.data?.backup) {
        const result = await restoreBackup(res.data.backup);
        toast({
          title: "Aus Cloud wiederhergestellt",
          description: `${result.logsRestored} Logs, ${result.settingsRestored} Einstellungen`
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast({ title: "Wiederherstellung fehlgeschlagen", description: "Backup konnte nicht geladen werden", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Wiederherstellung fehlgeschlagen", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setCloudRestoring(false);
    }
  };

  const handleToggleAutoBackup = (enabled) => {
    setAutoCloudBackup(enabled);
    localStorage.setItem("hb9om_auto_cloud_backup", String(enabled));
    if (enabled && cloudConfigured) {
      toast({ title: "Automatisches Backup aktiviert", description: "Backup wird bei jedem neuen QSO erstellt" });
    }
  };

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
      toast({ title: "Wiederherstellung abgeschlossen", description: `${result.logsRestored} Logs, ${result.settingsRestored} Einstellungen, ${result.qrzRestored} QRZ-Einträge` });
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
        Sichern Sie Ihr Logbuch und Einstellungen lokal als Datei oder automatisch in Ihre Cloud (WebDAV).
      </p>

      {/* Manual backup */}
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

      {/* Cloud backup */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1">
            <CloudUpload className="w-3.5 h-3.5" /> Cloud-Backup (WebDAV)
          </h3>
          <button
            onClick={() => setShowCloudSettings(!showCloudSettings)}
            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
          >
            <Settings2 className="w-3 h-3" />
            {showCloudSettings ? "Schliessen" : "Einrichten"}
          </button>
        </div>

        {cloudConfigured && !showCloudSettings && (
          <>
            {lastCloudBackup && (
              <div className="mb-2 p-2 bg-green-50 rounded-lg text-xs text-green-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Letztes Cloud-Backup: {new Date(lastCloudBackup).toLocaleString('de-CH')}
              </div>
            )}

            {/* Auto-backup toggle */}
            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg mb-2">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-900">Automatisches Backup</label>
                <p className="text-xs text-gray-500 mt-0.5">Bei jedem neuen QSO in die Cloud sichern</p>
              </div>
              <button
                onClick={() => handleToggleAutoBackup(!autoCloudBackup)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${autoCloudBackup ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoCloudBackup ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={handleCloudBackup}
                disabled={cloudUploading}
                className="px-3 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {cloudUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                Cloud-Backup
              </button>
              <button
                onClick={handleListCloudBackups}
                disabled={loadingFiles}
                className="px-3 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {loadingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Cloud-Dateien
              </button>
            </div>

            {/* Cloud files list */}
            {cloudFiles.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <p className="text-xs text-gray-500 font-medium">Backups in der Cloud:</p>
                {cloudFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileJson className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{f.name}</span>
                    </div>
                    <button
                      onClick={() => handleRestoreFromCloud(f)}
                      disabled={cloudRestoring}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 flex-shrink-0 ml-2"
                    >
                      {cloudRestoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      Wiederherstellen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {showCloudSettings && (
          <div className="space-y-2 p-3 bg-blue-50 rounded-lg">
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
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Unterstützt: Nextcloud, ownCloud, Synology, Strato HiDrive und alle WebDAV-kompatiblen Clouds.
              Verwenden Sie bei Nextcloud/ownCloud ein App-Passwort anstelle Ihres Hauptpassworts.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSaveCloudConfig}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Speichern
              </button>
              <button
                onClick={handleTestCloud}
                disabled={cloudTesting || !webdavUrl || !webdavUser}
                className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {cloudTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Testen
              </button>
            </div>
          </div>
        )}

        {!cloudConfigured && !showCloudSettings && (
          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Cloud-Backup noch nicht eingerichtet. Klicken Sie auf «Einrichten», um Ihre WebDAV-Zugangsdaten zu hinterlegen.</span>
          </div>
        )}
      </div>
    </section>
  );
}