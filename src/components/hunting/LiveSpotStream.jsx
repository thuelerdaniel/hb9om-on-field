import React, { useState, useEffect, useRef, useCallback } from "react";
import { Radio, RefreshCw, Pause, Play, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Spothole Live Spot Stream — polls Spothole API every 30 seconds for real-time spots.
// Since Base44 backend functions cannot maintain SSE connections, this uses fast polling
// via the fetchSpotholeSpots backend function and presents results as a live stream.
//
// Features:
// - Auto-refresh every 30s (toggleable)
// - Shows newest spots first with age indicator
// - Color-coded by activity type (SOTA/POTA/WWFF/DX)
// - Click spot to log QSO
// - Max 100 spots displayed (older ones scroll away)

const POLL_INTERVAL_MS = 30000;
const MAX_DISPLAYED = 100;
const SPOT_EXPIRY_MINUTES = 30;

const ACTIVITY_COLORS = {
  SOTA: "#e74c3c",
  POTA: "#27ae60",
  WWFF: "#8e44ad",
  GMA: "#f39c12",
  DX: "#3b82f6",
};

function formatAge(spotTime) {
  if (!spotTime) return "";
  const ageMs = Date.now() - new Date(spotTime).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  if (ageMin < 1) return "gerade eben";
  if (ageMin < 60) return `vor ${ageMin} Min`;
  const ageH = Math.floor(ageMin / 60);
  return `vor ${ageH}h ${ageMin % 60}Min`;
}

export default function LiveSpotStream({ onSpotClick, gpsPos }) {
  const [spots, setSpots] = useState([]);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchSpots = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("fetchSpotholeSpots", {
        skip_cluster: false,
        skip_solar: true,
      });
      const data = res?.data || res;

      // Fetch recent ActivitySpot records (populated by fetchSpotholeSpots)
      const recent = await base44.entities.ActivitySpot.list("-spot_time", 100);
      const now = Date.now();
      const fresh = (recent || [])
        .filter(s => {
          if (!s.spot_time) return false;
          const ageMin = (now - new Date(s.spot_time).getTime()) / 60000;
          return ageMin < SPOT_EXPIRY_MINUTES;
        })
        .map(s => ({
          id: s.id,
          call: s.call,
          activity_type: s.activity_type,
          reference: s.reference,
          name: s.name,
          frequency: s.frequency,
          band: s.band,
          mode: s.mode,
          comments: s.comments,
          spotter: s.spotter,
          spot_time: s.spot_time,
          source: s.source,
          latitude: s.latitude,
          longitude: s.longitude,
        }));

      setSpots(fresh.slice(0, MAX_DISPLAYED));
      setLastUpdate(new Date().toISOString());
    } catch (e) {
      setError(e.message || "Fehler beim Laden der Spots");
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchSpots();
    if (isLive) {
      intervalRef.current = setInterval(fetchSpots, POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSpots, isLive]);

  const handleToggleLive = () => {
    setIsLive(prev => !prev);
  };

  const handleClear = () => {
    setSpots([]);
  };

  return (
    <div className="bg-[#0d0d0d] border border-[#222] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#111] border-b border-[#222]">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${isLive ? "text-green-400 animate-pulse" : "text-gray-500"}`} />
          <span className="text-sm font-medium text-gray-200">Live Spot Stream</span>
          {isLive && (
            <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToggleLive}
            className="p-1.5 rounded hover:bg-[#222] text-gray-400 hover:text-gray-200"
            title={isLive ? "Pause" : "Live starten"}
          >
            {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={fetchSpots}
            className={`p-1.5 rounded hover:bg-[#222] text-gray-400 hover:text-gray-200 ${isFetching ? "animate-spin" : ""}`}
            title="Aktualisieren"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 rounded hover:bg-[#222] text-gray-400 hover:text-gray-200"
            title="Liste leeren"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1.5 bg-[#0a0a0a] border-b border-[#1a1a1a] flex items-center justify-between text-[10px] text-gray-500">
        <span>{spots.length} Spots</span>
        <span>{lastUpdate ? `Aktualisiert: ${formatAge(lastUpdate)}` : ""}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Spot list */}
      <div className="max-h-[400px] overflow-y-auto">
        {spots.length === 0 && !isFetching && (
          <div className="px-3 py-8 text-center text-gray-500 text-sm">
            Keine aktiven Spots in den letzten {SPOT_EXPIRY_MINUTES} Minuten
          </div>
        )}
        {spots.map((spot, i) => {
          const color = ACTIVITY_COLORS[spot.activity_type] || ACTIVITY_COLORS.DX;
          return (
            <div
              key={spot.id || i}
              onClick={() => onSpotClick?.(spot)}
              className="flex items-start gap-2 px-3 py-2 border-b border-[#1a1a1a] hover:bg-[#1a1a1a] cursor-pointer transition-colors"
            >
              {/* Color indicator */}
              <div
                className="w-1 h-full min-h-[32px] rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-gray-200">{spot.call}</span>
                  <span
                    className="text-[9px] px-1 py-0.5 rounded font-medium"
                    style={{ backgroundColor: color + "22", color }}
                  >
                    {spot.activity_type}
                  </span>
                  {spot.reference && (
                    <span className="text-[10px] text-gray-400">{spot.reference}</span>
                  )}
                </div>
                {spot.name && (
                  <div className="text-[10px] text-gray-500 truncate mt-0.5">{spot.name}</div>
                )}
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                  {spot.frequency > 0 && <span>{(spot.frequency / 1000).toFixed(3)} MHz</span>}
                  {spot.mode && <span>{spot.mode}</span>}
                  <span>{formatAge(spot.spot_time)}</span>
                </div>
                {spot.comments && (
                  <div className="text-[9px] text-gray-600 mt-0.5 line-clamp-1">{spot.comments}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}