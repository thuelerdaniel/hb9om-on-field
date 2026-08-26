import React, { useState, useEffect, useCallback } from "react";
import { Crosshair, RefreshCw, Eye, Target, FileText, Search, ChevronUp, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Live Spot Activity — Hauptbereich mit Filtern, Worked-Status, sortierbar.
// SHACK-SERVER Style: #050b10 bg, #0d1720 panels, #00e5ff cyan.

const REFRESH_MS = 30 * 1000;

function ageColor(age) {
  if (age == null) return '#9aa7b0';
  if (age < 60) return '#8cff00';
  if (age < 300) return '#ffc400';
  return '#ff5252';
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
  green: '#8cff00',
  blue: '#00e5ff',
  yellow: '#ffc400',
  gray: '#9aa7b0',
};

const BANDS = ['All', '160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m', '6m'];
const MODES = ['All', 'phone', 'digi', 'CW', 'SSB', 'FT8'];

export default function LiveSpotActivity({ onSpotDetails, onLogQso, onCallClick }) {
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
  const [sortBy, setSortBy] = useState('age');
  const [sortDir, setSortDir] = useState('asc');

  const fetchSpots = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await base44.functions.invoke("fetchDxSpots", {});
      const data = res?.data || res;
      if (data?.spots) {
        setSpots(data.spots);
        setWarning(data.warning || null);
      }
    } catch {
      try {
        const list = await base44.entities.DxSpot.list('-spot_time', 50);
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
  }, [fetchSpots, loadWorked]);

  // Filter + Sort
  const filtered = spots.filter(s => {
    if (search && !s.call?.toLowerCase().includes(search.toLowerCase()) && !s.country?.toLowerCase().includes(search.toLowerCase())) return false;
    if (bandFilter !== 'All' && s.band !== bandFilter) return false;
    if (modeFilter !== 'All' && s.mode !== modeFilter) return false;
    if (countryFilter && !s.country?.toLowerCase().includes(countryFilter.toLowerCase())) return false;
    if (sourceFilter !== 'All' && s.source !== sourceFilter) return false;
    if (s.confidence < minConfidence) return false;
    return true;
  }).sort((a, b) => {
    let av, bv;
    switch (sortBy) {
      case 'call': av = a.call; bv = b.call; break;
      case 'freq': av = a.frequency; bv = b.frequency; break;
      case 'dist': av = a.distance || 0; bv = b.distance || 0; break;
      case 'az': av = a.azimuth || 0; bv = b.azimuth || 0; break;
      case 'score': av = a.confidence || 0; bv = b.confidence || 0; break;
      default: av = a.age_seconds || 0; bv = b.age_seconds || 0;
    }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => sortBy === col ? (sortDir === 'asc' ? <ChevronUp className="w-2.5 h-2.5 inline" /> : <ChevronDown className="w-2.5 h-2.5 inline" />) : null;

  return (
    <div className="bg-[#0d1720] border border-[#1d3442] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1d3442]">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-[#00e5ff]" /> LIVE SPOT ACTIVITY
          <span className="text-[10px] text-[#9aa7b0] font-normal">({filtered.length})</span>
        </h2>
        <button onClick={() => fetchSpots(true)} disabled={refreshing} className="text-[#9aa7b0] hover:text-white">
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Warning */}
      {warning && (
        <div className="px-3 py-1.5 bg-[#ff9800]/10 border-b border-[#ff9800]/20 text-[10px] text-[#ff9800]">
          {warning}
        </div>
      )}

      {/* Filter Bar */}
      <div className="px-3 py-2 border-b border-[#1d3442] space-y-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9aa7b0]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Call oder Land…"
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-[#050b10] border border-[#1d3442] rounded-lg text-white placeholder-[#9aa7b0] focus:border-[#00e5ff] outline-none"
            />
          </div>
          <select value={bandFilter} onChange={e => setBandFilter(e.target.value)} className="px-2 py-1.5 text-xs bg-[#050b10] border border-[#1d3442] rounded-lg text-white focus:border-[#00e5ff] outline-none">
            {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} className="px-2 py-1.5 text-xs bg-[#050b10] border border-[#1d3442] rounded-lg text-white focus:border-[#00e5ff] outline-none">
            {MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            placeholder="Land…"
            className="flex-1 px-2 py-1.5 text-xs bg-[#050b10] border border-[#1d3442] rounded-lg text-white placeholder-[#9aa7b0] focus:border-[#00e5ff] outline-none"
          />
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="px-2 py-1.5 text-xs bg-[#050b10] border border-[#1d3442] rounded-lg text-white focus:border-[#00e5ff] outline-none">
            <option value="All">Alle Quellen</option>
            <option value="DXCluster (jo30.de)">jo30.de</option>
            <option value="DX Summit">DX Summit</option>
          </select>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[#9aa7b0]">Conf≥</span>
            <input
              type="number"
              min="0" max="100"
              value={minConfidence}
              onChange={e => setMinConfidence(parseInt(e.target.value) || 0)}
              className="w-10 px-1 py-1.5 text-xs bg-[#050b10] border border-[#1d3442] rounded-lg text-white focus:border-[#00e5ff] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[45vh] overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-[#9aa7b0] flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Spots werden geladen…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#9aa7b0]">Keine Spots gefunden.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0d1720] z-10">
              <tr className="text-[9px] text-[#9aa7b0] uppercase border-b border-[#1d3442]">
                <th className="px-2 py-1.5 text-left cursor-pointer hover:text-white" onClick={() => toggleSort('call')}>Call <SortIcon col="call" /></th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-white" onClick={() => toggleSort('freq')}>Freq <SortIcon col="freq" /></th>
                <th className="px-2 py-1.5 text-left">Mode</th>
                <th className="px-2 py-1.5 text-left hidden md:table-cell">Comment</th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-white hidden md:table-cell" onClick={() => toggleSort('dist')}>Dist <SortIcon col="dist" /></th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-white hidden md:table-cell" onClick={() => toggleSort('az')}>Az <SortIcon col="az" /></th>
                <th className="px-2 py-1.5 text-left hidden md:table-cell">Source</th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-white" onClick={() => toggleSort('age')}>Age <SortIcon col="age" /></th>
                <th className="px-2 py-1.5 text-right cursor-pointer hover:text-white hidden md:table-cell" onClick={() => toggleSort('score')}>Score <SortIcon col="score" /></th>
                <th className="px-2 py-1.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((spot, i) => {
                const dot = workedDot(spot, worked);
                const comment = spot.comments?.[0] || '';
                return (
                  <tr key={spot.id || i} className="border-b border-[#1d3442]/50 hover:bg-[#050b10]">
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: DOT_COLORS[dot] }} />
                        <button onClick={() => onCallClick?.(spot.call)} className="font-bold text-white hover:text-[#00e5ff] truncate">
                          {spot.call}
                        </button>
                        {spot.activity && (
                          <span className="text-[7px] px-1 rounded bg-[#00e5ff]/20 text-[#00e5ff] font-bold">{spot.activity}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-[#9aa7b0]">{formatFreq(spot.frequency)}</td>
                    <td className="px-2 py-1.5 text-[#00e5ff]">{spot.mode || '—'}</td>
                    <td className="px-2 py-1.5 text-[#9aa7b0] truncate max-w-[80px] hidden md:table-cell">{comment || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[#9aa7b0] hidden md:table-cell">{spot.distance > 0 ? `${spot.distance}` : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[#9aa7b0] hidden md:table-cell">{spot.azimuth > 0 ? `${spot.azimuth}°` : '—'}</td>
                    <td className="px-2 py-1.5 text-[9px] text-[#9aa7b0] truncate max-w-[60px] hidden md:table-cell">{spot.source || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono" style={{ color: ageColor(spot.age_seconds) }}>
                      {spot.age_seconds != null ? `${spot.age_seconds}s` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-white hidden md:table-cell">{spot.confidence || '—'}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onSpotDetails?.(spot)} className="text-[#9aa7b0] hover:text-[#00e5ff]" title="Details">
                          <Eye className="w-3 h-3" />
                        </button>
                        <button onClick={() => onLogQso?.(spot)} className="text-[#9aa7b0] hover:text-[#8cff00]" title="Log QSO">
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
      <div className="px-3 py-1.5 border-t border-[#1d3442] text-[8px] text-[#9aa7b0] flex justify-between">
        <span>Auto-Refresh 30s</span>
        <span>{filtered.length} / {spots.length} Spots</span>
      </div>
    </div>
  );
}