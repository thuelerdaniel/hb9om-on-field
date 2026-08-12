import React, { useState, useEffect } from "react";
import { AlertTriangle, ChevronDown, X, ZoomIn, Layers, Settings, Database, GripVertical } from "lucide-react";
import { Link } from "react-router-dom";
import { useDraggable } from "@/hooks/useDraggable";

/**
 * Red blinking hint shown above the legend when the viewport contains more
 * markers than the app can safely render (capping is active).
 * Informs the user that not all available data is displayed and gives tips
 * to speed up the app and improve stability.
 */
export default function ViewportLimitHint({ visibleCount, maxRender, totalCount, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("hb9om_viewport_hint_dismissed") === "true");

  // Re-show hint on a new session if capping is still active
  useEffect(() => {
    if (visibleCount <= maxRender) {
      sessionStorage.removeItem("hb9om_viewport_hint_dismissed");
    }
  }, [visibleCount, maxRender]);

  const { containerRef, handleRef } = useDraggable();

  if (dismissed || visibleCount <= maxRender) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("hb9om_viewport_hint_dismissed", "true");
    if (onDismiss) onDismiss();
  };

  return (
    <div ref={containerRef} className="absolute bottom-[8.5rem] left-3 z-[1001] max-w-[calc(100%-11rem)] sm:max-w-sm bg-white rounded-lg shadow-2xl border-2 border-red-500 overflow-hidden">
      {/* Static red header — draggable via handleRef (no blinking for readability) */}
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
          title="Hinweis ausblenden"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sub-line: counts */}
      <div className="px-2.5 py-1 bg-red-50 border-b border-red-100">
        <p className="text-[10px] text-red-800 leading-tight">
          <span className="font-semibold">{maxRender.toLocaleString()}</span> von{" "}
          <span className="font-semibold">{visibleCount.toLocaleString()}</span> Referenzen im Ausschnitt dargestelt — zu viel für flüssige Darstellung.
        </p>
      </div>

      {/* Expandable tips */}
      {expanded && (
        <div className="px-2.5 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">So beschleunigst du die App:</p>

          <div className="flex items-start gap-1.5">
            <ZoomIn className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-600 leading-tight">
              <span className="font-medium text-gray-800">Zoomen:</span> Kartenausschnitt verkleinern — nur sichtbare Marker laden
            </p>
          </div>

          <div className="flex items-start gap-1.5">
            <Layers className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-600 leading-tight">
              <span className="font-medium text-gray-800">Layer reduzieren:</span> Ebenen-Menü → nicht benötigte Layer deaktivieren
            </p>
          </div>

          <div className="flex items-start gap-1.5">
            <Settings className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-600 leading-tight">
              <span className="font-medium text-gray-800">Performance-Modus:</span>{" "}
              <Link to="/settings" className="text-blue-600 hover:underline">Einstellungen</Link> → Performance-Modus aktivieren (5× mehr Marker)
            </p>
          </div>

          <div className="flex items-start gap-1.5">
            <Database className="w-3 h-3 text-gray-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-gray-600 leading-tight">
              <span className="font-medium text-gray-800">Daten vorladen:</span>{" "}
              <Link to="/settings" className="text-blue-600 hover:underline">Einstellungen</Link> → Referenzen lokal speichern für schnellere Ladezeiten
            </p>
          </div>
        </div>
      )}
    </div>
  );
}