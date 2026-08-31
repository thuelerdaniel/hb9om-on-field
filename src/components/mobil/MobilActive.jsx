// MobilActive — Start-Modus nach Drücken von "Start".
// Layout: Header → Repeater-Panel (oben) → Karte (mitte, ~45%) → Repeater-Liste (unten).
// Der aktive Repeater (Detail-Panel + Abdeckung + Marker-Highlight) folgt der User-Auswahl,
// fällt zurück auf den empfohlenen (nächsten erreichbaren) wenn nichts selektiert.
// Liste begrenzt: 15 nächste + High-Repeater (elevation_m > 1500).

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import MobilStartHeader from "./MobilStartHeader";
import MobilMapView from "./MobilMapView";
import MobilActiveRepeaterPanel from "./MobilActiveRepeaterPanel";
import MobilRepeaterList from "./MobilRepeaterList";
import { calculateRange, isRepeaterReachable } from "@/lib/equipmentRange";
import { haversine, bearing } from "@/lib/geoUtilsFrontend";

const LIST_LIMIT = 15;
const HIGH_ELEVATION_M = 1500;

// High-Repeater: elevation_m > 1500 ü.M. (ERP-Feld existiert im Schema nicht)
function isHighRepeater(r) {
  return (r.elevation_m != null && r.elevation_m > HIGH_ELEVATION_M);
}

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
  const [selectedRepeaterId, setSelectedRepeaterId] = useState(null);
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
        return { ...r, _distToPos: dist, _azimuthToPos: az, _reachable: reachable, _isHigh: isHighRepeater(r) };
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

  // Active repeater = user selection, or recommended if nothing selected
  const activeRepeater = useMemo(() => {
    if (selectedRepeaterId) {
      const found = repeatersWithDist.find((r) => r.id === selectedRepeaterId);
      if (found) return found;
    }
    return recommendedRepeater;
  }, [selectedRepeaterId, repeatersWithDist, recommendedRepeater]);

  const isActiveReachable = activeRepeater?._reachable ?? isRecommendedReachable;

  // Filtered list: 15 nearest + all high repeaters beyond the 15
  const listRepeaters = useMemo(() => {
    if (repeatersWithDist.length === 0) return [];
    const nearest = repeatersWithDist.slice(0, LIST_LIMIT);
    const nearestIds = new Set(nearest.map((r) => r.id));
    const highBeyond = repeatersWithDist.filter(
      (r) => !nearestIds.has(r.id) && r._isHigh
    );
    return [...nearest, ...highBeyond];
  }, [repeatersWithDist]);

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
        const polygon =
          data?.polygon?.coordinates?.[0] ||
          data?.geojson?.coordinates?.[0] ||
          data?.coverage_polygon?.coordinates?.[0] ||
          (Array.isArray(data?.coordinates) ? (data.coordinates[0] || data.coordinates) : null) ||
          (Array.isArray(data?.polygon) ? data.polygon : null) ||
          null;
        if (Array.isArray(polygon)) setOwnCoveragePolygon(polygon);
      } catch {
        // Silent fail — coverage is optional
      } finally {
        setCoverageLoading(false);
      }
    },
    [showOwnCoverage, equipmentType, selectedBands]
  );

  useEffect(() => {
    if (!showOwnCoverage || !gpsPosition) {
      setOwnCoveragePolygon(null);
      return;
    }

    fetchOwnCoverage(gpsPosition.lat, gpsPosition.lon);
    setCoverageCountdown(60);

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

      {/* Active repeater panel — OBEN (prominent) */}
      <div className="px-3 py-2">
        <MobilActiveRepeaterPanel
          repeater={activeRepeater}
          distance={activeRepeater?._distToPos}
          azimuth={activeRepeater?._azimuthToPos}
          reachable={isActiveReachable}
          gpsActive={gpsActive}
        />
      </div>

      {/* Own coverage countdown */}
      {showOwnCoverage && (
        <div className="px-3 py-0.5 text-[10px] text-blue-600 dark:text-blue-400 text-center">
          {coverageLoading
            ? "Aktualisiere Eigene Reichweite..."
            : `Nächste Aktualisierung in ${coverageCountdown} Sekunden`}
        </div>
      )}

      {/* Map — MITTE (~45% of screen) */}
      <MobilMapView
        routeCoords={routeCoords}
        gpsPosition={gpsPosition}
        accuracy={accuracy}
        repeaters={listRepeaters}
        recommendedRepeater={activeRepeater}
        selectedRepeater={activeRepeater}
        showRepeaterCoverage={showRepeaterCoverage}
        showOwnCoverage={showOwnCoverage}
        ownCoveragePolygon={ownCoveragePolygon}
        isRecommendedReachable={isActiveReachable}
        equipmentType={equipmentType}
        height="45vh"
      />

      {/* Repeater list — UNTEN (scrollable, compact) */}
      <div className="px-3 pb-20 flex-1 overflow-hidden">
        <MobilRepeaterList
          repeaters={listRepeaters}
          onSelect={(r) => setSelectedRepeaterId(r.id)}
          selectedId={activeRepeater?.id}
          recommendedId={recommendedRepeater?.id}
        />
      </div>
    </div>
  );
}