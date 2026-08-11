import React, { useState, useEffect, useRef } from "react";
import { Loader2, ZoomIn, Layers, Settings as SettingsIcon, X } from "lucide-react";
import { Link } from "react-router-dom";

function RadioWaves() {
  return (
    <div className="relative w-20 h-16 flex items-center justify-center">
      {/* Animated radio waves emanating from antenna */}
      <span className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-blue-400 animate-radio-wave" />
      <span className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-blue-400 animate-radio-wave" style={{ animationDelay: "0.5s" }} />
      <span className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-blue-400 animate-radio-wave" style={{ animationDelay: "1s" }} />
      {/* Handheld radio (walkie-talkie) */}
      <svg viewBox="0 0 24 24" className="w-8 h-8 text-gray-700 relative z-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M5 7h10" />
        <path d="M5 17h10" />
        <circle cx="10" cy="12" r="1.5" />
        <path d="M13 3V1h2v2" />
      </svg>
      <style>{`
        @keyframes radio-wave {
          0% { transform: translateX(-50%) scale(0.4); opacity: 1; }
          100% { transform: translateX(-50%) scale(2.5); opacity: 0; }
        }
        .animate-radio-wave {
          animation: radio-wave 1.5s ease-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function RadioLoader({ isLoading, onCancel }) {
  const [showTips, setShowTips] = useState(false);
  const [visible, setVisible] = useState(false);
  const minVisibleUntil = useRef(0);
  const tipsStartedAt = useRef(0);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      // Minimum visible time: 2s from first show
      minVisibleUntil.current = Math.max(minVisibleUntil.current, Date.now() + 2000);
      // Tips appear after 1.5s — only start timer if not already started
      if (tipsStartedAt.current === 0) {
        tipsStartedAt.current = Date.now();
      }
      const elapsed = Date.now() - tipsStartedAt.current;
      const remaining = Math.max(0, 1500 - elapsed);
      const tipsTimer = setTimeout(() => setShowTips(true), remaining);
      return () => clearTimeout(tipsTimer);
    } else {
      // Delay hiding to prevent flicker — keep visible until minimum time expires
      const remaining = Math.max(0, minVisibleUntil.current - Date.now());
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setShowTips(false);
        minVisibleUntil.current = 0;
        tipsStartedAt.current = 0;
      }, remaining + 300); // 300ms grace period beyond minimum
      return () => clearTimeout(hideTimer);
    }
  }, [isLoading]);

  if (!visible) return null;

  return (
    <>
      {/* Compact loader with radio symbol — always visible while loading */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[10002] bg-white dark:bg-slate-800 rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
        <RadioWaves />
        <span className="text-sm text-gray-600 dark:text-slate-300">Daten werden geladen…</span>
        {onCancel && (
          <button
            onClick={onCancel}
            className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-medium transition-colors border border-red-200 dark:border-red-800"
            title="Abbrechen"
          >
            <X className="w-3 h-3" />
            Abbrechen
          </button>
        )}
      </div>

      {/* Extended tips panel — appears after 1.5s */}
      {showTips && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[10002] bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 p-5 max-w-sm w-[90vw]">
          <div className="flex justify-center mb-3">
            <RadioWaves />
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 text-center mb-1">
            Viele Daten werden geladen…
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400 text-center mb-3 leading-relaxed">
            Etwas Geduld bitte — die Referenzdaten werden von externen Quellen geladen.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-slate-300">
              <ZoomIn className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
              <span>Kartenausschnitt verkleinern, um weniger Marker zu laden</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-slate-300">
              <Layers className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
              <span>Weniger Layer aktivieren im Ebenen-Menü</span>
            </div>
            <Link to="/settings" className="flex items-start gap-2 text-xs text-blue-600 hover:underline">
              <SettingsIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>Performance-Modus in den Einstellungen aktivieren</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}