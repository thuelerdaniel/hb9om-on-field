import React, { useState, useEffect } from "react";
import { Crosshair } from "lucide-react";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

/**
 * Floating "My GPS Position" toggle on the map.
 * Controls hb9om_gps_tracking_enabled — the local blue crosshair indicator.
 * Independent from "Public GPS Position" (toggle in Settings).
 */
export default function GpsToggle() {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem("hb9om_gps_tracking_enabled") !== "false"
  );
  const { containerRef } = useDraggablePosition("drag-gps-toggle");

  useEffect(() => {
    const handler = () => {
      setEnabled(localStorage.getItem("hb9om_gps_tracking_enabled") !== "false");
    };
    window.addEventListener("gps-tracking-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("gps-tracking-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const handleToggle = () => {
    const newVal = !enabled;
    localStorage.setItem("hb9om_gps_tracking_enabled", String(newVal));
    setEnabled(newVal);
    window.dispatchEvent(new CustomEvent("gps-tracking-changed"));
  };

  return (
    <div
      ref={containerRef}
      className="absolute right-3 z-[1000]"
      style={{ top: "calc(7rem + 3.5rem)", touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}
    >
      <button
        onClick={handleToggle}
        className={`w-10 h-10 rounded-lg shadow-lg border flex items-center justify-center transition-colors ${
          enabled
            ? "bg-blue-600 border-blue-500 text-white"
            : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
        }`}
        title={enabled ? "Meine GPS-Position: AN" : "Meine GPS-Position: AUS"}
      >
        <Crosshair className={`w-5 h-5 ${enabled ? "animate-pulse" : ""}`} />
      </button>
    </div>
  );
}