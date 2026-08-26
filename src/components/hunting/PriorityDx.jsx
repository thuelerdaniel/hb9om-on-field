import React from "react";
import { Navigation } from "lucide-react";

// Priority DX — Top 5 Spots nach Distanz. Theme-aware.
// Zeigt Flag + Call, Freq + Mode, Distanz + Azimuth. Klickbar → Details.

export default function PriorityDx({ spots, onSpotDetails }) {
  const top5 = (spots || [])
    .filter(s => s.distance > 0)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 5);

  if (top5.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Navigation className="w-3.5 h-3.5 text-[#ff9800]" /> PRIORITY DX
        </h2>
      </div>
      <div className="divide-y divide-border/50">
        {top5.map((spot, i) => (
          <button
            key={spot.id || i}
            onClick={() => onSpotDetails?.(spot)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
          >
            <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
            {spot.countryCode && <span className="text-base leading-none">{spot.countryCode}</span>}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground truncate">{spot.call}</span>
                {spot.country && <span className="text-[10px] text-muted-foreground truncate">{spot.country}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {(spot.frequency / 1000).toFixed(3)} MHz · {spot.mode || '—'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-[#ff9800]">{spot.distance} km</div>
              <div className="text-[10px] text-muted-foreground">{spot.azimuth}°</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}