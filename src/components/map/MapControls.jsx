import React from "react";
import { Plus, Minus, Search, Ruler } from "lucide-react";

const SCALE_LABELS = {
  10000: "1:10k",
  25000: "1:25k",
  50000: "1:50k",
  100000: "1:100k",
};

export default function MapControls({
  lockedScale,
  onZoomIn,
  onZoomOut,
  onScaleUp,
  onScaleDown,
  baseLayer,
}) {
  const scaleLabel = lockedScale ? SCALE_LABELS[lockedScale] : "Auto";
  const showScale = baseLayer === "swisstopo";

  return (
    <div className="absolute right-3 top-20 z-[1000] flex flex-col gap-2">
      {/* Zoom controls */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col items-center overflow-hidden">
        <button
          onClick={onZoomIn}
          className="w-10 h-9 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors border-b border-gray-100"
          title="Vergrössern"
        >
          <Plus className="w-4 h-4 text-gray-700" />
        </button>
        <div className="w-10 h-7 flex items-center justify-center bg-gray-50 border-b border-gray-100">
          <Search className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <button
          onClick={onZoomOut}
          className="w-10 h-9 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="Verkleinern"
        >
          <Minus className="w-4 h-4 text-gray-700" />
        </button>
      </div>

      {/* Scale controls – nur bei Swisstopo-Karte */}
      {showScale && (
      <div className={`bg-white rounded-lg shadow-lg border flex flex-col items-center overflow-hidden ${lockedScale ? "border-blue-400" : "border-gray-200"}`}>
        <button
          onClick={onScaleUp}
          className="w-10 h-8 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors border-b border-gray-100"
          title="Grösserer Massstab (mehr Details)"
        >
          <Plus className="w-3.5 h-3.5 text-gray-700" />
        </button>
        <div className="w-10 min-h-[2.25rem] flex flex-col items-center justify-center bg-gray-50 border-b border-gray-100 px-1 py-1 gap-0.5">
          <Ruler className={`w-3 h-3 ${lockedScale ? "text-blue-500" : "text-gray-400"}`} />
          <span className={`text-[8px] font-bold leading-none whitespace-nowrap ${lockedScale ? "text-blue-600" : "text-gray-500"}`}>
            {scaleLabel}
          </span>
        </div>
        <button
          onClick={onScaleDown}
          className="w-10 h-8 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="Kleinerer Massstab (weniger Details)"
        >
          <Minus className="w-3.5 h-3.5 text-gray-700" />
        </button>
      </div>
      )}
    </div>
  );
}