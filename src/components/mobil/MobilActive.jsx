// MobilActive — Start-Modus nach Drücken von "Start".
// Layout: Header → Repeater-Panel (oben) → Karte (mitte, ~45%) → Repeater-Liste (unten).
// ITM (Longley-Rice) Propagation für Repeater-Empfehlung + Coverage-Polygon.
// Der aktive Repeater folgt der User-Auswahl, fällt zurück auf den empfohlenen.

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import MobilStartHeader from "./MobilStartHeader";
import MobilMapView from "./MobilMapView";
import MobilActiveRepeaterPanel from "./MobilActiveRepeaterPanel";
import MobilRepeaterNav from "./MobilRepeaterNav";
import MobilRepeaterList from "./MobilRepeaterList";
import { calculateRange, isRepeaterReachable } from "@/lib/equipmentRange";
import { haversine, bearing } from "@/lib/geoUtilsFrontend";
import { computeItmPropagation, computeItmCoverage } from "@/lib/itmPropagation";

const LIST_LIMIT = 15;
const HIGH_ELEVATION_M = 1500;
const ITM_LIST_LIMIT = 5;

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

  // ITM state
  const [itmResult, setItmResult] = useState(null);
  const [itmLoading, setItmLoading] = useState(false);
  const [itmCoveragePolygon, setItmCoveragePolygon] = useState(null);
  const [itmCoverageLoading, setItmCoverageLoading] = useState(false);
  const [itmResultsMap, setItmResultsMap] = useState({});

  const countdownRef = useRef(null);
  const itmDebounceRef = useRef(null);
  // Track which repeater ID we have a loaded ITM result for — prevents flicker on GPS updates
  const itmLoadedForRepeaterRef = useRef(null);

  const repeatersWithDist = useMemo(() => {
    const refPoint =
      gpsPosition ||
      (routeCoords.length > 0
        ? { lat: routeCoords[0][0], lon: routeCoords[0][1] }
        : null);
    if (!refPoint) return [];

    return repeaters
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => {
        const dist = haversine(refPoint.lat, refPoint.lon, r.lat, r.lng);
        const az = bearing(refPoint.lat, refPoint.lon, r.lat, r.lng);
        const reachable = isRepeaterReachable(dist, equipmentType, r.band);
        return { ...r, _distToPos: dist, _azimuthToPos: az, _reachable: reachable, _isHigh: isHighRepeater(r) };
      })
      .sort((a, b) => (a._distToPos || 0) - (b._distToPos || 0));
  }, [repeaters, gpsPosition, routeCoords, equipmentType]);

  const reachableRepeaters = repeatersWithDist.filter((r) => r._reachable);
  const recommendedRepeater =
    reachableRepeaters.length > 0
      ? reachableRepeaters[0]
      : repeatersWithDist[0] || null;
  const isRecommendedReachable = reachableRepeaters.length > 0;

  const activeRepeater = useMemo(() => {
    if (selectedRepeaterId) {
      const found = repeatersWithDist.find((r) => r.id === selectedRepeaterId);
      if (found) return found;
    }
    return recommendedRepeater;
  }, [selectedRepeaterId, repeatersWithDist, recommendedRepeater]);

  const isActiveReachable = activeRepeater?._reachable ?? isRecommendedReachable;

  const listRepeaters = useMemo(() => {
    if (repeatersWithDist.length === 0) return [];
    const nearest = repeatersWithDist.slice(0, LIST_LIMIT);
    const nearestIds = new Set(nearest.map((r) => r.id));
    const highBeyond = repeatersWithDist.filter(
      (r) => !nearestIds.has(r.id) && r._isHigh
    );
    return [...nearest, ...highBeyond];
  }, [repeatersWithDist]);

  // v0.9033: +/- Navigation — index of active repeater in the list
  const activeIndex = listRepeaters.findIndex((r) => r.id === activeRepeater?.id);
  const canPrev = activeIndex > 0;
  const canNext = activeIndex >= 0 && activeIndex < listRepeaters.length - 1;

  const handlePrevRepeater = useCallback(() => {
    if (canPrev) setSelectedRepeaterId(listRepeaters[activeIndex - 1].id);
  }, [canPrev, activeIndex, listRepeaters]);

  const handleNextRepeater = useCallback(() => {
    if (canNext) setSelectedRepeaterId(listRepeaters[activeIndex + 1].id);
  }, [canNext, activeIndex, listRepeaters]);

  // ITM: Fetch propagation for active repeater.
  // Only shows loading spinner on first load or repeater change — keeps old values
  // during GPS-update refetch to prevent dBm display flicker.
  useEffect(() => {
    if (!activeRepeater || !gpsPosition) {
      setItmResult(null);
      setItmLoading(false);
      itmLoadedForRepeaterRef.current = null;
      return;
    }

    const repeaterChanged = itmLoadedForRepeaterRef.current !== activeRepeater.id;
    // Only show loading spinner when the repeater changes (not on every GPS update)
    if (repeaterChanged) {
      setItmLoading(true);
      itmLoadedForRepeaterRef.current = activeRepeater.id;
    }

    let cancelled = false;

    computeItmPropagation({
      lat1: activeRepeater.lat,
      lng1: activeRepeater.lng,
      lat2: gpsPosition.lat,
      lng2: gpsPosition.lon,
      frequency_mhz: activeRepeater.frequency,
      tx_height_m: activeRepeater.elevation_m || 10,
      rx_height_m: equipmentType === "mobil" ? 2 : 1.5,
      tx_power_w: 50,
      tx_gain_db: 6,
      climate: 5,
    }).then((result) => {
      if (!cancelled) {
        setItmResult(result);
        setItmLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        // Keep old result on error — prevents flicker (don't clear itmResult)
        setItmLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [activeRepeater?.id, gpsPosition?.lat, gpsPosition?.lon, equipmentType]);

  // ITM: Fetch coverage polygon for active repeater
  useEffect(() => {
    if (!showRepeaterCoverage || !activeRepeater) {
      setItmCoveragePolygon(null);
      return;
    }

    let cancelled = false;
    setItmCoverageLoading(true);

    computeItmCoverage({
      lat: activeRepeater.lat,
      lng: activeRepeater.lng,
      frequency_mhz: activeRepeater.frequency,
      tx_height_m: activeRepeater.elevation_m || 10,
      tx_power_w: 50,
      tx_gain_db: 6,
      band: activeRepeater.band,
      directions: 16,
      step_km: 5,
      climate: 5,
    }).then((result) => {
      if (!cancelled && result?.coverage_polygon) {
        setItmCoveragePolygon(result.coverage_polygon);
        setItmCoverageLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setItmCoveragePolygon(null);
        setItmCoverageLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [showRepeaterCoverage, activeRepeater?.id]);

  // ITM: Fetch propagation for top N nearest repeaters (debounced, for list badges)
  useEffect(() => {
    if (!gpsPosition || repeatersWithDist.length === 0) {
      setItmResultsMap({});
      return;
    }

    if (itmDebounceRef.current) clearTimeout(itmDebounceRef.current);

    itmDebounceRef.current = setTimeout(async () => {
      const topRepeaters = repeatersWithDist.slice(0, ITM_LIST_LIMIT);
      const results = {};

      await Promise.all(
        topRepeaters.map(async (r) => {
          const result = await computeItmPropagation({
            lat1: r.lat,
            lng1: r.lng,
            lat2: gpsPosition.lat,
            lng2: gpsPosition.lon,
            frequency_mhz: r.frequency,
            tx_height_m: r.elevation_m || 10,
            rx_height_m: equipmentType === "mobil" ? 2 : 1.5,
            tx_power_w: 50,
            tx_gain_db: 6,
            climate: 5,
          });
          if (result) results[r.id] = result;
        })
      );

      setItmResultsMap(results);
    }, 1000);

    return () => {
      if (itmDebounceRef.current) clearTimeout(itmDebounceRef.current);
    };
  }, [repeatersWithDist, gpsPosition, equipmentType]);

  // Own coverage (existing)
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
          if (gpsPosition) fetchOwnCoverage(gpsPosition.lat, gpsPosition.lon);
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
      <MobilStartHeader
        mode={mode}
        equipmentType={equipmentType}
        showRepeaterCoverage={showRepeaterCoverage}
        showOwnCoverage={showOwnCoverage}
        onToggleRepeaterCoverage={() => onToggleRepeaterCoverage(!showRepeaterCoverage)}
        onToggleOwnCoverage={() => onToggleOwnCoverage(!showOwnCoverage)}
        onStop={onStop}
      />

      <div className="px-3 py-2">
        <MobilActiveRepeaterPanel
          repeater={activeRepeater}
          distance={activeRepeater?._distToPos}
          azimuth={activeRepeater?._azimuthToPos}
          reachable={isActiveReachable}
          gpsActive={gpsActive}
          itmResult={itmResult}
          itmLoading={itmLoading}
          selectedModes={selectedModes}
        />
        <MobilRepeaterNav
          currentIndex={activeIndex >= 0 ? activeIndex + 1 : 0}
          total={listRepeaters.length}
          onPrev={handlePrevRepeater}
          onNext={handleNextRepeater}
          canPrev={canPrev}
          canNext={canNext}
        />
      </div>

      {showOwnCoverage && (
        <div className="px-3 py-0.5 text-[10px] text-blue-600 dark:text-blue-400 text-center">
          {coverageLoading
            ? "Aktualisiere Eigene Reichweite..."
            : `Nächste Aktualisierung in ${coverageCountdown} Sekunden`}
        </div>
      )}

      {showRepeaterCoverage && itmCoverageLoading && (
        <div className="px-3 py-0.5 text-[10px] text-green-600 dark:text-green-400 text-center">
          Berechne ITM-Abdeckung (Terrain + Clutter)...
        </div>
      )}

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
        itmCoveragePolygon={itmCoveragePolygon}
        isRecommendedReachable={isActiveReachable}
        equipmentType={equipmentType}
        height="45vh"
      />

      <div className="px-3 pb-20 flex-1 overflow-hidden">
        <MobilRepeaterList
          repeaters={listRepeaters}
          onSelect={(r) => setSelectedRepeaterId(r.id)}
          selectedId={activeRepeater?.id}
          recommendedId={recommendedRepeater?.id}
          itmResultsMap={itmResultsMap}
        />
      </div>
    </div>
  );
}