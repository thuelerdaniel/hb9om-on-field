import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ChevronRight, ChevronLeft, LocateFixed, Crosshair, CloudOff, Cloud,
  Download, MapPin, Move, Radio, Mountain, Plus, Minus, Filter,
  Wifi, Satellite, Antenna, Droplets, Trees, Castle, Building2, Ship,
  Layers, List, ChevronsUp, ChevronsDown,
  Zap, Radio as RadioIcon,
} from "lucide-react";
import { useAppFeatures } from "@/lib/appFeatures";
import { useUISettings } from "@/lib/UISettingsContext";

// Collapsible panel at the left edge of the map.
// Contains ALL left-side map controls, grouped:
//   Navigation/GPS · Zoom · Layer/Filter · Kontextuelle Aktionen
// Default collapsed with a toggle handle. Tap on map closes (via parent callback).
// State persisted per user in UserHuntingSettings.ui_settings (left_panel_open).
// Min 44px touch targets, scrollable, dark/light mode, semi-transparent background.

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

function PanelButton({ onClick, active, activeClass, title, children, disabled, loading, dataLayerTrigger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      data-layer-trigger={dataLayerTrigger ? "true" : undefined}
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

function Divider() {
  return <div className="w-8 h-px bg-gray-200 dark:bg-gray-600 my-0.5" />;
}

export default function LeftControlPanel({
  // Navigation / GPS
  onCenterPosition,
  onGetGps,
  isOffline,
  onToggleOffline,
  onOpenOfflineDownload,
  onSetPositionViaMap,
  setPositionActive,
  gpsTrackingActive,
  // Zoom
  onZoomIn,
  onZoomOut,
  // Massstab (nur SwissTopo)
  showScale,
  onScaleUp,
  onScaleDown,
  scaleLabel,
  // Layer / Filter
  onOpenLayers,
  layersOpen,
  legendVisible,
  onToggleLegend,
  showLegend = true,
  // Tools (kontextuelle Aktionen)
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
  const { ui, updateUI } = useUISettings();
  const [gpsLoading, setGpsLoading] = useState(false);
  const { features } = useAppFeatures();

  // Panel open/closed — default collapsed, persisted per user
  const isOpen = ui.left_panel_open === true;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  // Close panel when map is clicked (external trigger)
  useEffect(() => {
    if (externalCloseTrigger > 0 && isOpenRef.current) {
      updateUI({ left_panel_open: false });
    }
  }, [externalCloseTrigger, updateUI]);

  const togglePanel = useCallback(() => {
    updateUI({ left_panel_open: !isOpenRef.current });
  }, [updateUI]);

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

  // Group visibility
  const hasNavGroup = showOffline || showGps || showSetPosition || showCenter || showDownload;
  const hasScaleGroup = !!showScale && !!(onScaleUp && onScaleDown);
  const hasLayerFilterGroup = !!onOpenLayers || activeFilterTriggers.length > 0 || (showLegend && !!onToggleLegend);
  const hasContextGroup = showDragMode || showCoverage || terrain3DVisible || showQso;

  return (
    <>
      {/* Open handle — only while the panel is CLOSED. Open, the handle lives inside the
          panel (as its first button), so it can never sit on top of the panel content. */}
      {!isOpen && (
        <button
          onClick={togglePanel}
          className="fixed left-0 top-20 z-[1001] w-7 h-14 flex items-center justify-center bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-600 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Bedienelemente öffnen"
          style={{ touchAction: "manipulation" }}
        >
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          {/* Badge dot when collapsed and dynamic buttons exist */}
          {hasDynamicButtons && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>
      )}

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
          {/* Close handle — only while the panel is OPEN, as part of the panel layout
              (own slot, own spacing). It is never stacked above the other rail buttons. */}
          {isOpen && (
            <PanelButton onClick={togglePanel} title="Bedienelemente schliessen">
              <ChevronLeft className="w-5 h-5" />
            </PanelButton>
          )}
          <Divider />

          {/* ── Gruppe: Navigation / GPS ── */}
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

          {/* ── Gruppe: Zoom ── */}
          {hasNavGroup && <Divider />}

          <PanelButton onClick={onZoomIn} title="Vergrössern (Zoom +)">
            <Plus className="w-5 h-5" />
          </PanelButton>
          <PanelButton onClick={onZoomOut} title="Verkleinern (Zoom −)">
            <Minus className="w-5 h-5" />
          </PanelButton>

          {hasScaleGroup && (
            <>
              <PanelButton onClick={onScaleUp} title={`Massstab vergrössern — mehr Details${scaleLabel ? ` (aktuell ${scaleLabel})` : ""}`}>
                <ChevronsUp className="w-5 h-5" />
              </PanelButton>
              <PanelButton onClick={onScaleDown} title={`Massstab verkleinern — weniger Details${scaleLabel ? ` (aktuell ${scaleLabel})` : ""}`}>
                <ChevronsDown className="w-5 h-5" />
              </PanelButton>
            </>
          )}

          {/* ── Gruppe: Layer / Filter ── */}
          <Divider />

          {onOpenLayers && (
            <PanelButton
              onClick={onOpenLayers}
              active={layersOpen}
              dataLayerTrigger
              title={layersOpen ? "Ebenen-Menü schliessen" : "Ebenen-Menü öffnen"}
            >
              <Layers className="w-5 h-5" />
            </PanelButton>
          )}

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

          {showLegend && onToggleLegend && (
            <PanelButton
              onClick={onToggleLegend}
              active={legendVisible}
              title={legendVisible ? "Legende ausblenden" : "Legende einblenden"}
            >
              <List className="w-5 h-5" />
            </PanelButton>
          )}

          {/* ── Gruppe: Kontextuelle Aktionen ── */}
          {hasLayerFilterGroup && hasContextGroup && <Divider />}

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

          {/* QSO Button — prominent green */}
          {showQso && (
            <>
              <Divider />
              <button
                onClick={onOpenQso}
                title="QSO loggen"
                className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg shadow-sm border-2 border-[#8cff00] bg-[#8cff00] text-black hover:bg-[#7df000] transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}