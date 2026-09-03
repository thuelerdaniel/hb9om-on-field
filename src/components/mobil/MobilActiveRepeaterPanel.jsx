// MobilActiveRepeaterPanel — Prominente Anzeige des aktiven Repeaters im Start-Modus.
// v0.9033: Tone neben Frequenz (gleiche Grösse, kein Label), Ort neben Rufzeichen (gleiche Grösse/Farbe),
// alle Modulationsarten als Badges, grosse Schrift für Auto/Feld-Bedienung.
// ITM (Longley-Rice) Signal-Qualität: dBm, Qualität-Badge, Path/ITM/Clutter Loss, Fresnel.

import React from "react";
import { Radio, Navigation, MapPin, AlertCircle, AlertTriangle, ArrowUp, Signal, Mountain } from "lucide-react";
import { getModeColor, getModeLabel, MODE_COLORS } from "@/lib/repeaterModes";
import { normalizeOffset, getInputFrequency } from "@/lib/repeaterOffset";
import { getQualityColor, getQualityBadge, getQualityLabel } from "@/lib/itmPropagation";

export default function MobilActiveRepeaterPanel({ repeater, distance, azimuth, reachable, gpsActive, itmResult, itmLoading, selectedModes }) {
  if (!repeater) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700/50 rounded-2xl p-4 text-center">
        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
          Kein Repeater in Reichweite
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {gpsActive ? "Kein Repeater gefunden" : "GPS wird gesucht..."}
        </p>
      </div>
    );
  }

  const normOffset = normalizeOffset(repeater.offset_mhz, repeater.band);
  const inputFreq = getInputFrequency(repeater.frequency, normOffset);
  const qualityColor = itmResult ? getQualityColor(itmResult.quality) : null;
  const qualityBadge = itmResult ? getQualityBadge(itmResult.quality) : null;

  // ÄNDERUNG 3: All modes for badges — show every mode the repeater supports
  const allModes = repeater.modes && repeater.modes.length > 0
    ? repeater.modes
    : (repeater.primary_mode ? [repeater.primary_mode] : []);

  return (
    <div
      className={`rounded-2xl p-4 border ${
        reachable
          ? "bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-700/50 border-blue-100 dark:border-slate-600"
          : "bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-700/50 border-amber-200 dark:border-amber-900"
      }`}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-1.5 text-xs mb-2">
        {reachable ? (
          <>
            <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-blue-600 dark:text-blue-400">
              Aktuell empfohlener Repeater
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="font-medium text-amber-600">
              Nächstgelegener Repeater — außerhalb Reichweite!
            </span>
          </>
        )}
      </div>

      {/* ÄNDERUNG 1+2+5: Freq + Tone | Callsign + Location — eine Zeile, grosse Schrift */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {/* Frequency — min 28px */}
        <span className="text-[28px] font-bold text-blue-600 dark:text-blue-400 leading-none font-mono">
          {repeater.frequency?.toFixed(4)}
          <span className="text-base font-normal text-gray-400 ml-1">MHz</span>
        </span>

        {/* ÄNDERUNG 1: Tone neben Frequenz, gleiche Grösse, kein Label */}
        {repeater.tone && (
          <span className="text-[28px] font-bold text-blue-600 dark:text-blue-400 leading-none font-mono">
            T{repeater.tone}
          </span>
        )}

        {/* ÄNDERUNG 2: Rufzeichen — min 22px */}
        <span className="text-[22px] font-bold text-gray-900 dark:text-slate-100 leading-none">
          {repeater.callsign}
        </span>

        {/* ÄNDERUNG 2: Ortsangabe neben Rufzeichen, gleiche Grösse und Farbe */}
        {repeater.location_name && (
          <span className="text-[22px] font-medium text-gray-900 dark:text-slate-100 leading-none">
            {repeater.location_name}
          </span>
        )}
      </div>

      {/* Input frequency (small, keep existing) */}
      {inputFreq != null && (
        <p className="text-sm text-gray-400 dark:text-slate-500 leading-tight mt-1 flex items-center gap-1">
          <ArrowUp className="w-3 h-3" />
          {inputFreq.toFixed(4)} MHz
        </p>
      )}

      {/* Offset (keep existing, small) */}
      <div className="flex items-center gap-3 mt-2 text-sm">
        <span className="font-medium text-gray-700 dark:text-slate-200">
          Offset:{" "}
          <span className={normOffset > 0 ? "text-green-600" : "text-red-500"}>
            {normOffset > 0 ? "+" : ""}
            {normOffset.toFixed(1)}
          </span>
        </span>
      </div>

      {/* ÄNDERUNG 3+5: Alle Modulationsarten als Badges — min 16px Schrift */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {allModes.map((mode) => {
          const modeColor = MODE_COLORS[mode] || MODE_COLORS.Other;
          const isSelected = selectedModes?.includes(mode);
          return (
            <span
              key={mode}
              className="px-2.5 py-1 text-base font-bold rounded-lg leading-none"
              style={{
                backgroundColor: isSelected ? modeColor : "transparent",
                color: isSelected ? "#ffffff" : modeColor,
                border: `2px solid ${modeColor}`,
              }}
            >
              {getModeLabel(mode)}
            </span>
          );
        })}
        <span className="text-base text-gray-500 dark:text-slate-400 ml-1">
          {repeater.band || "?"}
        </span>
      </div>

      {/* Distance + Azimuth — grosse Schrift für Auto-Bedienung */}
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1">
          <span className="text-base text-gray-500 dark:text-slate-400">Distanz:</span>
          <span className="text-xl font-bold text-gray-900 dark:text-slate-100">
            {distance?.toFixed(0)}
          </span>
          <span className="text-sm text-gray-400">km</span>
        </div>
        {azimuth != null && (
          <div className="flex items-center gap-1">
            <Navigation
              className="w-5 h-5 text-gray-600 dark:text-slate-300"
              style={{ transform: `rotate(${azimuth}deg)` }}
            />
            <span className="text-xl font-bold text-gray-900 dark:text-slate-100">
              {azimuth}°
            </span>
          </div>
        )}
      </div>

      {/* ITM Signal Quality Section — stable structure, values update in place (no flicker) */}
      {(itmResult || itmLoading) && (
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Signal
              className="w-4 h-4"
              style={{ color: itmResult ? qualityColor : "#9ca3af" }}
            />
            <span
              className="text-sm font-bold"
              style={{ color: itmResult ? qualityColor : "#9ca3af" }}
            >
              {itmResult
                ? `${qualityBadge} ${getQualityLabel(itmResult.quality)}`
                : itmLoading
                ? "Berechne ITM..."
                : "—"}
            </span>
            <span className="text-sm font-mono font-bold text-gray-900 dark:text-slate-100 ml-auto">
              {itmResult ? `${itmResult.rx_signal_dbm?.toFixed(1)} dBm` : "— dBm"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded px-2 py-1">
              <p className="text-gray-400 dark:text-slate-500">Path Loss</p>
              <p className="font-mono font-bold text-gray-700 dark:text-slate-200">
                {itmResult ? `${itmResult.path_loss_db?.toFixed(1)} dB` : "—"}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded px-2 py-1">
              <p className="text-gray-400 dark:text-slate-500">ITM Loss</p>
              <p className="font-mono font-bold text-gray-700 dark:text-slate-200">
                {itmResult ? `${itmResult.itm_loss_db?.toFixed(1)} dB` : "—"}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded px-2 py-1">
              <p className="text-gray-400 dark:text-slate-500">Clutter</p>
              <p className="font-mono font-bold text-gray-700 dark:text-slate-200">
                {itmResult ? `${itmResult.clutter_loss_db?.toFixed(1)} dB` : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Mountain className="w-3 h-3" />
              Fresnel: {itmResult ? `${itmResult.fresnel_clearance?.toFixed(0)}m` : "—"}
            </span>
            <span>
              Distanz: {itmResult ? `${itmResult.distance_km?.toFixed(1)} km` : "—"}
            </span>
          </div>
        </div>
      )}

      {/* Country (if no location_name shown above, keep country here) */}
      {repeater.country && !repeater.location_name && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-slate-400">
          <MapPin className="w-3 h-3" />
          <span>{repeater.country}</span>
        </div>
      )}
    </div>
  );
}