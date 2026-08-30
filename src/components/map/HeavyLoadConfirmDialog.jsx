import React, { useState } from "react";
import { AlertTriangle, Clock, Database, MapPin, X, Check, Layers } from "lucide-react";

// Geschätzte Datenmengen pro Layer-Typ beim weltweiten Laden.
// Wird verwendet, um den User vor dem Laden vieler Daten zu warnen
// und um im Layer-Menü die Punkte- und MB-Zahl anzuzeigen.
export const LAYER_ESTIMATES = {
  sota:         { points: 180000, mb: 35,   seconds: 45, label: "SOTA-Summits" },
  pota:         { points: 89000,  mb: 18,   seconds: 30, label: "POTA-Parks" },
  repeater:     { points: 10000,  mb: 2,    seconds: 15, label: "Amateurfunk-Relais" },
  aprs:         { points: 500,    mb: 0.1,  seconds: 3,  label: "APRS-Nodes (viewport-basiert)" },
  brandmeister: { points: 500,    mb: 0.1,  seconds: 3,  label: "BrandMeister-Nodes (viewport-basiert)" },
  castle:       { points: 30000,  mb: 6,    seconds: 12, label: "Burgen & Schlösser" },
  hbff:         { points: 2000,   mb: 0.5,  seconds: 5,  label: "WWFF-Flora & Fauna" },
  wwbota:       { points: 500,    mb: 0.1,  seconds: 2,  label: "WWBOTA-Bunker" },
  iota:         { points: 1200,   mb: 0.3,  seconds: 3,  label: "IOTA-Inseln" },
  lighthouse:   { points: 2000,   mb: 0.5,  seconds: 5,  label: "Leuchttürme" },
  llota:         { points: 8357,   mb: 2,    seconds: 8,  label: "LLOTA-Seen & Lagunen" },
};

// Ab dieser geschätzten Ladezeit (Sekunden) erscheint der Bestätigungsdialog.
export const LOAD_TIME_THRESHOLD = 7;

// Layer mit geschätzter Ladezeit >= Threshold
export const HEAVY_LAYERS = Object.entries(LAYER_ESTIMATES)
  .filter(([, e]) => e.seconds >= LOAD_TIME_THRESHOLD)
  .map(([k]) => k);

// --- Remembered decisions (localStorage) ---
const DECISIONS_KEY = "hb9om_heavy_load_decisions";

export function getRememberedDecision(layerId) {
  try {
    const data = JSON.parse(localStorage.getItem(DECISIONS_KEY) || "{}");
    if (data.perLayer?.[layerId]?.action) return data.perLayer[layerId].action;
    if (data.global?.action) return data.global.action;
  } catch {}
  return null;
}

export function saveRememberedDecision(layerId, action, scope) {
  try {
    const data = JSON.parse(localStorage.getItem(DECISIONS_KEY) || "{}");
    if (scope === "global") {
      data.global = { action };
    } else {
      data.perLayer = data.perLayer || {};
      data.perLayer[layerId] = { action };
    }
    localStorage.setItem(DECISIONS_KEY, JSON.stringify(data));
  } catch {}
}

export function clearRememberedDecisions() {
  localStorage.removeItem(DECISIONS_KEY);
}

export function hasRememberedDecisions() {
  try {
    const data = JSON.parse(localStorage.getItem(DECISIONS_KEY) || "{}");
    return !!(data.global?.action || (data.perLayer && Object.keys(data.perLayer).length > 0));
  } catch {}
  return false;
}

/**
 * Prüft, ob der Bestätigungsdialog für einen Layer angezeigt werden soll.
 * Nur Layer mit geschätzter Ladezeit >= Threshold und ohne gespeicherte Entscheidung.
 */
export function shouldShowHeavyLoadDialog(layerId) {
  const estimate = LAYER_ESTIMATES[layerId];
  if (!estimate || estimate.seconds < LOAD_TIME_THRESHOLD) return false;
  if (getRememberedDecision(layerId)) return false;
  return true;
}

// Formatierung für Layer-Menü: 180000 → "180k", 1200 → "1.2k"
export function formatPointsShort(p) {
  if (p >= 10000) return `${Math.round(p / 1000)}k`;
  if (p >= 1000) return `${(p / 1000).toFixed(1)}k`;
  return String(p);
}

function formatTime(s) {
  if (s < 60) return `~${s} Sekunden`;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `~${min} Min ${sec} Sek`;
}

/**
 * Bestätigungsdialog, der erscheint, wenn ein Layer mit vielen Datenpunkten
 * (geschätzte Ladezeit >= 7 Sekunden) aktiviert wird.
 * Zeigt eine Schätzung der Punkte, Datenmenge (MB) und Ladezeit.
 * Der User kann die Entscheidung merken lassen (global oder pro Layer).
 */
export default function HeavyLoadConfirmDialog({ layers, onConfirm, onCancel }) {
  const [remember, setRemember] = useState(false);
  const [scope, setScope] = useState("perLayer");

  const estimates = layers.map(l => LAYER_ESTIMATES[l]).filter(Boolean);
  const totalPoints = estimates.reduce((sum, e) => sum + e.points, 0);
  const totalMB = estimates.reduce((sum, e) => sum + e.mb, 0);
  const totalSeconds = estimates.reduce((sum, e) => sum + e.seconds, 0);
  const singleLayer = layers.length === 1;

  const handleConfirm = () => {
    if (remember) {
      layers.forEach(l => saveRememberedDecision(l, "confirm", scope));
    }
    onConfirm();
  };

  const handleCancel = () => {
    if (remember) {
      layers.forEach(l => saveRememberedDecision(l, "cancel", scope));
    }
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[10002] bg-black/50 flex items-center justify-center p-4" onClick={handleCancel}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Viele Daten laden</h3>
            <p className="text-[11px] text-gray-400 dark:text-slate-500">Bitte bestätigen Sie das Laden</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Sie aktivieren {estimates.length > 1 ? "mehrere Layer mit vielen Datenpunkten" : "einen Layer mit vielen Datenpunkten"}:
          </p>

          {/* Layer-Liste */}
          <div className="space-y-2">
            {estimates.map(e => (
              <div key={e.label} className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                <span className="text-sm font-medium text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-gray-400" />
                  {e.label}
                </span>
                <div className="flex gap-3 text-xs text-gray-500 dark:text-slate-400">
                  <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{e.points.toLocaleString()}</span>
                  <span className="flex items-center gap-0.5"><Database className="w-3 h-3" />~{e.mb} MB</span>
                </div>
              </div>
            ))}
          </div>

          {/* Geschätzte Gesamtwerte */}
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 space-y-1.5 border border-amber-100 dark:border-amber-900/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Punkte gesamt:</span>
              <span className="font-semibold text-gray-900 dark:text-slate-100">~{totalPoints.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-slate-400 flex items-center gap-1.5"><Database className="w-3.5 h-3.5" />Geschätzte Datenmenge:</span>
              <span className="font-semibold text-gray-900 dark:text-slate-100">~{totalMB} MB</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-slate-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Geschätzte Ladezeit:</span>
              <span className="font-semibold text-gray-900 dark:text-slate-100">{formatTime(totalSeconds)}</span>
            </div>
          </div>

          {/* Entscheidung merken */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 accent-blue-600 flex-shrink-0"
              />
              <span className="text-xs text-gray-600 dark:text-slate-400">Entscheidung merken (nicht mehr anzeigen)</span>
            </label>
            {remember && (
              <div className="flex items-center gap-3 pl-6">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="remember-scope"
                    value="perLayer"
                    checked={scope === "perLayer"}
                    onChange={() => setScope("perLayer")}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">Nur für {singleLayer ? "diesen Layer" : "diese Layer"}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="remember-scope"
                    value="global"
                    checked={scope === "global"}
                    onChange={() => setScope("global")}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  <span className="text-[11px] text-gray-500 dark:text-slate-400">Für alle Layer</span>
                </label>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">
            <strong>Abbrechen</strong> aktiviert den Layer, lädt aber nur die sichtbaren Punkte im aktuellen Ausschnitt. So können Sie zuerst die Karte anpassen (zoomen/verschieben) und später mehr Daten laden.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" /> Abbrechen (nur sichtbar)
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Laden bestätigen
          </button>
        </div>
      </div>
    </div>
  );
}