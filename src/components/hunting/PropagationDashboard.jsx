import React, { useState, useEffect, useCallback } from "react";
import { Sun, Activity, Radio, Zap, RefreshCw, Award } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Kompaktes Propagation Dashboard — Solar Flux zentral, K/A/MUF daneben,
// Band-Condition-Liste darunter. Auto-Refresh alle 5 Minuten.

const REFRESH_MS = 5 * 60 * 1000;

function conditionColor(condition) {
  switch (condition) {
    case 'Excellent': return { bg: 'bg-green-500', text: 'text-green-400', bar: 'bg-green-500' };
    case 'Good':      return { bg: 'bg-green-600', text: 'text-green-400', bar: 'bg-green-500' };
    case 'Fair':      return { bg: 'bg-yellow-500', text: 'text-yellow-400', bar: 'bg-yellow-500' };
    default:         return { bg: 'bg-red-500', text: 'text-red-400', bar: 'bg-red-500' };
  }
}

export default function PropagationDashboard() {
  const [propagation, setPropagation] = useState(null);
  const [bestBand, setBestBand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchProp = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await base44.functions.invoke("fetchPropagation", {});
      const data = res?.data || res;
      if (data?.propagation) {
        setPropagation(data.propagation);
        setBestBand(data.bestBand);
        setError(null);
      } else if (data?.error) {
        setError(data.error);
      }
    } catch (e) {
      setError("Propagation-Aktualisierung fehlgeschlagen");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProp();
    const interval = setInterval(() => fetchProp(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchProp]);

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Propagation wird geladen…</span>
        </div>
      </div>
    );
  }

  if (!propagation) {
    return (
      <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-gray-800">
        <p className="text-sm text-gray-500">{error || "Keine Propagation-Daten verfügbar"}</p>
        <button onClick={() => fetchProp(true)} className="mt-2 text-xs text-green-400 hover:underline">
          Erneut versuchen
        </button>
      </div>
    );
  }

  const bands = propagation.bands || [];

  return (
    <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header: Solar Flux zentral + K/A/MUF daneben */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
            <Sun className="w-4 h-4 text-yellow-400" /> Propagation
          </h2>
          <button
            onClick={() => fetchProp(true)}
            disabled={refreshing}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Solar Flux — grosse Zahl zentral */}
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold text-yellow-400 leading-none">
              {propagation.solar_flux ?? '—'}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Solar Flux</div>
          </div>

          {/* K-Index, A-Index, MUF — kleinere Felder */}
          <div className="grid grid-cols-3 gap-2 flex-1">
            <div className="text-center bg-black/30 rounded-lg py-1.5">
              <div className="text-lg font-semibold text-gray-200 leading-none">{propagation.k_index ?? '—'}</div>
              <div className="text-[9px] text-gray-500 mt-0.5">K-Index</div>
            </div>
            <div className="text-center bg-black/30 rounded-lg py-1.5">
              <div className="text-lg font-semibold text-gray-200 leading-none">{propagation.a_index ?? '—'}</div>
              <div className="text-[9px] text-gray-500 mt-0.5">A-Index</div>
            </div>
            <div className="text-center bg-black/30 rounded-lg py-1.5">
              <div className="text-lg font-semibold text-gray-200 leading-none">{propagation.muf ?? '—'}</div>
              <div className="text-[9px] text-gray-500 mt-0.5">MUF MHz</div>
            </div>
          </div>
        </div>
      </div>

      {/* Band-Condition-Liste */}
      <div className="p-3 space-y-1.5">
        {bands.map(b => {
          const colors = conditionColor(b.condition);
          const isBest = bestBand?.band === b.band && b.band !== '—';
          return (
            <div
              key={b.band}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                isBest ? "bg-green-900/30 border border-green-700/50" : ""
              }`}
            >
              {/* Bandname links */}
              <div className="w-12 text-sm font-mono font-medium text-gray-300 flex items-center gap-1">
                {b.band}
                {isBest && (
                  <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-green-400 bg-green-900/50 px-1 py-0.5 rounded">
                    <Award className="w-2.5 h-2.5" /> BEST
                  </span>
                )}
              </div>

              {/* Farbig Balken */}
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${colors.bar}`}
                  style={{ width: `${b.score || 0}%` }}
                />
              </div>

              {/* Condition-Text rechts */}
              <div className={`w-20 text-right text-xs font-medium ${colors.text}`}>
                {b.condition}
              </div>
              <div className="w-8 text-right text-[10px] text-gray-500 font-mono">
                {b.score}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: Quelle + Update-Zeit */}
      <div className="px-3 pb-2 flex items-center justify-between text-[9px] text-gray-600">
        <span className="flex items-center gap-1">
          <Activity className="w-2.5 h-2.5" /> {propagation.source || 'NOAA SWPC'}
        </span>
        <span>Auto-Refresh alle 5 Min</span>
      </div>
    </div>
  );
}