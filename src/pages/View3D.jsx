import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mountain, Trees, Zap, Globe2 } from "lucide-react";
import Map3D from "@/components/view3d/Map3D";
import BottomNavigation from "@/components/BottomNavigation";

const LAYER_BUTTONS = [
  { type: "sota", label: "SOTA", icon: Mountain, color: "#e74c3c" },
  { type: "pota", label: "POTA", icon: Trees, color: "#27ae60" },
  { type: "hbff", label: "WWFF", icon: Zap, color: "#8e44ad" },
];

export default function View3D() {
  const navigate = useNavigate();
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [activeLayers, setActiveLayers] = useState(["sota", "pota", "hbff"]);

  const toggleLayer = (type) => {
    setActiveLayers(prev =>
      prev.includes(type) ? prev.filter(l => l !== type) : [...prev, type]
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="Zurück zur Karte"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-slate-100">3D-Ansicht</h1>
            <p className="text-[10px] text-gray-500 dark:text-slate-400">Globus · Gelände · Gebäude · OpenFreeMap</p>
          </div>
          <button
            onClick={() => setTerrainEnabled(!terrainEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
              terrainEnabled
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
            title="3D-Gelände ein/aus (AWS Terrain Tiles)"
          >
            <Globe2 className="w-4 h-4" />
            {terrainEnabled ? "Gelände AN" : "Gelände"}
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="absolute top-[57px] bottom-0 left-0 right-0">
        <Map3D terrainEnabled={terrainEnabled} activeLayers={activeLayers} />
      </div>

      {/* Layer toggle buttons — floating bottom left */}
      <div className="absolute bottom-16 left-4 z-20 flex gap-2 flex-wrap max-w-[calc(100vw-2rem)]">
        {LAYER_BUTTONS.map(btn => {
          const active = activeLayers.includes(btn.type);
          const Icon = btn.icon;
          return (
            <button
              key={btn.type}
              onClick={() => toggleLayer(btn.type)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium shadow-lg transition-all ${
                active
                  ? "bg-white text-gray-900 dark:bg-slate-800 dark:text-slate-100"
                  : "bg-white/60 text-gray-400 dark:bg-slate-800/60"
              }`}
              style={{ borderLeft: `3px solid ${active ? btn.color : "transparent"}` }}
            >
              <Icon className="w-4 h-4" style={{ color: active ? btn.color : undefined }} />
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}