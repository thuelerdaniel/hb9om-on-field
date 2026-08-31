// Mobil.jsx — Hauptseite für das Mobil-Tab (v0.9007).
// Verwaltet: Mode (Route/Live), Equipment (Mobil/Portable), Modulations-Filter,
// Start-Status, Coverage-Toggles, GPS + Wake Lock, Repeater-Laden.
// Vor Start: MobilConfig (Konfiguration). Nach Start: MobilActive (Karte + Repeater).

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Smartphone } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMobilGps } from "@/hooks/useMobilGps";
import BottomNavigation from "@/components/BottomNavigation";
import MobilConfig from "@/components/mobil/MobilConfig";
import MobilActive from "@/components/mobil/MobilActive";
import {
  pointBounds,
  routeBounds,
  totalRouteDistance,
  fetchOsmRoute,
} from "@/lib/routeDistance";
import { repeaterMatchesMode } from "@/lib/repeaterModes";
import { maxRangeForBands } from "@/lib/equipmentRange";

export default function Mobil() {
  // Core state
  const [mode, setMode] = useState("route");
  const [equipmentType, setEquipmentType] = useState("mobil");
  const [selectedModes, setSelectedModes] = useState(["FM", "DMR", "D-STAR", "Fusion"]);
  const [selectedBands, setSelectedBands] = useState([]);
  const [started, setStarted] = useState(false);
  const [showRepeaterCoverage, setShowRepeaterCoverage] = useState(false);
  const [showOwnCoverage, setShowOwnCoverage] = useState(false);

  // GPS + Wake Lock
  const { position, accuracy, gpsActive, gpsError } = useMobilGps(true);

  // Route state
  const [waypoints, setWaypoints] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [repeaters, setRepeaters] = useState([]);
  const [loadingRepeaters, setLoadingRepeaters] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState([]);

  // Load saved routes on mount
  useEffect(() => {
    (async () => {
      try {
        const routes = await base44.entities.Route.list("-saved_date", 50);
        setSavedRoutes(routes || []);
      } catch {}
    })();
  }, []);

  // Effective range based on equipment type + selected bands
  const effectiveRange = useMemo(
    () => maxRangeForBands(equipmentType, selectedBands),
    [equipmentType, selectedBands]
  );

  // Load repeaters from backend
  const loadRepeaters = useCallback(async (bounds) => {
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

  // Load repeaters when route or GPS position changes (config mode only)
  useEffect(() => {
    if (started) return;

    if (mode === "route" && routeCoords.length >= 2) {
      const bounds = routeBounds(routeCoords, effectiveRange);
      if (bounds) loadRepeaters(bounds);
    } else if (mode === "live" && position) {
      const bounds = pointBounds(position.lat, position.lon, effectiveRange);
      loadRepeaters(bounds);
    } else {
      setRepeaters([]);
    }
  }, [mode, routeCoords, position, effectiveRange, started, loadRepeaters]);

  // Filter repeaters by mode + band
  const filteredRepeaters = useMemo(() => {
    return repeaters.filter((r) => {
      if (r.lat == null || r.lng == null) return false;
      if (selectedModes.length > 0 && !selectedModes.some((m) => repeaterMatchesMode(r, m)))
        return false;
      if (selectedBands.length > 0 && r.band && !selectedBands.includes(r.band)) return false;
      return true;
    });
  }, [repeaters, selectedModes, selectedBands]);

  // Route save
  const saveRoute = useCallback(
    async (name) => {
      try {
        const dist = totalRouteDistance(routeCoords);
        await base44.entities.Route.create({
          name,
          waypoints: waypoints.map((wp, i) => ({
            lat: wp.lat,
            lon: wp.lon,
            name: wp.name,
            order: i,
          })),
          mode_filter: selectedModes,
          band_filter: selectedBands,
          route_mode: "route",
          saved_date: new Date().toISOString().split("T")[0],
          is_active: true,
          total_distance_km: dist,
        });
        const routes = await base44.entities.Route.list("-saved_date", 50);
        setSavedRoutes(routes || []);
      } catch {}
    },
    [waypoints, routeCoords, selectedModes, selectedBands]
  );

  // Route load
  const loadRoute = useCallback((route) => {
    setWaypoints((route.waypoints || []).map((wp, i) => ({ ...wp, order: i })));
    setRouteCoords([]);
    setTimeout(() => {
      (async () => {
        const wps = (route.waypoints || []).map((wp, i) => ({ ...wp, order: i }));
        if (wps.length >= 2) {
          try {
            const coords = await fetchOsmRoute(wps);
            setRouteCoords(coords);
          } catch {
            setRouteCoords(wps.map((wp) => [wp.lat, wp.lon]));
          }
        }
      })();
    }, 100);
  }, []);

  // === START MODE ===
  if (started) {
    return (
      <>
        <MobilActive
          mode={mode}
          equipmentType={equipmentType}
          selectedModes={selectedModes}
          selectedBands={selectedBands}
          gpsPosition={position}
          accuracy={accuracy}
          gpsActive={gpsActive}
          routeCoords={routeCoords}
          repeaters={filteredRepeaters}
          showRepeaterCoverage={showRepeaterCoverage}
          showOwnCoverage={showOwnCoverage}
          onToggleRepeaterCoverage={setShowRepeaterCoverage}
          onToggleOwnCoverage={setShowOwnCoverage}
          onStop={() => setStarted(false)}
        />
        <BottomNavigation />
      </>
    );
  }

  // === CONFIG MODE ===
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      <header
        className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900 dark:text-slate-100">Mobil</h1>
            <p className="text-[10px] text-gray-400">
              {gpsActive
                ? `GPS aktiv${accuracy != null ? ` · ±${Math.round(accuracy)}m` : ""}`
                : gpsError || "GPS wird gesucht..."}
            </p>
          </div>
          {loadingRepeaters && (
            <span className="text-[10px] text-gray-400">Lade Repeater...</span>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4">
        <MobilConfig
          mode={mode}
          onModeChange={setMode}
          equipmentType={equipmentType}
          onEquipmentChange={setEquipmentType}
          selectedModes={selectedModes}
          onModesChange={setSelectedModes}
          selectedBands={selectedBands}
          onBandsChange={setSelectedBands}
          gpsPosition={position}
          accuracy={accuracy}
          gpsActive={gpsActive}
          gpsError={gpsError}
          waypoints={waypoints}
          onWaypointsChange={setWaypoints}
          routeCoords={routeCoords}
          onRouteCoordsChange={setRouteCoords}
          repeaters={filteredRepeaters}
          onStart={() => setStarted(true)}
          onSaveRoute={saveRoute}
          onLoadRoute={loadRoute}
          savedRoutes={savedRoutes}
        />
      </div>

      <BottomNavigation />
    </div>
  );
}