import { useState, useRef, useEffect } from "react";
import { Layers, X, Mountain, Trees, Zap, TowerControl, Waves, Ship, MapPin, Radio } from "lucide-react";

const STYLES = [
  { id: "https://tiles.openfreemap.org/styles/liberty", label: "Liberty", desc: "Klassisch" },
  { id: "https://tiles.openfreemap.org/styles/bright", label: "Bright", desc: "Hell" },
  { id: "https://tiles.openfreemap.org/styles/dark", label: "Dark", desc: "Dunkkel" },
];

const LAYER_OPTIONS = [
  { type: "sota", label: "SOTA", icon: Mountain, color: "#e74c3c" },
  { type: "pota", label: "POTA", icon: Trees, color: "#27ae60" },
  { type: "hbff", label: "WWFF", icon: Zap, color: "#8e44ad" },
  { type: "lighthouse", label: "Leuchtturm", icon: Ship, color: "#dc2626" },
  { type: "iota", label: "IOTA", icon: Waves, color: "#3498db" },
  { type: "llota", label: "LLOTA", icon: Waves, color: "#0ea5e9" },
  { type: "tota", label: "TOTA", icon: TowerControl, color: "#f97316" },
  { type: "repeater", label: "Relais", icon: Radio, color: "#3b82f6" },
  { type: "castle", label: "COTA", icon: MapPin, color: "#e67e22" },
];

/**
 * LayerControl3D — Popup mit Style-Auswahl (Liberty/Bright/Dark) und Layer-Toggles
 * für alle Aktivitätszonen + Repeater. Gleiche Toggles schalten die GeoJSON-Layer
 * im MapLibre-View.
 */
export default function LayerControl3D({
  activeLayers,
  onToggleLayer,
  styleUrl,
  onChangeStyle,
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const btnRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
        title="Layer & Style auswählen"
      >
        <Layers className="w-4 h-4" />
        Layer
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute top-[57px] right-2 z-30 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 w-72 max-h-[70vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Layer & Style</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Style selection */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <p className="text-[10px] font-semibold uppercase text-gray-500 dark:text-slate-400 mb-2">Karten-Style</p>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map(s => (
                <button
                  key={s.id}
                  onClick={() => onChangeStyle(s.id)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    styleUrl === s.id
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layer toggles */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase text-gray-500 dark:text-slate-400 mb-2">Aktivitätszonen</p>
            <div className="space-y-1.5">
              {LAYER_OPTIONS.map(opt => {
                const active = activeLayers.includes(opt.type);
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    onClick={() => onToggleLayer(opt.type)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? "bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                        : "text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: active ? opt.color : "transparent", border: active ? "none" : `1.5px solid ${opt.color}40` }}
                    >
                      <Icon className="w-3 h-3" style={{ color: active ? "#ffffff" : opt.color }} />
                    </div>
                    <span className="flex-1 text-left">{opt.label}</span>
                    {active && (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}