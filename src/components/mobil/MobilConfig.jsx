// MobilConfig — Konfigurations-Panel vor dem Start.
// Zeigt Mode-Toggle, Equipment-Auswahl, Modulations-Filter, Wegpunkt-Eingabe (Route)
// oder GPS-Status (Live), Karten-Vorschau und Start-Button.

import React, { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Play, Satellite, AlertCircle, Route as RouteIcon } from "lucide-react";
import MobilModeToggle from "./MobilModeToggle";
import MobilEquipmentSelect from "./MobilEquipmentSelect";
import MobilModulationFilter from "./MobilModulationFilter";
import RouteWaypointSearch from "./RouteWaypointSearch";
import RouteWaypointList from "./RouteWaypointList";
import MobilMapView from "./MobilMapView";
import { fetchOsmRoute, totalRouteDistance, minDistanceToRoute } from "@/lib/routeDistance";
import { generateMobilRoutePdf } from "@/lib/mobilRoutePdf";

export default function MobilConfig({
  mode,
  onModeChange,
  equipmentType,
  onEquipmentChange,
  selectedModes,
  onModesChange,
  selectedBands,
  onBandsChange,
  gpsPosition,
  accuracy,
  gpsActive,
  gpsError,
  waypoints,
  onWaypointsChange,
  routeCoords,
  onRouteCoordsChange,
  repeaters,
  onStart,
  onSaveRoute,
  onLoadRoute,
  savedRoutes,
  onRoutesChanged,
}) {
  const [calculating, setCalculating] = useState(false);

  const addWaypoint = (wp) => {
    onWaypointsChange([...waypoints, { ...wp, order: waypoints.length }]);
    onRouteCoordsChange([]);
  };

  const addMultipleWaypoints = (wps) => {
    onWaypointsChange([
      ...waypoints,
      ...wps.map((wp, i) => ({ ...wp, order: waypoints.length + i })),
    ]);
    onRouteCoordsChange([]);
  };

  const reorderWaypoints = (from, to) => {
    const next = [...waypoints];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onWaypointsChange(next.map((wp, i) => ({ ...wp, order: i })));
    onRouteCoordsChange([]);
  };

  const deleteWaypoint = (index) => {
    onWaypointsChange((prev) =>
      prev.filter((_, i) => i !== index).map((wp, i) => ({ ...wp, order: i }))
    );
    onRouteCoordsChange([]);
  };

  // v0.9022: Route löschen — alle Wegpunkte + Route + Repeater zurücksetzen
  const clearAllWaypoints = useCallback(() => {
    onWaypointsChange([]);
    onRouteCoordsChange([]);
  }, [onWaypointsChange, onRouteCoordsChange]);

  const totalDist = useMemo(() => totalRouteDistance(routeCoords), [routeCoords]);

  // v0.9024: PDF Export — komplett im Frontend (raw PDF string, keine Library)
  const handlePdfExport = useCallback(() => {
    if (waypoints.length === 0) return;
    try {
      const routeName = waypoints[0]?.name || "Route";
      const today = new Date().toISOString().split("T")[0];
      generateMobilRoutePdf(routeName, today, totalDist, selectedModes, repeaters, waypoints);
    } catch (err) {
      console.error("PDF Export Fehler:", err);
    }
  }, [waypoints, repeaters, totalDist, selectedModes]);

  const calculateRoute = async () => {
    if (waypoints.length < 2) return;
    setCalculating(true);
    try {
      const coords = await fetchOsmRoute(waypoints);
      onRouteCoordsChange(coords);
    } catch {
      onRouteCoordsChange(waypoints.map((wp) => [wp.lat, wp.lon]));
    } finally {
      setCalculating(false);
    }
  };

  const canStart =
    mode === "route" ? routeCoords.length >= 2 : gpsActive;

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <MobilModeToggle mode={mode} onChange={onModeChange} />

      {/* Equipment select */}
      <MobilEquipmentSelect value={equipmentType} onChange={onEquipmentChange} />

      {/* Collapsible modulation filter */}
      <MobilModulationFilter
        selectedModes={selectedModes}
        onModesChange={onModesChange}
        selectedBands={selectedBands}
        onBandsChange={onBandsChange}
      />

      {/* Route mode: waypoint search + list */}
      {mode === "route" && (
        <>
          <RouteWaypointSearch
            onAddWaypoint={addWaypoint}
            onAddMultipleWaypoints={addMultipleWaypoints}
            onPdfExport={handlePdfExport}
            pdfDisabled={waypoints.length === 0}
          />
          <RouteWaypointList
            waypoints={waypoints}
            onReorder={reorderWaypoints}
            onDelete={deleteWaypoint}
            onClearAll={clearAllWaypoints}
            onCalculate={calculateRoute}
            calculating={calculating}
            onSaveRoute={onSaveRoute}
            onLoadRoute={onLoadRoute}
            savedRoutes={savedRoutes}
            loadingRoutes={false}
            onRoutesChanged={onRoutesChanged}
          />

          {routeCoords.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 px-1">
              <RouteIcon className="w-3.5 h-3.5" />
              <span>
                Route: {totalDist} km · {repeaters.length} Repeater
              </span>
            </div>
          )}
        </>
      )}

      {/* Live mode: GPS status */}
      {mode === "live" && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
            gpsActive
              ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
          }`}
        >
          {gpsActive ? (
            <>
              <Satellite className="w-4 h-4" />
              <span>
                GPS aktiv{accuracy != null ? ` · ±${Math.round(accuracy)}m` : ""}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>{gpsError || "GPS wird gesucht..."}</span>
            </>
          )}
        </div>
      )}

      {/* Map preview */}
      {(routeCoords.length > 0 || gpsPosition) && (
        <MobilMapView
          routeCoords={routeCoords}
          gpsPosition={gpsPosition}
          accuracy={accuracy}
          repeaters={repeaters}
          recommendedRepeater={repeaters[0]}
          equipmentType={equipmentType}
          height="200px"
        />
      )}

      {/* Start button */}
      <button
        onClick={onStart}
        disabled={!canStart}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Play className="w-5 h-5 fill-current" />
        Start
      </button>
      {!canStart && (
        <p className="text-xs text-gray-400 text-center">
          {mode === "route"
            ? "Berechnen Sie zuerst eine Route mit mindestens 2 Wegpunkten"
            : "Warten Sie auf GPS-Signal..."}
        </p>
      )}
    </div>
  );
}