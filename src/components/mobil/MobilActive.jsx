// MobilActive — Start-Modus nach Drücken von "Start".
// Zeigt nur Header (Stop + Toggles), Karte (60%), aktiven Repeater-Panel und Repeater-Liste.
// Verwaltet Repeater-Abdeckung (Kreis) und eigene Reichweite (Polygon, 60s Auto-Update).

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import MobilStartHeader from "./MobilStartHeader";
import MobilMapView from "./MobilMapView";
import MobilActiveRepeaterPanel from "./MobilActiveRepeaterPanel";
import MobilRepeaterList from "./MobilRepeaterList";
import { calculateRange, isRepeaterReachable } from "@/lib/equipmentRange";
import { haversine, bearing } from "@/lib/geoUtilsFrontend";

export default function MobilActive({
  mode,
  equipmentType,
  selectedModes,
  selectedBands,
  gpsPosition,
  accuracy,
  gpsActive,
  routeCoords,
  repeaters,
  showRepeaterCoverage,
  showOwnCoverage,
  onToggleRepeaterCoverage,
  onToggleOwnCoverage,
  onStop,
}) {
  const [selectedRepeater, setSelectedRepeater] = useState(null);
  const [ownCoveragePolygon, setOwnCoveragePolygon] = useState(null);
  const [coverageCountdown, setCoverageCountdown] = useState(60);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const countdownRef = useRef(null);

  // Calculate distances + reachability for each repeater
  const repeatersWithDist = useMemo(() => {
    const refPoint =
      gpsPosition ||
      (routeCoords.length > 0
        ? { lat: routeCoords[0][0], lon: routeCoords[0][1] }
        : null);
    if (!refPoint) return [];

    return repeaters
      .map((r) => {
        const dist = haversine(refPoint.lat, refPoint.lon, r.lat, r.lng);
        const az = bearing(refPoint.lat, refPoint.lon, r.lat, r.lng);
        const reachable = isRepeaterReachable(dist, equipmentType, r.band);
        return { ...r, _distToPos: dist, _azimuthToPos: az, _reachable: reachable };
      })
      .sort((a, b) => (a._distToPos || 0) - (b._distToPos || 0));
  }, [repeaters, gpsPosition, routeCoords, equipmentType]);

  // Recommended repeater = nearest reachable, fallback = nearest overall
  const reachableRepeaters = repeatersWithDist.filter((r) => r._reachable);
  const recommendedRepeater =
    reachableRepeaters.length > 0
      ? reachableRepeaters[0]
      : repeatersWithDist[0] || null;
  const isRecommendedReachable = reachableRepeaters.length > 0;

  // Fetch own coverage polygon from backend
  const fetchOwnCoverage = useCallback(
    async (lat, lon) => {
      if (!showOwnCoverage) return;
      setCoverageLoading(true);
      try {
        const band = selectedBands[0] || "2m";
        const res = await base44.functions.invoke("calculateUserCoverage", {
          equipmentType,
          band,
          lat,
          lng: lon,
        });
        const data = res?.data;
        // Handle multiple response formats
        const polygon =
          data?.polygon ||
          data?.geojson?.coordinates?.[0] ||
          data?.coverage_polygon ||
          data?.coordinates?.[0] ||
          null;
        if (polygon) setOwnCoveragePolygon(polygon);
      } catch {
        // Silent fail — coverage is optional
      } finally {
        setCoverageLoading(false);
      }
    },
    [showOwnCoverage, equipmentType, selectedBands]
  );

  // Initial fetch + auto-update every 60s
  useEffect(() => {
    if (!showOwnCoverage || !gpsPosition) {
      setOwnCoveragePolygon(null);
      return;
    }

    // Initial fetch
    fetchOwnCoverage(gpsPosition.lat, gpsPosition.lon);
    setCoverageCountdown(60);

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setCoverageCountdown((prev) => {
        if (prev <= 1) {
          if (gpsPosition) {
            fetchOwnCoverage(gpsPosition.lat, gpsPosition.lon);
          }
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showOwnCoverage, gpsPosition, fetchOwnCoverage]);

  // Re-fetch immediately when equipment type changes
  useEffect(() => {
    if (showOwnCoverage && gpsPosition) {
      fetchOwnCoverage(gpsPosition.lat, gpsPosition.lon);
    }
  }, [equipmentType, fetchOwnCoverage, showOwnCoverage, gpsPosition]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header with stop + toggles */}
      <MobilStartHeader
        mode={mode}
        equipmentType={equipmentType}
        showRepeaterCoverage={showRepeaterCoverage}
        showOwnCoverage={showOwnCoverage}
        onToggleRepeaterCoverage={() => onToggleRepeaterCoverage(!showRepeaterCoverage)}
        onToggleOwnCoverage={() => onToggleOwnCoverage(!showOwnCoverage)}
        onStop={onStop}
      />

      {/* Map — 60% of screen */}
      <MobilMapView
        routeCoords={routeCoords}
        gpsPosition={gpsPosition}
        accuracy={accuracy}
        repeaters={repeatersWithDist}
        recommendedRepeater={recommendedRepeater}
        selectedRepeater={selectedRepeater}
        showRepeaterCoverage={showRepeaterCoverage}
        showOwnCoverage={showOwnCoverage}
        ownCoveragePolygon={ownCoveragePolygon}
        equipmentType={equipmentType}
        height="55vh"
      />

      {/* Own coverage countdown */}
      {showOwnCoverage && (
        <div className="px-3 py-1 text-[10px] text-blue-600 dark:text-blue-400 text-center">
          {coverageLoading
            ? "Aktualisiere Eigene Reichweite..."
            : `Nächste Aktualisierung in ${coverageCountdown} Sekunden`}
        </div>
      )}

      {/* Active repeater panel — prominent */}
      <div className="px-3 py-2">
        <MobilActiveRepeaterPanel
          repeater={recommendedRepeater}
          distance={recommendedRepeater?._distToPos}
          azimuth={recommendedRepeater?._azimuthToPos}
          reachable={isRecommendedReachable}
          gpsActive={gpsActive}
        />
      </div>

      {/* Repeater list — scrollable */}
      <div className="px-3 pb-20 flex-1 overflow-hidden">
        <MobilRepeaterList
          repeaters={repeatersWithDist}
          onSelect={setSelectedRepeater}
          selectedId={selectedRepeater?.id}
        />
      </div>
    </div>
  );
}