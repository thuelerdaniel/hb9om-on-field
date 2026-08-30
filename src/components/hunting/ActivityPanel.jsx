import React, { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, FileText, MapPin, CalendarClock, X, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PotaParkInfoPopup from "@/components/hunting/PotaParkInfoPopup";
import { calcHearScore, scoreColor } from "@/lib/hearScore";
import { isQRT, getFlagImg, getReferenceUrl } from "@/lib/spotUtils";

// Activity Panel — v0.9026: 4 Tabs (Live Spot Activity Tab entfernt)
// Tab 1 "SOTA":   NUR SOTA Live-Spots (ALLE, QRT gefiltert, kein Limit!)
// Tab 2 "POTA":   NUR POTA Live-Spots (ALLE, kein Limit!)
// Tab 3 "WWFF":   NUR WWFF Live-Spots (ALLE, kein Limit!)
// Tab 4 "Alerts": KOMBINIERT alle geplanten Aktivierungen (SOTA-Alerts + WWFF-Agendas)
// Default-Tab: SOTA

const REFRESH_MS = 60 * 1000;

const TABS = [
  { id: 'SOTA', label: 'SOTA', color: '#d97706' },
  { id: 'POTA', label: 'POTA', color: '#16a34a' },
  { id: 'WWFF', label: 'WWFF', color: '#0d9488' },
  { id: 'LLOTA', label: 'LLOTA', color: '#0ea5e9' },
  { id: 'alerts', label: 'Alerts', color: '#7c3aed' },
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

export default function ActivityPanel({ onLogQso, onSpotDetails, onCallClick, gpsPos, stationInfo }) {
  const [data, setData] = useState({ liveSpots: [], alerts: [], liveTotal: 0, alertsTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('SOTA');
  const [parkInfoRef, setParkInfoRef] = useState(null);
  const [propagation, setPropagation] = useState(null);
  const [sortBy, setSortBy] = useState('time');
  const [alertFilterType, setAlertFilterType] = useState('all');
  const [alertFilterCall, setAlertFilterCall] = useState('');
  const [alertFilterCountry, setAlertFilterCountry] = useState('');

  // v0.9028 Rollback: loadData reads from DB (fast) — called on mount + auto-refresh.
  // refreshData calls refreshHuntingData orchestrator (single call) — manual refresh only.
  // The scheduled automation keeps the DB fresh in the background.
  const loadData = useCallback(async () => {
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
    }
  }, []);

  // v0.9028 Rollback: Single refreshHuntingData orchestrator call (not 6 parallel sub-function calls)
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke("refreshHuntingData", {});
      await loadData();
    } catch {} finally {
      setRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadData]);

  const stationPos = useMemo(() => {
    if (gpsPos) return { lat: gpsPos.lat, lon: gpsPos.lng };
    return null;
  }, [gpsPos]);

  const tabCounts = useMemo(() => {
    const counts = {};
    for (const t of TABS) {
      if (t.id === 'alerts') counts[t.id] = data.alertsTotal;
      else counts[t.id] = data.liveSpots.filter(s => s.activity_type === t.id).length;
    }
    return counts;
  }, [data]);

  const displaySpots = useMemo(() => {
    if (tab === 'alerts') {
      let alerts = [...data.alerts];
      if (alertFilterType !== 'all') {
        alerts = alerts.filter(s => {
          const st = s.activity_type === 'SOTA-ALERT' ? 'SOTA'
            : s.activity_type === 'WWFF-ALERT' ? 'WWFF'
            : s.activity_type === 'LLOTA-ALERT' ? 'LLOTA'
            : s.activity_type || 'SOTA';
          return st === alertFilterType;
        });
      }
      if (alertFilterCall.trim()) {
        const q = alertFilterCall.trim().toLowerCase();
        alerts = alerts.filter(s => (s.call || '').toLowerCase().includes(q));
      }
      if (alertFilterCountry.trim()) {
        const q = alertFilterCountry.trim().toLowerCase();
        alerts = alerts.filter(s =>
          (s.reference || '').toLowerCase().includes(q) ||
          (s.locationDesc || '').toLowerCase().includes(q) ||
          (s.name || '').toLowerCase().includes(q)
        );
      }
      return alerts.sort((a, b) =>
        new Date(a.spot_time || 0).getTime() - new Date(b.spot_time || 0).getTime()
      );
    }
    let spots = data.liveSpots.filter(s => s.activity_type === tab && !isQRT(s));
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
    return spots;
  }, [data, tab, sortBy, stationPos, propagation, alertFilterType, alertFilterCall, alertFilterCountry]);

  const currentTab = TABS.find(t => t.id === tab) || TABS[0];
  const accentColor = currentTab.color;
  const isAlertsTab = tab === 'alerts';

  const renderSpotList = () => (
    <>
      <div className="max-h-[45vh] overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> {isAlertsTab ? 'Aktivierungen' : `${tab}-Spots`} werden geladen…
          </div>
        ) : displaySpots.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {isAlertsTab ? 'Keine geplanten Aktivierungen.' : `Keine ${tab} Live-Spots.`}
          </div>
        ) : (
          displaySpots.map((spot, i) => {
            const sourceType = spot.activity_type === 'SOTA-ALERT' ? 'SOTA'
              : spot.activity_type === 'WWFF-ALERT' ? 'WWFF'
              : spot.activity_type === 'LLOTA-ALERT' ? 'LLOTA'
              : spot.activity_type || 'SOTA';
            const sourceColor = sourceType === 'SOTA' ? '#d97706'
              : sourceType === 'POTA' ? '#16a34a'
              : sourceType === 'WWFF' ? '#0d9488'
              : sourceType === 'LLOTA' ? '#0ea5e9'
              : sourceType === 'WWBOTA' ? '#dc2626'
              : '#718096';
            const isAlert = isAlertsTab || spot.is_future;
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
                  <span
                    className="text-[8px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                    style={{ background: `${sourceColor}20`, color: sourceColor }}
                  >
                    {sourceType}
                  </span>
                  {flagInfo && <img src={flagInfo.url} alt={flagInfo.code} className="w-4 h-3 flex-shrink-0" loading="lazy" />}
                  <span className="font-bold text-foreground text-sm truncate flex-1">{spot.call}</span>
                  {isAlert && (
                    <span className="text-[7px] px-1 rounded bg-[#7c3aed]/20 text-[#7c3aed] font-bold flex-shrink-0">GEPLANT</span>
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
                    <span className="text-[#7c3aed] font-mono ml-auto">
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
        <span>Auto-Refresh 60s{!isAlertsTab ? ` · Sort: ${sortBy === 'time' ? 'Zeit' : 'Score'}` : ' · Alerts 5min'}</span>
        <span className="flex items-center gap-1">
          {gpsPos ? <MapPin className="w-2 h-2 text-[#16a34a]" /> : null}
          {tab}: {displaySpots.length}
        </span>
      </div>

      {parkInfoRef && (
        <PotaParkInfoPopup reference={parkInfoRef} onClose={() => setParkInfoRef(null)} />
      )}
    </>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {isAlertsTab
            ? <><CalendarClock className="w-3.5 h-3.5" style={{ color: accentColor }} /> GEPLANTE AKTIVIERUNGEN</>
            : <><span className="w-2 h-2 rounded-full" style={{ background: accentColor }} /> {tab} LIVE-SPOTS</>
          }
          <span className="text-[10px] text-muted-foreground font-normal">({tabCounts[tab]})</span>
        </h2>
        <div className="flex items-center gap-1.5">
          {!isAlertsTab && (
            <button
              onClick={() => setSortBy(sortBy === 'time' ? 'score' : 'time')}
              className="flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors bg-background text-muted-foreground border-border hover:bg-muted"
              title="Sortierung: nach Zeit oder Score"
            >
              {sortBy === 'time' ? 'Zeit' : 'Score'}
            </button>
          )}
          <button
            onClick={() => refreshData()}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Aktualisieren"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs — SOTA / POTA / WWFF / WWBOTA / Live Spot Activity / Alerts */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "bg-foreground/5 text-foreground border-b-2"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={tab === t.id ? { borderBottomColor: t.color, color: t.color } : {}}
          >
            {t.label} ({tabCounts[t.id]})
          </button>
        ))}
      </div>

      {/* Alerts-Tab: Filter-Controls */}
      {isAlertsTab && (
        <div className="px-3 py-2 bg-[#7c3aed]/5 border-b border-[#7c3aed]/20 space-y-1.5">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] text-muted-foreground font-medium flex-shrink-0">Art:</span>
            {['all', 'SOTA', 'WWFF', 'LLOTA'].map(t => (
              <button
                key={t}
                onClick={() => setAlertFilterType(t)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                  alertFilterType === t
                    ? 'bg-[#7c3aed] text-white'
                    : 'bg-background text-muted-foreground border border-border hover:bg-muted'
                }`}
              >
                {t === 'all' ? 'Alle' : t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={alertFilterCall}
              onChange={(e) => setAlertFilterCall(e.target.value)}
              placeholder="Rufzeichen…"
              className="flex-1 min-w-0 text-[10px] px-2 py-1 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed]/50"
            />
            <input
              type="text"
              value={alertFilterCountry}
              onChange={(e) => setAlertFilterCountry(e.target.value)}
              placeholder="Land / Referenz…"
              className="flex-1 min-w-0 text-[10px] px-2 py-1 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed]/50"
            />
            {(alertFilterCall || alertFilterCountry || alertFilterType !== 'all') && (
              <button
                onClick={() => { setAlertFilterCall(''); setAlertFilterCountry(''); setAlertFilterType('all'); }}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                title="Filter zurücksetzen"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content: spot list for all tabs */}
      {renderSpotList()}
    </div>
  );
}