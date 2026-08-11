import React, { useState, useEffect, useCallback } from "react";
import { History, Loader2, CheckCircle2, AlertTriangle, Trash2, RotateCcw, Plus, Database, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function RestorePointManager() {
  const [restorePoints, setRestorePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [label, setLabel] = useState("v0.75");
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const { toast } = useToast();

  const fetchRestorePoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageRestorePoint", { action: "list" });
      setRestorePoints(res.data?.restore_points || []);
    } catch (e) {
      // silent — will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRestorePoints(); }, [fetchRestorePoints]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await base44.functions.invoke("manageRestorePoint", { action: "create", label });
      if (res.data?.error) throw new Error(res.data.error);
      setCreateResult(res.data);
      toast({
        title: "Restore Point erstellt",
        description: `${label}: ${res.data?.total_records || 0} Datensätze gesichert`,
        duration: 5000,
      });
      fetchRestorePoints();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (point) => {
    setRestoring(point.id);
    setRestoreResult(null);
    try {
      const res = await base44.functions.invoke("manageRestorePoint", { action: "restore", restore_point_id: point.id });
      if (res.data?.error) throw new Error(res.data.error);
      setRestoreResult(res.data);
      toast({
        title: "Daten wiederhergestellt",
        description: `Restore Point "${point.label}" wurde eingespielt`,
        duration: 6000,
      });
    } catch (e) {
      toast({ title: "Fehler bei Wiederherstellung", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(null);
      setConfirmRestore(null);
    }
  };

  const handleDelete = async (point) => {
    setDeleting(point.id);
    try {
      await base44.functions.invoke("manageRestorePoint", { action: "delete", restore_point_id: point.id });
      toast({ title: "Restore Point gelöscht", description: point.label });
      fetchRestorePoints();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
        <History className="w-4 h-4 text-indigo-600" /> Restore Points
      </h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
        Erstellt einen Wiederherstellungspunkt der aktuellen Datenbank. Kann von Admins zurückgespielt werden, um zu einer früheren Version zurückzukehren.
      </p>

      {/* Create new restore point */}
      <div className="flex items-center gap-2 mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-600 block mb-1">Bezeichnung</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="z.B. v0.75"
            className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating || !label.trim()}
          className="self-end px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-2"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {creating ? "Erstellt..." : "Restore Point erstellen"}
        </button>
      </div>

      {createResult && (
        <div className="mb-3 p-3 rounded-lg text-sm bg-green-50 text-green-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Restore Point "{createResult.label}" erstellt</p>
            <p className="text-xs mt-1">{createResult.total_records} Datensätze gesichert:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(createResult.counts || {}).map(([entity, count]) => (
                count > 0 && (
                  <span key={entity} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                    {entity}: {count}
                  </span>
                )
              ))}
            </div>
          </div>
        </div>
      )}

      {restoreResult && (
        <div className="mb-3 p-3 rounded-lg text-sm bg-blue-50 text-blue-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Wiederherstellung abgeschlossen</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(restoreResult.restored || {}).map(([entity, count]) => (
                <span key={entity} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {entity}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* List existing restore points */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      ) : restorePoints.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-400 dark:text-slate-500">
          <Database className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          Noch keine Restore Points vorhanden
        </div>
      ) : (
        <div className="space-y-2">
          {restorePoints.map(point => (
            <div key={point.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{point.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono">
                      {point.total_records} Datensätze
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                    {new Date(point.created_date).toLocaleString('de-CH')}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setConfirmRestore(point)}
                    disabled={restoring === point.id}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {restoring === point.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Wiederherstellen
                  </button>
                  <button
                    onClick={() => handleDelete(point)}
                    disabled={deleting === point.id}
                    className="px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 flex items-center"
                  >
                    {deleting === point.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {point.counts && Object.keys(point.counts).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(point.counts).map(([entity, count]) => (
                    count > 0 && (
                      <span key={entity} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {entity}: {count}
                      </span>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation dialog for restore */}
      {confirmRestore && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-br from-amber-500 to-red-600 px-6 py-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-white" />
              <h2 className="text-white font-bold text-lg">Wiederherstellung bestätigen</h2>
              <button onClick={() => setConfirmRestore(null)} className="ml-auto text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Möchten Sie wirklich den Restore Point <strong>"{confirmRestore.label}"</strong> wiederherstellen?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Achtung:</strong> Alle aktuellen Daten werden überschrieben. Diese Aktion kann nicht rückgängig gemacht werden.
                    Bulk-Daten (Repeaters, ReferenceData) können bei Bedarf neu von externen Quellen abgerufen werden.
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRestore(confirmRestore)}
                  disabled={restoring === confirmRestore.id}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {restoring === confirmRestore.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Ja, wiederherstellen
                </button>
                <button
                  onClick={() => setConfirmRestore(null)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}