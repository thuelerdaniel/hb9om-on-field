// RouteWaypointSearch — Nominatim Ortssuche + Suchergebnisse + GPX/Google Maps Import.

import React, { useState, useRef, useCallback } from "react";
import { Search, Plus, FileUp, Link2, Loader2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { parseGpxFile } from "@/lib/gpxParser";
import { parseGoogleMapsUrl } from "@/lib/googleMapsUrlParser";

export default function RouteWaypointSearch({ onAddWaypoint, onAddMultipleWaypoints }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gpxError, setGpxError] = useState(null);
  const [gmapsUrl, setGmapsUrl] = useState("");
  const [gmapsError, setGmapsError] = useState(null);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await base44.functions.invoke("searchPlaces", { query: q, limit: 5 });
      const places = res?.data?.places || [];
      setResults(places);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 500);
  };

  const handleAdd = (place) => {
    onAddWaypoint({
      lat: place.lat,
      lon: place.lng,
      name: place.name || place.fullName?.split(",")[0] || `${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`,
      order: 0,
    });
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  const handleGpxImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGpxError(null);
    try {
      const wps = await parseGpxFile(file);
      onAddMultipleWaypoints(wps);
    } catch (err) {
      setGpxError(err.message || "GPX-Import fehlgeschlagen");
      setTimeout(() => setGpxError(null), 5000);
    }
    e.target.value = "";
  };

  const [gmapsLoading, setGmapsLoading] = useState(false);

  const handleGmapsImport = async () => {
    setGmapsError(null);
    if (!gmapsUrl.trim()) return;
    setGmapsLoading(true);
    try {
      // Try frontend parser first (for direct URLs with coordinates)
      const wps = parseGoogleMapsUrl(gmapsUrl.trim());
      if (wps.length > 0) {
        onAddMultipleWaypoints(wps);
        setGmapsUrl("");
        return;
      }
      // Fallback: call resolveGoogleMapsLink backend function (for short links)
      const res = await base44.functions.invoke("resolveGoogleMapsLink", { url: gmapsUrl.trim() });
      const data = res?.data;
      if (data?.success && data.waypoints?.length > 0) {
        onAddMultipleWaypoints(
          data.waypoints.map((wp) => ({
            lat: wp.lat,
            lon: wp.lng,
            name: wp.name || `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`,
            order: 0,
          }))
        );
        setGmapsUrl("");
      } else {
        setGmapsError(data?.error || "Keine Koordinaten gefunden");
        setTimeout(() => setGmapsError(null), 5000);
      }
    } catch (err) {
      setGmapsError("Google Maps Link konnte nicht aufgelöst werden");
      setTimeout(() => setGmapsError(null), 5000);
    } finally {
      setGmapsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Such-Eingabe */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Ort suchen..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none"
          />
          {searching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>

        {/* Suchergebnisse */}
        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-lg z-[500] max-h-60 overflow-y-auto">
            {results.map((place, i) => (
              <button
                key={i}
                onClick={() => handleAdd(place)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0"
              >
                <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{place.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{place.fullName}</p>
                </div>
                <Plus className="w-4 h-4 text-blue-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Import-Bereich */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600">
          <FileUp className="w-3.5 h-3.5" />
          GPX
          <input type="file" accept=".gpx,application/gpx+xml" onChange={handleGpxImport} className="hidden" />
        </label>

        <div className="flex items-center gap-1 flex-1 min-w-[160px]">
          <input
            type="text"
            value={gmapsUrl}
            onChange={(e) => setGmapsUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGmapsImport()}
            placeholder="Google Maps Link"
            className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleGmapsImport}
            className="p-1.5 text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
            title="Google Maps Link importieren"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {gpxError && <p className="text-xs text-red-500">{gpxError}</p>}
      {gmapsError && <p className="text-xs text-red-500">{gmapsError}</p>}
    </div>
  );
}