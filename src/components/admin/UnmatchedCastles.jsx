import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Castle, Loader2, Pencil, CheckCircle2, Search } from "lucide-react";
import ReferenceEditDialog from "@/components/admin/ReferenceEditDialog";

export default function UnmatchedCastles() {
  const [castles, setCastles] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [refData, overrideData] = await Promise.all([
        base44.entities.ReferenceData.filter({ type: "castle" }),
        base44.entities.ReferenceOverride.filter({ reference_type: "castle" })
      ]);
      const allCastles = refData?.[0]?.references || [];
      const unmatched = allCastles.filter(c => !c.lat || !c.lng);
      setCastles(unmatched);
      setOverrides(overrideData || []);
    } catch (e) {
      setCastles([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const overrideMap = new Map(overrides.map(o => [o.original_code, o]));

  const filtered = castles.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.wcaName || c.name || "").toLowerCase().includes(q) ||
           (c.code || "").toLowerCase().includes(q) ||
           (c.wcaLocation || c.canton || "").toLowerCase().includes(q);
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
        <Castle className="w-4 h-4" /> Nicht georeferenzierte Burgen
      </h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
        {castles.length} Burg{castles.length !== 1 ? "en" : ""} ohne Koordinaten — bearbeiten Sie Name, Ort oder Koordinaten für das nächste Update.
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Burg suchen..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Keine nicht georeferenzierten Burgen gefunden</p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {filtered.slice(0, 100).map(c => {
            const hasOverride = overrideMap.has(c.code);
            return (
              <div key={c.code} className={`p-2.5 rounded-lg border ${hasOverride ? "border-green-200 bg-green-50/30" : "border-gray-200 dark:border-slate-700"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-gray-700">{c.code}</span>
                      {hasOverride && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{c.wcaName || c.name}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{c.wcaLocation || c.canton}</p>
                  </div>
                  <button onClick={() => setEditTarget(c)}
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
          referenceType="castle"
          originalCode={editTarget.code}
          originalName={editTarget.wcaName || editTarget.name}
          originalLocation={editTarget.wcaLocation || editTarget.canton}
          onClose={() => setEditTarget(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}