import React, { useState, useEffect, useCallback } from "react";
import { Crosshair, RefreshCw, Download, Loader2, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { generateDxSpotPdf } from "@/lib/dxSpotPdfExport";

// DX Spot Referenz-Manager (Admin) — zeigt DX-Spots gefiltert nach Referenz-Typ.
// Referenz-Typen: SOTA, POTA, WWFF, WWBOTA, WCA, TOTA, IOTA, WLOTA.

const REF_TYPES = [
  { value: 'All', label: 'Alle Referenzen' },
  { value: 'SOTA', label: 'SOTA – Berggipfel' },
  { value: 'POTA', label: 'POTA – Parks' },
  { value: 'WWFF', label: 'WWFF – Flora & Fauna' },
  { value: 'WWBOTA', label: 'WWBOTA – Bunker' },
  { value: 'WCA', label: 'WCA – Burgen & Schlösser' },
  { value: 'TOTA', label: 'TOTA – Türme & Antennen' },
  { value: 'IOTA', label: 'IOTA – Inseln' },
  { value: 'WLOTA', label: 'WLOTA – Leuchttürme' },
];

export default function DxSpotReferenceManager() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refFilter, setRefFilter] = useState('All');
  const [pdfLoading, setPdfLoading] = useState(false);
  const { toast } = useToast();

  const fetchSpots = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await base44.functions.invoke("fetchDxSpots", {});
      const data = res?.data || res;
      if (data?.spots) {
        setSpots(data.spots);
      }
    } catch {
      try {
        const list = await base44.entities.DxSpot.list('-spot_time', 100);
        setSpots(list || []);
      } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSpots(); }, [fetchSpots]);

  const filtered = refFilter === 'All'
    ? spots
    : spots.filter(s => s.activity === refFilter);

  const handlePdfExport = () => {
    if (filtered.length === 0) {
      toast({ title: "Keine Spots", description: "Keine DX-Spots für den gewählten Referenz-Typ vorhanden", variant: "destructive" });
      return;
    }
    setPdfLoading(true);
    try {
      generateDxSpotPdf(filtered, refFilter);
      toast({ title: "PDF erstellt", description: `${filtered.length} DX-Spots als PDF exportiert` });
    } catch (e) {
      toast({ title: "PDF-Fehler", description: e.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
          <Crosshair className="w-4 h-4 text-orange-500" /> DX-Spot Referenzen
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSpots(true)}
            disabled={refreshing}
            className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handlePdfExport}
            disabled={pdfLoading || filtered.length === 0}
            className="px-2.5 py-1.5 text-xs font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
        DX-Spots nach Referenz-Typ filtern (SOTA, POTA, WWFF, etc.). Daten von jo30.de + Spothole API.
      </p>

      {/* Filter Dropdown */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {REF_TYPES.map(ref => (
          <button
            key={ref.value}
            onClick={() => setRefFilter(ref.value)}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              refFilter === ref.value
                ? "bg-orange-600 text-white"
                : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
            }`}
          >
            {ref.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-3 text-center">
        <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
          <div className="text-sm font-bold text-gray-900 dark:text-slate-100">{spots.length}</div>
          <div className="text-[9px] text-gray-400 dark:text-slate-500">Gesamt</div>
        </div>
        <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
          <div className="text-sm font-bold text-orange-600">{filtered.length}</div>
          <div className="text-[9px] text-gray-400 dark:text-slate-500">Gefiltert</div>
        </div>
        <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
          <div className="text-sm font-bold text-green-600">{spots.filter(s => s.activity).length}</div>
          <div className="text-[9px] text-gray-400 dark:text-slate-500">Mit Referenz</div>
        </div>
        <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
          <div className="text-sm font-bold text-blue-600">{new Set(spots.map(s => s.activity).filter(Boolean)).size}</div>
          <div className="text-[9px] text-gray-400 dark:text-slate-500">Typen</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-6 text-center text-xs text-gray-400 dark:text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> DX-Spots werden geladen…
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">
          Keine DX-Spots für "{refFilter}" gefunden.
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto overflow-x-hidden border border-gray-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-slate-900 z-10">
              <tr className="text-[9px] text-gray-400 dark:text-slate-500 uppercase border-b border-gray-200 dark:border-slate-700">
                <th className="px-2 py-1.5 text-left">Call</th>
                <th className="px-2 py-1.5 text-left">Ref</th>
                <th className="px-2 py-1.5 text-left hidden md:table-cell">Ref-Code</th>
                <th className="px-2 py-1.5 text-right">Freq</th>
                <th className="px-2 py-1.5 text-left hidden md:table-cell">Land</th>
                <th className="px-2 py-1.5 text-right">Dist</th>
                <th className="px-2 py-1.5 text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((spot, i) => (
                <tr key={spot.id || i} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-2 py-1.5 font-bold text-gray-900 dark:text-slate-100">{spot.call}</td>
                  <td className="px-2 py-1.5">
                    {spot.activity && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold">
                        {spot.activity}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500 dark:text-slate-400 hidden md:table-cell">{spot.activity_ref || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-gray-500 dark:text-slate-400">
                    {spot.frequency ? (spot.frequency / 1000).toFixed(3) : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500 dark:text-slate-400 hidden md:table-cell">
                    {spot.countryCode && <span className="mr-1">{spot.countryCode}</span>}
                    {spot.country || '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-gray-500 dark:text-slate-400">
                    {spot.distance > 0 ? `${spot.distance} km` : '—'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-gray-400 dark:text-slate-500">
                    {spot.age_seconds != null ? `${spot.age_seconds}s` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}