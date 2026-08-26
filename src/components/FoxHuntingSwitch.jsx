import React from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair, Radio } from "lucide-react";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

export default function FoxHuntingSwitch({ mode, onModeChange }) {
  const navigate = useNavigate();
  const { containerRef } = useDraggablePosition("drag-fox-switch");

  const isFox = mode === "fox";

  return (
    <div ref={containerRef} className="absolute top-20 left-1/2 -translate-x-1/2 z-[1005]" style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}>
      <div className="bg-white shadow-lg rounded-full border border-gray-200 flex items-center p-0.5">
        <button
          onClick={() => onModeChange("fox")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            isFox ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
          }`}
          title="Fox-Modus: Referenzkarte und QSO-Logbuch"
        >
          <Radio className="w-3.5 h-3.5" />
          Fox
        </button>
        <button
          onClick={() => navigate("/hunting")}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all bg-orange-500 text-white hover:bg-orange-600"
          title="Hunting-Modus: DX-Spots, Propagation und QSO-Logging"
        >
          <Crosshair className="w-3.5 h-3.5" />
          Hunting
        </button>
      </div>
    </div>
  );
}