import React, { useState } from "react";
import { LocateFixed, Crosshair, CloudOff, Cloud, Download, MapPin } from "lucide-react";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { useAppFeatures } from "@/lib/appFeatures";

export default function MapPositionControls({
  onCenterPosition,
  onGetGps,
  isOffline,
  onToggleOffline,
  onOpenOfflineDownload,
  onSetPositionViaMap,
  setPositionActive,
}) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const { containerRef } = useDraggablePosition("drag-position-controls");
  const { features } = useAppFeatures();

  const showOffline = features.offline?.offline_mode !== false;
  const showGps = features.tools?.gps !== false;
  const showCenter = features.tools?.center_position !== false;
  const showSetPosition = features.tools?.set_position !== false;
  const showDownload = features.offline?.map_download !== false;

  const handleGpsClick = () => {
    setGpsLoading(true);
    onGetGps?.(() => setGpsLoading(false));
  };

  // Wenn weder Offline- noch GPS- noch Center- noch SetPosition- noch Download-Button sichtbar sind, gar nichts renderen
  if (!showOffline && !showGps && !showCenter && !showSetPosition && !showDownload) return null;

  return (
    <div
      ref={containerRef}
      className="absolute left-3 top-28 z-[1000] flex flex-col gap-2"
      style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}
    >
      {/* Offline mode toggle */}
      {showOffline && (
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
      )}

      {/* GPS position button */}
      {showGps && (
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
      )}

      {/* Set position on map via click */}
      {showSetPosition && (
        <button
          onClick={onSetPositionViaMap}
          className={`w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border transition-colors ${
            setPositionActive
              ? "bg-blue-500 border-blue-600 text-white"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100"
          }`}
          title={setPositionActive ? "Kartenklick-Modus aktiv — auf Karte tippen" : "Position per Kartenklick setzen"}
        >
          <MapPin className="w-5 h-5" />
        </button>
      )}

      {/* Center on saved position */}
      {showCenter && (
        <button
          onClick={onCenterPosition}
          className="w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          title="Karte auf gespeicherte Position zentrieren"
        >
          <LocateFixed className="w-5 h-5" />
        </button>
      )}

      {/* Offline area download */}
      {showDownload && (
        <button
          onClick={onOpenOfflineDownload}
          className="w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          title="Karten-Bereich für Offline-Verwendung herunterladen"
        >
          <Download className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}