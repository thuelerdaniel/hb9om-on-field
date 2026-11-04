import React, { useState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { Z } from "@/lib/zLayers";

// Dezenter Ladehinweis (v1.0).
//
// Vorher: grosses Kärtchen mit Tipps mitten auf der Karte, das den Blick blockierte.
// Jetzt: eine schmale Leiste am oberen Rand mit Quelle, dünnem Fortschrittsbalken
// und Abbrechen-Knopf. Wichtig: Die Leiste fängt KEINE Klicks ab (pointer-events-none),
// die Karte bleibt während des Ladens voll bedienbar — nur der Abbrechen-Knopf ist
// anklickbar.

// Mindest-Anzeigedauer, damit der Hinweis bei schnellen Ladevorgängen nicht flackert.
const MIN_VISIBLE_MS = 800;

export default function RadioLoader({ isLoading, onCancel, message, progress }) {
  const [visible, setVisible] = useState(false);
  const minVisibleUntil = useRef(0);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      minVisibleUntil.current = Math.max(minVisibleUntil.current, Date.now() + MIN_VISIBLE_MS);
      return;
    }
    const remaining = Math.max(0, minVisibleUntil.current - Date.now());
    const hideTimer = setTimeout(() => setVisible(false), remaining);
    return () => clearTimeout(hideTimer);
  }, [isLoading]);

  if (!visible) return null;

  const loadingText = message || "Daten werden im Hintergrund geladen…";
  const hasProgress = typeof progress === "number" && Number.isFinite(progress);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ top: "calc(3.5rem + env(safe-area-inset-top, 0px))", zIndex: Z.MAP_HINT }}
    >
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-full shadow-md border border-gray-200 dark:border-slate-700 pl-3 pr-1 py-1 flex items-center gap-2 max-w-[calc(100vw-1.5rem)]">
        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
        <span className="text-[11px] text-gray-600 dark:text-slate-300 truncate">{loadingText}</span>

        {/* Dünner Fortschrittsbalken — bestimmt (progress) oder unbestimmt */}
        <span className="relative w-12 h-1 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden flex-shrink-0">
          {hasProgress ? (
            <span
              className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
            />
          ) : (
            <span className="absolute inset-y-0 left-0 w-1/2 bg-blue-500 rounded-full animate-loader-slide" />
          )}
        </span>

        {onCancel && (
          <button
            onClick={onCancel}
            className="pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
            title="Laden abbrechen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <style>{`
        @keyframes loader-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-loader-slide { animation: loader-slide 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}