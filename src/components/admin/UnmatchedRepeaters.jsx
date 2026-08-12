import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { RadioTower, Loader2, Pencil, Search, MapPin, AlertTriangle, Check, X, Download, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Admin component: lists repeaters with missing or imprecise coordinates.
// - No coordinates (lat/lng null) — admin can manually add lat/lng
// - Coordinates from Maidenhead locator (coords_from_locator=true) — imprecise, admin can refine
// - "Auto-Geocode" button: uses Nominatim API to geocode from location_name + country
//   (marks results as imprecise — city-level accuracy, not exact repeater site)

export default function UnmatchedRepeaters() {
  const [repeaters, setRepeaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(null);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch repeaters with no coordinates or imprecise (from locator)
      // Platform caps filter at 5000 — paginate to get all
      const allReps = [];
      let lastId = null;
      for (let i = 0; i < 10; i++) {
        const query = lastId ? { _id: { $gt: lastId } } : {};
        const batch = await base44.entities.Repeater.filter(query, "_id", 5000);
        if (!batch || batch.length === 0) break;
        allReps.push(...batch);
        lastId = batch[batch.length - 1].id;
        if (batch.length < 5000) break;
      }
      const unmatched = allReps.filter(r => !r.lat || !r.lng || r.coords_from_locator);
      setRepeaters(unmatched);
    } catch (e) {
      setRepeaters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = repeaters.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.callsign || "").toLowerCase().includes(q) ||
           (r.location_name || "").toLowerCase().includes(q) ||
           (r.country || "").toLowerCase().includes(q) ||
           (r.locator || "").toLowerCase().includes(q);
  });

  const handleEdit = (r) => {
    setEditTarget(r);
    setLatInput(r.lat ? String(r.lat) : "");
    setLngInput(r.lng ? String(r.lng) : "");
  };

  const handleSave = async () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) {
      toast({ title: "Ungültige Koordinaten", description: "Breiten- und Längengrad als Zahlen eingeben", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke("manageRepeater", {
        action: "setCoords",
        repeater_id: editTarget.id,
        lat,
        lng,
      });
      toast({ title: "Koordinaten gespeichert", description: `${editTarget.callsign} aktualisiert`, duration: 4000 });
      setEditTarget(null);
      loadData();
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGeocode = async () => {
    setGeocoding(true);
    setGeocodeProgress(null);
    try {
      const res = await base44.functions.invoke("geocodeRepeaters", { maxGeocodes: 25 });
      const data = res.data;
      if (data?.status === "success") {
        setGeocodeProgress(data);
        toast({
          title: "Auto-Geocodierung abgeschlossen",
          description: `${data.geocoded} Orte geocodiert, ${data.updated_repeaters} Relais aktualisiert. ${data.places_remaining} Orte verbleibend — erneut ausführen für mehr.`,
          duration: 6000,
        });
        loadData();
      } else {
        toast({ title: "Fehler", description: data?.error || "Unbekannter Fehler", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Fehler", description: e.message || "Unbekannter Fehler", variant: "destructive" });
    } finally {
      setGeocoding(false);
    }
  };

  const noCoordsCount = repeaters.filter(r => !r.lat || !r.lng).length;
  const impreciseCount = repeaters.filter(r => r.coords_from_locator).length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
        <RadioTower className="w-4 h-4" /> Relais ohne/ungenaue Koordinaten
      </h3>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">
        {repeaters.length} Relais — {noCoordsCount} ohne Koordinaten, {impreciseCount} ungenau (aus Locator/Geocodierung)
      </p>
      <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-3">
        Hier können Sie als Admin manuell Koordinaten ergänzen oder verfeinern. Relais ohne Koordinaten werden auf der Karte nicht angezeigt.
      </p>

      {/* Auto-Geocode button */}
      <div className="flex items-center gap-2 mb-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/50">
        <Zap className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
            Auto-Geocodierung aus Ortsnamen
          </p>
          <p className="text-[10px] text-blue-600 dark:text-blue-400">
            Verwendet OpenStreetMap Nominatim, um Relais aus Ortsnamen zu platzieren (stadtgenau, markiert als "ungenaue Position").
          </p>
          {geocodeProgress && (
            <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
              Letzte Ausführung: {geocodeProgress.geocoded} Orte, {geocodeProgress.updated_repeaters} Relais aktualisiert, {geocodeProgress.places_remaining} verbleibend
            </p>
          )}
        </div>
        <button
          onClick={handleAutoGeocode}
          disabled={geocoding || noCoordsCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {geocoding ? "Geocodiere..." : "Auto-Geocode"}
        </button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Relais suchen (Rufzeichen, Ort, Land, Locator)..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">Keine Relais mit fehlenden Koordinaten gefunden</p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-1.5">
          {filtered.slice(0, 200).map(r => (
            <div key={r.id} className={`p-2.5 rounded-lg border ${r.coords_from_locator ? "border-amber-200 bg-amber-50/30" : "border-red-200 bg-red-50/30"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-gray-700 dark:text-slate-300">{r.callsign}</span>
                    <span className="text-[10px] text-gray-500">{r.frequency?.toFixed(4)} MHz</span>
                    {r.coords_from_locator ? (
                      <span className="text-[9px] text-amber-600 flex items-center gap-0.5" title="Position aus Maidenhead-Locator oder Geocodierung abgeleitet (stadtgenau, nicht exakter Standort)">
                        <AlertTriangle className="w-2.5 h-2.5" /> ungenau
                      </span>
                    ) : (
                      <span className="text-[9px] text-red-600 flex items-center gap-0.5" title="Keine Koordinaten vorhanden — wird nicht auf Karte angezeigt">
                        <MapPin className="w-2.5 h-2.5" /> fehlt
                      </span>
                    )}
                  </div>
                  {r.location_name && <p className="text-xs text-gray-600 dark:text-slate-400 truncate">{r.location_name}</p>}
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-slate-500">
                    {r.country && <span>{r.country}</span>}
                    {r.locator && <span className="font-mono">Loc: {r.locator}</span>}
                    {r.lat != null && r.lng != null && <span className="font-mono">{r.lat.toFixed(4)}, {r.lng.toFixed(4)}</span>}
                  </div>
                </div>
                <button onClick={() => handleEdit(r)}
                  className="p-1.5 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:bg-slate-900 flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length > 200 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center pt-2">{filtered.length - 200} weitere — bitte Suche eingrenzen</p>
          )}
        </div>
      )}

      {/* Edit dialog */}
      {editTarget && (
        <div className="fixed inset-0 z-[10005] bg-black/50 flex items-center justify-center p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-4 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Koordinaten setzen: {editTarget.callsign}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
              {editTarget.location_name} · {editTarget.country} {editTarget.locator ? `· Locator: ${editTarget.locator}` : ""}
            </p>
            <div className="space-y-2 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Breitengrad (Lat)</label>
                <input type="number" step="any" value={latInput} onChange={e => setLatInput(e.target.value)}
                  placeholder="z.B. 47.3769" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400">Längengrad (Lng)</label>
                <input type="number" step="any" value={lngInput} onChange={e => setLngInput(e.target.value)}
                  placeholder="z.B. 8.5417" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Speichern
              </button>
              <button onClick={() => setEditTarget(null)}
                className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}