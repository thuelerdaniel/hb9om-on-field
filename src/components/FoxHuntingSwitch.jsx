import React from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair, Radio } from "lucide-react";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

export default function FoxHuntingSwitch({ mode, onModeChange }) {
  const navigate = useNavigate();
  const { containerRef } = useDraggablePosition("drag-fox-switch");

  const isFox = mode === "fox";

  return (
    <div
      ref={containerRef}
      className="absolute top-14 left-1/2 -translate-x-1/2 z-[1100]"
      style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}
    >
      <div className="bg-white shadow-xl shadow-orange-500/30 rounded-full border-2 border-orange-400 flex items-center p-0.5">
        <button
          onClick={() => onModeChange("fox")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${
            isFox ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
          }`}
          title="Fox-Modus: Referenzkarte und QSO-Logbuch"
        >
          <Radio className="w-4 h-4" />
          Fox
        </button>
        <button
          onClick={() => navigate("/hunting")}
          className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold transition-all bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-500/40"
          title="Hunting-Modus: DX-Spots, Propagation und QSO-Logging"
        >
          <Crosshair className="w-4 h-4" />
          Hunting
        </button>
      </div>
    </div>
  );
}