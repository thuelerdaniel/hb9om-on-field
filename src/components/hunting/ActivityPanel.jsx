import React, { useState, useEffect, useCallback } from "react";
import { Mountain, TreePine, RefreshCw, FileText, MapPin, CalendarClock, Filter, ChevronDown, X, Building2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Activity Panel — v0.9010: Zeigt alle Aktivitaets-Typen (SOTA, POTA, WWFF, WWBOTA, GMA, Alerts).
// Tabs pro Typ, Band-Filter, manueller Refresh.
// Fix 6: Lesbare Farben (#16a34a statt #8cff00 fuer Text).

const REFRESH_MS = 60 * 1000;
const BAND_OPTIONS = ['All', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '2m', '70cm'];

const TABS = [
  { id: 'SOTA', label: 'SOTA', icon: Mountain, color: '#d97706' },
  { id: 'POTA', label: 'POTA', icon: TreePine, color: '#16a34a' },
  { id: 'WWFF', label: 'WWFF', icon: TreePine, color: '#0d9488' },
  { id: 'WWBOTA', label: 'WWBOTA', icon: Building2, color: '#dc2626' },
  { id: 'GMA', label: 'GMA', icon: Mountain, color: '#7c3aed' },
  { id: 'ALERTS', label: 'Alerts', icon: CalendarClock, color: '#0284c7' },
];

function ageColor(age) {
  if (age == null) return 'hsl(var(--muted-foreground))';
  if (age < 300) return '#16a34a';
  if (age < 900) return '#d97706';
  return '#dc2626';
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
  const [activities, setActivities] = useState({ sota: [], pota: [], wwff: [], wwbota: [], gma: [], alerts: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('SOTA');
  const [filterOpen, setFilterOpen] = useState(false);
  const [bandFilter, setBandFilter] = useState('All');

  useEffect(() => { return () => setFilterOpen(false); }, []);

  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await base44.functions.invoke("getActivities", { include_future: true });
      const data = res?.data || res;
      if (data?.success) {
        setActivities({
          sota: data.sota || [],
          pota: data.pota || [],
          wwff: data.wwff || [],
          wwbota: data.wwbota || [],
          gma: data.gma || [],
          alerts: data.alerts || [],
          total: data.total || 0,
        });
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(() => fetchActivities(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  const tabKey = tab.toLowerCase();
  const activeSpots = activities[tabKey] || [];
  const spots = bandFilter === 'All' ? activeSpots : activeSpots.filter(s => s.band === bandFilter);
  const currentTab = TABS.find(t => t.id === tab) || TABS[0];
  const accentColor = currentTab.color;
  const Icon = currentTab.icon;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} /> ACTIVE ACTIVATIONS
          <span className="text-[10px] text-muted-foreground font-normal">({activities.total})</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors ${
                bandFilter !== 'All'
                  ? "bg-foreground/10 text-foreground border-foreground/30"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
              title="Band-Filter"
            >
              <Filter className="w-3 h-3" />
              {bandFilter === 'All' ? 'Alle' : bandFilter}
              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
            </button>
            {filterOpen && (
              <>
                <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
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
                          ? 'bg-foreground/10 text-foreground font-bold'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      {b === 'All' ? 'Alle' : b}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => fetchActivities(true)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Aktivierungen aktualisieren"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs — scrollable for all activity types */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map(t => {
          const count = (activities[t.id.toLowerCase()] || []).length;
          const TabIcon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                tab === t.id
                  ? "bg-foreground/5 text-foreground border-b-2"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={tab === t.id ? { borderBottomColor: t.color, color: t.color } : {}}
            >
              <TabIcon className="w-3 h-3" /> {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="max-h-[40vh] overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> Aktivierungen werden geladen…
          </div>
        ) : spots.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Keine {tab}-Aktivierungen.
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
                  <span className="text-[7px] px-1 rounded bg-[#0284c7]/20 text-[#0284c7] font-bold flex-shrink-0">GEPLANT</span>
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
                {spot.frequency > 0 && (
                  <span className="text-[#0284c7] font-mono">{formatFreq(spot.frequency)}</span>
                )}
                <span className="text-muted-foreground">{spot.mode || '—'}</span>
                {spot.distance > 0 && (
                  <span className="text-muted-foreground font-mono">{spot.distance} km · {spot.azimuth}°</span>
                )}
                {spot.is_future && spot.spot_time && (
                  <span className="text-[#0284c7] font-mono ml-auto">
                    {new Date(spot.spot_time).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
                  </span>
                )}
                {!spot.is_future && (
                  <span className="ml-auto font-mono" style={{ color: ageColor(spot.age_seconds) }}>
                    {ageText(spot.age_seconds)}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onLogQso?.(spot); }}
                  className="text-muted-foreground hover:text-foreground flex-shrink-0"
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
          {gpsPos ? <MapPin className="w-2 h-2 text-[#16a34a]" /> : null}
          {tab}: {spots.length}
        </span>
      </div>
    </div>
  );
}