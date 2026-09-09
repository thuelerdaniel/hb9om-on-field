// ContestDetailModal — Detail-Ansicht eines Contests.
// Zeigt alle Felder + Regeln-Link. Wird von ContestTable bei Zeilen-Klick geöffnet.

import React from "react";
import { X, ExternalLink, Trophy, Clock, Radio, Globe, MapPin, CheckCircle2, XCircle } from "lucide-react";

function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const utc = d.toLocaleString("de-CH", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
  const local = d.toLocaleString("de-CH", {
    weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  return { utc, local };
}

function formatDuration(hours) {
  if (!hours || hours <= 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

export default function ContestDetailModal({ contest, onClose }) {
  if (!contest) return null;
  const start = formatDateTime(contest.start_utc);
  const end = formatDateTime(contest.end_utc);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-start gap-2">
          <Trophy className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground leading-tight">{contest.name}</h2>
            {contest.sponsor && (
              <p className="text-xs text-muted-foreground mt-0.5">{contest.sponsor}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5">
            {contest.verified ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verifiziert
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 font-medium flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Unverifiziert
              </span>
            )}
            {contest.can_enter ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-medium">
                Teilnahme möglich
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 font-medium">
                Teilnahme eingeschränkt
              </span>
            )}
            {contest.eligibility_scope && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {contest.eligibility_scope}
              </span>
            )}
          </div>

          {/* Date/Time */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground">Start:</span>
              <span className="text-muted-foreground">{start.local}</span>
              <span className="text-[10px] text-muted-foreground font-mono">({start.utc})</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground">Ende:</span>
              <span className="text-muted-foreground">{end.local}</span>
              <span className="text-[10px] text-muted-foreground font-mono">({end.utc})</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-foreground">Dauer:</span>
              <span className="text-muted-foreground">{formatDuration(contest.duration_hours)}</span>
            </div>
          </div>

          {/* Modes */}
          {contest.modes && contest.modes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                <Radio className="w-3 h-3" /> Modi
              </div>
              <div className="flex flex-wrap gap-1">
                {contest.modes.map(m => (
                  <span key={m} className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 font-medium">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bands */}
          {contest.bands && contest.bands.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
                <Radio className="w-3 h-3" /> Bänder
              </div>
              <div className="flex flex-wrap gap-1">
                {contest.bands.map(b => (
                  <span key={b} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Country + Scope */}
          <div className="flex items-center gap-4 text-xs">
            {contest.country && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">Land:</span>
                <span className="text-muted-foreground">{contest.country}</span>
              </div>
            )}
            {contest.eligibility_scope && (
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">Bereich:</span>
                <span className="text-muted-foreground">{contest.eligibility_scope}</span>
              </div>
            )}
          </div>

          {/* Contest ID */}
          {contest.contest_id && (
            <div className="text-[10px] text-muted-foreground font-mono">
              ID: {contest.contest_id}
            </div>
          )}
        </div>

        {/* Footer — Rules link */}
        {contest.rules_url && (
          <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3">
            <a
              href={contest.rules_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Contest-Regeln öffnen
            </a>
          </div>
        )}
      </div>
    </div>
  );
}