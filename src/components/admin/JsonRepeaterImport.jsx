import React, { useState, useRef, useCallback } from "react";
import { Upload, FileJson, Loader2, Play, CheckCircle2, XCircle, AlertCircle, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import ImportHistoryTable from "@/components/admin/ImportHistoryTable";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function JsonRepeaterImport() {
  const [file, setFile] = useState(null);
  const [jsonContent, setJsonContent] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [sourceTag, setSourceTag] = useState("RepeaterBook Export");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [parseError, setParseError] = useState(null);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFile = useCallback(async (f) => {
    if (!f) return;
    if (!f.name.endsWith(".json")) {
      toast({ title: "Nur .json-Dateien", variant: "destructive" });
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: "Datei zu gross", description: "Max 10 MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setResult(null);
    setParseError(null);
    try {
      const text = await f.text();
      setJsonContent(text);
      const parsed = JSON.parse(text);
      if (!parsed.records || !Array.isArray(parsed.records)) {
        setParseError("Invalid JSON: missing 'records' array");
        setParsedData(null);
        return;
      }
      setParsedData(parsed);
    } catch (e) {
      setParseError(`JSON Parse Error: ${e.message}`);
      setParsedData(null);
    }
  }, [toast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!jsonContent) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("importRepeaterJson", {
        json_content: jsonContent,
        source_tag: sourceTag,
        filename: file?.name || "unknown.json",
      });
      setResult(res.data);
      if (res.data?.status === "failed") {
        toast({ title: "Import fehlgeschlagen", description: res.data.error, variant: "destructive" });
      } else if (res.data?.status === "partial") {
        toast({ title: "Import teilweise", description: `${res.data.imported_new} neu, ${res.data.updated} aktualisiert, ${res.data.errors} Fehler`, duration: 5000 });
      } else {
        toast({ title: "Import erfolgreich", description: `${res.data.imported_new} neu, ${res.data.updated} aktualisiert`, duration: 5000 });
      }
      // Clear file on success or partial (not on failed)
      if (res.data?.status !== "failed") {
        setFile(null);
        setJsonContent(null);
        setParsedData(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setImporting(false);
  };

  const handleClearFile = () => {
    setFile(null);
    setJsonContent(null);
    setParsedData(null);
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const previewRecords = parsedData?.records?.slice(0, 5) || [];

  return (
    <div className="space-y-3">
      {/* Description */}
      <p className="text-xs text-gray-500 dark:text-slate-400">
        JSON-Dateien mit Repeater-Daten hochladen. Neue Relais werden hinzugefuegt, bestehende werden ergaenzt.
        Importierte Dateien werden automatisch geloescht.
      </p>

      {/* Upload Zone */}
      {!file && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-slate-600 hover:border-gray-400"
          }`}
        >
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-slate-400 font-medium">JSON-Datei hierher ziehen</p>
          <p className="text-xs text-gray-400 mt-1">oder klicken zum Auswaehlen (.json, max 10 MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* File Info + Preview */}
      {file && (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-900 rounded-lg p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <FileJson className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">{file.name}</span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
            </div>
            <button onClick={handleClearFile} className="p-1 text-gray-400 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {parseError && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 text-xs text-red-700 flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {parseError}
            </div>
          )}

          {/* Source Tag Input */}
          <div>
            <label className="text-[10px] text-gray-400 dark:text-slate-500 block mb-1">Quellen-Tag (optional)</label>
            <input
              type="text"
              value={sourceTag}
              onChange={(e) => setSourceTag(e.target.value)}
              placeholder="RepeaterBook Export"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
            />
          </div>

          {/* Preview */}
          {parsedData && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-gray-600 dark:text-slate-400">
                  Vorschau: {Math.min(5, previewRecords.length)} von {parsedData.records.length} Records
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {previewRecords.map((r, i) => (
                  <div key={i} className="px-2.5 py-1.5 text-[10px] grid grid-cols-4 gap-1">
                    <span className="font-mono font-medium text-gray-700 dark:text-slate-300 truncate">{r.callsign || "UNKNOWN"}</span>
                    <span className="text-gray-500">{parseFloat(r.freq_mhz || 0).toFixed(3)} MHz</span>
                    <span className="text-gray-500 truncate">{r.city || r.state || "-"}</span>
                    <span className="text-gray-500">{r.country || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Button */}
          {parsedData && !parseError && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {importing ? "Importiert..." : `Import starten (${parsedData.records.length} Records)`}
            </button>
          )}
        </div>
      )}

      {/* Result Report */}
      {result && (
        <div className={`rounded-xl p-3 border ${
          result.status === "success" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50" :
          result.status === "partial" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50" :
          "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {result.status === "success" ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
             result.status === "partial" ? <AlertCircle className="w-4 h-4 text-amber-600" /> :
             <XCircle className="w-4 h-4 text-red-600" />}
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">Import-Ergebnis</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-gray-500">Gesamt:</span> <span className="font-bold">{result.total}</span></div>
            <div><span className="text-gray-500">Neu:</span> <span className="font-bold text-green-600">{result.imported_new}</span></div>
            <div><span className="text-gray-500">Aktual.:</span> <span className="font-bold text-blue-600">{result.updated}</span></div>
            <div><span className="text-gray-500">Duplikate:</span> <span className="font-bold">{result.skipped_duplicates}</span></div>
            <div><span className="text-gray-500">Mit Koord.:</span> <span className="font-bold">{result.with_coords}</span></div>
            <div><span className="text-gray-500">Ohne Koord.:</span> <span className="font-bold">{result.without_coords}</span></div>
          </div>
          {result.by_country && Object.keys(result.by_country).length > 0 && (
            <div className="mt-2 text-[10px] text-gray-500">
              <span>Pro Land: </span>
              {Object.entries(result.by_country).map(([cc, n]) => `${cc}: ${n}`).join(", ")}
            </div>
          )}
          <div className="mt-1 text-[10px] text-gray-400">Dauer: {((result.duration_ms || 0) / 1000).toFixed(1)}s</div>
          {result.error_details && result.error_details.length > 0 && (
            <div className="mt-2 text-[10px] text-red-600 bg-red-50 dark:bg-red-900/20 rounded p-2 max-h-24 overflow-y-auto">
              {result.error_details.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
          {result.status !== "failed" && (
            <div className="mt-2 text-[10px] text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Datei automatisch geloescht
            </div>
          )}
        </div>
      )}

      {/* Import History */}
      <ImportHistoryTable />
    </div>
  );
}