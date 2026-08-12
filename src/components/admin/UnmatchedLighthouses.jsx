import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Anchor, Loader2, Pencil, CheckCircle2, Search, MapPin, Zap } from "lucide-react";
import ReferenceEditDialog from "@/components/admin/ReferenceEditDialog";
import { useToast } from "@/components/ui/use-toast";

export default function UnmatchedLighthouses() {
  const [lighthouses, setLighthouses] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [refData, overrideData] = await Promise.all([
        base44.entities.ReferenceData.filter({ type: "lighthouse" }),
        base44.entities.ReferenceOverride.filter({ reference_type: "lighthouse" })
      ]);
      const allLh = refData?.[0]?.references || [];
      const unmatched = allLh.filter(l => !l.lat || !l.lng);
      setLighthouses(unmatched);
      setOverrides(overrideData || []);
    } catch (e) {
      setLighthouses([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleGeocode = async () => {
    setGeocoding(true);
    try {
      const res = await base44.functions.invoke("geocodeLighthouses", { max: 50 });
      const data = res.data;
      if (data.success) {
        toast({
          title: "Geocodierung abgeschlossen",
          description: `${data.geocoded} von ${data.attempted} Leuchttürmen geocodiert. ${data.withCoords}/${data.total} haben nun Koordinaten.`,
          duration: 6000,
        });
        loadData();
      } else {
        toast({ title: "Fehler", description: data.error || "Unbekannt", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
    setGeocoding(false);
  };

  const overrideMap = new Map(overrides.map(o => [o.original_code, o]));

  const filtered = lighthouses.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.name || "").toLowerCase().includes(q) ||
           (l.code || "").toLowerCase().includes(q) ||
           (l.country || "").toLowerCase().includes(q);
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
          <Anchor className="w-4 h-4" /> Nicht georeferenzierte Leuchttürme
        </h3>
        <button
          onClick={handleGeocode}
          disabled={geocoding || lighthouses.length === 0}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40"
        >
          {geocoding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          {geocoding ? "Geocodiert..." : "Auto-Geocode (Nominatim)"}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
        {lighthouses.length} Leuchtturm{lighthouses.length !== 1 ? "e" : ""} ohne Koordinaten — bearbeiten Sie Name, Ort oder Koordinaten für das nächste Update.
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Leuchtturm suchen..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">
          {lighthouses.length === 0 ? "Alle Leuchttürme haben Koordinaten ✓" : "Keine Treffer"}
        </p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {filtered.slice(0, 100).map(l => {
            const hasOverride = overrideMap.has(l.code);
            return (
              <div key={l.code} className={`p-2.5 rounded-lg border ${hasOverride ? "border-green-200 bg-green-50/30" : "border-gray-200 dark:border-slate-700"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-gray-700">{l.code}</span>
                      {hasOverride && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{l.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {l.country || "Unbekannt"}
                    </p>
                  </div>
                  <button onClick={() => setEditTarget(l)}
                    className="p-1.5 text-gray-600 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:bg-slate-900 flex-shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length > 100 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center pt-2">{filtered.length - 100} weitere — bitte Suche eingrenzen</p>
          )}
        </div>
      )}

      {editTarget && (
        <ReferenceEditDialog
          referenceType="lighthouse"
          originalCode={editTarget.code}
          originalName={editTarget.name}
          originalLocation={editTarget.country}
          onClose={() => setEditTarget(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}