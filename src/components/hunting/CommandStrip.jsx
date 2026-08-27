import React, { useState, useEffect, useCallback } from "react";
import { Target, Radio, Crosshair, Bell, Loader2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { latLngToGrid } from "@/lib/geoUtilsFrontend";
import StationLocatorDialog from "@/components/hunting/StationLocatorDialog";

// Command Strip — 4 Info-Kästchen oben: DX Opportunity, Best Band, Station Ready, Opportunities.
// Theme-aware: bg-card, border-border, text-foreground, text-muted-foreground.

const PANEL = "bg-card border border-border rounded-xl";
const LABEL = "text-[9px] text-muted-foreground uppercase tracking-wider font-semibold";
const VALUE = "text-sm font-bold text-foreground truncate";

export default function CommandStrip({ spots, propagation, stationInfo, gpsPos, onLocatorSave, onDxClick }) {
  const [worked, setWorked] = useState(null);
  const [showLocatorDialog, setShowLocatorDialog] = useState(false);
  const [savedLocator, setSavedLocator] = useState(() => localStorage.getItem('station_locator') || '');

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
      {/* DX Opportunity — klickbar: scrollt zum Spot in der Tabelle */}
      <div
        className={`${PANEL} p-2.5 cursor-pointer hover:border-[#00e5ff] hover:bg-[#00e5ff]/5 transition-all`}
        onClick={() => farthest && onDxClick?.(farthest)}
        title="Klicken um zum Spot in der Tabelle zu springen"
      >
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

      {/* Station Ready — klickbar für Locator-Dialog */}
      <div className={`${PANEL} p-2.5 cursor-pointer hover:border-[#8cff00] transition-colors`} onClick={() => setShowLocatorDialog(true)}>
        <div className="flex items-center gap-1 mb-1">
          <Crosshair className={`w-3 h-3 ${gpsPos ? 'text-[#8cff00]' : 'text-[#ffc400]'}`} />
          <span className={LABEL}>Station Ready</span>
          {gpsPos && <MapPin className="w-2.5 h-2.5 text-[#8cff00] animate-pulse" />}
        </div>
        {stationInfo ? (
          <>
            <div className={VALUE}>{stationInfo.callsign || '—'}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {gpsPos ? (
                <>
                  <span className="text-[#8cff00] font-semibold">📍 GPS aktiv</span>
                  <br />
                  <span className="text-[9px] font-mono">{gpsPos.lat.toFixed(4)}°, {gpsPos.lng.toFixed(4)}°</span>
                  <br />
                  <span className="text-[9px]">GPS · {latLngToGrid(gpsPos.lat, gpsPos.lng)}</span>
                  {gpsPos.accuracy && <span className="text-[9px] text-muted-foreground"> ±{Math.round(gpsPos.accuracy)}m</span>}
                </>
              ) : (
                <>
                  <span className="text-[#ffc400] font-semibold">📍 Locator: {savedLocator || stationInfo.locator || '—'} (manuell)</span>
                  <br />
                  <span className="text-[9px]">{stationInfo.name || ''}</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">— Klick zum Eingeben —</div>
        )}
      </div>

      {/* Station Locator Dialog */}
      {showLocatorDialog && (
        <StationLocatorDialog
          currentLocator={savedLocator || stationInfo?.locator || ''}
          onClose={() => setShowLocatorDialog(false)}
          onSave={(locator) => {
            setSavedLocator(locator);
            localStorage.setItem('station_locator', locator);
            try { base44.auth.updateMe({ station_locator: locator }); } catch {}
            onLocatorSave?.(locator);
            setShowLocatorDialog(false);
          }}
        />
      )}

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