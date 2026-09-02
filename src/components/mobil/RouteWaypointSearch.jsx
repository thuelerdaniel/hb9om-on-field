// RouteWaypointSearch — Nominatim Ortssuche + Suchergebnisse + GPX/Google Maps Import.

import React, { useState, useRef, useCallback } from "react";
import { Search, Plus, FileUp, Link2, Loader2, MapPin, FileDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { parseGpxFile } from "@/lib/gpxParser";

export default function RouteWaypointSearch({ onAddWaypoint, onAddMultipleWaypoints, onPdfExport, pdfDisabled }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [gpxError, setGpxError] = useState(null);
  const [gmapsUrl, setGmapsUrl] = useState("");
  const [gmapsError, setGmapsError] = useState(null);
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // v0.9025: Google-Import — Dual-Methode: Regex zuerst, Backend als Fallback
  const handleGmapsImport = async () => {
    setGmapsError(null);
    const url = gmapsUrl.trim();
    if (!url) return;

    setGmapsLoading(true);
    try {
      let points = [];

      // METHODE 1: Koordinaten direkt aus URL parsen (Regex)
      const coordPattern = /(-?\d{1,3}\.\d{3,6}),(-?\d{1,3}\.\d{3,6})/g;
      const matches = [...url.matchAll(coordPattern)];

      if (matches.length >= 2) {
        points = matches.map((m, i) => ({
          lat: parseFloat(m[1]),
          lon: parseFloat(m[2]),
          name: `WP ${i + 1}`,
          order: i,
        }));
      }

      // METHODE 2: Falls keine Koordinaten in URL → Backend aufrufen
      if (points.length === 0) {
        console.log('Keine Koordinaten in URL, versuche Backend...');
        try {
          const res = await base44.functions.invoke("resolveGoogleMapsLink", { url });
          const data = res?.data;
          if (data?.success && Array.isArray(data.waypoints) && data.waypoints.length > 0) {
            points = data.waypoints.map((wp, i) => ({
              lat: Number(wp.lat),
              lon: Number(wp.lng),
              name: wp.name || `WP ${i + 1}`,
              order: i,
            }));
          }
        } catch (backendErr) {
          console.error('Backend error:', backendErr);
        }
      }

      if (points.length === 0) {
        setGmapsError("Keine Wegpunkte gefunden. Bitte Google-Maps-Routen-URL mit Koordinaten verwenden (z.B. /dir/47.39,8.05/47.45,8.65/)");
        setTimeout(() => setGmapsError(null), 8000);
        return;
      }

      console.log('Import: ' + points.length + ' Wegpunkte gefunden');
      onAddMultipleWaypoints(points);
      setGmapsUrl("");
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
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600"
        >
          <FileUp className="w-3.5 h-3.5" />
          GPX
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gpx,application/gpx+xml,text/xml,application/xml"
          onChange={handleGpxImport}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className="flex items-center gap-1 flex-1 min-w-[140px]">
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

        {/* v0.9021: PDF Export Button — in gleicher Button-Gruppe wie GPX/Google */}
        <button
          onClick={onPdfExport}
          disabled={pdfDisabled}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title={pdfDisabled ? "Zuerst Route berechnen für PDF-Export" : "Routenplan als PDF exportieren"}
        >
          <FileDown className="w-3.5 h-3.5" />
          PDF
        </button>
      </div>

      {gpxError && <p className="text-xs text-red-500">{gpxError}</p>}
      {gmapsError && <p className="text-xs text-red-500">{gmapsError}</p>}
    </div>
  );
}