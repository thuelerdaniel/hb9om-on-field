import React from "react";
import { Mountain } from "lucide-react";
import DraggableMapButton from "@/components/map/DraggableMapButton";

// v0.951: 3D-Terrain-Toggle als verschiebbarer Button (Long-Press-Drag).
// Default-Position im Daumenbereich (rechts, ~55% Bildschirmhöhe).
// Position wird pro Gerät gespeichert (wie andere verschiebbare Buttons).
export default function DraggableTerrainToggle({ enabled, onToggle, visible }) {
  if (!visible) return null;

  return (
    <DraggableMapButton
      storageKey="mapbtn_terrain3d"
      defaultPos={{ x: typeof window !== "undefined" ? window.innerWidth - 56 : 304, y: typeof window !== "undefined" ? Math.round(window.innerHeight * 0.55) : 400 }}
      size={44}
      onClick={onToggle}
      title={enabled ? "3D-Modus aktiv — tippen zum Deaktivieren" : "3D-Gelände anzeigen (Terrain + Neigung)"}
      active={enabled}
      activeClass="bg-orange-500 border-orange-600 text-white"
      inactiveClass="bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
    >
      <Mountain className="w-5 h-5" />
    </DraggableMapButton>
  );
}