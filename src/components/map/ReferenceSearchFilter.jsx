import React, { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

// Compact filter button with search popup for reference layers (SOTA, POTA, HBFF, WWBOTA, WCA, IOTA).
// Positioned via inline style (leftPx, bottomPx) to support multi-row layouts.
export default function ReferenceSearchFilter({
  layerType,
  label,
  color,
  query,
  onQueryChange,
  leftPx,
  bottomPx,
  markerCount = 0,
}) {
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div
      ref={popRef}
      className="fixed z-[1000]"
      style={{ left: `${leftPx}px`, bottom: `${bottomPx}px` }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-11 h-11 flex items-center justify-center rounded-lg shadow-lg border transition-colors ${
          open || query
            ? "bg-white border-gray-300 text-gray-900"
            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
        }`}
        title={`${label} filter`}
      >
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: color }}
        />
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-2 w-56">
          <div className="flex items-center gap-1.5 px-1 pb-1.5 border-b border-gray-100">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-xs font-semibold text-gray-900">{label}</span>
            <span className="text-[10px] text-gray-400 ml-auto">{markerCount}</span>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={query || ""}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Referenz / Name…"
              className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
              autoFocus
            />
            {query && (
              <button
                onClick={() => onQueryChange("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}