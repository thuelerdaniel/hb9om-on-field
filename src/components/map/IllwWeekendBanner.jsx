import React, { useState, useEffect } from "react";
import { Anchor, X, Radio } from "lucide-react";
import { isIllwWeekendNow, getNextIllwWeekend, formatIllwDate, daysUntilIllw } from "@/lib/illwUtils";

export default function IllwWeekendBanner({ activeCount = 0, onZoomToActive }) {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("hb9om_illw_banner_dismissed") === "true");
  const [isNow, setIsNow] = useState(isIllwWeekendNow());

  useEffect(() => {
    const interval = setInterval(() => {
      setIsNow(isIllwWeekendNow());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("hb9om_illw_banner_dismissed", "true");
  };

  const nextWeekend = getNextIllwWeekend();
  const daysUntil = daysUntilIllw();

  // During ILLW weekend: red banner
  if (isNow) {
    return (
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[1500] bg-red-600 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 max-w-[calc(100vw-2rem)]">
        <Anchor className="w-5 h-5 flex-shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">ILLW {new Date().getFullYear()} läuft!</p>
          <p className="text-[11px] opacity-90">{(activeCount ?? 0).toLocaleString()} Leuchttürme weltweit aktiv</p>
        </div>
        {onZoomToActive && (
          <button
            onClick={onZoomToActive}
            className="px-2 py-1 bg-white/20 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors flex items-center gap-1 flex-shrink-0"
          >
            <Radio className="w-3 h-3" /> Zeigen
          </button>
        )}
        <button onClick={handleDismiss} className="p-0.5 hover:bg-white/20 rounded flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Before ILLW (within 30 days): blue info banner
  if (nextWeekend && daysUntil != null && daysUntil > 0 && daysUntil <= 30) {
    return (
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[1500] bg-blue-600 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 max-w-[calc(100vw-2rem)]">
        <Anchor className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Nächstes ILLW: {formatIllwDate(nextWeekend)}</p>
          <p className="text-[11px] opacity-90">in {daysUntil} Tagen</p>
        </div>
        <button onClick={handleDismiss} className="p-0.5 hover:bg-white/20 rounded flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}