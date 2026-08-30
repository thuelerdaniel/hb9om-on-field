import React from "react";
import { MapPinned, X } from "lucide-react";

// Reusable boundary toggle section — inserted into reference filter panels.
// Shows "Show all boundaries" toggle + active count + "Clear" button.
export default function BoundaryToggleSection({
  layerType,
  allBoundariesActive = false,
  onToggleAllBoundaries,
  activeBoundaryCount = 0,
  onClearBoundaries,
  accentColor = "amber",
}) {
  if (!onToggleAllBoundaries) return null;

  const accentClasses = {
    amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", btn: "bg-amber-500 hover:bg-amber-600 border-amber-600", badge: "bg-amber-100 text-amber-700" },
    red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", btn: "bg-red-500 hover:bg-red-600 border-red-600", badge: "bg-red-100 text-red-700" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", btn: "bg-purple-500 hover:bg-purple-600 border-purple-600", badge: "bg-purple-100 text-purple-700" },
    blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", btn: "bg-blue-500 hover:bg-blue-600 border-blue-600", badge: "bg-blue-100 text-blue-700" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800", btn: "bg-orange-500 hover:bg-orange-600 border-orange-600", badge: "bg-orange-100 text-orange-700" },
    brown: { bg: "bg-amber-50", border: "border-amber-700", text: "text-amber-800", btn: "bg-amber-700 hover:bg-amber-800 border-amber-800", badge: "bg-amber-100 text-amber-800" },
    sky: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800", btn: "bg-sky-500 hover:bg-sky-600 border-sky-600", badge: "bg-sky-100 text-sky-700" },
    green: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", btn: "bg-green-500 hover:bg-green-600 border-green-600", badge: "bg-green-100 text-green-700" },
  };
  const c = accentClasses[accentColor] || accentClasses.amber;

  return (
    <div className={`p-3 border-b border-gray-100 ${c.bg}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <MapPinned className={`w-3.5 h-3.5 ${c.text}`} />
        <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Grenzen</h4>
        {activeBoundaryCount > 0 && (
          <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-bold ${c.badge}`}>
            {activeBoundaryCount}
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => onToggleAllBoundaries(!allBoundariesActive)}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-lg border transition-colors ${
            allBoundariesActive
              ? `text-white ${c.btn} border`
              : `text-gray-700 bg-white border-gray-200 hover:bg-gray-50`
          }`}
        >
          <MapPinned className="w-3 h-3" />
          {allBoundariesActive ? "Alle ausblenden" : "Alle anzeigen"}
        </button>
        {activeBoundaryCount > 0 && (
          <button
            onClick={onClearBoundaries}
            className="flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
            title="Grenzen entfernen"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}