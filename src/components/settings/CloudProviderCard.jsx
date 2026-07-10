import React, { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, AlertCircle, CloudUpload, RefreshCw, Upload, Trash2, Link2, Unlink, FileJson } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { createBackup, restoreBackup } from "@/lib/dataBackup";

export default function CloudProviderCard({ provider, connectorId, displayName, color, description }) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [files, setFiles] = useState([]);
  const [showFiles, setShowFiles] = useState(false);
  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem("hb9om_auto_cloud_backup") === "true" && localStorage.getItem("hb9om_cloud_provider") === provider);
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem("hb9om_last_cloud_backup"));

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await base44.functions.invoke("cloudDriveBackup", { action: "list", provider });
      if (res.data?.files) {
        setConnected(true);
        setFiles(res.data.files);
      } else {
        setConnected(false);
      }
    } catch (e) {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  }, [provider]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleConnect = async () => {
    try {
      const url = await base44.connectors.connectAppUser(connectorId);
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setTimeout(() => checkConnection(), 500);
        }
      }, 500);
    } catch (e) {
      toast({ title: "Verbindung fehlgeschlagen", description: e?.message, variant: "destructive" });
    }
  };

  const handleDisconnect = async () => {
    try {
      await base44.connectors.disconnectAppUser(connectorId);
      setConnected(false);
      setFiles([]);
      setShowFiles(false);
      if (localStorage.getItem("hb9om_cloud_provider") === provider) {
        localStorage.removeItem("hb9om_cloud_provider");
      }
      toast({ title: `${displayName} getrennt`, description: "Die Verbindung wurde entfernt." });
    } catch (e) {
      toast({ title: "Trennen fehlgeschlagen", description: e?.message, variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      const backup = await createBackup();
      const callsign = backup.settings?.hb9om_my_callsign || "hb9om";
      const filename = `hb9om_backup_${callsign}_${new Date().toISOString().slice(0, 10)}.json`;
      const res = await base44.functions.invoke("cloudDriveBackup", {
        action: "upload",
        provider,
        backup_data: backup,
        backup_filename: filename
      });
      if (res.data?.success) {
        const now = new Date().toISOString();
        localStorage.setItem("hb9om_last_cloud_backup", now);
        localStorage.setItem("hb9om_cloud_provider", provider);
        setLastBackup(now);
        toast({ title: "Backup erstellt", description: `${backup.logs.length} Einträge in ${displayName} hochgeladen` });
        checkConnection();
      } else {
        toast({ title: "Backup fehlgeschlagen", description: res.data?.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Backup fehlgeschlagen", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleListFiles = async () => {
    setShowFiles(!showFiles);
    if (!showFiles) {
      setLoadingFiles(true);
      try {
        const res = await base44.functions.invoke("cloudDriveBackup", { action: "list", provider });
        setFiles(res.data?.files || []);
      } catch (e) {
        toast({ title: "Fehler beim Auflisten", description: e?.response?.data?.error || e?.message, variant: "destructive" });
      } finally {
        setLoadingFiles(false);
      }
    }
  };

  const handleRestore = async (file) => {
    if (!confirm(`Backup "${file.name}" aus ${displayName} wiederherstellen? Aktuelle Daten werden überschrieben.`)) return;
    setRestoring(true);
    try {
      const res = await base44.functions.invoke("cloudDriveBackup", {
        action: "download",
        provider,
        file_id: file.id
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
      setRestoring(false);
    }
  };

  const handleDeleteFile = async (file) => {
    if (!confirm(`Backup "${file.name}" endgültig aus ${displayName} löschen?`)) return;
    try {
      const res = await base44.functions.invoke("cloudDriveBackup", {
        action: "delete",
        provider,
        file_id: file.id
      });
      if (res.data?.success) {
        toast({ title: "Backup gelöscht", description: `"${file.name}" wurde entfernt.` });
        setFiles(prev => prev.filter(f => f.id !== file.id));
      } else {
        toast({ title: "Löschen fehlgeschlagen", description: res.data?.error, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Löschen fehlgeschlagen", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    }
  };

  const handleToggleAuto = (enabled) => {
    setAutoBackup(enabled);
    if (enabled) {
      localStorage.setItem("hb9om_auto_cloud_backup", "true");
      localStorage.setItem("hb9om_cloud_provider", provider);
      toast({ title: "Automatisches Backup aktiviert", description: `Bei jedem neuen QSO wird in ${displayName} gesichert` });
    } else {
      localStorage.setItem("hb9om_auto_cloud_backup", "false");
      if (localStorage.getItem("hb9om_cloud_provider") === provider) {
        localStorage.removeItem("hb9om_cloud_provider");
      }
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3" style={{ borderColor: connected ? color + '40' : undefined }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
            <CloudUpload className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            <p className="text-[10px] text-gray-400">{description}</p>
          </div>
        </div>
        {checking ? (
          <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
        ) : connected ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verbunden
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <AlertCircle className="w-3.5 h-3.5" /> Nicht verbunden
          </span>
        )}
      </div>

      {!connected && !checking && (
        <button
          onClick={handleConnect}
          className="w-full px-3 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center justify-center gap-1.5"
          style={{ backgroundColor: color }}
        >
          <Link2 className="w-4 h-4" />
          Mit {displayName} verbinden
        </button>
      )}

      {connected && (
        <>
          {lastBackup && (
            <div className="mb-2 p-1.5 bg-green-50 rounded text-[11px] text-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Letztes Cloud-Backup: {new Date(lastBackup).toLocaleString('de-CH')}
            </div>
          )}

          <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-900">Automatisches Backup</label>
              <p className="text-[10px] text-gray-500">Bei jedem neuen QSO sichern</p>
            </div>
            <button
              onClick={() => handleToggleAuto(!autoBackup)}
              className={`relative w-11 h-5 rounded-full transition-colors flex-shrink-0 ${autoBackup ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoBackup ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-2 py-2 text-xs font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-1"
              style={{ backgroundColor: color }}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
              Backup
            </button>
            <button
              onClick={handleListFiles}
              disabled={loadingFiles}
              className="px-2 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center gap-1"
            >
              {loadingFiles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Dateien
            </button>
          </div>

          {showFiles && files.length > 0 && (
            <div className="space-y-1 mb-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-gray-50 rounded">
                  <div className="flex items-center gap-1 min-w-0">
                    <FileJson className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-700 truncate">{f.name}</p>
                      <p className="text-[9px] text-gray-400">
                        {f.modified ? new Date(f.modified).toLocaleDateString('de-CH') : ''}
                        {f.size ? ` · ${formatSize(parseInt(f.size))}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => handleRestore(f)}
                      disabled={restoring}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Wiederherstellen"
                    >
                      {restoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleDeleteFile(f)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                      title="Löschen"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showFiles && files.length === 0 && !loadingFiles && (
            <p className="text-[11px] text-gray-400 text-center py-2">Keine Backups vorhanden</p>
          )}

          <button
            onClick={handleDisconnect}
            className="w-full px-2 py-1.5 text-[11px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1"
          >
            <Unlink className="w-3 h-3" />
            Verbindung trennen
          </button>
        </>
      )}
    </div>
  );
}