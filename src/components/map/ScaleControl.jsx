import React, { useState, useEffect } from "react";
import { Scale, ChevronDown } from "lucide-react";

// Standard Swiss map scale steps
const SCALE_STEPS = [
  { value: 10000, label: "1:10'000", zoom: 15 },
  { value: 25000, label: "1:25'000", zoom: 13 },
  { value: 50000, label: "1:50'000", zoom: 12 },
  { value: 100000, label: "1:100'000", zoom: 10 }
];

// Approximate scale at a given zoom level (at Swiss latitudes)
function scaleAtZoom(zoom, lat = 46.8) {
  const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
  // assume ~96 DPI screen -> 0.0254 m/px
  const scale = metersPerPixel / 0.0254;
  return Math.round(scale);
}

export default function ScaleControl({ map, scaleMode, scaleValue, onScaleChange }) {
  const [open, setOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(8);

  React.useEffect(() => {
    if (!map) return;
    const update = () => setCurrentZoom(map.getZoom());
    map.on("zoomend", update);
    update();
    return () => map.off("zoomend", update);
  }, [map]);

  const autoScale = scaleAtZoom(currentZoom);
  const displayScale = scaleMode === "auto" ? autoScale : scaleValue;

  const handleSelect = (step) => {
    onScaleChange({ mode: "manual", value: step.value, zoom: step.zoom });
    map.flyTo(map.getCenter(), step.zoom, { duration: 0.8 });
    setOpen(false);
  };

  const handleAuto = () => {
    onScaleChange({ mode: "auto" });
    setOpen(false);
  };

  return (
    <div className="absolute bottom-14 right-3 z-[1000]">
      <button
        onClick={() => setOpen(!open)}
        className="bg-white shadow-lg rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors border border-gray-200 flex items-center gap-2"
        title="Kartenmassstab"
      >
        <Scale className="w-4 h-4 text-gray-700" />
        <span className="text-xs font-mono font-semibold text-gray-900">
          1:{displayScale.toLocaleString("de-CH")}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <div className="absolute bottom-11 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 w-52 overflow-hidden">
          <button
            onClick={handleAuto}
            className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between ${
              scaleMode === "auto" ? "bg-gray-50 font-semibold" : ""
            }`}>
            <span>Automatisch</span>
            <span className="text-[10px] text-gray-400">zoom-abhängig</span>
          </button>
          <div className="border-t border-gray-100" />
          {SCALE_STEPS.map(s => (
            <button
              key={s.value}
              onClick={() => handleSelect(s)}
              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 ${
                scaleMode === "manual" && scaleValue === s.value ? "bg-gray-50 font-semibold" : ""
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { SCALE_STEPS, scaleAtZoom };