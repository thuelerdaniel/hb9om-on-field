import React, { useState, useEffect } from "react";
import { X, Gift, Check, Eye, AlertTriangle } from "lucide-react";
import { APP_VERSION } from "@/lib/constants";
import { Z } from "@/lib/zLayers";

const STORAGE_KEY = "hb9om_changelog_seen";
const DISMISS_KEY = "hb9om_changelog_dismissed";

export const VERSION_CHANGELOG = [
  {
    version: "1.001",
    title: "Version 1.001 — kleine Korrekturen und Bugfixing",
    changes: [
      "MENÜBAND LINKS — Der Streifen umschliesst die Knöpfe jetzt genau: oben und unten kein Leerraum mehr, alle Knöpfe vollständig sichtbar.",
      "Kleine Korrekturen und Bugfixing an der Bedienung.",
      "PDFs — Hilfe, Admin-Hilfe, Relais-Liste, Route und Flyer zeigen die Versionsnummer 1.001.",
    ],
  },
];

export function hasSeenCurrentChangelog() {
  try {
    return localStorage.getItem(STORAGE_KEY) === APP_VERSION;
  } catch { return false; }
}

export function markChangelogSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
  } catch {}
}

export function isChangelogPermanentlyDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch { return false; }
}

export function setChangelogPermanentlyDismissed(value) {
  try {
    localStorage.setItem(DISMISS_KEY, String(value));
  } catch {}
}

export function resetChangelog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DISMISS_KEY);
  } catch {}
}

export default function VersionChangelogPopup({ onClose }) {
  const [visible, setVisible] = useState(true);
  // v1.0: standardmässig nur die aktuelle Version zeigen — ältere auf Wunsch.
  const [showAll, setShowAll] = useState(false);
  const entries = showAll ? VERSION_CHANGELOG : VERSION_CHANGELOG.slice(0, 1);
  const olderCount = VERSION_CHANGELOG.length - 1;

  const handleClose = () => {
    setVisible(false);
    markChangelogSeen();
    setTimeout(() => onClose && onClose(), 300);
  };

  const handleDontShowAgain = () => {
    setChangelogPermanentlyDismissed(true);
    handleClose();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0, zIndex: Z.DIALOG_TOP }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full mx-3 max-h-[72vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <Gift className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">Was ist neu in v{APP_VERSION}?</h2>
              <p className="text-slate-400 text-[10px] leading-tight">Kleine Korrekturen und Bugfixing</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/50 hover:text-white transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content — interner Scroll, kompakte Abstände */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {entries.map((entry, idx) => (
            <div key={idx} className={idx > 0 ? "mt-4" : ""}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold">
                  v{entry.version}
                </span>
                <h3 className="font-semibold text-slate-900 dark:text-white text-xs leading-snug">{entry.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] leading-snug text-slate-700 dark:text-slate-300">
                    <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-[3px]" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {!showAll && olderCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-3 w-full text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 py-1.5 border-t border-slate-200 dark:border-slate-700"
            >
              Ältere Versionen anzeigen ({olderCount})
            </button>
          )}
        </div>

        {/* Data sources note — kompakt */}
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-900 flex-shrink-0">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800 dark:text-amber-200 leading-snug">
              Noch nicht alle Datenquellen sind eingebunden — einzelne Länder können lückenhaft sein. Die Datenbank wird laufend erweitert.
            </p>
          </div>
        </div>

        {/* Footer — kompakt */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2.5 flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={handleClose}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg py-2 font-medium text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Verstanden
          </button>
          <button
            onClick={handleDontShowAgain}
            className="w-full text-slate-500 dark:text-slate-400 text-[10px] hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1"
          >
            <Eye className="w-3 h-3" />
            Nicht mehr anzeigen (in Hilfe reaktivierbar)
          </button>
        </div>
      </div>
    </div>
  );
}