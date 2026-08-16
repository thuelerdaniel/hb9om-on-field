import React, { useState, useEffect, useCallback } from "react";
import { Anchor, RefreshCw, Radio, Check, X, Loader2, Globe2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function IllwAdminSection() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [lighthouses, setLighthouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCountry, setFilterCountry] = useState("");
  const [sortBy, setSortBy] = useState("country");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

  const loadLighthouses = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.Lighthouse.list("-updated_date", 500);
      setLighthouses(all || []);
    } catch {
      setLighthouses([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLighthouses();
  }, [loadLighthouses]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("syncILLWEntrants", {
        year: yearFilter,
      });
      const data = res?.data || res;
      setSyncResult(data);
      loadLighthouses(); // Reload after sync
    } catch (e) {
      setSyncResult({ error: e.message || "Sync fehlgeschlagen" });
    }
    setSyncing(false);
  };

  const handleToggleActive = async (lighthouse) => {
    try {
      await base44.entities.Lighthouse.update(lighthouse.id, {
        illw_active: !lighthouse.illw_active,
        illw_year_active: !lighthouse.illw_active ? yearFilter : lighthouse.illw_year_active,
      });
      loadLighthouses();
    } catch {}
  };

  // Stats
  const stats = {
    total: lighthouses.length,
    active: lighthouses.filter((l) => l.illw_active).length,
    countries: new Set(lighthouses.filter((l) => l.illw_active).map((l) => l.illw_country || l.country)).size,
  };

  // Filter and sort
  const filtered = lighthouses
    .filter((l) => !filterCountry || (l.illw_country || l.country) === filterCountry)
    .sort((a, b) => {
      if (sortBy === "country")
        return (a.illw_country || a.country || "").localeCompare(b.illw_country || b.country || "");
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "active") return (b.illw_active ? 1 : 0) - (a.illw_active ? 1 : 0);
      return 0;
    });

  // Country list for filter
  const countryList = [...new Set(lighthouses.map((l) => l.illw_country || l.country).filter(Boolean))].sort();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Anchor className="w-5 h-5 text-red-600" />
        <h3 className="font-semibold text-sm text-gray-900">ILLW-Verwaltung</h3>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Gesamt</p>
          <p className="text-lg font-bold text-gray-900">{(stats.total ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-red-500 uppercase">Aktiv {yearFilter}</p>
          <p className="text-lg font-bold text-red-600">{(stats.active ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2.5 text-center">
          <p className="text-[10px] text-blue-500 uppercase">Länder</p>
          <p className="text-lg font-bold text-blue-600">{(stats.countries ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Sync controls */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(parseInt(e.target.value))}
            className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
          >
            {[yearFilter, yearFilter - 1, yearFilter - 2].map((y) => (
              <option key={y} value={y}>
                ILLW {y}
              </option>
            ))}
          </select>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            ILLW {yearFilter} Teilnehmer synchronisieren
          </button>
        </div>

        {syncResult && (
          <div
            className={`rounded-lg p-2.5 text-xs ${
              syncResult.error
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            {syncResult.error ? (
              <p>Fehler: {syncResult.error}</p>
            ) : (
              <div className="space-y-0.5">
                <p className="font-medium">
                  Sync erfolgreich: {syncResult.activeCount} aktiv von {syncResult.totalLighthouses} Leuchttürmen
                </p>
                <p className="text-[11px] opacity-80">
                  Neu: {syncResult.newCount}, Aktualisiert: {syncResult.updatedCount}, Teilnehmer-Liste: {syncResult.entrantsCount}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter + Sort */}
      <div className="flex items-center gap-2">
        <Globe2 className="w-3.5 h-3.5 text-gray-400" />
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white flex-1"
        >
          <option value="">Alle Länder ({countryList.length})</option>
          {countryList.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
        >
          <option value="country">Sort: Land</option>
          <option value="name">Sort: Name</option>
          <option value="active">Sort: Aktiv</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
              Lade Leuchttürme…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              Keine Leuchttürme gefunden. Bitte zuerst synchronisieren.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium text-gray-500">Name</th>
                  <th className="text-left px-2 py-1.5 font-medium text-gray-500">ILLW-No</th>
                  <th className="text-left px-2 py-1.5 font-medium text-gray-500">Land</th>
                  <th className="text-left px-2 py-1.5 font-medium text-gray-500">Callsign</th>
                  <th className="text-center px-2 py-1.5 font-medium text-gray-500">Aktiv</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.slice(0, 200).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-gray-900 max-w-[120px] truncate" title={l.name}>
                      {l.name}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-gray-600">{l.illw_number || "—"}</td>
                    <td className="px-2 py-1.5 text-gray-600">{l.illw_country || l.country || "—"}</td>
                    <td className="px-2 py-1.5 text-gray-600">{l.illw_callsign || "—"}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => handleToggleActive(l)}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                          l.illw_active
                            ? "bg-red-100 text-red-600 hover:bg-red-200"
                            : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                        title={l.illw_active ? "Aktiv — klicken zum Deaktivieren" : "Inaktiv — klicken zum Aktivieren"}
                      >
                        {l.illw_active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {filtered.length > 200 && (
          <div className="p-2 text-center text-[10px] text-gray-400 bg-gray-50">
            Zeige 200 von {filtered.length} — Filter für mehr
          </div>
        )}
      </div>
    </div>
  );
}