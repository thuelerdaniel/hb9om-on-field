// MobilRouteMode — Container für Routenplanung-Modus.
// Verwaltet Wegpunkte, Routenberechnung (OSRM), Repeater-Filterung und -Laden,
// Routen speichern/laden aus der Route-Entity.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Route as RouteIcon } from "lucide-react";
import RouteWaypointSearch from "./RouteWaypointSearch";
import RouteWaypointList from "./RouteWaypointList";
import MobilRepeaterFilter from "./MobilRepeaterFilter";
import RouteMapView from "./RouteMapView";
import RouteRepeaterList from "./RouteRepeaterList";
import { generateMobilRoutePdf } from "@/lib/mobilRoutePdf";
import { fetchOsmRoute, routeBounds, minDistanceToRoute, nearestSegmentIndex, totalRouteDistance } from "@/lib/routeDistance";
import { repeaterMatchesMode } from "@/lib/repeaterModes";

export default function MobilRouteMode({ gpsPosition }) {
  const [waypoints, setWaypoints] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [selectedModes, setSelectedModes] = useState(["FM", "DMR", "D-STAR", "Fusion"]);
  const [rangeKm, setRangeKm] = useState(25);
  const [selectedBands, setSelectedBands] = useState([]);
  const [repeaters, setRepeaters] = useState([]);
  const [loadingRepeaters, setLoadingRepeaters] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  // Gespeicherte Routen laden
  const loadSavedRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const routes = await base44.entities.Route.list("-saved_date", 50);
      setSavedRoutes(routes || []);
    } catch {} finally {
      setLoadingRoutes(false);
    }
  }, []);

  useEffect(() => {
    loadSavedRoutes();
  }, [loadSavedRoutes]);

  // v0.9021: Custom-Event Listener für Route löschen — umgeht HMR-Caching Probleme
  useEffect(() => {
    const handler = () => {
      setWaypoints([]);
      setRouteCoords([]);
      setRepeaters([]);
    };
    window.addEventListener("mobil-clear-route", handler);
    return () => window.removeEventListener("mobil-clear-route", handler);
  }, []);

  // Wegpunkt hinzufügen
  const addWaypoint = useCallback((wp) => {
    setWaypoints((prev) => [...prev, { ...wp, order: prev.length }]);
    setRouteCoords([]); // Reset bei neuen Wegpunkten
  }, []);

  const addMultipleWaypoints = useCallback((wps) => {
    setWaypoints((prev) => {
      const baseOrder = prev.length;
      return [...prev, ...wps.map((wp, i) => ({ ...wp, order: baseOrder + i }))];
    });
    setRouteCoords([]);
  }, []);

  // Wegpunkte neu ordnen
  const reorderWaypoints = useCallback((from, to) => {
    setWaypoints((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((wp, i) => ({ ...wp, order: i }));
    });
    setRouteCoords([]);
  }, []);

  const deleteWaypoint = useCallback((index) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index).map((wp, i) => ({ ...wp, order: i })));
    setRouteCoords([]);
  }, []);

  // v0.9021: Alle Wegpunkte + Route + Repeater löschen — inline definiert für zuverlässige Prop-Übergabe
  const clearAllWaypoints = () => {
    setWaypoints([]);
    setRouteCoords([]);
    setRepeaters([]);
  };

  // Route berechnen (OSRM)
  const calculateRoute = useCallback(async () => {
    if (waypoints.length < 2) return;
    setCalculating(true);
    try {
      const coords = await fetchOsmRoute(waypoints);
      setRouteCoords(coords);
    } catch {
      // Fallback: direkte Linien
      setRouteCoords(waypoints.map((wp) => [wp.lat, wp.lon]));
    } finally {
      setCalculating(false);
    }
  }, [waypoints]);

  // Route speichern
  const saveRoute = useCallback(async (name) => {
    try {
      const dist = totalRouteDistance(routeCoords);
      await base44.entities.Route.create({
        name,
        waypoints: waypoints.map((wp, i) => ({ lat: wp.lat, lon: wp.lon, name: wp.name, order: i })),
        mode_filter: selectedModes,
        range_km: rangeKm,
        band_filter: selectedBands,
        route_mode: "route",
        saved_date: new Date().toISOString().split("T")[0],
        is_active: true,
        total_distance_km: dist,
      });
      loadSavedRoutes();
    } catch {}
  }, [waypoints, routeCoords, selectedModes, rangeKm, selectedBands, loadSavedRoutes]);

  // Gespeicherte Route laden
  const loadRoute = useCallback((route) => {
    setWaypoints((route.waypoints || []).map((wp, i) => ({ ...wp, order: i })));
    setSelectedModes(route.mode_filter || ["FM", "DMR", "D-STAR", "Fusion"]);
    setRangeKm(route.range_km || 25);
    setSelectedBands(route.band_filter || []);
    setRouteCoords([]);
    // Auto-berechnen
    setTimeout(() => {
      (async () => {
        const wps = (route.waypoints || []).map((wp, i) => ({ ...wp, order: i }));
        if (wps.length >= 2) {
          setCalculating(true);
          try {
            const coords = await fetchOsmRoute(wps);
            setRouteCoords(coords);
          } catch {
            setRouteCoords(wps.map((wp) => [wp.lat, wp.lon]));
          } finally {
            setCalculating(false);
          }
        }
      })();
    }, 100);
  }, []);

  // Repeater laden wenn Route oder Reichweite ändert
  useEffect(() => {
    if (routeCoords.length < 2) {
      setRepeaters([]);
      return;
    }
    const bounds = routeBounds(routeCoords, rangeKm);
    if (!bounds) return;

    let cancelled = false;
    setLoadingRepeaters(true);
    (async () => {
      try {
        const res = await base44.functions.invoke("getReferencesInBounds", {
          types: ["repeater"],
          bounds,
          max_per_type: 5000,
        });
        if (cancelled) return;
        const rawRepeaters = res?.data?.references?.repeater || [];
        setRepeaters(rawRepeaters);
      } catch {
        if (!cancelled) setRepeaters([]);
      } finally {
        if (!cancelled) setLoadingRepeaters(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routeCoords, rangeKm]);

  // Repeater filtern + Distanz zur Route berechnen
  const filteredRepeaters = useMemo(() => {
    if (routeCoords.length < 2) return [];
    return repeaters
      .filter((r) => {
        if (r.lat == null || r.lng == null) return false;
        if (selectedModes.length > 0 && !selectedModes.some((m) => repeaterMatchesMode(r, m))) return false;
        if (selectedBands.length > 0 && r.band && !selectedBands.includes(r.band)) return false;
        return true;
      })
      .map((r) => {
        const dist = minDistanceToRoute(r.lat, r.lng, routeCoords);
        const segIdx = nearestSegmentIndex(r.lat, r.lng, routeCoords);
        return { ...r, _distToRoute: dist, _segmentIdx: segIdx };
      })
      .filter((r) => r._distToRoute <= rangeKm)
      .sort((a, b) => (a._segmentIdx || 0) - (b._segmentIdx || 0) || (a._distToRoute || 0) - (b._distToRoute || 0));
  }, [repeaters, selectedModes, selectedBands, rangeKm, routeCoords]);

  const totalDist = useMemo(() => totalRouteDistance(routeCoords), [routeCoords]);
  const today = new Date().toISOString().split("T")[0];

  // v0.9021: PDF Export Handler — sammelt Waypoints + Repeater und generiert PDF
  const handlePdfExport = useCallback(() => {
    const routeName = waypoints[0]?.name || "Route";
    const sortedRepeaters = [...filteredRepeaters].sort(
      (a, b) => (a._segmentIdx || 0) - (b._segmentIdx || 0) || (a._distToRoute || 0) - (b._distToRoute || 0)
    );
    generateMobilRoutePdf(routeName, today, totalDist, selectedModes, sortedRepeaters, waypoints);
  }, [waypoints, filteredRepeaters, totalDist, selectedModes, today]);

  const pdfDisabled = waypoints.length === 0;

  return (
    <div className="space-y-3">
      <RouteWaypointSearch
        onAddWaypoint={addWaypoint}
        onAddMultipleWaypoints={addMultipleWaypoints}
        onPdfExport={handlePdfExport}
        pdfDisabled={pdfDisabled}
      />

      <RouteWaypointList
        waypoints={waypoints}
        onReorder={reorderWaypoints}
        onDelete={deleteWaypoint}
        onClearAll={clearAllWaypoints}
        onCalculate={calculateRoute}
        calculating={calculating}
        onSaveRoute={saveRoute}
        onLoadRoute={loadRoute}
        savedRoutes={savedRoutes}
        loadingRoutes={loadingRoutes}
        onRoutesChanged={loadSavedRoutes}
      />

      <MobilRepeaterFilter
        selectedModes={selectedModes}
        onModesChange={setSelectedModes}
        rangeKm={rangeKm}
        onRangeChange={setRangeKm}
        selectedBands={selectedBands}
        onBandsChange={setSelectedBands}
      />

      {routeCoords.length > 0 ? (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 px-1">
            <RouteIcon className="w-3.5 h-3.5" />
            <span>Route: {totalDist} km · {filteredRepeaters.length} Repeater in Reichweite</span>
            {loadingRepeaters && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>

          <RouteMapView
            routeCoords={routeCoords}
            repeaters={filteredRepeaters}
            rangeKm={rangeKm}
            gpsPosition={gpsPosition}
            selectedModes={selectedModes}
            selectedBands={selectedBands}
          />

          <RouteRepeaterList
            repeaters={filteredRepeaters}
            waypoints={waypoints}
            routeName={waypoints[0]?.name || "Route"}
            totalDistance={totalDist}
            modeFilter={selectedModes}
            date={today}
          />
        </>
      ) : (
        <div className="text-center py-8 text-gray-400 dark:text-slate-500">
          <RouteIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Fügen Sie mindestens 2 Wegpunkte hinzu und berechnen Sie die Route</p>
        </div>
      )}
    </div>
  );
}