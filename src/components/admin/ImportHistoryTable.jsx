import React, { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp, Shield, ShieldOff, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function ImportHistoryTable() {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [removingProtection, setRemovingProtection] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  const fetchImports = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ImportLog.list("-import_date", 20);
      setImports(data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchImports(); }, []);

  const handleRemoveProtection = async () => {
    setRemovingProtection(true);
    try {
      const res = await base44.functions.invoke("importRepeaterJson", { action: "remove_protection" });
      toast({
        title: "Sync-Schutz aufgehoben",
        description: `${res.data?.updated || 0} Relais können nun wieder von Syncs aktualisiert werden`,
        duration: 5000,
      });
      setShowConfirm(false);
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setRemovingProtection(false);
  };

  return (
    <div className="space-y-3">
      {/* Sync Protection Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50 p-3">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-blue-800 dark:text-blue-200 font-medium">
              Importierte Relais werden durch Syncs nicht überschrieben (source_id = json-import).
            </p>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={removingProtection}
              className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
            >
              {removingProtection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
              JSON-Schutz aufheben
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">JSON-Schutz aufheben?</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mb-4">
              Alle als json-import markierten Relais werden auf "manual" gesetzt. Danach werden sie wieder von automatischen Syncs aktualisiert und können überschrieben werden.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200"
              >
                Abbrechen
              </button>
              <button
                onClick={handleRemoveProtection}
                disabled={removingProtection}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 flex items-center gap-1.5"
              >
                {removingProtection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                Ja, aufheben
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Import-Historie (letzte 20)</h4>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
          </div>
        ) : imports.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Noch keine Importe</p>
        ) : (
          <div className="space-y-1.5">
            {imports.map(imp => (
              <div key={imp.id} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === imp.id ? null : imp.id)}
                  className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                >
                  <div className="flex items-center gap-2 text-left">
                    {expanded === imp.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {new Date(imp.import_date).toLocaleString("de-CH")}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-[120px]">{imp.filename}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-green-600 font-medium">+{imp.imported_new || 0}</span>
                    <span className="text-blue-600 font-medium">↻{imp.updated || 0}</span>
                    {(imp.errors || 0) > 0 && <span className="text-red-500 font-medium">!{imp.errors}</span>}
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      imp.status === "success" ? "bg-green-100 text-green-700" :
                      imp.status === "partial" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>{imp.status}</span>
                  </div>
                </button>
                {expanded === imp.id && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-slate-700 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div><span className="text-gray-400">Gesamt:</span> <span className="font-medium">{imp.total}</span></div>
                      <div><span className="text-gray-400">Neu:</span> <span className="font-medium text-green-600">{imp.imported_new}</span></div>
                      <div><span className="text-gray-400">Aktual.:</span> <span className="font-medium text-blue-600">{imp.updated}</span></div>
                      <div><span className="text-gray-400">Duplikate:</span> <span className="font-medium">{imp.skipped_duplicates}</span></div>
                      <div><span className="text-gray-400">Mit Koord.:</span> <span className="font-medium">{imp.with_coords}</span></div>
                      <div><span className="text-gray-400">Ohne Koord.:</span> <span className="font-medium">{imp.without_coords}</span></div>
                    </div>
                    {imp.by_country && Object.keys(imp.by_country).length > 0 && (
                      <div className="text-[10px]">
                        <span className="text-gray-400">Länder: </span>
                        {Object.entries(imp.by_country).map(([cc, n]) => `${cc}: ${n}`).join(", ")}
                      </div>
                    )}
                    {imp.by_mode && Object.keys(imp.by_mode).length > 0 && (
                      <div className="text-[10px]">
                        <span className="text-gray-400">Modi: </span>
                        {Object.entries(imp.by_mode).map(([m, n]) => `${m}: ${n}`).join(", ")}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400">Dauer: {((imp.duration_ms || 0) / 1000).toFixed(1)}s · Quelle: {imp.source_tag}</div>
                    {imp.error_details && imp.error_details.length > 0 && (
                      <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2 max-h-24 overflow-y-auto">
                        {imp.error_details.map((e, i) => <div key={i}>{e}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}