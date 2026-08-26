import React, { useState, useEffect, useCallback } from "react";
import { Radio, RefreshCw, Clock, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Live DX Spots Liste — scrollbar, Auto-Refresh alle 30 Sekunden.
// Alter farbcodiert: grün <60s, gelb <300s, rot >300s.

const REFRESH_MS = 30 * 1000;

function ageColor(age) {
  if (age == null) return 'text-gray-500';
  if (age < 60) return 'text-green-400';
  if (age < 300) return 'text-yellow-400';
  return 'text-red-400';
}

function ageText(age) {
  if (age == null) return '—';
  if (age < 60) return `${age}s`;
  if (age < 3600) return `${Math.floor(age / 60)}m`;
  return `${Math.floor(age / 3600)}h`;
}

function formatFreq(kHz) {
  if (!kHz) return '—';
  return `${(kHz / 1000).toFixed(3)} MHz`;
}

export default function DxSpotList({ onCallClick, onLogQso }) {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState(null);

  const fetchSpots = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // Erst Spots vom Backend holen (Entity), dann ggf. neue laden
      const res = await base44.functions.invoke("fetchDxSpots", {});
      const data = res?.data || res;
      if (data?.spots) {
        setSpots(data.spots);
        setWarning(data.warning || null);
      } else if (data?.error) {
        setWarning(data.error);
      }
    } catch (e) {
      // Fallback: lade direkt aus Entity
      try {
        const list = await base44.entities.DxSpot.list('-spot_time', 30);
        setSpots(list || []);
      } catch {
        setWarning("Spots konnten nicht geladen werden");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSpots();
    const interval = setInterval(() => fetchSpots(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchSpots]);

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">DX-Spots werden geladen…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-green-400" /> Live DX-Spots
          <span className="text-[10px] text-gray-500 font-normal">({spots.length})</span>
        </h2>
        <button
          onClick={() => fetchSpots(true)}
          disabled={refreshing}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Warning */}
      {warning && (
        <div className="px-3 py-1.5 bg-yellow-900/20 border-b border-yellow-900/30 text-[10px] text-yellow-500">
          {warning}
        </div>
      )}

      {/* Spot-Liste — scrollbar */}
      <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-800/50">
        {spots.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-600">
            Keine DX-Spots verfügbar. Die DX-Summit-API ist möglicherweise gerade nicht erreichbar.
          </div>
        ) : (
          spots.map((spot, i) => {
            const age = spot.age_seconds;
            return (
              <div
                key={spot.id || i}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800/30 transition-colors"
              >
                {/* Call — fett, klickbar */}
                <button
                  onClick={() => onCallClick?.(spot.call)}
                  className="text-sm font-bold text-green-400 hover:text-green-300 hover:underline truncate min-w-0"
                >
                  {spot.call}
                </button>

                {/* Frequenz */}
                <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                  {formatFreq(spot.frequency)}
                </span>

                {/* Band */}
                <span className="text-[10px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {spot.band}
                </span>

                {/* Mode */}
                {spot.mode && spot.mode !== 'Unknown' && (
                  <span className="text-[10px] text-blue-400 whitespace-nowrap">{spot.mode}</span>
                )}

                {/* Country */}
                {spot.country && (
                  <span className="text-[10px] text-gray-500 truncate flex-1 min-w-0">{spot.country}</span>
                )}

                {/* Alter */}
                <span className={`text-[10px] font-mono whitespace-nowrap ${ageColor(age)}`}>
                  <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                  {ageText(age)}
                </span>

                {/* Log QSO Button */}
                <button
                  onClick={() => onLogQso?.(spot)}
                  className="flex-shrink-0 inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-green-900/40 text-green-400 hover:bg-green-800/60 text-[10px] font-medium transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" /> Log
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-800 text-[9px] text-gray-600 flex items-center justify-between">
        <span>Quelle: DX Summit</span>
        <span>Auto-Refresh alle 30s</span>
      </div>
    </div>
  );
}