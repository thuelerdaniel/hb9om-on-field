// ContestPanel — ContestClock.com Integration im Hunting-Modul.
// Zeigt aktive Contests ("on the air" mit Restzeit-Countdown) und kommende Contests (nächste 7 Tage).
// Offline: Daten aus Contest-Entity (DB), Refresh wenn online.
// Filter: Modus (CW, SSB, RTTY, Digital, FM) und Band.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CalendarClock, RefreshCw, ExternalLink, Radio } from "lucide-react";
import { base44 } from "@/api/base44Client";

const REFRESH_MS = 60 * 1000;

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

function formatDateLabel(isoStr) {
  const d = new Date(isoStr);
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  if (diffDays > 1 && diffDays < 7) return `in ${diffDays} Tagen`;
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" });
}

const MODE_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "CW", label: "CW" },
  { value: "SSB", label: "SSB" },
  { value: "RTTY", label: "RTTY" },
  { value: "Digital", label: "Digital" },
  { value: "FM", label: "FM" },
];

export default function ContestPanel() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modeFilter, setModeFilter] = useState("all");
  const [lastUpdate, setLastUpdate] = useState(null);

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

  const now = useMemo(() => Date.now(), [lastUpdate]);

  const { activeContests, upcomingContests } = useMemo(() => {
    const filtered = modeFilter === "all"
      ? contests
      : contests.filter(c => {
          if (!c.modes || !Array.isArray(c.modes)) return false;
          if (modeFilter === "Digital") {
            return c.modes.some(m => ["RTTY", "PSK", "FT8", "FT4", "Digital"].includes(m));
          }
          return c.modes.includes(modeFilter);
        });

    const active = [];
    const upcoming = [];
    for (const c of filtered) {
      const startMs = new Date(c.start_utc).getTime();
      const endMs = new Date(c.end_utc).getTime();
      if (now >= startMs && now <= endMs) {
        active.push({ ...c, _remaining: endMs - now });
      } else if (startMs > now && startMs < now + 7 * 24 * 60 * 60 * 1000) {
        upcoming.push({ ...c, _countdown: startMs - now });
      }
    }
    active.sort((a, b) => a._remaining - b._remaining);
    upcoming.sort((a, b) => new Date(a.start_utc).getTime() - new Date(b.start_utc).getTime());
    return { activeContests: active, upcomingContests: upcoming.slice(0, 20) };
  }, [contests, modeFilter, now]);

  const totalActive = activeContests.length;
  const totalUpcoming = upcomingContests.length;

  return (
    <>
      {/* Mode Filter + Refresh */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border overflow-x-auto">
        <span className="text-[9px] text-muted-foreground font-medium flex-shrink-0">Modus:</span>
        {MODE_FILTERS.map(m => (
          <button
            key={m.value}
            onClick={() => setModeFilter(m.value)}
            className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
              modeFilter === m.value
                ? "bg-amber-500 text-white"
                : "bg-background text-muted-foreground border border-border hover:bg-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
        <button
          onClick={refreshContests}
          disabled={refreshing}
          className="flex-shrink-0 ml-auto text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Contests synchronisieren"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-[45vh] overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> Contests werden geladen…
          </div>
        ) : totalActive === 0 && totalUpcoming === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Keine Contests gefunden.{" "}
            {contests.length === 0 && "Admin kann Contests über die Aktualisieren-Taste synchronisieren."}
          </div>
        ) : (
          <>
            {/* Active Contests */}
            {totalActive > 0 && (
              <div className="border-b border-border">
                <div className="px-3 py-1.5 bg-green-50 dark:bg-green-950/20 text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wide flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" /> On the Air ({totalActive})
                </div>
                {activeContests.map((c, i) => (
                  <ContestRow key={`active-${c.uid || i}`} contest={c} isActive={true} />
                ))}
              </div>
            )}

            {/* Upcoming Contests */}
            {totalUpcoming > 0 && (
              <div>
                <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/20 text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" /> Nächste 7 Tage ({totalUpcoming})
                </div>
                {upcomingContests.map((c, i) => (
                  <ContestRow key={`upcoming-${c.uid || i}`} contest={c} isActive={false} />
                ))}
              </div>
            )}
          </>
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
    </>
  );
}

function ContestRow({ contest, isActive }) {
  const startDate = new Date(contest.start_utc);
  const timeStr = startDate.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = formatDateLabel(contest.start_utc);

  return (
    <div className="px-3 py-2 border-b border-border/50 hover:bg-muted">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-foreground text-sm truncate">{contest.name}</span>
            {contest.sponsor && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                {contest.sponsor}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
            <span className="font-medium">{dateLabel} · {timeStr} UTC</span>
            {contest.modes && contest.modes.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {contest.modes.join(", ")}
              </span>
            )}
            {contest.bands && contest.bands.length > 0 && (
              <span className="font-mono">
                {contest.bands.length > 3
                  ? `${contest.bands.slice(0, 3).join(", ")} +${contest.bands.length - 3}`
                  : contest.bands.join(", ")}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {isActive ? (
            <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
              {formatRemaining(contest._remaining)}
            </span>
          ) : (
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
              {formatCountdown(contest._countdown)}
            </span>
          )}
          {contest.rules_url && (
            <a
              href={contest.rules_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="Contest-Regeln"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}