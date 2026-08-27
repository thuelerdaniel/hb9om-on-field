import React, { useState, useEffect, useCallback } from "react";
import { Mountain, TreePine, RefreshCw, FileText, MapPin, CalendarClock, Globe, AlertCircle, Filter, ChevronDown, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Activity Panel — zeigt aktive SOTA- und POTA-Aktivierungen.
// Zwei Tabs: SOTA (orange) und POTA (grün).
// Fix 7: Band-Filter Dropdown mit Backdrop — schliesst sauber bei Aussenklick.
// Theme-aware: bg-card, border-border, text-foreground.

const REFRESH_MS = 60 * 1000;

const BAND_OPTIONS = ['All', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '2m', '70cm'];

function ageColor(age) {
  if (age == null) return 'hsl(var(--muted-foreground))';
  if (age < 300) return '#8cff00';
  if (age < 900) return '#ffc400';
  return '#ff5252';
}

function ageText(age) {
  if (age == null) return '—';
  if (age < 60) return `${age}s`;
  if (age < 3600) return `${Math.floor(age / 60)}m`;
  return `${Math.floor(age / 3600)}h`;
}

function formatFreq(kHz) {
  if (!kHz) return '—';
  return `${(kHz / 1000).toFixed(3)}`;
}

export default function ActivityPanel({ onLogQso, onSpotDetails, gpsPos }) {
  const [activities, setActivities] = useState({ sota: [], pota: [], futureSota: [], futurePota: [], total: 0, futureTotal: 0 });
  const [sotaScheduledAvailable, setSotaScheduledAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('SOTA');
  const [showFuture, setShowFuture] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [bandFilter, setBandFilter] = useState('All');

  // Fix 7C: Cleanup — Dropdown schliessen beim Verlassen der Komponente
  useEffect(() => { return () => setFilterOpen(false); }, []);

  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await base44.functions.invoke("getActivities", { include_future: showFuture });
      const data = res?.data || res;
      if (data?.success) {
        setActivities({
          sota: data.sota || [],
          pota: data.pota || [],
          futureSota: data.futureSota || [],
          futurePota: data.futurePota || [],
          total: data.total || 0,
          futureTotal: data.futureTotal || 0,
        });
        setSotaScheduledAvailable(data.sotaScheduledAvailable !== false);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showFuture]);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(() => fetchActivities(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  // Fix 3: Sofortiger Refresh wenn showFuture wechselt — nicht erst beim Tab-Wechsel
  useEffect(() => {
    if (!loading) fetchActivities(true);
  }, [showFuture]);

  const activeSpots = tab === 'SOTA' ? activities.sota : activities.pota;
  const futureSpots = tab === 'SOTA' ? activities.futureSota : activities.futurePota;
  const allSpots = showFuture ? [...activeSpots, ...futureSpots] : activeSpots;
  // Fix 7: Band-Filter anwenden
  const spots = bandFilter === 'All' ? allSpots : allSpots.filter(s => s.band === bandFilter);
  const accentColor = tab === 'SOTA' ? '#ff9800' : '#8cff00';
  const Icon = tab === 'SOTA' ? Mountain : TreePine;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} /> ACTIVE ACTIVATIONS
          <span className="text-[10px] text-muted-foreground font-normal">({activities.total})</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setShowFuture(!showFuture); }}
            className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors ${
              showFuture
                ? "bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/30"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
            title="Zukünftige Aktivierungen ein-/ausblenden (sofortiger Refresh)"
          >
            <CalendarClock className="w-3 h-3" />
            {showFuture ? "Aktiv + Geplant" : "Geplante"}
          </button>
          {/* Fix 7: Band-Filter Dropdown mit Backdrop */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors ${
                bandFilter !== 'All'
                  ? "bg-[#ff9800]/10 text-[#ff9800] border-[#ff9800]/30"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
              title="Band-Filter"
            >
              <Filter className="w-3 h-3" />
              {bandFilter === 'All' ? 'Alle Bänder' : bandFilter}
              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
            {filterOpen && (
              <>
                {/* Fix 7A: Backdrop — klicken schliesst Dropdown */}
                <div
                  onClick={() => setFilterOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                />
                {/* Fix 7B: Dropdown — z-index 9999, onClick statt onTouchEnd */}
                <div
                  className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-2xl min-w-[120px] max-h-[200px] overflow-y-auto"
                  style={{ zIndex: 9999 }}
                >
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-border sticky top-0 bg-card">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">Band</span>
                    <button onClick={() => setFilterOpen(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {BAND_OPTIONS.map(b => (
                    <button
                      key={b}
                      onClick={() => { setBandFilter(b); setFilterOpen(false); }}
                      className={`w-full text-left px-2 py-1.5 text-[10px] transition-colors ${
                        bandFilter === b
                          ? 'bg-[#ff9800]/10 text-[#ff9800] font-bold'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {b === 'All' ? 'Alle Bänder' : b}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Fix 3: Manueller Refresh-Button — lädt auch geplante Aktivitäten neu */}
          <button
            onClick={() => fetchActivities(true)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Aktivierungen aktualisieren (inkl. geplante)"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab('SOTA')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'SOTA'
              ? "bg-[#ff9800]/10 text-[#ff9800] border-b-2 border-[#ff9800]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mountain className="w-3 h-3" /> SOTA ({activities.sota.length})
        </button>
        <button
          onClick={() => setTab('POTA')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            tab === 'POTA'
              ? "bg-[#8cff00]/10 text-[#8cff00] border-b-2 border-[#8cff00]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <TreePine className="w-3 h-3" /> POTA ({activities.pota.length})
        </button>
      </div>

      {/* SOTA scheduled API unavailable warning */}
      {showFuture && tab === 'SOTA' && !sotaScheduledAvailable && (
        <div className="px-3 py-1.5 bg-[#ff9800]/10 border-b border-[#ff9800]/20 text-[9px] text-[#ff9800] flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          SOTA-Scheduled-API nicht verfügbar — nur POTA-Geplant verfügbar.
        </div>
      )}

      {/* List */}
      <div className="max-h-[40vh] overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> Aktivierungen werden geladen…
          </div>
        ) : spots.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Keine {showFuture ? 'aktiven oder geplanten' : 'aktiven'} {tab}-Aktivierungen.
          </div>
        ) : (
          spots.map((spot, i) => (
            <div
              key={spot.id || i}
              className="px-3 py-2 border-b border-border/50 hover:bg-muted cursor-pointer"
              onClick={() => onSpotDetails?.(spot)}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm truncate flex-1">{spot.call}</span>
                {spot.is_future && (
                  <span className="text-[7px] px-1 rounded bg-[#00e5ff]/20 text-[#00e5ff] font-bold flex-shrink-0">GEPLANT</span>
                )}
                {spot.reference && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                    style={{ background: `${accentColor}20`, color: accentColor }}
                  >
                    {spot.reference}
                  </span>
                )}
              </div>
              {spot.name && (
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">{spot.name}</div>
              )}
              <div className="flex items-center gap-2 mt-1 text-[10px]">
                <span className="text-[#00e5ff] font-mono">{formatFreq(spot.frequency)}</span>
                <span className="text-muted-foreground">{spot.mode || '—'}</span>
                {spot.distance > 0 && (
                  <span className="text-muted-foreground font-mono">{spot.distance} km · {spot.azimuth}°</span>
                )}
                <span className="ml-auto font-mono" style={{ color: ageColor(spot.age_seconds) }}>
                  {ageText(spot.age_seconds)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onSpotDetails?.(spot); }}
                  className="text-muted-foreground hover:text-[#00e5ff] flex-shrink-0"
                  title="Auf Globus/Karte zeigen"
                >
                  <Globe className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onLogQso?.(spot); }}
                  className="text-muted-foreground hover:text-[#8cff00] flex-shrink-0"
                  title="Log QSO"
                >
                  <FileText className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border text-[8px] text-muted-foreground flex justify-between">
        <span>Auto-Refresh 60s</span>
        <span className="flex items-center gap-1">
          {gpsPos ? <MapPin className="w-2 h-2 text-[#8cff00]" /> : null}
          {tab}: {spots.length}
        </span>
      </div>
    </div>
  );
}