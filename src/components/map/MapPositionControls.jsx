import React, { useState } from "react";
import { LocateFixed, Crosshair, CloudOff, Cloud } from "lucide-react";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

export default function MapPositionControls({
  onCenterPosition,
  onGetGps,
  isOffline,
  onToggleOffline,
}) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const { containerRef } = useDraggablePosition("drag-position-controls");

  const handleGpsClick = () => {
    setGpsLoading(true);
    onGetGps?.(() => setGpsLoading(false));
  };

  return (
    <div
      ref={containerRef}
      className="absolute left-3 top-28 z-[1000] flex flex-col gap-2"
      style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}
    >
      {/* Offline mode toggle */}
      <button
        onClick={onToggleOffline}
        className={`w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border transition-colors ${
          isOffline
            ? "bg-amber-500 border-amber-600 text-white"
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
        }`}
        title={isOffline ? "Offline-Modus aktiv — tippen für Online" : "Online-Modus — tippen für Offline"}
      >
        {isOffline ? <CloudOff className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
      </button>

      {/* GPS position button */}
      <button
        onClick={handleGpsClick}
        disabled={gpsLoading}
        className={`w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border transition-colors ${
          gpsLoading
            ? "bg-blue-100 border-blue-300 text-blue-500 animate-pulse"
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100"
        }`}
        title="Aktuelle GPS-Position abrufen"
      >
        <Crosshair className="w-5 h-5" />
      </button>

      {/* Center on saved position */}
      <button
        onClick={onCenterPosition}
        className="w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        title="Karte auf gespeicherte Position zentrieren"
      >
        <LocateFixed className="w-5 h-5" />
      </button>
    </div>
  );
}