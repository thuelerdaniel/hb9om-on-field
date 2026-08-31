// MobilLiveMode — Container für Live-Repeater-Modus.
// Zeigt GPS-Position, nächsten Repeater prominent, und alle Repeater in Reichweite auf der Karte.
// Auto-Update: Repeater werden neu geladen wenn GPS-Position signifikant ändert.

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Satellite, AlertCircle } from "lucide-react";
import MobilRepeaterFilter from "./MobilRepeaterFilter";
import LiveRepeaterPanel from "./LiveRepeaterPanel";
import LiveMapView from "./LiveMapView";
import { pointBounds } from "@/lib/routeDistance";
import { haversine, bearing } from "@/lib/geoUtilsFrontend";
import { repeaterMatchesMode } from "@/lib/repeaterModes";

export default function MobilLiveMode({ gpsPosition, accuracy, gpsActive, gpsError }) {
  const [selectedModes, setSelectedModes] = useState(["FM", "DMR", "D-STAR", "Fusion"]);
  const [rangeKm, setRangeKm] = useState(25);
  const [selectedBands, setSelectedBands] = useState([]);
  const [repeaters, setRepeaters] = useState([]);
  const [loadingRepeaters, setLoadingRepeaters] = useState(false);
  const lastLoadPosRef = useRef(null);

  // Repeater laden wenn GPS-Position signifikant ändert (>5km) oder Reichweite ändert
  const loadRepeaters = useCallback(async (lat, lon, range) => {
    const bounds = pointBounds(lat, lon, range);
    setLoadingRepeaters(true);
    try {
      const res = await base44.functions.invoke("getReferencesInBounds", {
        types: ["repeater"],
        bounds,
        max_per_type: 5000,
      });
      const raw = res?.data?.references?.repeater || [];
      setRepeaters(raw);
    } catch {
      setRepeaters([]);
    } finally {
      setLoadingRepeaters(false);
    }
  }, []);

  useEffect(() => {
    if (!gpsPosition) return;
    // Nur neu laden wenn Position >5km vom letzten Laden entfernt ist
    const shouldReload =
      !lastLoadPosRef.current ||
      haversine(gpsPosition.lat, gpsPosition.lon, lastLoadPosRef.current.lat, lastLoadPosRef.current.lon) > 5;

    if (shouldReload) {
      lastLoadPosRef.current = gpsPosition;
      loadRepeaters(gpsPosition.lat, gpsPosition.lon, rangeKm);
    }
  }, [gpsPosition, rangeKm, loadRepeaters]);

  // Repeater filtern + Distanz/Azimuth zur GPS-Position berechnen
  const filteredRepeaters = useMemo(() => {
    if (!gpsPosition) return [];
    return repeaters
      .filter((r) => {
        if (r.lat == null || r.lng == null) return false;
        if (selectedModes.length > 0 && !selectedModes.some((m) => repeaterMatchesMode(r, m))) return false;
        if (selectedBands.length > 0 && r.band && !selectedBands.includes(r.band)) return false;
        return true;
      })
      .map((r) => {
        const dist = haversine(gpsPosition.lat, gpsPosition.lon, r.lat, r.lng);
        const az = bearing(gpsPosition.lat, gpsPosition.lon, r.lat, r.lng);
        return { ...r, _distToPos: dist, _azimuthToPos: az };
      })
      .filter((r) => r._distToPos <= rangeKm)
      .sort((a, b) => (a._distToPos || 0) - (b._distToPos || 0));
  }, [repeaters, selectedModes, selectedBands, rangeKm, gpsPosition]);

  // Empfohlener Repeater = der nächstgelegene
  const recommendedRepeater = filteredRepeaters.length > 0 ? filteredRepeaters[0] : null;
  const recommendedDistance = recommendedRepeater?._distToPos;
  const recommendedAzimuth = recommendedRepeater?._azimuthToPos;

  return (
    <div className="space-y-3">
      {/* GPS-Status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
        gpsActive
          ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
          : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
      }`}>
        {gpsActive ? (
          <>
            <Satellite className="w-4 h-4" />
            <span>GPS aktiv{accuracy != null ? ` · ±${Math.round(accuracy)}m` : ""}</span>
            {gpsPosition && <span className="text-gray-400">· {gpsPosition.lat.toFixed(4)}, {gpsPosition.lon.toFixed(4)}</span>}
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>{gpsError || "GPS wird gesucht..."}</span>
          </>
        )}
      </div>

      <MobilRepeaterFilter
        selectedModes={selectedModes}
        onModesChange={setSelectedModes}
        rangeKm={rangeKm}
        onRangeChange={setRangeKm}
        selectedBands={selectedBands}
        onBandsChange={setSelectedBands}
      />

      {/* Empfohlener Repeater — prominent */}
      <LiveRepeaterPanel
        repeater={recommendedRepeater}
        distance={recommendedDistance}
        azimuth={recommendedAzimuth}
        gpsActive={gpsActive}
      />

      {loadingRepeaters && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Lade Repeater...
        </div>
      )}

      {/* Live-Karte — 40% Bildschirmhöhe */}
      <LiveMapView
        gpsPosition={gpsPosition}
        accuracy={accuracy}
        repeaters={filteredRepeaters}
        recommendedRepeater={recommendedRepeater}
        selectedModes={selectedModes}
        selectedBands={selectedBands}
        rangeKm={rangeKm}
      />

      {/* Repeater-Liste (kompakt) */}
      {filteredRepeaters.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="p-2.5 border-b border-gray-100 dark:border-slate-700">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Repeater in Reichweite ({filteredRepeaters.length})
            </span>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filteredRepeaters.slice(0, 20).map((r, i) => (
              <div key={r.id || i} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 dark:border-slate-700 last:border-0">
                <span className="text-xs font-mono font-bold text-gray-900 dark:text-slate-100">{r.callsign}</span>
                <span className="text-[10px] text-gray-500">{r.frequency?.toFixed(3)}</span>
                <span className="text-[10px] text-gray-400">{r.primary_mode}</span>
                <div className="flex-1" />
                <span className="text-[10px] font-medium text-blue-600">{r._distToPos?.toFixed(0)} km {r._azimuthToPos}°</span>
              </div>
            ))}
            {filteredRepeaters.length > 20 && (
              <p className="text-[10px] text-gray-400 text-center py-1">+{filteredRepeaters.length - 20} weitere</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}