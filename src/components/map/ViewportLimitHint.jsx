import React, { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, X, ZoomIn, Layers, Settings, Database, GripVertical } from "lucide-react";
import { Link } from "react-router-dom";
import { useDraggable } from "@/hooks/useDraggable";

/**
 * Red blinking hint shown above the legend when the viewport contains more
 * markers than the app can safely render (capping is active).
 * Informs the user that not all available data is displayed and gives tips
 * to speed up the app and improve stability.
 *
 * Action buttons: "Layer reduzieren" (opens layer menu), "Performance-Modus" (settings),
 * "Schliessen" (dismiss). After dismiss, stays hidden for 30s. Auto-hides when <500 markers.
 */
export default function ViewportLimitHint({ visibleCount, maxRender, totalCount, onDismiss, onOpenLayers }) {
  const [expanded, setExpanded] = useState(true);
  const [dismissedAt, setDismissedAt] = useState(() => {
    const ts = sessionStorage.getItem("hb9om_viewport_hint_dismissed_at");
    return ts ? parseInt(ts, 10) : 0;
  });

  // Auto-hide when <500 markers OR not capping
  const AUTO_HIDE_THRESHOLD = 500;
  const isCapped = visibleCount > maxRender;
  const shouldAutoHide = visibleCount < AUTO_HIDE_THRESHOLD || !isCapped;

  // Re-show hint if 30s have passed since dismiss AND capping is still active
  useEffect(() => {
    if (shouldAutoHide) {
      sessionStorage.removeItem("hb9om_viewport_hint_dismissed_at");
    }
  }, [shouldAutoHide]);

  const { containerRef, handleRef } = useDraggable();

  // Check if dismissed within last 30s
  const DISMISS_COOLDOWN_MS = 30000;
  const now = Date.now();
  const isInCooldown = dismissedAt > 0 && (now - dismissedAt) < DISMISS_COOLDOWN_MS;

  if (shouldAutoHide) return null;
  if (isInCooldown) return null;

  const handleDismiss = () => {
    const ts = Date.now();
    setDismissedAt(ts);
    sessionStorage.setItem("hb9om_viewport_hint_dismissed_at", String(ts));
    if (onDismiss) onDismiss();
  };

  return (
    <div ref={containerRef} className="absolute bottom-[8.5rem] left-3 z-[1001] max-w-[calc(100%-11rem)] sm:max-w-sm bg-white rounded-lg shadow-2xl border-2 border-red-500 overflow-hidden">
      {/* Static red header — draggable via handleRef */}
      <div ref={handleRef} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500 text-white cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50" />
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-[11px] font-bold flex-1">Nicht alle Daten angezeigt</span>
        <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded">
          {maxRender.toLocaleString()} / {visibleCount.toLocaleString()}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 hover:bg-white/20 rounded transition-colors"
          title={expanded ? "Tipps ausblenden" : "Tipps anzeigen"}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={handleDismiss}
          className="p-0.5 hover:bg-white/20 rounded transition-colors"
          title="Hinweis ausblenden (30s)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub-line: counts */}
      <div className="px-2.5 py-1 bg-red-50 border-b border-red-100">
        <p className="text-[10px] text-red-800 leading-tight">
          <span className="font-semibold">{maxRender.toLocaleString()}</span> von{" "}
          <span className="font-semibold">{visibleCount.toLocaleString()}</span> Referenzen im Ausschnitt dargestellt — zu viel für flüssige Darstellung.
        </p>
      </div>

      {/* Expandable tips + action buttons */}
      {expanded && (
        <div className="px-2.5 py-2 space-y-2">
          <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">So beschleunigst du die App:</p>

          <div className="flex items-start gap-1.5">
            <ZoomIn className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-600 leading-tight">
              <span className="font-medium text-gray-800">Zoomen:</span> Kartenausschnitt verkleinern — nur sichtbare Marker laden
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {onOpenLayers && (
              <button
                onClick={onOpenLayers}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-medium hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <Layers className="w-3 h-3" />
                Layer reduzieren
              </button>
            )}
            <Link
              to="/settings"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-[10px] font-medium hover:bg-purple-100 transition-colors border border-purple-200"
            >
              <Settings className="w-3 h-3" />
              Performance-Modus
            </Link>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-medium hover:bg-gray-200 transition-colors"
            >
              <X className="w-3 h-3" />
              Schliessen
            </button>
          </div>

          <div className="flex items-start gap-1.5 pt-1 border-t border-gray-100">
            <Database className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-600 leading-tight">
              <span className="font-medium text-gray-800">Daten vorladen:</span>{" "}
              <Link to="/settings" className="text-blue-600 hover:underline">Einstellungen</Link> → Referenzen lokal speichern
            </p>
          </div>
        </div>
      )}
    </div>
  );
}