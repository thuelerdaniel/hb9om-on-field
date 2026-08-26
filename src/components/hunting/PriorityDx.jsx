import React, { useState, useEffect, useCallback } from "react";
import { Navigation, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Priority DX — Top 5 Spots nach Distanz.
// Zeigt Flag + Call, Freq + Mode, Distanz + Azimuth. Klickbar → Details.

export default function PriorityDx({ spots, onSpotDetails }) {
  const top5 = (spots || [])
    .filter(s => s.distance > 0)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 5);

  if (top5.length === 0) return null;

  return (
    <div className="bg-[#0d1720] border border-[#1d3442] rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-[#1d3442]">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-[#ff9800]" /> PRIORITY DX
        </h2>
      </div>
      <div className="divide-y divide-[#1d3442]/50">
        {top5.map((spot, i) => (
          <button
            key={spot.id || i}
            onClick={() => onSpotDetails?.(spot)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#050b10] transition-colors text-left"
          >
            <span className="text-[10px] font-bold text-[#9aa7b0] w-4">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white truncate">{spot.call}</span>
                {spot.country && <span className="text-[10px] text-[#9aa7b0] truncate">{spot.country}</span>}
              </div>
              <div className="text-[10px] text-[#9aa7b0]">
                {(spot.frequency / 1000).toFixed(3)} MHz · {spot.mode || '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-[#ff9800]">{spot.distance} km</div>
              <div className="text-[10px] text-[#9aa7b0]">{spot.azimuth}°</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}