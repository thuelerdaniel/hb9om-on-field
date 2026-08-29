import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Crosshair, RefreshCw, Eye, Target, FileText, Search, ChevronUp, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon, haversine, bearing } from "@/lib/geoUtilsFrontend";
import { calcHearScore, scoreColor } from "@/lib/hearScore";
import { isQRT, getFlagImg } from "@/lib/spotUtils";

// Live Spot Activity — Hauptbereich mit Filtern, Worked-Status, sortierbar.
// Theme-aware: bg-card, border-border, text-foreground, text-muted-foreground.

const REFRESH_MS = 60 * 1000;

function ageColor(age) {
  if (age == null) return 'hsl(var(--muted-foreground))';
  if (age < 60) return '#16a34a';
  if (age < 300) return '#d97706';
  return '#dc2626';
}

function formatFreq(kHz) {
  if (!kHz) return '—';
  return `${(kHz / 1000).toFixed(3)}`;
}

function workedDot(spot, worked) {
  if (!worked) return 'gray';
  const callBand = `${spot.call}|${spot.band}`;
  const countryBand = `${(spot.country || '').toUpperCase()}|${spot.band}`;
  if (worked.callsOnBand?.includes(callBand)) return 'green';
  if (worked.countriesOnBand?.includes(countryBand)) return 'blue';
  if (worked.calls?.includes(spot.call)) return 'yellow';
  return 'gray';
}

const DOT_COLORS = {
  green: '#16a34a',
  blue: '#0284c7',
  yellow: '#d97706',
  gray: 'hsl(var(--muted-foreground))',
};

// Source badge colors
function sourceColor(source) {
  if (!source) return '#9ca3af';
  const s = source.toLowerCase();
  if (s.includes('dx summit')) return '#3b82f6';
  if (s.includes('hb9on')) return '#22c55e';
  if (s.includes('hb9iac')) return '#f97316';
  if (s.includes('holy')) return '#a855f7';
  if (s.includes('jo30') || s.includes('dxcluster')) return '#06b6d4';
  return '#9ca3af';
}

function sourceLabel(source) {
  if (!source) return '—';
  const s = source.toLowerCase();
  if (s.includes('dx summit')) return 'DX Summit';
  if (s.includes('hb9on')) return 'HB9ON-8';
  if (s.includes('hb9iac')) return 'HB9IAC-8';
  if (s.includes('holy')) return 'HolyCluster';
  if (s.includes('jo30') || s.includes('dxcluster')) return 'jo30.de';
  return source.length > 12 ? source.slice(0, 10) + '…' : source;
}

function getDistAz(spot, stationPos) {
  if (spot.distance > 0 && spot.azimuth > 0) {
    return { dist: spot.distance, az: spot.azimuth };
  }
  const locator = spot.locator || spot.grid6;
  if (locator && stationPos) {
    const p = maidenheadToLatLon(locator);
    if (p) {
      return {
        dist: Math.round(haversine(stationPos.lat, stationPos.lon, p.lat, p.lon)),
        az: Math.round(bearing(stationPos.lat, stationPos.lon, p.lat, p.lon)),
      };
    }
  }
  if (spot.lat != null && spot.lng != null && stationPos) {
    return {
      dist: Math.round(haversine(stationPos.lat, stationPos.lon, spot.lat, spot.lng)),
      az: Math.round(bearing(stationPos.lat, stationPos.lon, spot.lat, spot.lng)),
    };
  }
  return { dist: null, az: null };
}

function formatTime(timeStr) {
  if (!timeStr) return '—';
  try {
    const d = new Date(timeStr);
    return d.toISOString().slice(11, 16);
  } catch { return '—'; }
}

const BANDS = ['All', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m'];
const MODES = ['All', 'FT8', 'FT4', 'CW', 'SSB', 'FM', 'RTTY', 'PSK', 'Other'];
const REFS = ['All', 'SOTA', 'POTA', 'WWFF', 'WWBOTA', 'WCA', 'TOTA', 'IOTA', 'WLOTA'];

export default function LiveSpotActivity({ onSpotDetails, onLogQso, onCallClick, gpsPos, stationInfo, highlightSpot }) {
  const [spots, setSpots] = useState([]);
  const [worked, setWorked] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warning, setWarning] = useState(null);
  const [search, setSearch] = useState('');
  const [bandFilter, setBandFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [countryFilter, setCountryFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [minConfidence, setMinConfidence] = useState(0);
  const [refFilter, setRefFilter] = useState('All');
  const [sortBy, setSortBy] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [highlightedKey, setHighlightedKey] = useState(null);

  // Fix 3: Bei highlightSpot → zum Spot-Eintrag scrollen und hervorheben
  useEffect(() => {
    if (!highlightSpot) return;
    const key = `${highlightSpot.call}_${Math.round(highlightSpot.frequency)}`;
    setHighlightedKey(key);
    setTimeout(() => {
      const row = document.querySelector(`tr[data-spot-key="${CSS.escape(key)}"]`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const table = document.querySelector('.spot-table');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => setHighlightedKey(null), 3000);
    }, 100);
  }, [highlightSpot]);

  const fetchSpots = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const payload = gpsPos ? { station_lat: gpsPos.lat, station_lng: gpsPos.lng } : {};
      const res = await base44.functions.invoke("fetchDxSpots", payload);
      const data = res?.data || res;
      // v0.9029: If fetchDxSpots returns spots, use them; otherwise fall back to DxSpot entity
      if (data?.spots && Array.isArray(data.spots) && data.spots.length > 0) {
        setSpots(data.spots);
        setWarning(data.warning || null);
      } else {
        // Fallback: load directly from DxSpot entity (DB has fresh data from scheduled automation)
        const list = await base44.entities.DxSpot.filter({ is_active: true }, '-spot_time', 500);
        setSpots(list || []);
        setWarning(data?.warning || null);
      }
    } catch {
      try {
        // Fix 12: Kein Limit — alle Spots laden
        const list = await base44.entities.DxSpot.filter({ is_active: true }, '-spot_time', 500);
        setSpots(list || []);
      } catch { setWarning("Spots konnten nicht geladen werden"); }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadWorked = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("getWorkedStatus", {});
      const data = res?.data || res;
      if (data?.worked) setWorked(data.worked);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSpots();
    loadWorked();
    const interval = setInterval(() => { fetchSpots(true); }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchSpots, loadWorked, gpsPos]);

  // Station-Position für Distanz/Azimut-Berechnung
  const stationPos = useMemo(() => {
    if (gpsPos) return { lat: gpsPos.lat, lon: gpsPos.lng };
    if (stationInfo?.locator) {
      const p = maidenheadToLatLon(stationInfo.locator);
      return p || null;
    }
    return null;
  }, [gpsPos, stationInfo]);

  // Fix 3: Duplicate Spots konsolidieren — gleicher Call + gleiche Frequenz = ein Eintrag
  const consolidatedSpots = useMemo(() => {
    if (!spots.length) return [];
    // Fix 1: QRT-Stationen herausfiltern
    const nonQrt = spots.filter(s => !isQRT(s));
    // 1. Exakte Duplikate entfernen (gleicher Call, Freq, Spotter, Zeit innerhalb 60s)
    const deduped = [];
    const seen = new Set();
    for (const s of nonQrt) {
      const time = s.spot_time ? new Date(s.spot_time).getTime() : 0;
      const key = `${s.call}_${Math.round(s.frequency)}_${s.spotter || ''}_${Math.floor(time / 60000)}`;
      if (!seen.has(key)) { seen.add(key); deduped.push(s); }
    }
    // 2. Nach Call + Frequenz konsolidieren
    const map = new Map();
    for (const s of deduped) {
      const key = `${s.call}_${Math.round(s.frequency)}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...s, _spotCount: 1, _allSpotters: [s.spotter].filter(Boolean), _allComments: [...(Array.isArray(s.comments) ? s.comments : (s.comments ? [s.comments] : []))] });
      } else {
        const existingTime = existing.spot_time ? new Date(existing.spot_time).getTime() : 0;
        const newTime = s.spot_time ? new Date(s.spot_time).getTime() : 0;
        existing._spotCount++;
        if (s.spotter && !existing._allSpotters.includes(s.spotter)) existing._allSpotters.push(s.spotter);
        const sComments = Array.isArray(s.comments) ? s.comments : (s.comments ? [s.comments] : []);
        if (sComments.length) existing._allComments.push(...sComments);
        if (newTime > existingTime) {
          const merged = { ...s, _spotCount: existing._spotCount, _allSpotters: existing._allSpotters, _allComments: existing._allComments };
          map.set(key, merged);
        }
      }
    }
    return Array.from(map.values());
  }, [spots]);

  // Filter + Sort — mit clientseitig berechneter Distanz/Azimut
  const filtered = consolidatedSpots.map(s => {
    const { dist, az } = getDistAz(s, stationPos);
    const score = calcHearScore({ ...s, _calcDist: dist }, stationPos, null);
    return { ...s, _calcDist: dist, _calcAz: az, _hearScore: score };
  }).filter(s => {
    if (search && !s.call?.toLowerCase().includes(search.toLowerCase()) && !s.country?.toLowerCase().includes(search.toLowerCase())) return false;
    if (bandFilter !== 'All' && s.band !== bandFilter) return false;
    if (modeFilter !== 'All' && s.mode !== modeFilter) return false;
    if (countryFilter && !s.country?.toLowerCase().includes(countryFilter.toLowerCase())) return false;
    if (sourceFilter !== 'All' && !(s.source || '').toLowerCase().includes(sourceFilter.toLowerCase())) return false;
    if (refFilter !== 'All' && s.activity !== refFilter) return false;
    if (s.confidence < minConfidence) return false;
    return true;
  }).sort((a, b) => {
    let av, bv;
    switch (sortBy) {
      case 'call': av = a.call; bv = b.call; break;
      case 'freq': av = a.frequency; bv = b.frequency; break;
      case 'dist': av = a._calcDist || a.distance || 0; bv = b._calcDist || b.distance || 0; break;
      case 'az': av = a._calcAz || a.azimuth || 0; bv = b._calcAz || b.azimuth || 0; break;
      case 'score': av = a._hearScore || 0; bv = b._hearScore || 0; break;
      default: av = a.age_seconds || 0; bv = b.age_seconds || 0;
    }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  // Unique countries from current spots for dropdown
  const availableCountries = useMemo(() => {
    const set = new Set();
    for (const s of spots) {
      if (s.country) set.add(s.country);
    }
    return Array.from(set).sort();
  }, [spots]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => sortBy === col ? (sortDir === 'asc' ? <ChevronUp className="w-2.5 h-2.5 inline" /> : <ChevronDown className="w-2.5 h-2.5 inline" />) : null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-[#00e5ff]" /> LIVE SPOT ACTIVITY
          <span className="text-[10px] text-muted-foreground font-normal">({filtered.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSortBy(sortBy === 'score' ? 'age' : 'score'); setSortDir('desc'); }}
            className="text-[9px] px-2 py-0.5 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Sortierung wechseln: nach Hörscheinlichkeit oder nach Zeit"
          >
            {sortBy === 'score' ? '⭐ Nach Score' : '🕐 Nach Zeit'}
          </button>
          <button onClick={() => fetchSpots(true)} disabled={refreshing} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Warning */}
      {warning && (
        <div className="px-3 py-1.5 bg-[#ff9800]/10 border-b border-[#ff9800]/20 text-[10px] text-[#ff9800]">
          {warning}
        </div>
      )}

      {/* Filter Bar */}
      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Call oder Land…"
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-[#00e5ff] outline-none"
            />
          </div>
          <select value={bandFilter} onChange={e => setBandFilter(e.target.value)} className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:border-[#00e5ff] outline-none">
            {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:border-[#00e5ff] outline-none">
            {MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={refFilter} onChange={e => setRefFilter(e.target.value)} className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:border-[#00e5ff] outline-none">
            {REFS.map(r => <option key={r} value={r}>{r === 'All' ? 'Alle Ref' : r}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="flex-1 min-w-[80px] px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:border-[#00e5ff] outline-none">
            <option value="">Alle Länder</option>
            {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:border-[#00e5ff] outline-none">
            <option value="All">Alle Quellen</option>
            <option value="DX Summit">DX Summit</option>
            <option value="HB9ON-8">HB9ON-8</option>
            <option value="HB9IAC-8">HB9IAC-8</option>
            <option value="HolyCluster">HolyCluster</option>
            <option value="DXCluster (jo30.de)">jo30.de</option>
          </select>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">Conf≥</span>
            <input
              type="number"
              min="0" max="100"
              value={minConfidence}
              onChange={e => setMinConfidence(parseInt(e.target.value) || 0)}
              className="w-10 px-1 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:border-[#00e5ff] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Fix 1: Table — overflow-x auto mit touch scrolling */}
      {/* Table */}
      <div className="max-h-[45vh] overflow-y-auto overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Spots werden geladen…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Keine Spots gefunden.</div>
        ) : (
          <table className="w-full text-[13px] spot-table spot-table-responsive">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-[9px] text-muted-foreground uppercase border-b border-border">
                <th className="px-2 py-1.5 text-left cursor-pointer hover:text-foreground" style={{ minWidth: '110px' }} onClick={() => toggleSort('call')} title="Rufzeichen des sendenden Stations">Call <SortIcon col="call" /></th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-foreground" style={{ minWidth: '80px' }} onClick={() => toggleSort('freq')} title="Frequenz in MHz">Freq <SortIcon col="freq" /></th>
                <th className="px-2 py-1.5 text-left" style={{ minWidth: '70px' }} title="Betriebsart (SSB, CW, FT8, etc.)">Mode</th>
                <th className="px-2 py-1.5 text-left hidden md:table-cell" style={{ minWidth: '140px' }} title="Letzter Kommentar zum Spot">Comment</th>
                <th className="px-2 py-1.5 text-left hidden md:table-cell" style={{ minWidth: '110px' }} title="Rufzeichen des Spot-Gebers">Spotter</th>
                <th className="px-2 py-1.5 text-right hidden md:table-cell" style={{ minWidth: '70px' }} title="Zeitpunkt des Spots (UTC)">Time</th>
                <th className="px-2 py-1.5 text-left hidden md:table-cell" style={{ minWidth: '110px' }} title="SOTA/POTA/WWFF-Referenz des Aktivierungs-Punktes">Ref</th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-foreground" style={{ minWidth: '55px' }} onClick={() => toggleSort('dist')} title="Entfernung zum Spot in Kilometern (Great Circle)">Dist <SortIcon col="dist" /></th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-foreground hidden md:table-cell" style={{ minWidth: '70px' }} onClick={() => toggleSort('az')} title="Azimut/Peilung zum Spot in Grad (0=N, 90=O, 180=S, 270=W)">Az <SortIcon col="az" /></th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-foreground hidden md:table-cell" style={{ minWidth: '70px' }} onClick={() => toggleSort('age')} title="Alter des Spots in Sekunden">Age <SortIcon col="age" /></th>
                <th className="px-2.5 py-1.5 text-right cursor-pointer hover:text-foreground" style={{ minWidth: '70px' }} onClick={() => toggleSort('score')} title="Wahrscheinlichkeit die Station zu hören, berechnet aus Distanz, Ausbreitung, Standort und Band.">Score <SortIcon col="score" /></th>
                <th className="px-2 py-1.5 text-center hidden md:table-cell" style={{ minWidth: '70px' }} title="Spot-Typ: DX (rot), SOTA (blau), POTA (grün)">Type</th>
                <th className="px-2 py-1.5 text-center" style={{ minWidth: '80px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((spot, i) => {
                const dot = workedDot(spot, worked);
                const comment = spot.comments?.[0] || '';
                return (
                  <tr key={spot.id || i} data-spot-key={`${spot.call}_${Math.round(spot.frequency)}`} className={`border-b border-border/50 hover:bg-muted ${highlightedKey === `${spot.call}_${Math.round(spot.frequency)}` ? 'spot-highlight' : ''}`}>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: DOT_COLORS[dot] }} />
                        {(() => { const flag = getFlagImg(spot.call); return flag ? <img src={flag.url} alt={flag.code} className="w-4 h-3 flex-shrink-0" loading="lazy" /> : (spot.countryCode ? <span className="text-sm leading-none">{spot.countryCode}</span> : null); })()}
                        <button onClick={() => onSpotDetails?.(spot)} className="font-bold text-foreground hover:text-[#00e5ff] truncate">
                          {spot.call}
                        </button>
                        {spot.activity && (
                          <span className="text-[7px] px-1 rounded bg-[#00e5ff]/20 text-[#00e5ff] font-bold">{spot.activity}</span>
                        )}
                        {spot._spotCount > 1 && (
                          <span className="text-[7px] px-1 rounded bg-[#ffc400]/20 text-[#ffc400] font-bold" title={`${spot._spotCount} Spots konsolidiert`}>{spot._spotCount}x</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{formatFreq(spot.frequency)}</td>
                    <td className="px-2 py-1.5 text-[#00e5ff]">{spot.mode || '—'}</td>
                    <td className="px-2 py-1.5 hidden md:table-cell" style={{ minWidth: '120px', maxWidth: '200px' }}>
                      <div className="spot-comments text-muted-foreground" title={spot._allComments?.length > 1 ? spot._allComments.join('\n---\n') : comment}>
                        {comment || '—'}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell">
                      {spot._allSpotters?.length > 1
                        ? <span title={spot._allSpotters.join(', ')}>{spot._allSpotters[0]} +{spot._allSpotters.length - 1}</span>
                        : (spot.spotter || '—')}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground hidden md:table-cell">{formatTime(spot.spot_time)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell">{spot.activity_ref || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{spot._calcDist != null ? `${spot._calcDist}` : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground hidden md:table-cell">{spot._calcAz != null ? `${spot._calcAz}°` : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono hidden md:table-cell" style={{ color: ageColor(spot.age_seconds) }}>
                      {spot.age_seconds != null ? `${spot.age_seconds}s` : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: scoreColor(spot._hearScore) + '20', color: scoreColor(spot._hearScore) }}>
                        {spot._hearScore}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center hidden md:table-cell">
                      {(() => {
                        const spotType = spot.activity || 'DX';
                        const typeColor = spotType === 'SOTA' ? '#3b82f6' : spotType === 'POTA' ? '#22c55e' : spotType === 'DX' ? '#ef4444' : '#ffc400';
                        return <span className="text-[8px] font-bold" style={{ color: typeColor }}>{spotType}</span>;
                      })()}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onSpotDetails?.(spot)} className="text-muted-foreground hover:text-[#00e5ff]" title="Details">
                          <Eye className="w-3 h-3" />
                        </button>
                        <button onClick={() => onLogQso?.(spot)} className="text-muted-foreground hover:text-[#8cff00]" title="Log QSO">
                          <FileText className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border text-[8px] text-muted-foreground flex justify-between">
        <span>Auto-Refresh 60s · alle Spots</span>
        <span>{filtered.length} / {spots.length} Spots</span>
      </div>
    </div>
  );
}