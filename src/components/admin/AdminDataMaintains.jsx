import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trash2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminDataMaintenance() {
  const { toast } = useToast();
  const [olderThanDays, setOlderThanDays] = useState(30);
  const [cleaning, setCleaning] = useState(null);
  const [result, setResult] = useState(null);

  const handleCleanup = async (type) => {
    const label = type === "changeRequests" ? "Änderungsanträge" : "Funktionsvorschläge";
    if (!confirm(`Alle erledigten und zurückgezogenen ${label} älter als ${olderThanDays} Tage endgültig löschen?`)) return;
    setCleaning(type);
    setResult(null);
    try {
      const fn = type === "changeRequests" ? "manageChangeRequests" : "manageFeatureRequests";
      const res = await base44.functions.invoke(fn, { action: "cleanup", olderThanDays: parseInt(olderThanDays) });
      setResult({ type, ...res.data });
      toast({ title: "Aufgeräumt", description: res.data?.message || `${label} bereinigt` });
    } catch (e) {
      toast({ title: "Fehler", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setCleaning(null);
    }
  };

  return (
    <section className="bg-white rounded-xl border-2 border-red-100 p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4 text-amber-600" /> Datenpflege
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Erledigte und zurückgezogene Anträge &amp; Vorschläge älter als X Tage bereinigen.
        Ausstehende Anträge werden nicht gelöscht.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-gray-500 whitespace-nowrap">Älter als</label>
        <select
          value={olderThanDays}
          onChange={e => setOlderThanDays(e.target.value)}
          className="px-2 py-1 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value={7}>7 Tage</option>
          <option value={14}>14 Tage</option>
          <option value={30}>30 Tage</option>
          <option value={90}>90 Tage</option>
          <option value={180}>180 Tage</option>
          <option value={365}>1 Jahr</option>
        </select>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => handleCleanup("changeRequests")}
          disabled={cleaning !== null}
          className="w-full px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {cleaning === "changeRequests" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Änderungsanträge aufräumen
        </button>
        <button
          onClick={() => handleCleanup("featureRequests")}
          disabled={cleaning !== null}
          className="w-full px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {cleaning === "featureRequests" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Funktionsvorschläge aufräumen
        </button>
      </div>

      {result && (
        <div className="mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 bg-green-50 text-green-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{result.message}</span>
        </div>
      )}
    </section>
  );
}