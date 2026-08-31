// Mobil.jsx — Hauptseite für das Mobil-Tab.
// Verwaltet Modus-Umschaltung (Route/Live), GPS + Wake Lock, rendert Route- oder Live-Modus.

import React, { useState, lazy, Suspense } from "react";
import { Smartphone, Loader2 } from "lucide-react";
import { useMobilGps } from "@/hooks/useMobilGps";
import MobilModeToggle from "@/components/mobil/MobilModeToggle";
import BottomNavigation from "@/components/BottomNavigation";

const MobilRouteMode = lazy(() => import("@/components/mobil/MobilRouteMode"));
const MobilLiveMode = lazy(() => import("@/components/mobil/MobilLiveMode"));

export default function Mobil() {
  const [mode, setMode] = useState("route");
  const { position, accuracy, gpsActive, gpsError } = useMobilGps(true);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      {/* Header */}
      <header
        className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900 dark:text-slate-100">Mobil</h1>
            <p className="text-[10px] text-gray-400">
              {gpsActive
                ? `GPS aktiv${accuracy != null ? ` · ±${Math.round(accuracy)}m` : ""}`
                : gpsError || "GPS wird gesucht..."}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
        {/* Modus-Umschalter */}
        <MobilModeToggle mode={mode} onChange={setMode} />

        {/* Modus-Inhalt */}
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          }
        >
          {mode === "route" ? (
            <MobilRouteMode gpsPosition={position} />
          ) : (
            <MobilLiveMode
              gpsPosition={position}
              accuracy={accuracy}
              gpsActive={gpsActive}
              gpsError={gpsError}
            />
          )}
        </Suspense>
      </div>

      <BottomNavigation />
    </div>
  );
}