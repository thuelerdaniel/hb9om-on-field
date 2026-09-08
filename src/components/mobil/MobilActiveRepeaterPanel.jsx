// MobilActiveRepeaterPanel — Prominente Anzeige des aktiven Repeaters im Start-Modus.
// v0.9040: Kompakt-Layout — Titel entfernt, Path Loss/ITM Loss/Clutter/Fresnel/Distanz entfernt.
//          DCS-Code neben Tone. ITM-Qualität inline mit Distanz/Azimuth.
//          Ziel: Relais-Angaben + Karte passen auf einen Bildschirm.

import React from "react";
import { Navigation, AlertCircle, AlertTriangle, ArrowUp, Signal } from "lucide-react";
import { getModeColor, getModeLabel, MODE_COLORS } from "@/lib/repeaterModes";
import { normalizeOffset, getInputFrequency } from "@/lib/repeaterOffset";
import { getQualityColor, getQualityBadge, getQualityLabel } from "@/lib/itmPropagation";

export default function MobilActiveRepeaterPanel({ repeater, distance, azimuth, reachable, gpsActive, itmResult, itmLoading, selectedModes }) {
  if (!repeater) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-700/50 rounded-2xl p-3 text-center">
        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-1" />
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
          Kein Repeater in Reichweite
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {gpsActive ? "Kein Repeater gefunden" : "GPS wird gesucht..."}
        </p>
      </div>
    );
  }

  const normOffset = normalizeOffset(repeater.offset_mhz, repeater.band);
  const inputFreq = getInputFrequency(repeater.frequency, normOffset);
  const qualityColor = itmResult ? getQualityColor(itmResult.quality) : null;
  const qualityBadge = itmResult ? getQualityBadge(itmResult.quality) : null;

  const allModes = repeater.modes && repeater.modes.length > 0
    ? repeater.modes
    : (repeater.primary_mode ? [repeater.primary_mode] : []);

  // v0.9041: DCS-Code prüfen — eigenes Feld ODER im tone-Feld (Backward-Compat mit alten Imports)
  let dcsValue = repeater.dcs && repeater.dcs.trim() && repeater.dcs.toLowerCase() !== "none"
    ? repeater.dcs.trim()
    : "";
  let toneValue = repeater.tone && repeater.tone.trim() && repeater.tone.toLowerCase() !== "none"
    ? repeater.tone.trim()
    : "";
  // Backward-Compat: DCS-Code im tone-Feld erkennen (z.B. "D023", "D023N", "D023I")
  if (!dcsValue && toneValue && /^(D\d{3}|D\d{3}[NI])$/i.test(toneValue)) {
    dcsValue = toneValue.toUpperCase();
    toneValue = "";
  }
  const hasDcs = !!dcsValue;
  const hasTone = !!toneValue;

  return (
    <div
      className={`rounded-2xl p-3 border ${
        reachable
          ? "bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-700/50 border-blue-100 dark:border-slate-600"
          : "bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-700/50 border-amber-200 dark:border-amber-900"
      }`}
    >
      {/* v0.9040: Titel entfernt — "Aktuell empfohlener Repeater" fliegt raus */}
      {/* Bei außerhalb Reichweite: kompakter Warn-Hinweis statt Titel-Zeile */}
      {!reachable && (
        <div className="flex items-center gap-1.5 text-xs mb-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span className="font-medium text-amber-600">Außerhalb Reichweite</span>
        </div>
      )}

      {/* Freq + Callsign + Location — eine Zeile, grosse Schrift */}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[28px] font-bold text-blue-600 dark:text-blue-400 leading-none font-mono">
          {repeater.frequency?.toFixed(4)}
          <span className="text-base font-normal text-gray-400 ml-1">MHz</span>
        </span>
        <span className="text-[22px] font-bold text-gray-900 dark:text-slate-100 leading-none">
          {repeater.callsign}
        </span>
        {repeater.location_name && (
          <span className="text-[22px] font-medium text-gray-900 dark:text-slate-100 leading-none">
            {repeater.location_name}
          </span>
        )}
      </div>

      {/* Input frequency (small) */}
      {inputFreq != null && (
        <p className="text-sm text-gray-400 dark:text-slate-500 leading-tight mt-0.5 flex items-center gap-1">
          <ArrowUp className="w-3 h-3" />
          {inputFreq.toFixed(4)} MHz
        </p>
      )}

      {/* v0.9040: Offset + CTCSS-Ton + DCS-Code in derselben Zeile — kompakt */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm">
        <span className="font-medium text-gray-700 dark:text-slate-200">
          Offset:{" "}
          <span className={`font-bold ${normOffset > 0 ? "text-green-600" : "text-red-500"}`}>
            {normOffset > 0 ? "+" : ""}
            {normOffset.toFixed(1)}
          </span>
          <span className="text-gray-400 ml-0.5">MHz</span>
        </span>
        <span className="font-medium text-gray-700 dark:text-slate-200">
          Tone:{" "}
          {hasTone ? (
            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{toneValue}</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </span>
        {/* v0.9041: DCS-Code neben Tone — nur anzeigen wenn vorhanden */}
        {hasDcs && (
          <span className="font-medium text-gray-700 dark:text-slate-200">
            DCS:{" "}
            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{dcsValue}</span>
          </span>
        )}
      </div>

      {/* Alle Modulationsarten als Badges — min 16px Schrift */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
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

      {/* v0.9040: Distanz + Azimuth + ITM-Qualität in einer kompakten Zeile */}
      <div className="flex items-center gap-4 mt-2">
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
        {/* v0.9040: ITM-Qualität inline — nur Badge + dBm, keine Path Loss/Clutter/Fresnel mehr */}
        {(itmResult || itmLoading) && (
          <div className="flex items-center gap-2 ml-auto">
            <Signal
              className="w-4 h-4"
              style={{ color: itmResult ? qualityColor : "#9ca3af" }}
            />
            <span
              className="text-sm font-bold"
              style={{ color: itmResult ? qualityColor : "#9ca3af" }}
            >
              {itmResult
                ? `${qualityBadge} ${itmResult.rx_signal_dbm?.toFixed(0)} dBm`
                : itmLoading
                ? "..."
                : "—"}
            </span>
          </div>
        )}
      </div>

      {/* Country (if no location_name shown above) */}
      {repeater.country && !repeater.location_name && (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500 dark:text-slate-400">
          <span>{repeater.country}</span>
        </div>
      )}
    </div>
  );
}