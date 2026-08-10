import React, { useState, useEffect } from "react";
import { X, Gift, Check, Eye, AlertTriangle } from "lucide-react";
import { APP_VERSION } from "@/lib/constants";

const STORAGE_KEY = "hb9om_changelog_seen";
const DISMISS_KEY = "hb9om_changelog_dismissed";

export const VERSION_CHANGELOG = [
  {
    version: "1.0",
    title: "Weltweite Referenzen & Performance-Optimierung",
    changes: [
      "SOTA, POTA, WWFF, WWBOTA und Burgen jetzt weltweit — keine Schweizer-Begrenzung mehr",
      "WWFF ersetzt HBFF: 40'000+ Flora-Fauna-Referenzen weltweit mit Koordinaten von wwff.co",
      "WWBOTA weltweit: Alle Bunker-Schemata (HBBOTA, DFBOTA, GBBOTA etc.) geladen",
      "Marker-Sortierung nach Distanz: Schweizer Gipfel werden zuverlässig angezeigt auch bei 180'000+ weltweiten Referenzen",
      "Lade-Indikator mit Abbrechen-Button: Datenladung kann jederzeit abgebrochen werden",
      "Splash-Screen und Hilfe aktualisiert für weltweite Abdeckung",
    ],
  },
  {
    version: "0.9",
    title: "Nordamerika-Relais & POTA-Weltabdeckung",
    changes: [
      "RepeaterBook jetzt mit USA (50 Bundesstaaten + DC) und Kanada (13 Provinzen) — eigene Nordamerika-URL-Struktur",
      "Relais-Symbol aktualisiert: Turm mit Blitz — farbig nach Modulation",
      "Admin: Pro-Relais Web-Link ergänzen und Abdeckungsberechnung anstossen (Button im Popup)",
      "POTA: Inkrementelles Speichern nach jedem Batch — keine Datenverluste mehr bei Timeout, Asien & alle Kontinente jetzt vollständig",
      "Kontinent-Filter «Ganze Welt» umbenannt (vorher «Alle Welt»)",
      "Admin-Bereich: Abdeckungs-Berechnung um USA, Kanada, Japan, Australien, Brasilien erweitert",
      "Externe Datenquellen-Liste aktualisiert mit APRS.fi Koordinaten-Verfeinerung",
    ],
  },
  {
    version: "0.8",
    title: "Weltweite Daten & Länder-Filter",
    changes: [
      "SOTA-Gipfel und POTA-Parks jetzt weltweit (alle ~125'000 Gipfel und alle Parks)",
      "Neues Relais-Symbol: Gekreuzte Dipole (Turnstile-Antenne) — klar vom SOTA-Berg unterscheidbar",
      "IOTA-Inseln weltweit integriert",
      "Kontinent-Filter um Länder erweitert — einzelne Länder oder Mix auswählbar",
      "Pro-Butzer APRS.fi API-Key in den Einstellungen konfigurierbar",
      "Admin: Externe Datenquellen-Liste mit PDF-Export",
      "RepeaterBook-Daten für 68+ Länder (Spanien, Italien, UK, Irland u.v.m.)",
      "Sicherheits-Audit: Auth-Checks für alle Backend-Funktionen",
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Was ist neu in v{APP_VERSION}?</h2>
              <p className="text-slate-400 text-xs">Massgebliche Anpassungen seit v0.8</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {VERSION_CHANGELOG.map((entry, idx) => (
            <div key={idx}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold">
                  v{entry.version}
                </span>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{entry.title}</h3>
              </div>
              <ul className="space-y-2">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Data sources note */}
        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              <strong>Hinweis:</strong> Es sind noch nicht alle Datenquellen eingefügt und abgefragt. Es ist möglich, dass für bestimmte Kontinente oder Länder noch keine Informationen verfügbar sind. Die Datenbank wird laufend erweitert.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col gap-2">
          <button
            onClick={handleClose}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg py-2.5 font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Verstanden
          </button>
          <button
            onClick={handleDontShowAgain}
            className="w-full text-slate-500 dark:text-slate-400 text-xs hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            Nicht mehr anzeigen (in Hilfe reaktivierbar)
          </button>
        </div>
      </div>
    </div>
  );
}