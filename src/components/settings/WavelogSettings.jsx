import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, XCircle, Server, Wifi, RefreshCw, Upload, Download, CloudOff, Radio } from "lucide-react";
import { testWavelogConnection, getWavelogStations, uploadToWavelog, importFromWavelog, getOfflineQueueLength } from "@/lib/wavelogSync";
import { useHuntingSettings } from "@/hooks/useHuntingSettings";

export default function WavelogSettings() {
  const { settings, loading, saveSettings } = useHuntingSettings();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [stations, setStations] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [queueLength, setQueueLength] = useState(getOfflineQueueLength());

  const wavelogEnabled = settings?.wavelog_enabled || false;
  const wavelogAutoSync = settings?.wavelog_auto_sync || false;
  const loggingBackend = settings?.logging_backend || "qrz";
  const lanUrl = settings?.wavelog_lan_url || "";
  const wanUrl = settings?.wavelog_wan_url || "";
  const apiKey = settings?.wavelog_api_key || "";
  const stationId = settings?.wavelog_station_id || "";
  const wavelogConfigured = !!(apiKey && (lanUrl || wanUrl));

  const handleTest = async () => {
    if (!wavelogConfigured) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testWavelogConnection({
        wavelog_lan_url: lanUrl,
        wavelog_wan_url: wanUrl,
        wavelog_api_key: apiKey,
      });
      setTestResult(result);
      if (result.connected) {
        // Stationen abrufen
        const stRes = await getWavelogStations({
          wavelog_lan_url: lanUrl,
          wavelog_wan_url: wanUrl,
          wavelog_api_key: apiKey,
        });
        if (stRes.stations) setStations(stRes.stations);
      }
    } catch (e) {
      setTestResult({ connected: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await uploadToWavelog({
        wavelog_enabled: true,
        wavelog_lan_url: lanUrl,
        wavelog_wan_url: wanUrl,
        wavelog_api_key: apiKey,
        wavelog_station_id: stationId,
      });
      setUploadResult(result);
    } catch (e) {
      setUploadResult({ success: false, message: e.message });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadResult(null), 5000);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importFromWavelog({
        wavelog_enabled: true,
        wavelog_lan_url: lanUrl,
        wavelog_wan_url: wanUrl,
        wavelog_api_key: apiKey,
        wavelog_station_id: stationId,
        wavelog_last_fetch_id: settings?.wavelog_last_fetch_id || 0,
      });
      setImportResult(result);
      // lastfetchedid speichern
      if (result.lastfetchedid != null) {
        saveSettings({ wavelog_last_fetch_id: result.lastfetchedid });
      }
    } catch (e) {
      setImportResult({ success: false, message: e.message });
    } finally {
      setImporting(false);
      setTimeout(() => setImportResult(null), 5000);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
        <div>
          <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Server className="w-4 h-4" /> Wavelog-Integration
          </label>
          <p className="text-xs text-gray-500 mt-0.5">QSOs mit eigenem Wavelog-Server synchronisieren</p>
        </div>
        <button
          onClick={() => saveSettings({ wavelog_enabled: !wavelogEnabled })}
          className={`relative w-12 h-6 rounded-full transition-colors ${wavelogEnabled ? "bg-green-600" : "bg-gray-300"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${wavelogEnabled ? "translate-x-6" : ""}`} />
        </button>
      </div>

      {wavelogEnabled && (
        <>
          {/* LAN / WAN URLs */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Interne Adresse (LAN)</label>
              <input
                type="text"
                value={lanUrl}
                onChange={e => saveSettings({ wavelog_lan_url: e.target.value })}
                placeholder="http://192.168.178.146"
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Externe Adresse (WAN)</label>
              <input
                type="text"
                value={wanUrl}
                onChange={e => saveSettings({ wavelog_wan_url: e.target.value })}
                placeholder="http://hb3ynf.ddns.net:8080"
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 font-mono"
              />
            </div>
            <p className="text-[10px] text-gray-400">LAN wird bevorzugt (3s Timeout), WAN als Fallback verwendet.</p>
          </div>

          {/* API Key */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">API Key (Read+Write)</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => saveSettings({ wavelog_api_key: e.target.value })}
              placeholder="Wavelog API Key"
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300 font-mono"
            />
          </div>

          {/* Test Button */}
          <button
            onClick={handleTest}
            disabled={!wavelogConfigured || testing}
            className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            Verbindung testen
          </button>

          {testResult && (
            <div className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${testResult.connected ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.connected ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <div className="flex-1">
                <span>{testResult.connected ? `Verbunden — Version ${testResult.version || "?"}` : testResult.error || "Nicht erreichbar"}</span>
                {testResult.baseUrl && <span className="block text-[10px] opacity-60 mt-0.5">URL: {testResult.baseUrl}</span>}
              </div>
            </div>
          )}

          {/* Station Dropdown */}
          {stations.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Station Profile</label>
              <select
                value={stationId}
                onChange={e => saveSettings({ wavelog_station_id: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-300"
              >
                <option value="">— Station wählen —</option>
                {stations.map(s => (
                  <option key={s.station_id} value={s.station_id}>
                    {s.station_callsign || s.station_profile_name || `Station ${s.station_id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Logging Backend Toggle */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-500" /> QSO Logging Backend
            </label>
            <p className="text-xs text-gray-500 mt-0.5">Wohin sollen QSOs gesendet werden?</p>
            <div className="mt-2 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="logging_backend"
                  value="qrz"
                  checked={loggingBackend === "qrz"}
                  onChange={() => saveSettings({ logging_backend: "qrz" })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">QRZ.com (persönlich oder Club)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="logging_backend"
                  value="wavelog"
                  checked={loggingBackend === "wavelog"}
                  onChange={() => saveSettings({ logging_backend: "wavelog" })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">Wavelog (eigener Server)</span>
              </label>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
              Beides gleichzeitig nicht möglich. Ausnahme: Club-QRZ kann immer verwendet werden, wenn das Logbuch auf Club-Log gefiltert ist.
            </p>
          </div>

          {/* Auto-Sync Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
            <div>
              <label className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4" /> Permanent Sync
              </label>
              <p className="text-xs text-gray-500 mt-0.5">QSOs sofort an Wavelog senden</p>
            </div>
            <button
              onClick={() => saveSettings({ wavelog_auto_sync: !wavelogAutoSync })}
              className={`relative w-12 h-6 rounded-full transition-colors ${wavelogAutoSync ? "bg-green-600" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${wavelogAutoSync ? "translate-x-6" : ""}`} />
            </button>
          </div>
          {wavelogAutoSync && (
            <p className="text-[10px] text-gray-400 leading-relaxed -mt-2">
              Wenn aktiv: QSOs werden sofort an Wavelog gesendet. Offline: wird automatisch nachgeholt beim nächsten Online. Beim Öffnen des Logbuches werden neue Wavelog-QSOs importiert.
            </p>
          )}

          {/* Manual Upload / Import */}
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={!wavelogConfigured || !stationId || uploading}
              className="flex-1 px-3 py-2 text-sm font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              An Wavelog senden
            </button>
            <button
              onClick={handleImport}
              disabled={!wavelogConfigured || !stationId || importing}
              className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Von Wavelog importieren
            </button>
          </div>

          {uploadResult && (
            <div className={`text-xs font-medium px-2 py-1 rounded ${uploadResult.success ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}>
              {uploadResult.message}
            </div>
          )}
          {importResult && (
            <div className={`text-xs font-medium px-2 py-1 rounded ${importResult.success ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}>
              {importResult.message}
            </div>
          )}

          {/* Offline Queue Status */}
          {queueLength > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <CloudOff className="w-3.5 h-3.5" />
              {queueLength} QSO(s) warten auf Sync
            </div>
          )}
        </>
      )}
    </div>
  );
}