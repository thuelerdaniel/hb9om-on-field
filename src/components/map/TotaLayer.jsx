import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { CircleMarker, Popup, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { RadioTower, Signal, Building, AlertTriangle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { isInContinents } from "@/lib/continents";
import { isInCountries } from "@/lib/countries";
import { getMarkerSvg } from "@/lib/markerShapes";
import DraggablePopup from "@/components/map/DraggablePopup";

// ─── Viewport-based TOTA Layer ───
// Loads TOTA points only within the current map viewport, with zoom-level checks:
// - Zoom < 8: No points loaded, warning shown
// - Zoom 8-12: Max 2000 points per viewport query
// - Zoom >= 12: Full viewport query (up to 5000)
// Swiss points (country_code=CH / source=swiss_csv) are hidden by default
// unless showChTota=true.

const TOTA_COLORS = {
  antenna: "#8b5cf6",
  tower: "#f97316",
};

const TOTA_TYPE_LABELS = {
  antenna: "Antenne",
  tower: "Turm / Aussichtsturm",
};

const TOTA_TYPE_ICONS = {
  antenna: Signal,
  tower: RadioTower,
};

const DEBOUNCE_MS = 300;
const MIN_ZOOM = 8;
const MID_ZOOM = 12;
const MID_ZOOM_LIMIT = 2000;
const QUERY_LIMIT = 5000;

function formatCoords(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function TotaLayer({
  filterTypes,
  searchQuery,
  performanceMode,
  userPosition,
  activeContinents = [],
  activeCountries = [],
  filterCountries = [],
  showChTota = false,
  onCountsChange,
}) {
  const map = useMap();
  const [rawPoints, setRawPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState(null);
  const debounceRef = useRef(null);
  const warningTimerRef = useRef(null);

  const showWarning = useCallback((type, message) => {
    setWarning({ type, message });
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => setWarning(null), 4000);
  }, []);

  // Fetch TOTA points within viewport bounds
  const fetchPoints = useCallback(async () => {
    const zoom = map.getZoom();

    // Zoom check: don't load below MIN_ZOOM
    if (zoom < MIN_ZOOM) {
      setRawPoints([]);
      onCountsChange?.(0, 0);
      showWarning("zoom", "Zoomen Sie hinein (min. Zoom 8) um TOTA-Punkte zu sehen");
      return;
    }

    const bounds = map.getBounds();
    const padded = bounds.pad(0.2);
    const limit = zoom < MID_ZOOM ? MID_ZOOM_LIMIT : QUERY_LIMIT;

    setLoading(true);
    try {
      const query = {
        lat: { $gte: padded.getSouth(), $lte: padded.getNorth() },
        lng: { $gte: padded.getWest(), $lte: padded.getEast() },
      };

      const points = await base44.entities.TotaPoint.filter(query, "id", limit);

      // Filter out CH points if showChTota is false
      let filtered = points || [];
      if (!showChTota) {
        filtered = filtered.filter(
          (p) => p.country_code !== "CH" && p.source !== "swiss_csv"
        );
      }

      setRawPoints(filtered);

      // Show count info if > 1000
      if (filtered.length > 1000) {
        showWarning("count", `${filtered.length} TOTA-Punkte im sichtbaren Bereich geladen`);
      }

      // Show limit warning if limit reached at mid-zoom
      if (zoom < MID_ZOOM && (points || []).length >= limit) {
        showWarning("limit", `Maximal ${MID_ZOOM_LIMIT} Punkte angezeigt. Zoomen Sie hinein für mehr Details.`);
      }
    } catch (e) {
      // Silent — previous data still shows
    } finally {
      setLoading(false);
    }
  }, [map, showChTota, onCountsChange, showWarning]);

  // Map event handler with debounce
  const handleMapChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPoints();
    }, DEBOUNCE_MS);
  }, [fetchPoints]);

  useMapEvents({
    moveend: handleMapChange,
    zoomend: handleMapChange,
  });

  // Fetch on mount and when showChTota changes
  useEffect(() => {
    fetchPoints();
  }, [fetchPoints, showChTota]);

  // Cleanup
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    },
    []
  );

  // Filter points by type, search, continent, country
  const filteredPoints = useMemo(() => {
    let result = rawPoints;
    if (filterTypes && filterTypes.length === 0) return [];
    if (filterTypes && filterTypes.length > 0) {
      result = result.filter((p) => filterTypes.includes(p.type));
    }
    if (searchQuery && searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q) ||
          (p.subtype || "").toLowerCase().includes(q) ||
          (p.usage || "").toLowerCase().includes(q)
      );
    }
    if (filterCountries && filterCountries.length > 0) {
      result = result.filter(
        (p) =>
          filterCountries.includes(p.country_code) ||
          (p.source === "swiss_csv" && filterCountries.includes("CH"))
      );
    } else {
      result = result
        .filter((p) => isInContinents(p.lat, p.lng, activeContinents))
        .filter((p) => isInCountries(p, activeCountries));
    }
    return result;
  }, [rawPoints, filterTypes, searchQuery, activeContinents, activeCountries, filterCountries]);

  // Update counts for parent
  useEffect(() => {
    onCountsChange?.(filteredPoints.length, rawPoints.length);
  }, [filteredPoints.length, rawPoints.length, onCountsChange]);

  // Viewport bounds filtering (client-side, for already-fetched points)
  const visiblePoints = useMemo(() => {
    if (!map) return filteredPoints;
    const bounds = map.getBounds();
    return filteredPoints.filter(
      (p) =>
        p.lat >= bounds.getSouth() &&
        p.lat <= bounds.getNorth() &&
        p.lng >= bounds.getWest() &&
        p.lng <= bounds.getEast()
    );
  }, [filteredPoints, map]);

  // Icon cache
  const iconCache = useMemo(() => new Map(), []);
  const getTotaIcon = (pointType, color) => {
    const cacheKey = `${pointType}:${color}`;
    if (iconCache.has(cacheKey)) return iconCache.get(cacheKey);
    const svg = getMarkerSvg("tota", color);
    const icon = L.divIcon({
      className: "tota-marker-icon",
      html: `<div style="width:28px;height:28px;">${svg}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    iconCache.set(cacheKey, icon);
    return icon;
  };

  return (
    <>
      {/* Warning banner — non-blocking, auto-dismiss after 4s */}
      {warning && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 rounded-lg shadow-lg border text-xs font-medium flex items-center gap-2 max-w-[90vw]"
          style={{
            background: warning.type === "zoom" ? "#fffbeb" : warning.type === "limit" ? "#fef2f2" : "#f0f9ff",
            borderColor: warning.type === "zoom" ? "#f59e0b" : warning.type === "limit" ? "#ef4444" : "#3b82f6",
            color: warning.type === "zoom" ? "#92400e" : warning.type === "limit" ? "#991b1b" : "#1e40af",
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{warning.message}</span>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[1100] px-3 py-1.5 rounded-lg shadow-lg bg-white border border-gray-200 text-xs text-gray-600 flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          TOTA wird geladen…
        </div>
      )}

      {/* TOTA markers */}
      {visiblePoints.map((point, idx) => {
        const color = TOTA_COLORS[point.type] || "#6b7280";
        const Icon = TOTA_TYPE_ICONS[point.type] || Building;

        const popupContent = (
          <div className="text-xs space-y-1.5 min-w-[180px]">
            <div className="flex items-center gap-1.5 font-bold text-sm text-gray-900 border-b pb-1.5 mb-1.5">
              <Icon className="w-4 h-4" style={{ color }} />
              {point.name || point.code}
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 font-medium">Typ:</span>
              <span style={{ color }} className="font-medium">
                {TOTA_TYPE_LABELS[point.type] || point.type}
              </span>
            </div>
            {point.code && (
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Ref:</span>
                <span className="font-mono text-gray-900">{point.code}</span>
              </div>
            )}
            {point.subtype && (
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Kategorie:</span>
                <span className="text-gray-900">{point.subtype}</span>
              </div>
            )}
            {point.usage && (
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Nutzung:</span>
                <span className="text-gray-900">{point.usage}</span>
              </div>
            )}
            {point.country && (
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Land:</span>
                <span className="text-gray-900">{point.country}</span>
              </div>
            )}
            {point.locator && (
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Locator:</span>
                <span className="font-mono text-gray-900">{point.locator}</span>
              </div>
            )}
            {point.height_m != null && (
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Höhe:</span>
                <span className="text-gray-900">{point.height_m} m</span>
              </div>
            )}
            {point.spot_height_m != null && (
              <div className="flex gap-2">
                <span className="text-gray-500 font-medium">Standort:</span>
                <span className="text-gray-900">{point.spot_height_m} m ü.M.</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-500 font-medium">Quelle:</span>
              <span className="text-gray-900">
                {point.source === "swiss_csv" ? "Schweiz (CSV)" : "wwtota.com"}
              </span>
            </div>
            <div className="text-gray-400 text-[10px] pt-1 border-t">
              {formatCoords(point.lat, point.lng)}
            </div>

            {point.code && point.source !== "swiss_csv" && (
              <div className="space-y-1 pt-1.5 border-t">
                <a
                  href={`https://wwtota.com/karta_rozhledny.php?ref=${encodeURIComponent(point.code)}&lang=de`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-white bg-orange-600 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-orange-700"
                >
                  🔗 TOTA Detailseite (wwtota.com)
                </a>
                <a
                  href={`https://wwtota.com/seznam/?lang=de`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-gray-700 bg-gray-100 rounded-lg px-2 py-1 text-xs font-medium hover:bg-gray-200"
                >
                  📋 Alle TOTA-Türme (Tabelle)
                </a>
              </div>
            )}

            {point.code && point.source === "swiss_csv" && (
              <div className="pt-1.5 border-t">
                <a
                  href={`https://wwtota.com/seznam/?lang=de`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-gray-700 bg-gray-100 rounded-lg px-2 py-1 text-xs font-medium hover:bg-gray-200"
                >
                  📋 TOTA-Türme auf wwtota.com
                </a>
              </div>
            )}

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-white bg-blue-600 rounded-lg px-2 py-1 text-xs font-medium hover:bg-blue-700 mt-1.5"
            >
              Navigation
            </a>
          </div>
        );

        if (performanceMode) {
          return (
            <CircleMarker
              key={point.id || idx}
              center={[point.lat, point.lng]}
              radius={5}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 2,
              }}
            >
              <DraggablePopup>{popupContent}</DraggablePopup>
            </CircleMarker>
          );
        }

        return (
          <Marker
            key={point.id || idx}
            position={[point.lat, point.lng]}
            icon={getTotaIcon(point.type, color)}
          >
            <DraggablePopup>{popupContent}</DraggablePopup>
          </Marker>
        );
      })}
    </>
  );
}