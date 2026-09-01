import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Download } from "lucide-react";
import { importFromWavelog, fullImportFromWavelog } from "@/lib/wavelogSync";
import { toast } from "@/components/ui/use-toast";

// Wavelog Sync Buttons — v0.9018
// 2 Buttons: Wavelog Import (Delta) + Wavelog Voll Import
// syncPaused steuert nur den Auto-Sync (cronjob), nicht die manuellen Buttons (point 7)
export default function WavelogSyncButtons({ onSynced, syncPaused }) {
  const [settings, setSettings] = useState(null);
  const [importing, setImporting] = useState(false);
  const [fullImporting, setFullImporting] = useState(false);

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
  // v0.9018 point 7: syncPaused only affects auto-sync cronjob, NOT manual buttons
  const disabled = !wavelogEnabled || !wavelogConfigured;

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
      <button
        onClick={handleImport}
        disabled={disabled || importing || fullImporting}
        className="px-3 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        title={!wavelogEnabled ? "Wavelog nicht aktiviert — in Einstellungen konfigurieren" : !wavelogConfigured ? "Wavelog nicht vollständig konfiguriert" : "Neue QSOs von Wavelog importieren (Delta-Sync)"}
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Wavelog Import
      </button>
      <button
        onClick={handleFullImport}
        disabled={disabled || importing || fullImporting}
        className="px-3 py-2 text-sm font-medium text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        title={!wavelogEnabled ? "Wavelog nicht aktiviert — in Einstellungen konfigurieren" : !wavelogConfigured ? "Wavelog nicht vollständig konfiguriert" : "ALLE QSOs von Wavelog importieren (Voll-Neuimport ab ID 0)"}
      >
        {fullImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Wavelog Voll Import
      </button>
    </>
  );
}