import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Mountain, TreePine, RefreshCw, FileText, MapPin, CalendarClock, Filter, ChevronDown, X, Building2, Info, Layers, ArrowUpDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PotaParkInfoPopup from "@/components/hunting/PotaParkInfoPopup";
import { calcHearScore, scoreColor } from "@/lib/hearScore";
import { maidenheadToLatLon, haversine, bearing } from "@/lib/geoUtilsFrontend";
import { isQRT, getFlagImg, getReferenceUrl } from "@/lib/spotUtils";

// Activity Panel — v0.9011:
// Fix 9: Sortierung nach Zeit oder Verbindungswahrscheinlichkeit
// Fix 15: Landesfahne neben Callsign
// Fix 16: Referenz klickbar zu Web-Info
// Fix 17: Alerts mit Typ-Markierung (farbige Badges)
// Fix 18: GMA-Tab ersetzt durch "Weitere"

const REFRESH_MS = 60 * 1000;
const BAND_OPTIONS = ['All', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '2m', '70cm'];

// Fix 18: GMA-Tab ersetzt durch "Weitere"
const TABS = [
  { id: 'SOTA', label: 'SOTA', icon: Mountain, color: '#d97706' },
  { id: 'POTA', label: 'POTA', icon: TreePine, color: '#16a34a' },
  { id: 'WWFF', label: 'WWFF', icon: TreePine, color: '#0d9488' },
  { id: 'WWBOTA', label: 'WWBOTA', icon: Building2, color: '#dc2626' },
  { id: 'OTHER', label: 'Weitere', icon: Layers, color: '#7c3aed' },
  { id: 'ALERTS', label: 'Alerts', icon: CalendarClock, color: '#0284c7' },
];

// Fix 17: Alert-Typ Farben
const ALERT_TYPE_COLORS = {
  SOTA: '#e8820c',
  POTA: '#1a9c7c',
  WWFF: '#4fd1c5',
  WWBOTA: '#d8443c',
  WCA: '#8b5cf6',
  COTA: '#ec4899',
  IOTA: '#06b6d4',
  GMA: '#7c3aed',
  TOTA: '#f97316',
  LOTA: '#a855f7',
  MOTA: '#6366f1',
  HEMA: '#8b5cf6',
};

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

// Fix 7 + 9: getReferenceUrl aus spotUtils importiert (WWFF → wwff.co/directory/, WWBOTA → scheme-basiert)

// Fix 17: Alert-Typ aus Referenz extrahieren
function getAlertType(alert) {
  if (alert.activity_type && alert.activity_type !== 'SOTA-ALERT') return alert.activity_type;
  const ref = alert.reference || '';
  if (ref.match(/^[A-Z0-9]+\/[A-Z0-9]+-[0-9]+$/)) return 'SOTA';
  if (ref.match(/^[A-Z]{2}-\d+$/)) return 'POTA';
  if (ref.match(/^[A-Z]{2}FF-\d{4}$/)) return 'WWFF';
  if (ref.match(/^[A-Z]{2}BOTA-/)) return 'WWBOTA';
  if (ref.match(/^[A-Z]{2}-\d{3}$/)) return 'IOTA';
  if (ref.match(/WCA/i)) return 'WCA';
  if (ref.match(/COTA/i)) return 'COTA';
  if (alert.activity_type === 'SOTA-ALERT') return 'SOTA';
  return 'SOTA';
}

// Fix 4: getCountryFlag durch getFlagImg aus spotUtils ersetzt (flagcdn.com Bilder)

export default function ActivityPanel({ onLogQso, onSpotDetails, gpsPos }) {
  const [activities, setActivities] = useState({ sota: [], pota: [], wwff: [], wwbota: [], gma: [], alerts: [], other: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('SOTA');
  const [filterOpen, setFilterOpen] = useState(false);
  const [bandFilter, setBandFilter] = useState('All');
  const [parkInfoRef, setParkInfoRef] = useState(null);
  // Fix 9: Sortierung
  const [sortBy, setSortBy] = useState('time'); // 'time' | 'score'
  // Fix 17: Alert-Typ Filter
  const [alertTypeFilter, setAlertTypeFilter] = useState('All');
  const [propagation, setPropagation] = useState(null);

  useEffect(() => { return () => setFilterOpen(false); }, []);

  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [actRes, propRes] = await Promise.all([
        base44.functions.invoke("getActivities", { include_future: true }),
        base44.entities.Propagation.list("-updated", 1).catch(() => []),
      ]);
      const data = actRes?.data || actRes;
      if (data?.success) {
        setActivities({
          sota: data.sota || [],
          pota: data.pota || [],
          wwff: data.wwff || [],
          wwbota: data.wwbota || [],
          gma: data.gma || [],
          alerts: data.alerts || [],
          other: data.other || [],
          total: data.total || 0,
        });
      }
      if (propRes && propRes.length > 0) setPropagation(propRes[0]);
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

  // Station-Position für Score-Berechnung
  const stationPos = useMemo(() => {
    if (gpsPos) return { lat: gpsPos.lat, lon: gpsPos.lng };
    return null;
  }, [gpsPos]);

  // Fix 18: "Weitere" Tab — alle Spots die nicht SOTA/POTA/WWFF/WWBOTA sind
  const otherSpots = useMemo(() => {
    return activities.other || [];
  }, [activities.other]);

  const tabKey = tab.toLowerCase();
  let activeSpots;
  if (tab === 'OTHER') {
    activeSpots = otherSpots;
  } else {
    activeSpots = activities[tabKey] || [];
  }

  // Fix 2 + 9: Sortierung — LIVE-Spots zuerst, dann ALERTS (nach Datum aufsteigend)
  const sortedSpots = useMemo(() => {
    let spots = (bandFilter === 'All' ? [...activeSpots] : activeSpots.filter(s => s.band === bandFilter)).filter(s => !isQRT(s));

    const isLive = (s) => s.spot_type === 'LIVE' || (!s.is_future && !s.spot_type);
    const liveFirstCompare = (a, b) => {
      const aLive = isLive(a);
      const bLive = isLive(b);
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      if (aLive) {
        return new Date(b.spot_time || 0).getTime() - new Date(a.spot_time || 0).getTime();
      }
      return new Date(a.spot_time || 0).getTime() - new Date(b.spot_time || 0).getTime();
    };

    if (sortBy === 'score') {
      spots = spots.map(s => {
        const score = calcHearScore(s, stationPos, propagation);
        return { ...s, _hearScore: score };
      }).sort((a, b) => {
        const aLive = isLive(a);
        const bLive = isLive(b);
        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;
        return (b._hearScore || 0) - (a._hearScore || 0);
      });
    } else {
      spots = spots.sort(liveFirstCompare);
    }
    return spots;
  }, [activeSpots, bandFilter, sortBy, stationPos, propagation]);

  // Fix 17: Alerts nach Typ filtern
  const filteredAlerts = useMemo(() => {
    if (tab !== 'ALERTS') return sortedSpots;
    if (alertTypeFilter === 'All') return sortedSpots;
    return sortedSpots.filter(a => getAlertType(a) === alertTypeFilter);
  }, [sortedSpots, tab, alertTypeFilter]);

  const spots = filteredAlerts;
  const currentTab = TABS.find(t => t.id === tab) || TABS[0];
  const accentColor = currentTab.color;
  const Icon = currentTab.icon;

  // Fix 17: Verfügbare Alert-Typen
  const availableAlertTypes = useMemo(() => {
    if (!activities.alerts) return [];
    const types = new Set();
    for (const a of activities.alerts) {
      types.add(getAlertType(a));
    }
    return Array.from(types).sort();
  }, [activities.alerts]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} /> ACTIVE ACTIVATIONS
          <span className="text-[10px] text-muted-foreground font-normal">({activities.total})</span>
        </h2>
        <div className="flex items-center gap-1.5">
          {/* Fix 9: Sortier-Button */}
          <button
            onClick={() => setSortBy(sortBy === 'time' ? 'score' : 'time')}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors bg-background text-muted-foreground border-border hover:bg-muted"
            title="Sortierung: nach Zeit oder Verbindungswahrscheinlichkeit"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === 'time' ? 'Zeit' : 'Score'}
          </button>
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
          const count = t.id === 'OTHER' ? (activities.other || []).length : (activities[t.id.toLowerCase()] || []).length;
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

      {/* Fix 17: Alert-Typ Filter (nur im Alerts-Tab) */}
      {tab === 'ALERTS' && availableAlertTypes.length > 0 && (
        <div className="flex gap-1 px-3 py-1.5 border-b border-border overflow-x-auto">
          <button
            onClick={() => setAlertTypeFilter('All')}
            className={`px-2 py-0.5 text-[10px] rounded-md border whitespace-nowrap transition-colors ${
              alertTypeFilter === 'All'
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            Alle
          </button>
          {availableAlertTypes.map(t => (
            <button
              key={t}
              onClick={() => setAlertTypeFilter(t)}
              className={`px-2 py-0.5 text-[10px] rounded-md border whitespace-nowrap transition-colors ${
                alertTypeFilter === t
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block mr-1" style={{ background: ALERT_TYPE_COLORS[t] || '#718096' }} />
              {t}
            </button>
          ))}
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
            Keine {tab === 'OTHER' ? 'weiteren' : tab}-Aktivierungen.
          </div>
        ) : (
          spots.map((spot, i) => {
            // Fix 17: Alert-Typ Badge
            const isAlert = tab === 'ALERTS' || spot.is_future;
            const alertType = isAlert ? getAlertType(spot) : null;
            const alertColor = alertType ? (ALERT_TYPE_COLORS[alertType] || '#718096') : null;
            // Fix 4: Landesfahne via flagcdn.com
            const flagInfo = getFlagImg(spot.call);
            // Fix 16: Referenz-URL
            const refUrl = getReferenceUrl(spot.activity_type || (isAlert ? alertType : tab), spot.reference);
            // Fix 9: Score-Anzeige
            const score = spot._hearScore != null ? spot._hearScore : null;

            return (
              <div
                key={spot.id || i}
                className="px-3 py-2 border-b border-border/50 hover:bg-muted cursor-pointer"
                onClick={() => onSpotDetails?.(spot)}
              >
                <div className="flex items-center gap-2">
                  {/* Fix 17: Alert-Typ Badge */}
                  {isAlert && alertType && (
                    <span
                      className="text-[8px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                      style={{ background: `${alertColor}20`, color: alertColor }}
                    >
                      {alertType}
                    </span>
                  )}
                  {/* Fix 4: Landesfahne via flagcdn.com */}
                  {flagInfo && <img src={flagInfo.url} alt={flagInfo.code} className="w-4 h-3 flex-shrink-0" loading="lazy" />}
                  <span className="font-bold text-foreground text-sm truncate flex-1">{spot.call}</span>
                  {/* Fix 2: LIVE/GEPLANT Badge — SOTA-Tab zeigt kombinierte Spots+Alerts */}
                  {spot.spot_type === 'LIVE' && (
                    <span className="text-[7px] px-1 rounded bg-green-500/20 text-green-600 font-bold flex-shrink-0">LIVE</span>
                  )}
                  {spot.spot_type === 'ALERT' && (
                    <span className="text-[7px] px-1 rounded bg-[#0284c7]/20 text-[#0284c7] font-bold flex-shrink-0">GEPLANT</span>
                  )}
                  {!spot.spot_type && spot.is_future && !isAlert && (
                    <span className="text-[7px] px-1 rounded bg-[#0284c7]/20 text-[#0284c7] font-bold flex-shrink-0">GEPLANT</span>
                  )}
                  {spot.reference && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Fix 16: Referenz klickbar */}
                      {refUrl ? (
                        <a
                          href={refUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold hover:underline"
                          style={{ background: `${accentColor}20`, color: accentColor }}
                        >
                          {spot.reference} ↗
                        </a>
                      ) : (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: `${accentColor}20`, color: accentColor }}
                        >
                          {spot.reference}
                        </span>
                      )}
                      {tab === 'POTA' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setParkInfoRef(spot.reference); }}
                          className="text-muted-foreground hover:text-green-600 transition-colors"
                          title="POTA Park-Info"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      )}
                    </div>
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
                  {/* Fix 9: Score-Anzeige */}
                  {score != null && (
                    <span
                      className="text-[9px] font-bold px-1 rounded"
                      style={{ background: scoreColor(score) + '20', color: scoreColor(score) }}
                    >
                      {score}%
                    </span>
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
                {/* Fix 18: Quelle anzeigen bei "Weitere"-Tab */}
                {tab === 'OTHER' && spot.source && (
                  <div className="text-[9px] text-muted-foreground mt-0.5 truncate">
                    Quelle: {spot.source}{spot.comments ? ` · ${spot.comments}` : ''}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border text-[8px] text-muted-foreground flex justify-between">
        <span>Auto-Refresh 60s · Sort: {sortBy === 'time' ? 'Zeit' : 'Score'}</span>
        <span className="flex items-center gap-1">
          {gpsPos ? <MapPin className="w-2 h-2 text-[#16a34a]" /> : null}
          {tab}: {spots.length}
        </span>
      </div>
      {/* POTA Park-Info Popup */}
      {parkInfoRef && (
        <PotaParkInfoPopup reference={parkInfoRef} onClose={() => setParkInfoRef(null)} />
      )}
    </div>
  );
}