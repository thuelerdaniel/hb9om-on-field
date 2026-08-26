import React, { useState, useEffect, useCallback } from "react";
import { Target, Radio, Crosshair, Bell, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Command Strip — 4 Info-Kästchen oben: DX Opportunity, Best Band, Station Ready, Opportunities.
// Theme-aware: bg-card, border-border, text-foreground, text-muted-foreground.

const PANEL = "bg-card border border-border rounded-xl";
const LABEL = "text-[9px] text-muted-foreground uppercase tracking-wider font-semibold";
const VALUE = "text-sm font-bold text-foreground truncate";

export default function CommandStrip({ spots, propagation, stationInfo }) {
  const [worked, setWorked] = useState(null);

  const loadWorked = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("getWorkedStatus", {});
      const data = res?.data || res;
      if (data?.worked) setWorked(data.worked);
    } catch {}
  }, []);

  useEffect(() => { loadWorked(); }, [loadWorked]);

  // DX Opportunity = weitester Spot
  const farthest = spots?.length > 0
    ? spots.reduce((max, s) => (s.distance > max.distance ? s : max), spots[0])
    : null;

  // Best Band
  const bestBand = propagation?.bands?.length > 0
    ? propagation.bands.reduce((best, b) => (b.score > best.score ? b : best), propagation.bands[0])
    : null;

  // Opportunities = Anzahl Spots
  const oppCount = spots?.length || 0;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {/* DX Opportunity */}
      <div className={`${PANEL} p-2.5`}>
        <div className="flex items-center gap-1 mb-1">
          <Target className="w-3 h-3 text-[#00e5ff]" />
          <span className={LABEL}>DX Opportunity</span>
        </div>
        {farthest ? (
          <>
            <div className={VALUE}>{farthest.call}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {farthest.distance > 0 ? `${farthest.distance.toLocaleString()} km` : '— km'}
              {farthest.azimuth > 0 && ` · ${farthest.azimuth}°`}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">—</div>
        )}
      </div>

      {/* Best Band */}
      <div className={`${PANEL} p-2.5`}>
        <div className="flex items-center gap-1 mb-1">
          <Radio className="w-3 h-3 text-[#8cff00]" />
          <span className={LABEL}>Best Band</span>
        </div>
        {bestBand ? (
          <>
            <div className={VALUE}>{bestBand.band}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {bestBand.condition} · {bestBand.score}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">—</div>
        )}
      </div>

      {/* Station Ready */}
      <div className={`${PANEL} p-2.5`}>
        <div className="flex items-center gap-1 mb-1">
          <Crosshair className="w-3 h-3 text-[#ffc400]" />
          <span className={LABEL}>Station Ready</span>
        </div>
        {stationInfo ? (
          <>
            <div className={VALUE}>{stationInfo.callsign || '—'}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {stationInfo.locator || '—'} · {stationInfo.name || ''}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">—</div>
        )}
      </div>

      {/* Opportunities */}
      <div className={`${PANEL} p-2.5`}>
        <div className="flex items-center gap-1 mb-1">
          <Bell className="w-3 h-3 text-[#ff9800]" />
          <span className={LABEL}>Opportunities</span>
        </div>
        <div className={VALUE}>{oppCount}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {worked ? `${worked.calls?.length || 0} worked` : 'spots'}
        </div>
      </div>
    </div>
  );
}