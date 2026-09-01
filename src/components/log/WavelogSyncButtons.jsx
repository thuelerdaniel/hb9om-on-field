import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Upload, Download, RefreshCw, CloudOff } from "lucide-react";
import { uploadToWavelog, importFromWavelog, fullImportFromWavelog, getOfflineQueueLength } from "@/lib/wavelogSync";
import { toast } from "@/components/ui/use-toast";

// Wavelog Sync Buttons für das Logbuch — v0.9018
// Rendert 3 Buttons: Club Log Wavelog (Upload), Wavelog Import, Wavelog Voll Import
// syncPaused=true deaktiviert alle Buttons (Löschen-Button bleibt in Log.jsx aktiv)
export default function WavelogSyncButtons({ onSynced, syncPaused }) {
  const [settings, setSettings] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fullImporting, setFullImporting] = useState(false);
  const [queueLength, setQueueLength] = useState(getOfflineQueueLength());

  useEffect(() => {
    base44.entities.UserHuntingSettings.list()
      .then(data => {
        if (data && data.length > 0) {
          const s = data[0];
          if (s.wavelog_enabled && s.logging_backend === "wavelog" && s.wavelog_api_key && (s.wavelog_lan_url || s.wavelog_wan_url) && !s.wavelog_station_id) {
            base44.entities.UserHuntingSettings.update(s.id, { wavelog_station_id: "1" })
              .then(() => setSettings({ ...s, wavelog_station_id: "1" }))
              .catch(() => setSettings(s));
          } else {
            setSettings(s);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const update = () => setQueueLength(getOfflineQueueLength());
    window.addEventListener("online", update);
    return () => window.removeEventListener("online", update);
  }, []);

  // v0.9018 FIX: Always render the 3 Wavelog buttons — disable if not configured
  const wavelogEnabled = !!(settings?.wavelog_enabled && settings?.logging_backend === "wavelog");
  const config = {
    wavelog_enabled: settings?.wavelog_enabled,
    wavelog_lan_url: settings?.wavelog_lan_url,
    wavelog_wan_url: settings?.wavelog_wan_url,
    wavelog_api_key: settings?.wavelog_api_key,
    wavelog_station_id: settings?.wavelog_station_id,
    wavelog_last_fetch_id: settings?.wavelog_last_fetch_id || 0,
  };

  const wavelogConfigured = !!(config.wavelog_api_key && (config.wavelog_lan_url || config.wavelog_wan_url) && config.wavelog_station_id);
  const disabled = syncPaused || !wavelogEnabled || !wavelogConfigured;

  const handleUpload = async () => {
    if (disabled) return;
    setUploading(true);
    try {
      const r = await uploadToWavelog(config);
      toast({
        title: r.success ? "Club Log Wavelog" : "Fehler",
        description: r.message || (r.success ? "Upload abgeschlossen" : "Upload fehlgeschlagen"),
        variant: r.success ? "default" : "destructive",
        duration: 5000,
      });
      if (r.success && onSynced) onSynced();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive", duration: 5000 });
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (disabled) return;
    setImporting(true);
    try {
      const r = await importFromWavelog(config);
      toast({
        title: r.success ? "Wavelog Import" : "Fehler",
        description: r.message || `${r.imported || 0} Einträge importiert`,
        variant: r.success ? "default" : "destructive",
        duration: 5000,
      });
      if (r.lastfetchedid != null) {
        await base44.entities.UserHuntingSettings.update(settings.id, { wavelog_last_fetch_id: r.lastfetchedid });
      }
      if (r.success && onSynced) onSynced();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive", duration: 5000 });
    } finally {
      setImporting(false);
    }
  };

  const handleFullImport = async () => {
    if (disabled) return;
    if (!confirm('Voll-Import startet ab ID 0 und lädt ALLE QSOs von Wavelog. Fortfahren?')) return;
    setFullImporting(true);
    try {
      const r = await fullImportFromWavelog(config);
      toast({
        title: r.success ? "Wavelog Voll-Import" : "Fehler",
        description: r.message || `${r.imported || 0} Einträge importiert`,
        variant: r.success ? "default" : "destructive",
        duration: 8000,
      });
      if (r.lastfetchedid != null) {
        await base44.entities.UserHuntingSettings.update(settings.id, { wavelog_last_fetch_id: r.lastfetchedid });
      }
      if (r.success && onSynced) onSynced();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive", duration: 5000 });
    } finally {
      setFullImporting(false);
    }
  };

  return (
    <>
      {/* 3. Club Log Wavelog — Upload zu Wavelog */}
      <button
        onClick={handleUpload}
        disabled={disabled || uploading}
        className="px-3 py-2 text-sm font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        title={syncPaused ? "Sync ist gestoppt" : !wavelogEnabled ? "Wavelog nicht aktiviert — in Einstellungen konfigurieren" : !wavelogConfigured ? "Wavelog nicht vollständig konfiguriert" : "Alle nicht gesendeten QSOs an Wavelog senden"}
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Club Log Wavelog
      </button>
      {/* 4. Wavelog Import — inkrementell */}
      <button
        onClick={handleImport}
        disabled={disabled || importing || fullImporting}
        className="px-3 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        title={syncPaused ? "Sync ist gestoppt" : !wavelogEnabled ? "Wavelog nicht aktiviert — in Einstellungen konfigurieren" : !wavelogConfigured ? "Wavelog nicht vollständig konfiguriert" : "Neue QSOs von Wavelog importieren (Delta-Sync)"}
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Wavelog Import
      </button>
      {/* 5. Wavelog Voll Import — alle QSOs neu importieren */}
      <button
        onClick={handleFullImport}
        disabled={disabled || importing || fullImporting}
        className="px-3 py-2 text-sm font-medium text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        title={syncPaused ? "Sync ist gestoppt" : !wavelogEnabled ? "Wavelog nicht aktiviert — in Einstellungen konfigurieren" : !wavelogConfigured ? "Wavelog nicht vollständig konfiguriert" : "ALLE QSOs von Wavelog importieren (Voll-Neuimport ab ID 0)"}
      >
        {fullImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Wavelog Voll Import
      </button>
      {wavelogEnabled && settings.wavelog_auto_sync && !syncPaused && (
        <span className="flex items-center gap-1 text-[10px] text-green-600" title="Permanent Sync aktiv">
          <RefreshCw className="w-3 h-3" /> Auto-Sync
        </span>
      )}
      {queueLength > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-amber-600" title={`${queueLength} QSO(s) warten auf Sync`}>
          <CloudOff className="w-3 h-3" /> {queueLength} warten
        </span>
      )}
    </>
  );
}