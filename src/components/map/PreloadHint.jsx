import React, { useState } from "react";
import { Link } from "react-router-dom";
import { X, Download, Zap } from "lucide-react";
import { isOfflineReady } from "@/lib/offlineDataCache";

export default function PreloadHint({ activeLayers, isLoading }) {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("hb9om_preload_hint_dismissed") === "true"
  );

  // Show hint when: many layers active, no local cache, and data is loading
  const shouldShow =
    !dismissed && !isOfflineReady() && activeLayers.length >= 3 && isLoading;

  if (!shouldShow) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("hb9om_preload_hint_dismissed", "true");
  };

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1001] bg-white rounded-lg shadow-xl border border-blue-200 px-3.5 py-2.5 max-w-md w-[calc(100%-1.5rem)] flex items-start gap-2.5">
      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Zap className="w-4 h-4 text-blue-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900">App beschleunigen</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
          {activeLayers.length} Layer aktiv — lade Referenzen vorab in den Einstellungen, damit die App schneller reagiert und offline nutzbar ist. Benötigt lokalen Speicherplatz.
        </p>
        <Link
          to="/settings"
          className="text-[11px] text-blue-600 hover:underline font-medium flex items-center gap-1 mt-1"
        >
          <Download className="w-3 h-3" /> Jetzt vorab laden
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="p-0.5 hover:bg-gray-100 rounded text-gray-400 flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}