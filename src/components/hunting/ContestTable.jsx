// ContestTable — Eigenständige Contest-Ansicht im Hunting-Modul (v0.9043).
// KEIN Tab in der ActivityPanel-Tabelle mehr, sondern separater Bereich.
// Oben: Zusammenfassung (On the Air + Nächste 7 Tage Countdowns).
// Darunter: Sortierbare Tabelle mit allen kommenden Contests + erweiterte Suche/Filter.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trophy, RefreshCw, ExternalLink, Radio, CalendarClock,
  ChevronUp, ChevronDown, X, Search,
  Filter, RotateCcw,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import ContestDetailModal from "@/components/hunting/ContestDetailModal";

const REFRESH_MS = 60 * 1000;

// ── Helpers ──────────────────────────────────────────────

function formatCountdown(ms) {
  if (ms <= 0) return "beendet";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}min`;
  return `in ${mins}min`;
}

function formatRemaining(ms) {
  if (ms <= 0) return "beendet";
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `läuft noch ${hours}h ${mins}min`;
  return `läuft noch ${mins}min`;
}

function formatDurationShort(hours) {
  if (!hours || hours <= 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

function formatTableDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const utc = d.toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  });
  return utc;
}

function formatLocalDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString("de-CH", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ── Filter Constants ──────────────────────────────────────

const MODE_OPTIONS = ["CW", "SSB", "RTTY", "Digital", "FM", "FT8/FT4", "Mixed"];
const BAND_OPTIONS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "VHF+"];
const DURATION_OPTIONS = [
  { value: "lt2", label: "< 2h" },
  { value: "2-12", label: "2-12h" },
  { value: "12-24", label: "12-24h" },
  { value: "24+", label: "> 24h" },
];
const TIME_OPTIONS = [
  { value: "all", label: "Alle" },
  { value: "active", label: "Jetzt aktiv" },
  { value: "7d", label: "Nächste 7 Tage" },
  { value: "30d", label: "Nächste 30 Tage" },
  { value: "90d", label: "Nächste 90 Tage" },
];

// ── Sortable Column Header ────────────────────────────────

function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 text-left hover:text-foreground transition-colors ${
        active ? "text-foreground font-bold" : "text-muted-foreground font-medium"
      }`}
    >
      {label}
      {active && (
        sortDir === "asc"
          ? <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );
}

// ── Multi-Select Filter Chip ───────────────────────────────

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
        active
          ? "bg-amber-500 text-white"
          : "bg-background text-muted-foreground border border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function ContestTable() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedContest, setSelectedContest] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [modeFilters, setModeFilters] = useState([]);
  const [bandFilters, setBandFilters] = useState([]);
  const [durationFilters, setDurationFilters] = useState([]);
  const [timeFilter, setTimeFilter] = useState("all");
  const [sponsorFilter, setSponsorFilter] = useState("all");

  // Sorting
  const [sortField, setSortField] = useState("start_utc");
  const [sortDir, setSortDir] = useState("asc");

  // ── Data Loading ──
  const loadContests = useCallback(async () => {
    try {
      const year = new Date().getUTCFullYear();
      const data = await base44.entities.Contest.filter({ year });
      setContests(data || []);
      setLastUpdate(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshContests = useCallback(async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke("fetchContests", { year: new Date().getUTCFullYear() });
      await loadContests();
    } catch {
      // silent — offline or no admin
    } finally {
      setRefreshing(false);
    }
  }, [loadContests]);

  useEffect(() => {
    loadContests();
    const interval = setInterval(() => {
      loadContests();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [loadContests]);

  // ── Sponsors list (from data) ──
  const sponsors = useMemo(() => {
    const set = new Set();
    for (const c of contests) {
      if (c.sponsor) set.add(c.sponsor);
    }
    return Array.from(set).sort();
  }, [contests]);

  // ── Sorting ──
  const handleSort = useCallback((field) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
        return field;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  // ── Filtered + Sorted Contests ──
  const { activeContests, upcomingContests, tableContests } = useMemo(() => {
    const now = Date.now();
    const DAY7 = 7 * 24 * 60 * 60 * 1000;

    // Apply text search
    let filtered = contests;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      filtered = filtered.filter(c =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.sponsor || "").toLowerCase().includes(q)
      );
    }

    // Apply mode filter (AND: contest must match ALL selected modes via mode_families)
    if (modeFilters.length > 0) {
      filtered = filtered.filter(c => {
        const fams = c.mode_families || [];
        if (fams.length === 0) return false;
        // "Mixed" = contest has more than one mode family
        if (modeFilters.includes("Mixed")) {
          if (fams.length < 2) return false;
        }
        // Check each selected mode (excluding "Mixed" which is a meta-filter)
        const realModes = modeFilters.filter(m => m !== "Mixed");
        if (realModes.length > 0) {
          // FT8/FT4 maps to "Digital"
          const checkModes = realModes.map(m => m === "FT8/FT4" ? "Digital" : m);
          const hasAll = checkModes.every(m => fams.includes(m));
          if (!hasAll) return false;
        }
        return true;
      });
    }

    // Apply band filter
    if (bandFilters.length > 0) {
      filtered = filtered.filter(c => {
        const fams = c.band_families || [];
        if (fams.length === 0) return false;
        return bandFilters.every(b => fams.includes(b));
      });
    }

    // Apply duration filter
    if (durationFilters.length > 0) {
      filtered = filtered.filter(c => {
        const bucket = c.duration_bucket || "";
        if (!bucket) {
          // Fallback: compute from duration_hours
          const h = c.duration_hours || 0;
          if (durationFilters.includes("lt2") && h < 2) return true;
          if (durationFilters.includes("2-12") && h >= 2 && h < 12) return true;
          if (durationFilters.includes("12-24") && h >= 12 && h < 24) return true;
          if (durationFilters.includes("24+") && h >= 24) return true;
          return false;
        }
        return durationFilters.includes(bucket);
      });
    }

    // Apply sponsor filter
    if (sponsorFilter !== "all") {
      filtered = filtered.filter(c => (c.sponsor || "") === sponsorFilter);
    }

    // Apply time filter
    let timeFiltered = filtered;
    if (timeFilter === "active") {
      timeFiltered = filtered.filter(c => {
        const s = new Date(c.start_utc).getTime();
        const e = new Date(c.end_utc).getTime();
        return now >= s && now <= e;
      });
    } else if (timeFilter === "7d") {
      timeFiltered = filtered.filter(c => {
        const s = new Date(c.start_utc).getTime();
        return s > now - DAY7 && s < now + DAY7;
      });
    } else if (timeFilter === "30d") {
      timeFiltered = filtered.filter(c => {
        const s = new Date(c.start_utc).getTime();
        return s > now && s < now + 30 * 24 * 60 * 60 * 1000;
      });
    } else if (timeFilter === "90d") {
      timeFiltered = filtered.filter(c => {
        const s = new Date(c.start_utc).getTime();
        return s > now && s < now + 90 * 24 * 60 * 60 * 1000;
      });
    }

    // Split into active + upcoming (for summary)
    const active = [];
    const upcoming = [];
    for (const c of timeFiltered) {
      const startMs = new Date(c.start_utc).getTime();
      const endMs = new Date(c.end_utc).getTime();
      if (now >= startMs && now <= endMs) {
        active.push({ ...c, _remaining: endMs - now });
      } else if (startMs > now && startMs < now + DAY7) {
        upcoming.push({ ...c, _countdown: startMs - now });
      }
    }
    active.sort((a, b) => a._remaining - b._remaining);
    upcoming.sort((a, b) => new Date(a.start_utc).getTime() - new Date(b.start_utc).getTime());

    // Sort table contests
    let table = [...timeFiltered];
    // Default: exclude past contests from table
    table = table.filter(c => {
      const endMs = new Date(c.end_utc).getTime();
      return endMs >= now - 24 * 60 * 60 * 1000; // keep contests that ended < 24h ago too
    });

    table.sort((a, b) => {
      let av, bv;
      switch (sortField) {
        case "name":
          av = (a.name || "").toLowerCase();
          bv = (b.name || "").toLowerCase();
          break;
        case "sponsor":
          av = (a.sponsor || "").toLowerCase();
          bv = (b.sponsor || "").toLowerCase();
          break;
        case "modes":
          av = (a.mode_families || []).join(",").toLowerCase();
          bv = (b.mode_families || []).join(",").toLowerCase();
          break;
        case "duration_hours":
          av = a.duration_hours || 0;
          bv = b.duration_hours || 0;
          break;
        case "start_utc":
        default:
          av = new Date(a.start_utc).getTime();
          bv = new Date(b.start_utc).getTime();
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return {
      activeContests: active,
      upcomingContests: upcoming.slice(0, 10),
      tableContests: table,
    };
  }, [contests, searchText, modeFilters, bandFilters, durationFilters, timeFilter, sponsorFilter, sortField, sortDir]);

  // ── Reset all filters ──
  const resetFilters = useCallback(() => {
    setSearchText("");
    setModeFilters([]);
    setBandFilters([]);
    setDurationFilters([]);
    setTimeFilter("all");
    setSponsorFilter("all");
  }, []);

  const hasActiveFilters = searchText.trim() || modeFilters.length > 0 || bandFilters.length > 0 ||
    durationFilters.length > 0 || timeFilter !== "all" || sponsorFilter !== "all";

  const totalActive = activeContests.length;
  const totalUpcoming = upcomingContests.length;
  const totalTable = tableContests.length;

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" /> CONTESTS
            <span className="text-[10px] text-muted-foreground font-normal">({totalTable})</span>
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
              title="Filter ein-/ausblenden"
            >
              <Filter className="w-3 h-3" /> Filter
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </button>
            <button
              onClick={refreshContests}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              title="Contests synchronisieren"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Summary: On the Air + Next 7 Days */}
        {(totalActive > 0 || totalUpcoming > 0) && (
          <div className="border-b border-border">
            {totalActive > 0 && (
              <div className="bg-green-50 dark:bg-green-950/20">
                <div className="px-3 py-1 text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wide flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" /> On the Air ({totalActive})
                </div>
                <div className="px-3 pb-2 space-y-1">
                  {activeContests.slice(0, 3).map((c, i) => (
                    <div key={`act-${c.uid || i}`} className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-foreground truncate flex-1">{c.name}</span>
                      <span className="text-[10px] font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                        {formatRemaining(c._remaining)}
                      </span>
                      {c.rules_url && (
                        <a
                          href={c.rules_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          title="Regeln"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {totalUpcoming > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20">
                <div className="px-3 py-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" /> Nächste 7 Tage ({totalUpcoming})
                </div>
                <div className="px-3 pb-2 space-y-1">
                  {upcomingContests.slice(0, 3).map((c, i) => (
                    <div key={`upc-${c.uid || i}`} className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-foreground truncate flex-1">{c.name}</span>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                        {formatCountdown(c._countdown)}
                      </span>
                      {c.rules_url && (
                        <a
                          href={c.rules_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          title="Regeln"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter Section */}
        {showFilters && (
          <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-950/10 border-b border-amber-500/20 space-y-2">
            {/* Text Search */}
            <div className="flex items-center gap-1.5">
              <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Name oder Sponsor suchen…"
                className="flex-1 min-w-0 text-[10px] px-2 py-1 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50"
              />
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[9px] px-1.5 py-1 rounded text-muted-foreground hover:text-foreground border border-border hover:bg-muted flex-shrink-0"
                  title="Filter zurücksetzen"
                >
                  <RotateCcw className="w-3 h-3" /> Zurück
                </button>
              )}
            </div>

            {/* Mode Filter (multi-select) */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-muted-foreground font-medium flex-shrink-0">Modus:</span>
              {MODE_OPTIONS.map(m => (
                <FilterChip
                  key={m}
                  label={m}
                  active={modeFilters.includes(m)}
                  onClick={() => setModeFilters(prev =>
                    prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                  )}
                />
              ))}
            </div>

            {/* Band Filter (multi-select) */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-muted-foreground font-medium flex-shrink-0">Band:</span>
              {BAND_OPTIONS.map(b => (
                <FilterChip
                  key={b}
                  label={b}
                  active={bandFilters.includes(b)}
                  onClick={() => setBandFilters(prev =>
                    prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]
                  )}
                />
              ))}
            </div>

            {/* Duration Filter (multi-select) */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-muted-foreground font-medium flex-shrink-0">Dauer:</span>
              {DURATION_OPTIONS.map(d => (
                <FilterChip
                  key={d.value}
                  label={d.label}
                  active={durationFilters.includes(d.value)}
                  onClick={() => setDurationFilters(prev =>
                    prev.includes(d.value) ? prev.filter(x => x !== d.value) : [...prev, d.value]
                  )}
                />
              ))}
            </div>

            {/* Time + Sponsor Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground font-medium flex-shrink-0">Zeit:</span>
                {TIME_OPTIONS.map(t => (
                  <FilterChip
                    key={t.value}
                    label={t.label}
                    active={timeFilter === t.value}
                    onClick={() => setTimeFilter(t.value)}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground font-medium flex-shrink-0">Sponsor:</span>
              <select
                value={sponsorFilter}
                onChange={(e) => setSponsorFilter(e.target.value)}
                className="text-[10px] px-2 py-1 rounded border border-border bg-background text-foreground focus:outline-none focus:border-amber-500/50 max-w-[200px]"
              >
                <option value="all">Alle Sponsoren</option>
                {sponsors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Result count */}
        <div className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border/50 flex justify-between items-center">
          <span>{totalTable} Konteste gefunden</span>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-[9px] text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
            >
              <X className="w-2.5 h-2.5" /> Filter löschen
            </button>
          )}
        </div>

        {/* Table */}
        <div className="max-h-[50vh] overflow-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin" /> Contests werden geladen…
            </div>
          ) : totalTable === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Keine Contests gefunden.
              {contests.length === 0 && " Admin kann Contests über die Aktualisieren-Taste synchronisieren."}
            </div>
          ) : (
            <table className="w-full text-xs spot-table spot-table-responsive">
              <thead className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-1.5">
                    <SortHeader label="Name" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-2 py-1.5 hidden sm:table-cell">
                    <SortHeader label="Sponsor" field="sponsor" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-2 py-1.5 hidden md:table-cell">
                    <SortHeader label="Modus" field="modes" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-2 py-1.5 hidden lg:table-cell">Bänder</th>
                  <th className="text-left px-2 py-1.5">
                    <SortHeader label="Datum/Zeit" field="start_utc" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-2 py-1.5 hidden sm:table-cell">
                    <SortHeader label="Dauer" field="duration_hours" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="text-left px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {tableContests.map((c, i) => {
                  const now = Date.now();
                  const startMs = new Date(c.start_utc).getTime();
                  const endMs = new Date(c.end_utc).getTime();
                  const isActive = now >= startMs && now <= endMs;
                  const isUpcoming = startMs > now;
                  const remaining = isActive ? endMs - now : 0;
                  const countdown = isUpcoming ? startMs - now : 0;

                  return (
                    <tr
                      key={c.uid || c.id || i}
                      onClick={() => setSelectedContest(c)}
                      className="border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 py-1.5">
                        <div className="font-bold text-foreground text-xs truncate max-w-[140px]">{c.name}</div>
                        <div className="text-[9px] text-muted-foreground truncate sm:hidden">{c.sponsor}</div>
                      </td>
                      <td className="px-2 py-1.5 hidden sm:table-cell">
                        <span className="text-[10px] text-muted-foreground">{c.sponsor || "—"}</span>
                      </td>
                      <td className="px-2 py-1.5 hidden md:table-cell">
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                          {(c.mode_families || c.modes || []).join(", ") || "—"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 hidden lg:table-cell">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {(c.band_families || c.bands || []).length > 3
                            ? `${(c.band_families || c.bands || []).slice(0, 3).join(", ")} +${(c.band_families || c.bands || []).length - 3}`
                            : (c.band_families || c.bands || []).join(", ") || "—"
                          }
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-[10px] font-mono text-foreground">{formatTableDate(c.start_utc)}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">{formatLocalDate(c.start_utc)}</div>
                      </td>
                      <td className="px-2 py-1.5 hidden sm:table-cell">
                        <span className="text-[10px] text-muted-foreground">{formatDurationShort(c.duration_hours)}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        {isActive ? (
                          <span className="text-[10px] font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                            {formatRemaining(remaining)}
                          </span>
                        ) : isUpcoming ? (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {formatCountdown(countdown)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">beendet</span>
                        )}
                        {c.rules_url && (
                          <a
                            href={c.rules_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-1 text-muted-foreground hover:text-foreground inline-flex"
                            title="Regeln"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
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
          <span>
            Auto-Refresh 60s
            {lastUpdate && ` · Aktualisiert: ${lastUpdate.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`}
          </span>
          <span>Quelle: contestclock.com (CC BY 4.0)</span>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedContest && (
        <ContestDetailModal
          contest={selectedContest}
          onClose={() => setSelectedContest(null)}
        />
      )}
    </>
  );
}