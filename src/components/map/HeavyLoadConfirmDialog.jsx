import React from "react";
import { AlertTriangle, Clock, Database, MapPin, X, Check, Layers } from "lucide-react";

// Geschätzte Datenmengen pro Layer-Typ beim weltweiten Laden.
// Wird verwendet, um den User vor dem Laden vieler Daten zu warnen.
export const HEAVY_LAYER_ESTIMATES = {
  sota: { points: 180000, mb: 35, seconds: 45, label: "SOTA-Summits" },
  pota: { points: 89000, mb: 18, seconds: 30, label: "POTA-Parks" },
  repeater: { points: 10000, mb: 2, seconds: 15, label: "Amateurfunk-Relais" },
  aprs: { points: 15000, mb: 3, seconds: 20, label: "APRS-Nodes" },
  brandmeister: { points: 15000, mb: 3, seconds: 20, label: "BrandMeister-Nodes" },
};

export const HEAVY_LAYERS = Object.keys(HEAVY_LAYER_ESTIMATES);

function formatTime(s) {
  if (s < 60) return `~${s} Sekunden`;
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `~${min} Min ${sec} Sek`;
}

/**
 * Bestätigungsdialog, der erscheint, wenn ein Layer mit vielen Datenpunkten
 * aktiviert wird. Zeigt eine Schätzung der Punkte, Datenmenge (MB) und Ladezeit,
 * damit der User entscheiden kann, ob er das Laden bestätigt oder abbricht,
 * um zuerst Kartenanpassungen vorzunehmen.
 */
export default function HeavyLoadConfirmDialog({ layers, onConfirm, onCancel }) {
  const estimates = layers.map(l => HEAVY_LAYER_ESTIMATES[l]).filter(Boolean);
  const totalPoints = estimates.reduce((sum, e) => sum + e.points, 0);
  const totalMB = estimates.reduce((sum, e) => sum + e.mb, 0);
  const totalSeconds = estimates.reduce((sum, e) => sum + e.seconds, 0);

  return (
    <div className="fixed inset-0 z-[10002] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
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

          <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">
            <strong>Abbrechen</strong> aktiviert den Layer, lädt aber nur die sichtbaren Punkte im aktuellen Ausschnitt. So können Sie zuerst die Karte anpassen (zoomen/verschieben) und später mehr Daten laden.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" /> Abbrechen (nur sichtbar)
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Laden bestätigen
          </button>
        </div>
      </div>
    </div>
  );
}