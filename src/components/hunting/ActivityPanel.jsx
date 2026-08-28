import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Mountain, TreePine, RefreshCw, FileText, MapPin, CalendarClock, Filter, ChevronDown, X, Building2, Info, Radio, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PotaParkInfoPopup from "@/components/hunting/PotaParkInfoPopup";
import { calcHearScore, scoreColor } from "@/lib/hearScore";
import { maidenheadToLatLon, haversine, bearing } from "@/lib/geoUtilsFrontend";
import { isQRT, getFlagImg, getReferenceUrl } from "@/lib/spotUtils";

// Activity Panel — v0.9016:
// Fix: Strikte Trennung von Live-Spots und geplanten Aktivierungen (Alerts)
// Tab 1 "Live":  Nur Live-Spots (SOTA, POTA, WWFF, WWBOTA, Weitere) — QRT gefiltert
// Tab 2 "Alerts": Nur geplante Aktivierungen (SOTA-Alerts, WWFF-Agendas) + Hinweise

const REFRESH_MS = 60 * 1000;
const BAND_OPTIONS = ['All', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m', '2m', '70cm'];

// Fix v0.9016: Zwei Haupt-Tabs statt 6 Quellen-Tabs
const TABS = [
  { id: 'live', label: 'Live', icon: Radio, color: '#16a34a' },
  { id: 'alerts', label: 'Alerts', icon: CalendarClock, color: '#0284c7' },
];

// Quellen-Farben für Badges
const SOURCE_COLORS = {
  SOTA: '#d97706',
  POTA: '#16a34a',
  WWFF: '#0d9488',
  WWBOTA: '#dc2626',
  GMA: '#7c3aed',
  WCA: '#8b5cf6',
  COTA: '#ec4899',
  IOTA: '#06b6d4',
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

// Quellen-Typ aus Spot extrahieren
function getSourceType(spot) {
  if (spot.activity_type === 'SOTA-ALERT') return 'SOTA';
  if (spot.activity_type === 'WWFF-ALERT') return 'WWFF';
  if (spot.activity_type) return spot.activity_type;
  return 'SOTA';
}

export default function ActivityPanel({ onLogQso, onSpotDetails, gpsPos }) {
  const [data, setData] = useState({ liveSpots: [], alerts: [], liveTotal: 0, alertsTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('live');
  const [filterOpen, setFilterOpen] = useState(false);
  const [bandFilter, setBandFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [parkInfoRef, setParkInfoRef] = useState(null);
  const [sortBy, setSortBy] = useState('time');
  const [propagation, setPropagation] = useState(null);

  useEffect(() => { return () => setFilterOpen(false); }, []);

  const fetchActivities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [actRes, propRes] = await Promise.all([
        base44.functions.invoke("getActivities", { include_future: true }),
        base44.entities.Propagation.list("-updated", 1).catch(() => []),
      ]);
      const d = actRes?.data || actRes;
      if (d?.success) {
        setData({
          liveSpots: d.liveSpots || [],
          alerts: d.alerts || [],
          liveTotal: d.liveTotal || 0,
          alertsTotal: d.alertsTotal || 0,
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

  const stationPos = useMemo(() => {
    if (gpsPos) return { lat: gpsPos.lat, lon: gpsPos.lng };
    return null;
  }, [gpsPos]);

  // Verfügbare Quellen im aktuellen Tab
  const availableSources = useMemo(() => {
    const spots = tab === 'live' ? data.liveSpots : data.alerts;
    const sources = new Set();
    for (const s of spots) {
      sources.add(getSourceType(s));
    }
    return Array.from(sources).sort();
  }, [data, tab]);

  // Gefilterte + sortierte Spots
  const displaySpots = useMemo(() => {
    let spots = tab === 'live' ? data.liveSpots : data.alerts;

    // Band-Filter
    if (bandFilter !== 'All') {
      spots = spots.filter(s => s.band === bandFilter);
    }

    // Quellen-Filter
    if (sourceFilter !== 'All') {
      spots = spots.filter(s => getSourceType(s) === sourceFilter);
    }

    // QRT-Filter (zusätzlich zum Backend-Filter)
    spots = spots.filter(s => !isQRT(s));

    // Sortierung
    if (tab === 'live') {
      // Live: nach Zeit absteigend (neueste zuerst)
      if (sortBy === 'score') {
        spots = spots.map(s => ({
          ...s,
          _hearScore: calcHearScore(s, stationPos, propagation),
        })).sort((a, b) => (b._hearScore || 0) - (a._hearScore || 0));
      } else {
        spots = [...spots].sort((a, b) =>
          new Date(b.spot_time || 0).getTime() - new Date(a.spot_time || 0).getTime()
        );
      }
    } else {
      // Alerts: nach planned_time aufsteigend (nächste zuerst)
      spots = [...spots].sort((a, b) =>
        new Date(a.spot_time || 0).getTime() - new Date(b.spot_time || 0).getTime()
      );
    }
    return spots;
  }, [data, tab, bandFilter, sourceFilter, sortBy, stationPos, propagation]);

  const currentTab = TABS.find(t => t.id === tab) || TABS[0];
  const accentColor = currentTab.color;
  const Icon = currentTab.icon;
  const totalCount = tab === 'live' ? data.liveTotal : data.alertsTotal;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
          {tab === 'live' ? 'LIVE SPOTS' : 'GEPLANTE AKTIVIERUNGEN'}
          <span className="text-[10px] text-muted-foreground font-normal">({totalCount})</span>
        </h2>
        <div className="flex items-center gap-1.5">
          {tab === 'live' && (
            <button
              onClick={() => setSortBy(sortBy === 'time' ? 'score' : 'time')}
              className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors bg-background text-muted-foreground border-border hover:bg-muted"
              title="Sortierung: nach Zeit oder Verbindungswahrscheinlichkeit"
            >
              {sortBy === 'time' ? 'Zeit' : 'Score'}
            </button>
          )}
          {/* Quellen-Filter */}
          {availableSources.length > 1 && (
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="text-[9px] rounded-md border bg-background text-muted-foreground border-border px-1.5 py-0.5"
            >
              <option value="All">Alle Quellen</option>
              {availableSources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {/* Band-Filter */}
          {tab === 'live' && (
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors ${
                  bandFilter !== 'All'
                    ? "bg-foreground/10 text-foreground border-foreground/30"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
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
                    {BAND_OPTIONS.map(b => (
                      <button
                        key={b}
                        onClick={() => { setBandFilter(b); setFilterOpen(false); }}
                        className={`w-full text-left px-2 py-1.5 text-[10px] transition-colors ${
                          bandFilter === b ? 'bg-foreground/10 text-foreground font-bold' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        {b === 'All' ? 'Alle' : b}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={() => fetchActivities(true)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Aktualisieren"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs — Live vs Alerts */}
      <div className="flex border-b border-border">
        {TABS.map(t => {
          const count = t.id === 'live' ? data.liveTotal : data.alertsTotal;
          const TabIcon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSourceFilter('All'); setBandFilter('All'); }}
              className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
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

      {/* Alerts-Tab: Hinweis für POTA/WWBOTA */}
      {tab === 'alerts' && (
        <div className="px-3 py-1.5 bg-[#0284c7]/5 border-b border-[#0284c7]/20 flex items-start gap-1.5">
          <AlertCircle className="w-3 h-3 text-[#0284c7] flex-shrink-0 mt-0.5" />
          <div className="text-[9px] text-muted-foreground">
            POTA und WWBOTA haben keine geplante API — nur Live-Spots im "Live"-Tab.
          </div>
        </div>
      )}

      {/* List */}
      <div className="max-h-[40vh] overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> {tab === 'live' ? 'Live-Spots' : 'Aktivierungen'} werden geladen…
          </div>
        ) : displaySpots.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {tab === 'live' ? 'Keine Live-Spots.' : 'Keine geplanten Aktivierungen.'}
          </div>
        ) : (
          displaySpots.map((spot, i) => {
            const sourceType = getSourceType(spot);
            const sourceColor = SOURCE_COLORS[sourceType] || '#718096';
            const isAlert = tab === 'alerts' || spot.is_future;
            const flagInfo = getFlagImg(spot.call);
            const refUrl = getReferenceUrl(spot.activity_type || sourceType, spot.reference);
            const score = spot._hearScore != null ? spot._hearScore : null;

            return (
              <div
                key={spot.id || i}
                className="px-3 py-2 border-b border-border/50 hover:bg-muted cursor-pointer"
                onClick={() => onSpotDetails?.(spot)}
              >
                <div className="flex items-center gap-2">
                  {/* Quellen-Badge */}
                  <span
                    className="text-[8px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                    style={{ background: `${sourceColor}20`, color: sourceColor }}
                  >
                    {sourceType}
                  </span>
                  {flagInfo && <img src={flagInfo.url} alt={flagInfo.code} className="w-4 h-3 flex-shrink-0" loading="lazy" />}
                  <span className="font-bold text-foreground text-sm truncate flex-1">{spot.call}</span>
                  {isAlert && (
                    <span className="text-[7px] px-1 rounded bg-[#0284c7]/20 text-[#0284c7] font-bold flex-shrink-0">GEPLANT</span>
                  )}
                  {spot.reference && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {refUrl ? (
                        <a
                          href={refUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold hover:underline"
                          style={{ background: `${sourceColor}20`, color: sourceColor }}
                        >
                          {spot.reference} ↗
                        </a>
                      ) : (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: `${sourceColor}20`, color: sourceColor }}
                        >
                          {spot.reference}
                        </span>
                      )}
                      {sourceType === 'POTA' && (
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
                  {score != null && (
                    <span
                      className="text-[9px] font-bold px-1 rounded"
                      style={{ background: scoreColor(score) + '20', color: scoreColor(score) }}
                    >
                      {score}%
                    </span>
                  )}
                  {isAlert && spot.spot_time && (
                    <span className="text-[#0284c7] font-mono ml-auto">
                      {new Date(spot.spot_time).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })} {new Date(spot.spot_time).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {!isAlert && (
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
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border text-[8px] text-muted-foreground flex justify-between">
        <span>Auto-Refresh 60s{tab === 'live' ? ` · Sort: ${sortBy === 'time' ? 'Zeit' : 'Score'}` : ''}</span>
        <span className="flex items-center gap-1">
          {gpsPos ? <MapPin className="w-2 h-2 text-[#16a34a]" /> : null}
          {tab}: {displaySpots.length}
        </span>
      </div>
      {parkInfoRef && (
        <PotaParkInfoPopup reference={parkInfoRef} onClose={() => setParkInfoRef(null)} />
      )}
    </div>
  );
}