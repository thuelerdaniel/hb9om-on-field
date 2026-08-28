import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Upload, Download, RefreshCw, CloudOff, CheckCircle2 } from "lucide-react";
import { uploadToWavelog, importFromWavelog, getOfflineQueueLength } from "@/lib/wavelogSync";

// Wavelog Sync Buttons für das Logbuch — v0.9022
// Wird nur angezeigt wenn Wavelog in den Settings aktiviert ist.
export default function WavelogSyncButtons({ onSynced }) {
  const [settings, setSettings] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [queueLength, setQueueLength] = useState(getOfflineQueueLength());

  useEffect(() => {
    // Load user's Wavelog settings
    base44.entities.UserHuntingSettings.list()
      .then(data => {
        if (data && data.length > 0) {
          const s = data[0];
          // Auto-Fallback: Wenn Wavelog aktiviert aber keine station_id → "1" setzen
          if (s.wavelog_enabled && s.logging_backend === "wavelog" && s.wavelog_api_key && (s.wavelog_lan_url || s.wavelog_wan_url) && !s.wavelog_station_id) {
            console.log('[Wavelog] Auto-setting station_id to "1"');
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

  // Update queue length when component receives focus
  useEffect(() => {
    const update = () => setQueueLength(getOfflineQueueLength());
    window.addEventListener("online", update);
    return () => window.removeEventListener("online", update);
  }, []);

  if (!settings?.wavelog_enabled || settings?.logging_backend !== "wavelog") return null;

  const config = {
    wavelog_enabled: settings.wavelog_enabled,
    wavelog_lan_url: settings.wavelog_lan_url,
    wavelog_wan_url: settings.wavelog_wan_url,
    wavelog_api_key: settings.wavelog_api_key,
    wavelog_station_id: settings.wavelog_station_id,
    wavelog_last_fetch_id: settings.wavelog_last_fetch_id || 0,
  };

  const wavelogConfigured = !!(config.wavelog_api_key && (config.wavelog_lan_url || config.wavelog_wan_url) && config.wavelog_station_id);

  const handleUpload = async () => {
    setUploading(true);
    setResult(null);
    try {
      const r = await uploadToWavelog(config);
      setResult(r);
      if (r.success && onSynced) onSynced();
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setUploading(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      const r = await importFromWavelog(config);
      setResult(r);
      // lastfetchedid speichern
      if (r.lastfetchedid != null) {
        await base44.entities.UserHuntingSettings.update(settings.id, {
          wavelog_last_fetch_id: r.lastfetchedid,
        });
      }
      if (r.success && onSynced) onSynced();
    } catch (e) {
      setResult({ success: false, message: e.message });
    } finally {
      setImporting(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleUpload}
        disabled={!wavelogConfigured || uploading}
        className="px-3 py-1.5 text-sm font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-40 flex items-center gap-1.5"
        title="Alle nicht gesendeten QSOs an Wavelog senden"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        Wavelog Upload
      </button>
      <button
        onClick={handleImport}
        disabled={!wavelogConfigured || importing}
        className="px-3 py-1.5 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-40 flex items-center gap-1.5"
        title="Neue QSOs von Wavelog importieren (Delta-Sync)"
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Wavelog Import
      </button>
      {/* Auto-Sync Status */}
      {settings.wavelog_auto_sync && (
        <span className="flex items-center gap-1 text-[10px] text-green-600" title="Permanent Sync aktiv">
          <RefreshCw className="w-3 h-3" /> Auto-Sync
        </span>
      )}
      {queueLength > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-amber-600" title={`${queueLength} QSO(s) warten auf Sync`}>
          <CloudOff className="w-3 h-3" /> {queueLength} warten
        </span>
      )}
      {result && (
        <span className={`text-[10px] font-medium ${result.success ? "text-green-600" : "text-red-600"}`}>
          {result.message}
        </span>
      )}
    </div>
  );
}