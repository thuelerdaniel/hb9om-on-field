import React, { useState, useEffect } from "react";
import { Radio, X, Coffee } from "lucide-react";
import { APP_VERSION } from "@/lib/constants";

export default function SplashScreen({ onDismiss }) {
  const [visible, setVisible] = useState(true);

  // No internal auto-dismiss — parent controls timing (min 3s)
  const handleClose = () => {
    setVisible(false);
    if (onDismiss) setTimeout(onDismiss, 300);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="text-center px-8">
        <a
          href="https://hb9om.ch"
          target="_blank"
          rel="noopener noreferrer"
          className="block group"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-6 group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
            <Radio className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            HB9OM On Field
          </h1>

          <p className="text-lg text-slate-300 mb-1">
            Amateurfunk Referenzen weltweit
          </p>

          <p className="text-sm text-slate-400 mb-6">
            Besuchen Sie <span className="text-blue-400 group-hover:underline font-medium">hb9om.ch</span> für mehr Informationen
          </p>

          <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 border border-white/20">
            <span className="text-sm font-mono text-slate-200">Version {APP_VERSION}</span>
          </div>
        </a>

        {/* Donation hint */}
        <a
          href="https://paypal.me/Thueler"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-colors"
        >
          <Coffee className="w-3.5 h-3.5" />
          Spende doch was ☕
        </a>

        <p className="text-[10px] text-slate-500 mt-4 max-w-xs mx-auto leading-relaxed text-center">
          Haftungsausschluss: Diese App wird ohne jegliche Gewährleistung bereitgestellt.
          Es wird keine Haftung für Fehler, Datenverluste oder andere Probleme übernommen.
          Die Nutzung erfolgt auf eigene Verantwortung.
        </p>

        <div className="mt-8">
          <div className="w-32 h-1 bg-white/10 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
              style={{ animation: "splash-progress 1.5s linear forwards" }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes splash-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .splash-progress-bar {
          animation: splash-progress 1.5s linear forwards;
        }
      `}</style>
    </div>
  );
}