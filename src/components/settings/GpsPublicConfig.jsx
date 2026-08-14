import React, { useState } from "react";
import { Crosshair, ChevronDown, MessageSquare, Radio, Loader2 } from "lucide-react";
import { APRS_SYMBOLS, getAprsSymbolSvg } from "@/lib/aprsSymbols";
import { base44 } from "@/api/base44Client";

// Symbol options shown in the selector — same set used by the APRS filter.
const SYMBOL_OPTIONS = Object.entries(APRS_SYMBOLS).map(([key, val]) => ({
  value: key,
  label: val.name,
}));

export default function GpsPublicConfig() {
  // Live GPS position is ON by default (per default eingeschaltet)
  const [publicEnabled, setPublicEnabled] = useState(
    () => localStorage.getItem("hb9om_gps_public_enabled") !== "false"
  );
  const [comment, setComment] = useState(
    () => localStorage.getItem("hb9om_gps_public_comment") || ""
  );
  const [symbol, setSymbol] = useState(
    () => localStorage.getItem("hb9om_gps_public_symbol") || "dot"
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Enable public position: also enable GPS tracking, get current position, and
  // immediately broadcast it so the symbol appears on the map right away.
  const handleTogglePublic = async (enabled) => {
    setToggling(true);
    try {
      if (enabled) {
        // Also enable GPS tracking so the position is continuously updated
        localStorage.setItem("hb9om_gps_tracking_enabled", "true");
        localStorage.setItem("hb9om_gps_public_enabled", "true");
        setPublicEnabled(true);
        window.dispatchEvent(new CustomEvent("gps-tracking-changed"));

        // Get current position and broadcast immediately
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const callsign = localStorage.getItem("hb9om_user_callsign") || "Unknown";
              const deviceType = localStorage.getItem("hb9om_cov_device") || "mobil";
              const aprsSymbol = localStorage.getItem("hb9om_gps_public_symbol") || "mobile";
              const cmt = localStorage.getItem("hb9om_gps_public_comment") || "";
              base44.functions.invoke("managePublicPosition", {
                action: "set",
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                callsign,
                device_type: deviceType,
                comment: cmt,
                aprs_symbol: aprsSymbol,
              }).catch(() => {});
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }
      } else {
        // Disable: remove public position immediately
        localStorage.setItem("hb9om_gps_public_enabled", "false");
        setPublicEnabled(false);
        window.dispatchEvent(new CustomEvent("gps-public-changed"));
        base44.functions.invoke("managePublicPosition", { action: "remove" }).catch(() => {});
      }
    } finally {
      setToggling(false);
    }
  };

  const handleCommentChange = (val) => {
    setComment(val);
    localStorage.setItem("hb9om_gps_public_comment", val);
  };

  const handleSymbolChange = (val) => {
    setSymbol(val);
    localStorage.setItem("hb9om_gps_public_symbol", val);
    // Trigger a refresh so the next GPS broadcast picks up the new symbol
    window.dispatchEvent(new CustomEvent("gps-public-changed"));
  };

  return (
    <div className="mt-3 border-t border-gray-100 dark:border-slate-700 pt-3">
      {/* Live GPS position toggle — directly visible (not behind advanced options) */}
      <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
              <Radio className="w-4 h-4" /> Position öffentlich teilen
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              Standort für andere Benutzer sichtbar teilen (Rufzeichen als Identifikation)
            </p>
          </div>
          <button
            onClick={() => handleTogglePublic(!publicEnabled)}
            disabled={toggling}
            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${publicEnabled ? "bg-green-600" : "bg-gray-300"}`}
          >
            {toggling ? (
              <Loader2 className="absolute top-1 left-1 w-4 h-4 animate-spin text-white" />
            ) : (
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${publicEnabled ? "translate-x-6" : ""}`} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
          {publicEnabled
            ? "Eingeschaltet — Ihr Symbol wird anderen Benutzern angezeigt, wenn der APRS-Layer aktiv ist. GPS-Tracking wird automatisch aktiviert."
            : "Ausgeschaltet — Ihre Position wird nicht übertragen."}
        </p>
      </div>

      {/* Advanced options: comment + symbol selector */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:white mt-3"
      >
        <span className="flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5" />
          Erweiterte Optionen (Bemerkung & Symbol)
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
      </button>

      {showAdvanced && (
        <div className="mt-3 space-y-3">
          {/* Comment / Bemerkung field */}
          <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
            <label className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> Bemerkung
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              Wird anderen Benutzern angezeigt, wenn sie Ihr Symbol anklicken
            </p>
            <textarea
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              placeholder="z.B. unterwegs mit QRP, aktiv auf 2m FM, ..."
              rows={2}
              maxLength={500}
              className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-1 text-right">{comment.length}/500</p>
          </div>

          {/* Symbol selector — APRS symbols */}
          <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
            <label className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Symbol auf der Karte
            </label>
            <p className="text-xs text-gray-500 mt-0.5">
              APRS-Symbol, das für Ihre Position angezeigt wird
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {SYMBOL_OPTIONS.map(opt => {
                const selected = symbol === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSymbolChange(opt.value)}
                    title={opt.label}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-colors ${
                      selected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-slate-700 hover:border-blue-300"
                    }`}
                  >
                    <div
                      dangerouslySetInnerHTML={{
                        __html: getAprsSymbolSvg(opt.value, selected ? "#2563eb" : "#6b7280"),
                      }}
                      style={{ width: 28, height: 28 }}
                    />
                    <span className="text-[8px] text-gray-500 dark:text-slate-400 leading-tight text-center">
                      {opt.label.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}