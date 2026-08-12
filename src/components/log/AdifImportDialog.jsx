import React, { useState, useRef, useEffect } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle2, XCircle, Copy, Loader2, X, ChevronDown, ChevronUp, History, FileUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { parseAndValidate, dedupKey } from "@/lib/adifParser";
import { createEntry, loadLocal } from "@/lib/localLogStore";
import { useToast } from "@/components/ui/use-toast";

const REF_TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "WWFF", wwbota: "WWBOTA",
  castle: "Burg", iota: "IOTA", lighthouse: "Leuchtt.", repeater: "Relais",
  swiss_protected: "Inventar", generell: "Generell", custom: "Eigen",
};

function RecordRow({ entry, showIssues }) {
  const r = entry.record;
  const [expanded, setExpanded] = useState(false);
  const hasIssues = entry.issues && entry.issues.length > 0;
  const hasMissing = entry.missingFields && entry.missingFields.length > 0;

  return (
    <div className={`border rounded-lg p-2.5 text-xs ${
      !entry.isValid ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30" :
      entry.isDuplicate ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" :
      "border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-bold text-gray-900 dark:text-slate-100">
              #{entry.index} {r.callsign}{r.callsign_suffix}
            </span>
            <span className="text-gray-500 dark:text-slate-400">{r.qso_date} {r.time_start && `${r.time_start}`}</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">{r.band} {r.mode}</span>
            {r.frequency != null && <span className="text-gray-500 dark:text-slate-400">{r.frequency} MHz</span>}
          </div>
          {r.my_reference && (
            <div className="mt-0.5">
              <span className="px-1 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 rounded text-[10px]">
                {REF_TYPE_LABELS[r.my_reference_type] || r.my_reference_type}
              </span>{" "}
              <span className="font-mono text-gray-600 dark:text-slate-300">{r.my_reference}</span>
            </div>
          )}
          {hasIssues && showIssues && (
            <div className="mt-1 text-amber-600 dark:text-amber-400 text-[11px]">
              {entry.issues.map((iss, i) => <div key={i}>⚠ {iss}</div>)}
            </div>
          )}
          {hasMissing && (
            <div className="mt-1 text-red-600 dark:text-red-400 text-[11px]">
              Fehlt: {entry.missingFields.join(", ")}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {!entry.isValid && <XCircle className="w-4 h-4 text-red-500" />}
          {entry.isValid && entry.isDuplicate && <Copy className="w-4 h-4 text-amber-500" />}
          {entry.isValid && !entry.isDuplicate && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>
      </div>
      {(hasIssues || r.operator_name || r.operator_country) && (
        <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 mt-1 flex items-center gap-0.5">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Details
        </button>
      )}
      {expanded && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-slate-700 text-[11px] text-gray-500 dark:text-slate-400 space-y-0.5">
          {r.operator_name && <div>Name: {r.operator_name}</div>}
          {r.operator_country && <div>Land: {r.operator_country}</div>}
          {r.operator_grid && <div>Grid: {r.operator_grid}</div>}
          {r.rst_sent && <div>RST: {r.rst_sent}/{r.rst_received}</div>}
          {r.notes && <div className="italic truncate">Notiz: {r.notes}</div>}
          {r.is_clubstation && <div>Club: {r.club_callsign} · Op: {r.club_operator_callsign}</div>}
        </div>
      )}
    </div>
  );
}

export default function AdifImportDialog({ onClose, onImported }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState("upload"); // upload | preview | importing | result
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: [] });
  const [importLog, setImportLog] = useState(null);
  const [pastImports, setPastImports] = useState([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("valid"); // valid | duplicates | invalid

  useEffect(() => {
    loadPastImports();
  }, []);

  const loadPastImports = async () => {
    try {
      const logs = await base44.entities.AdifImportLog.list("-import_date", 10);
      setPastImports(logs || []);
    } catch (e) { }
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    setError("");
    setFileName(file.name);

    // Validate file extension
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["adi", "adif", "txt"].includes(ext)) {
      setError("Bitte eine .adi oder .adif Datei wählen");
      return;
    }

    try {
      const text = await file.text();
      const existing = loadLocal();
      const result = parseAndValidate(text, existing);
      setParseResult(result);

      if (result.rawCount === 0) {
        setError("Keine ADIF-Datensätze in der Datei gefunden");
        return;
      }

      setStep("preview");
      setActiveTab(result.parsed.length > 0 ? "valid" : (result.duplicates.length > 0 ? "duplicates" : "invalid"));
    } catch (e) {
      setError("Fehler beim Lesen der Datei: " + (e.message || e));
    }
  };

  const handleImport = async () => {
    const toImport = includeDuplicates
      ? [...parseResult.parsed, ...parseResult.duplicates]
      : parseResult.parsed;

    if (toImport.length === 0) {
      setError("Keine zu importierenden Datensätze");
      return;
    }

    setStep("importing");
    setImportProgress({ done: 0, total: toImport.length, errors: [] });

    const results = [];
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < toImport.length; i++) {
      const entry = toImport[i];
      try {
        createEntry(entry.record);
        imported++;
        results.push({ index: entry.index, callsign: entry.record.callsign, status: "imported" });
      } catch (e) {
        errors++;
        results.push({ index: entry.index, callsign: entry.record.callsign, status: "error", error: e.message || String(e) });
      }
      setImportProgress({ done: i + 1, total: toImport.length, errors: results.filter(r => r.status === "error") });
    }

    // Also log skipped (invalid + duplicates if not included)
    if (!includeDuplicates) {
      parseResult.duplicates.forEach(d => {
        results.push({ index: d.index, callsign: d.record.callsign, status: "skipped_duplicate" });
      });
      skipped += parseResult.duplicates.length;
    }
    parseResult.invalid.forEach(inv => {
      results.push({ index: inv.index, callsign: inv.record?.callsign || "?", status: "skipped_invalid", missing: inv.missingFields });
      skipped++;
    });

    // Save import log to entity
    const status = errors === 0 && imported > 0 ? "success" : (imported > 0 ? "partial" : "failed");
    const summaryText = `Import von ${fileName}: ${imported} importiert, ${skipped} übersprungen (${parseResult.duplicates.length} Dubletten, ${parseResult.invalid.length} ungültig), ${errors} Fehler`;

    let savedLog = null;
    try {
      savedLog = await base44.entities.AdifImportLog.create({
        filename: fileName,
        import_date: new Date().toISOString(),
        total_records: parseResult.summary.total,
        valid_records: parseResult.summary.valid,
        invalid_records: parseResult.summary.invalid,
        duplicate_records: parseResult.summary.duplicates,
        imported_records: imported,
        skipped_records: skipped,
        status,
        results,
        summary: summaryText,
      });
      setImportLog(savedLog);
    } catch (e) {
      // Log save failed, but import itself succeeded — show warning
      setImportLog({ summary: summaryText, _saveError: e.message || String(e) });
    }

    setStep("result");
    if (onImported) onImported();
    await loadPastImports();
  };

  const handleReset = () => {
    setStep("upload");
    setFileName("");
    setParseResult(null);
    setError("");
    setImportLog(null);
    setIncludeDuplicates(false);
    setImportProgress({ done: 0, total: 0, errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const s = parseResult?.summary || { total: 0, valid: 0, invalid: 0, duplicates: 0, importable: 0 };

  return (
    <div className="fixed inset-0 z-[10001] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-gray-50 dark:bg-slate-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 sm:rounded-t-2xl" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <FileUp className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">ADIF Import</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              >
                <Upload className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200">ADIF-Datei auswählen</p>
                <p className="text-xs text-gray-400 mt-1">.adi oder .adif — wird lokal geprüft vor dem Import</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".adi,.adif,.txt"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files[0])}
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Past imports */}
              {pastImports.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 mb-2">
                    <History className="w-3.5 h-3.5" />
                    Letzte Importe
                  </div>
                  <div className="space-y-1.5">
                    {pastImports.map(imp => (
                      <div key={imp.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-700 dark:text-slate-200 truncate">{imp.filename}</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                            imp.status === "success" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" :
                            imp.status === "partial" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
                            "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                          }`}>
                            {imp.imported_records}/{imp.total_records}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(imp.import_date).toLocaleString("de-CH")}
                          {imp.duplicate_records > 0 && ` · ${imp.duplicate_records} Dubletten`}
                          {imp.invalid_records > 0 && ` · ${imp.invalid_records} ungültig`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && parseResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-200 truncate">{fileName}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                    <div className="text-lg font-bold text-gray-700 dark:text-slate-200">{s.total}</div>
                    <div className="text-[10px] text-gray-400">Total</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{s.importable}</div>
                    <div className="text-[10px] text-green-600 dark:text-green-500">Importierbar</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{s.duplicates}</div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-500">Dubletten</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2">
                    <div className="text-lg font-bold text-red-600 dark:text-red-400">{s.invalid}</div>
                    <div className="text-[10px] text-red-600 dark:text-red-500">Ungültig</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("valid")}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === "valid" ? "bg-green-500 text-white" : "text-gray-500 dark:text-slate-400"}`}
                >
                  Gültig ({parseResult.parsed.length})
                </button>
                <button
                  onClick={() => setActiveTab("duplicates")}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === "duplicates" ? "bg-amber-500 text-white" : "text-gray-500 dark:text-slate-400"}`}
                >
                  Dubletten ({parseResult.duplicates.length})
                </button>
                <button
                  onClick={() => setActiveTab("invalid")}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === "invalid" ? "bg-red-500 text-white" : "text-gray-500 dark:text-slate-400"}`}
                >
                  Ungültig ({parseResult.invalid.length})
                </button>
              </div>

              {/* Record list */}
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {activeTab === "valid" && parseResult.parsed.map(e => <RecordRow key={e.index} entry={e} showIssues />)}
                {activeTab === "duplicates" && (
                  <>
                    {parseResult.duplicates.length > 0 && (
                      <label className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5 text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeDuplicates}
                          onChange={e => setIncludeDuplicates(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Dubletten trotzdem importieren
                      </label>
                    )}
                    {parseResult.duplicates.map(e => (
                      <RecordRow key={e.index} entry={e} showIssues />
                    ))}
                    {parseResult.duplicates.length === 0 && (
                      <p className="text-center text-sm text-gray-400 py-8">Keine Dubletten gefunden</p>
                    )}
                  </>
                )}
                {activeTab === "invalid" && (
                  parseResult.invalid.length > 0 ? (
                    parseResult.invalid.map(e => <RecordRow key={e.index} entry={e} showIssues />)
                  ) : (
                    <p className="text-center text-sm text-gray-400 py-8">Keine ungültigen Datensätze</p>
                  )
                )}
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                Importiere... {importProgress.done}/{importProgress.total}
              </p>
              <div className="w-full max-w-xs bg-gray-200 dark:bg-slate-700 rounded-full h-2 mt-3">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
                />
              </div>
              {importProgress.errors.length > 0 && (
                <p className="text-xs text-red-500 mt-3">{importProgress.errors.length} Fehler</p>
              )}
            </div>
          )}

          {/* Step: Result */}
          {step === "result" && importLog && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 text-center ${
                importLog.status === "success" ? "bg-green-50 dark:bg-green-950/30" :
                importLog.status === "partial" ? "bg-amber-50 dark:bg-amber-950/30" :
                "bg-red-50 dark:bg-red-950/30"
              }`}>
                {importLog.status === "success" ? (
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                ) : (
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                )}
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  {importLog.imported_records || 0} Einträge importiert
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{importLog.summary || importLog._saveError}</p>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Datei</span>
                  <span className="font-medium text-gray-700 dark:text-slate-200 truncate ml-2">{fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Gesamt</span>
                  <span className="font-medium text-gray-700 dark:text-slate-200">{s.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Importiert</span>
                  <span className="font-medium text-green-600 dark:text-green-400">{importLog.imported_records || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Dubletten übersprungen</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{includeDuplicates ? 0 : s.duplicates}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Ungültig übersprungen</span>
                  <span className="font-medium text-red-600 dark:text-red-400">{s.invalid}</span>
                </div>
                {importLog._saveError && (
                  <div className="text-amber-600 dark:text-amber-400 text-[11px] pt-1 border-t border-gray-100 dark:border-slate-700">
                    Import-Log konnte nicht gespeichert werden: {importLog._saveError}
                  </div>
                )}
              </div>

              <button
                onClick={handleReset}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600"
              >
                Weitere Datei importieren
              </button>
            </div>
          )}
        </div>

        {/* Footer — only on preview step */}
        {step === "preview" && parseResult && (
          <div className="border-t border-gray-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800 flex gap-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
            <button
              onClick={handleReset}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Abbrechen
            </button>
            <button
              onClick={handleImport}
              disabled={s.importable === 0 && !includeDuplicates}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {includeDuplicates
                ? `${s.importable + s.duplicates} importieren`
                : `${s.importable} importieren`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}