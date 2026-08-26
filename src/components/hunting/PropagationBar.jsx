import React, { useState, useEffect, useCallback } from "react";
import { Sun, RefreshCw, Activity } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Propagation Bar — vollbreit, kompakt. SHACK-SERVER Style.
// Links: Solar Flux + K/A-Index. Mitte: SVG Band-Graph. Rechts: Station Info.

const REFRESH_MS = 5 * 60 * 1000;

function scoreColor(score) {
  if (score >= 80) return '#8cff00';
  if (score >= 60) return '#00e5ff';
  if (score >= 40) return '#ffc400';
  return '#ff5252';
}

export default function PropagationBar({ stationInfo }) {
  const [prop, setProp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProp = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await base44.functions.invoke("fetchPropagation", {});
      const data = res?.data || res;
      if (data?.propagation) setProp(data.propagation);
    } catch {} finally {
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
      <div className="bg-[#0d1720] border border-[#1d3442] rounded-xl p-4 flex items-center gap-2 text-[#9aa7b0]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Propagation wird geladen…</span>
      </div>
    );
  }

  if (!prop) return null;

  const bands = prop.bands || [];

  return (
    <div className="bg-[#0d1720] border border-[#1d3442] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1d3442]">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-[#ffc400]" /> Propagation Overview
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#9aa7b0]">Auto-Refresh 5 Min</span>
          <button onClick={() => fetchProp(true)} disabled={refreshing} className="text-[#9aa7b0] hover:text-white">
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Body: 3 Spalten auf Desktop, gestapelt auf Mobile */}
      <div className="p-3 flex flex-col sm:flex-row gap-3">
        {/* Links: Solar Flux + K/A */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-[#00e5ff] leading-none">{prop.solar_flux ?? '—'}</div>
            <div className="text-[9px] text-[#9aa7b0] uppercase">Solar Flux</div>
          </div>
          <div className="flex gap-2">
            <div className="text-center">
              <div className="text-sm font-semibold text-white">{prop.k_index ?? '—'}</div>
              <div className="text-[8px] text-[#9aa7b0]">K</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-white">{prop.a_index ?? '—'}</div>
              <div className="text-[8px] text-[#9aa7b0]">A</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-white">{prop.muf ?? '—'}</div>
              <div className="text-[8px] text-[#9aa7b0]">MUF</div>
            </div>
          </div>
        </div>

        {/* Mitte: SVG Band-Graph */}
        <div className="flex-1 min-w-0">
          <svg viewBox="0 0 300 120" className="w-full h-auto" preserveAspectRatio="none">
            {/* Balken */}
            {bands.map((b, i) => {
              const barHeight = (b.score / 100) * 90;
              const x = i * (300 / bands.length) + 4;
              const barW = (300 / bands.length) - 8;
              const y = 100 - barHeight;
              const color = scoreColor(b.score);
              return (
                <g key={b.band}>
                  <rect x={x} y={y} width={barW} height={barHeight} fill={color} rx={2} opacity={0.85} />
                  <text x={x + barW / 2} y={115} textAnchor="middle" fontSize="7" fill="#9aa7b0">{b.band}</text>
                  <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize="6" fill={color}>{b.score}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Rechts: Station Info */}
        <div className="sm:text-right">
          <div className="text-xs font-bold text-white">{stationInfo?.callsign || '—'}</div>
          <div className="text-[10px] text-[#9aa7b0]">{stationInfo?.locator || '—'}</div>
          <div className="text-[10px] text-[#9aa7b0]">{stationInfo?.name || ''}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 flex items-center justify-between text-[8px] text-[#9aa7b0]">
        <span className="flex items-center gap-1">
          <Activity className="w-2.5 h-2.5" /> {prop.source || 'NOAA SWPC'}
        </span>
      </div>
    </div>
  );
}