import React, { useState, useEffect } from "react";
import { Loader2, ZoomIn, Layers, Settings as SettingsIcon } from "lucide-react";
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

export default function RadioLoader({ isLoading }) {
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowTips(false);
      return;
    }
    const timer = setTimeout(() => setShowTips(true), 1500);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <>
      {/* Compact spinner — always visible while loading (above splash z-10000) */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[10002] bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
        <span className="text-sm text-gray-600">Daten werden geladen…</span>
      </div>

      {/* Extended tips panel — appears after 3s */}
      {showTips && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-[10002] bg-white rounded-2xl shadow-xl border border-gray-200 p-5 max-w-sm w-[90vw]">
          <div className="flex justify-center mb-3">
            <RadioWaves />
          </div>
          <p className="text-sm font-semibold text-gray-900 text-center mb-1">
            Viele Daten werden geladen…
          </p>
          <p className="text-xs text-gray-500 text-center mb-3 leading-relaxed">
            Etwas Geduld bitte — die Referenzdaten werden von externen Quellen geladen.
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <ZoomIn className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <span>Kartenausschnitt verkleinern, um weniger Marker zu laden</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-600">
              <Layers className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
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