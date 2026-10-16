import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronRight, ChevronLeft, LocateFixed, Crosshair, CloudOff, Cloud,
  Download, MapPin, Move, Radio, Mountain, Plus, Filter,
  Wifi, Satellite, Antenna, Droplets, Trees, Castle, Building2, Ship,
  Zap, Radio as RadioIcon,
} from "lucide-react";
import { safeGetItem, safeSetItem } from "@/lib/safeStorage";
import { useAppFeatures } from "@/lib/appFeatures";

// Collapsible panel at the left edge of the map.
// Contains ALL left-side control buttons (GPS, Offline, 3D, Coverage, QSO, Filters).
// Default collapsed with a toggle handle. Tap on map closes (via parent callback).
// State persisted in localStorage (hb9om_left_panel_open).
// Min 44px touch targets, scrollable, dark/light mode, semi-transparent background.

const STORAGE_KEY = "hb9om_left_panel_open";

// Filter trigger config — icon + color per layer type
const FILTER_CONFIG = {
  repeater: { icon: RadioIcon, color: "#3b82f6", label: "Relais" },
  tota: { icon: Antenna, color: "#f97316", label: "TOTA" },
  lighthouse: { icon: Ship, color: "#dc2626", label: "Leuchtturm" },
  aprs: { icon: Satellite, color: "#f59e0b", label: "APRS" },
  brandmeister: { icon: Wifi, color: "#e11d48", label: "BrandMeister" },
  sota: { icon: Mountain, color: "#e74c3c", label: "SOTA" },
  pota: { icon: Trees, color: "#27ae60", label: "POTA" },
  hbff: { icon: Trees, color: "#8e44ad", label: "WWFF" },
  castle: { icon: Castle, color: "#e67e22", label: "WCA" },
  wwbota: { icon: Building2, color: "#795548", label: "WWBOTA" },
  llota: { icon: Droplets, color: "#0ea5e9", label: "LLOTA" },
  iota: { icon: MapPin, color: "#3498db", label: "IOTA" },
};

function PanelButton({ onClick, active, activeClass, title, children, disabled, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg shadow-sm border transition-colors ${
        active
          ? (activeClass || "bg-blue-500 border-blue-600 text-white")
          : "bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${loading ? "animate-pulse" : ""}`}
    >
      {children}
    </button>
  );
}

export default function LeftControlPanel({
  // Position controls
  onCenterPosition,
  onGetGps,
  isOffline,
  onToggleOffline,
  onOpenOfflineDownload,
  onSetPositionViaMap,
  setPositionActive,
  gpsTrackingActive,
  // Tools
  dragMode,
  onToggleDragMode,
  terrain3DEnabled,
  onToggleTerrain3D,
  terrain3DVisible,
  onOpenCoverage,
  onOpenQso,
  // Filters
  filterTriggers, // [{ type, count, visibleCount }]
  openFilter,
  onOpenFilter,
  // External close (called when map is clicked)
  externalCloseTrigger,
}) {
  const [isOpen, setIsOpen] = useState(() => safeGetItem(STORAGE_KEY) === "true");
  const [gpsLoading, setGpsLoading] = useState(false);
  const { features } = useAppFeatures();

  // Persist open/closed state
  useEffect(() => {
    safeSetItem(STORAGE_KEY, String(isOpen));
  }, [isOpen]);

  // Close panel when map is clicked (external trigger)
  useEffect(() => {
    if (externalCloseTrigger > 0) {
      setIsOpen(false);
    }
  }, [externalCloseTrigger]);

  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleGpsClick = useCallback(() => {
    setGpsLoading(true);
    onGetGps?.(() => setGpsLoading(false));
  }, [onGetGps]);

  // Feature flags
  const showOffline = features.offline?.offline_mode !== false;
  const showGps = features.tools?.gps !== false;
  const showCenter = features.tools?.center_position !== false;
  const showSetPosition = features.tools?.set_position !== false;
  const showDownload = features.offline?.map_download !== false;
  const showDragMode = features.tools?.filter !== false;
  const showCoverage = features.tools?.own_coverage !== false;
  const showQso = features.tools?.qso_add !== false;

  // Build the list of active filter triggers
  const activeFilterTriggers = useMemo(() => {
    if (!filterTriggers || filterTriggers.length === 0) return [];
    return filterTriggers.map(ft => ({
      ...ft,
      config: FILTER_CONFIG[ft.type] || { icon: Filter, color: "#6b7280", label: ft.type },
    }));
  }, [filterTriggers]);

  // Check if any dynamic buttons are visible (for badge on handle)
  const hasDynamicButtons = activeFilterTriggers.length > 0;

  return (
    <>
      {/* Toggle handle — always visible at left edge */}
      <button
        onClick={togglePanel}
        className="fixed left-0 top-20 z-[1001] w-7 h-14 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-600 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
        title={isOpen ? "Panel schliessen" : "Bedienelemente öffnen"}
        style={{ touchAction: "manipulation" }}
      >
        {isOpen ? (
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        )}
        {/* Badge dot when collapsed and dynamic buttons exist */}
        {!isOpen && hasDynamicButtons && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
        )}
      </button>

      {/* Panel — slides in from left */}
      <div
        className={`fixed left-0 top-20 bottom-16 z-[1000] transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ touchAction: "pan-y" }}
      >
        <div className="h-full w-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-2 gap-1.5 overflow-y-auto overscroll-contain"
          style={{ scrollbarWidth: "thin" }}
        >
          {/* Position Controls Section */}
          {showOffline && (
            <PanelButton
              onClick={onToggleOffline}
              active={isOffline}
              activeClass="bg-amber-500 border-amber-600 text-white"
              title={isOffline ? "Offline-Modus aktiv — tippen für Online" : "Online-Modus — tippen für Offline"}
            >
              {isOffline ? <CloudOff className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
            </PanelButton>
          )}

          {showGps && (
            <PanelButton
              onClick={handleGpsClick}
              loading={gpsLoading}
              active={gpsLoading}
              activeClass="bg-blue-100 border-blue-300 text-blue-500"
              title="Aktuelle GPS-Position abrufen"
            >
              <Crosshair className="w-5 h-5" />
            </PanelButton>
          )}

          {showSetPosition && (
            <PanelButton
              onClick={onSetPositionViaMap}
              active={setPositionActive}
              title={setPositionActive ? "Kartenklick-Modus aktiv — auf Karte tippen" : "Position per Kartenklick setzen"}
            >
              <MapPin className="w-5 h-5" />
            </PanelButton>
          )}

          {showCenter && (
            <PanelButton
              onClick={onCenterPosition}
              active={gpsTrackingActive}
              title={gpsTrackingActive ? "GPS-Tracking aktiv — tippen zum Ausschalten" : "Auf meine GPS-Position zentrieren / GPS-Tracking einschalten"}
            >
              <LocateFixed className={`w-5 h-5 ${gpsTrackingActive ? "animate-pulse" : ""}`} />
            </PanelButton>
          )}

          {showDownload && (
            <PanelButton
              onClick={onOpenOfflineDownload}
              title="Karten-Bereich für Offline-Verwendung herunterladen"
            >
              <Download className="w-5 h-5" />
            </PanelButton>
          )}

          {/* Divider */}
          {(showOffline || showGps || showSetPosition || showCenter || showDownload) && (
            <div className="w-8 h-px bg-gray-200 dark:bg-gray-600 my-0.5" />
          )}

          {/* Tools Section */}
          {showDragMode && (
            <PanelButton
              onClick={onToggleDragMode}
              active={dragMode}
              title={dragMode ? "Marker-Verschiebung aktiv — tippen zum Deaktivieren" : "Marker verschieben (Positionskorrektur)"}
            >
              <Move className="w-5 h-5" />
            </PanelButton>
          )}

          {showCoverage && (
            <PanelButton
              onClick={onOpenCoverage}
              title="Meine Abdeckung berechnen"
            >
              <Radio className="w-5 h-5 text-orange-500" />
            </PanelButton>
          )}

          {terrain3DVisible && (
            <PanelButton
              onClick={onToggleTerrain3D}
              active={terrain3DEnabled}
              activeClass="bg-orange-500 border-orange-600 text-white"
              title={terrain3DEnabled ? "3D-Modus aktiv — tippen zum Deaktivieren" : "3D-Gelände anzeigen (Terrain + Neigung)"}
            >
              <Mountain className="w-5 h-5" />
            </PanelButton>
          )}

          {/* Divider before filters */}
          {(showDragMode || showCoverage || terrain3DVisible) && activeFilterTriggers.length > 0 && (
            <div className="w-8 h-px bg-gray-200 dark:bg-gray-600 my-0.5" />
          )}

          {/* Filter Triggers Section */}
          {activeFilterTriggers.map(ft => {
            const Icon = ft.config.icon;
            const isActive = openFilter === ft.type;
            return (
              <PanelButton
                key={ft.type}
                onClick={() => onOpenFilter(isActive ? null : ft.type)}
                active={isActive}
                activeClass="bg-white dark:bg-gray-700 border-2"
                title={`${ft.config.label}-Filter ${isActive ? 'schliessen' : 'öffnen'}`}
              >
                <Icon className="w-5 h-5" style={{ color: ft.config.color }} />
              </PanelButton>
            );
          })}

          {/* Divider before QSO */}
          {activeFilterTriggers.length > 0 && showQso && (
            <div className="w-8 h-px bg-gray-200 dark:bg-gray-600 my-0.5" />
          )}

          {/* QSO Button — prominent green */}
          {showQso && (
            <button
              onClick={onOpenQso}
              title="QSO loggen"
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg shadow-sm border-2 border-[#8cff00] bg-[#8cff00] text-black hover:bg-[#7df000] transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}