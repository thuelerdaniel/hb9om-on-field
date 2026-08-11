import React, { useState, useEffect, useCallback } from "react";
import { RadioTower, Upload, RefreshCw, Loader2, CheckCircle2, AlertCircle, Signal, Globe, Database } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function TotaManager() {
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [worldwideLoading, setWorldwideLoading] = useState(false);
  const [antennasFile, setAntennasFile] = useState(null);
  const [towersFile, setTowersFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.TotaPoint.list("-created_date", 20000);
      const all = data || [];
      const antennas = all.filter((t) => t.type === "antenna");
      const towers = all.filter((t) => t.type === "tower");
      const swiss = all.filter((t) => t.source === "swiss_csv");
      const worldwide = all.filter((t) => t.source === "wwtota.com");
      setStats({
        total: all.length,
        antennas: antennas.length,
        towers: towers.length,
        swiss: swiss.length,
        worldwide: worldwide.length,
      });
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleUploadAndImport = async () => {
    if (!antennasFile && !towersFile) {
      toast({
        title: "Keine Dateien",
        description: "Bitte mindestens eine CSV-Datei auswählen",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    setImportLoading(true);
    setImportResult(null);
    try {
      let antennasUrl = null;
      let towersUrl = null;

      // Upload files to get URLs
      if (antennasFile) {
        const formData = new FormData();
        formData.append("file", antennasFile);
        const uploadRes = await base44.integrations.Core.UploadFile({ file: antennasFile });
        antennasUrl = uploadRes.file_url;
      }
      if (towersFile) {
        const uploadRes = await base44.integrations.Core.UploadFile({ file: towersFile });
        towersUrl = uploadRes.file_url;
      }

      // Call backend function to import
      const res = await base44.functions.invoke("fetchTota", {
        action: "importSwiss",
        antennas_csv_url: antennasUrl,
        towers_csv_url: towersUrl,
      });

      setImportResult(res.data);
      toast({
        title: "Import erfolgreich",
        description: `${res.data?.antennas_imported || 0} Antennen, ${res.data?.towers_imported || 0} Türme importiert`,
        duration: 5000,
      });
      fetchStats();
      setAntennasFile(null);
      setTowersFile(null);
    } catch (e) {
      toast({
        title: "Import fehlgeschlagen",
        description: e.message || "Unbekannter Fehler",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleFetchWorldwide = async () => {
    setWorldwideLoading(true);
    try {
      const res = await base44.functions.invoke("fetchTota", {
        action: "fetchWorldwide",
      });
      toast({
        title: "Worldwide-Daten aktualisiert",
        description: `${res.data?.worldwide_imported || 0} TOTA-Türme von wwtota.com geladen`,
        duration: 5000,
      });
      fetchStats();
    } catch (e) {
      toast({
        title: "Aktualisierung fehlgeschlagen",
        description: e.message || "Unbekannter Fehler",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setWorldwideLoading(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        <RadioTower className="w-4 h-4 text-orange-600" /> TOTA – Towers on the Air
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-semibold">
            <Signal className="w-3 h-3 text-purple-500" /> Antennen (CH)
          </div>
          <p className="text-lg font-bold text-purple-600 mt-0.5">
            {loading ? "…" : (stats?.antennas || 0).toLocaleString("de-CH")}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-semibold">
            <RadioTower className="w-3 h-3 text-orange-500" /> Türme (CH)
          </div>
          <p className="text-lg font-bold text-orange-600 mt-0.5">
            {loading ? "…" : (stats?.towers || 0).toLocaleString("de-CH")}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-semibold">
            <Database className="w-3 h-3 text-gray-400" /> Schweiz (CSV)
          </div>
          <p className="text-lg font-bold text-gray-700 mt-0.5">
            {loading ? "…" : (stats?.swiss || 0).toLocaleString("de-CH")}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase font-semibold">
            <Globe className="w-3 h-3 text-blue-400" /> Worldwide
          </div>
          <p className="text-lg font-bold text-blue-600 mt-0.5">
            {loading ? "…" : (stats?.worldwide || 0).toLocaleString("de-CH")}
          </p>
        </div>
      </div>

      {/* Swiss CSV Upload */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Schweiz: CSV-Dateien hochladen
        </h3>
        <p className="text-[10px] text-gray-400 mb-2">
          Antennen.csv (Spalten: OBJEKTART;X_Koord;Y_Koord) und Turm.csv (Spalten: OBJEKTART;NUTZUNG;NAME;X_KOORD;Y_KOORD) mit LV95-Koordinaten.
        </p>
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 mb-1">
              <Signal className="w-3.5 h-3.5 text-purple-500" /> Antennen.csv
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setAntennasFile(e.target.files[0])}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 file:font-medium file:cursor-pointer hover:file:bg-purple-100"
            />
            {antennasFile && (
              <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {antennasFile.name} ({(antennasFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 flex items-center gap-1.5 mb-1">
              <RadioTower className="w-3.5 h-3.5 text-orange-500" /> Turm.csv
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setTowersFile(e.target.files[0])}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-orange-50 file:text-orange-700 file:font-medium file:cursor-pointer hover:file:bg-orange-100"
            />
            {towersFile && (
              <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {towersFile.name} ({(towersFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
          <button
            onClick={handleUploadAndImport}
            disabled={importLoading || (!antennasFile && !towersFile)}
            className="w-full px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {importLoading ? "Importiere..." : "Hochladen & Importieren"}
          </button>
        </div>
      </div>

      {/* Worldwide Refresh */}
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Worldwide: wwtota.com aktualisieren
        </h3>
        <p className="text-[10px] text-gray-400 mb-2">
          Lädt TOTA-Türme weltweit von wwtota.com (5300+ Türme in 17 Ländern).
          Koordinaten werden aus Maidenhead-Locatoren berechnet.
        </p>
        <button
          onClick={handleFetchWorldwide}
          disabled={worldwideLoading}
          className="w-full px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {worldwideLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {worldwideLoading ? "Lade..." : "Worldwide-Daten aktualisieren"}
        </button>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="mt-3 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs">
          <div className="flex items-center gap-1.5 text-green-700 font-medium mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Import erfolgreich
          </div>
          <div className="text-green-600 space-y-0.5">
            <p>• {importResult.antennas_imported || 0} Antennen importiert</p>
            <p>• {importResult.towers_imported || 0} Türme importiert</p>
            {importResult.errors?.length > 0 && (
              <p className="text-red-600">• Fehler: {importResult.errors.join(", ")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}