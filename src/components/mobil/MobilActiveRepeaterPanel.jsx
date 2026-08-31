// MobilActiveRepeaterPanel — Prominente Anzeige des aktiven Repeaters im Start-Modus.
// Große Schrift, alle wichtigen Daten, Input-Frequenz (klein), normalisierter Offset.
// ITM (Longley-Rice) Signal-Qualität: dBm, Qualität-Badge, Path/ITM/Clutter Loss, Fresnel.

import React from "react";
import { Radio, Navigation, MapPin, AlertCircle, AlertTriangle, ArrowUp, Signal, Activity, Mountain } from "lucide-react";
import { getModeColor, getModeLabel } from "@/lib/repeaterModes";
import { normalizeOffset, getInputFrequency } from "@/lib/repeaterOffset";
import { getQualityColor, getQualityBadge, getQualityLabel } from "@/lib/itmPropagation";

export default function MobilActiveRepeaterPanel({ repeater, distance, azimuth, reachable, gpsActive, itmResult, itmLoading }) {
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

  const color = getModeColor(repeater.primary_mode);
  const normOffset = normalizeOffset(repeater.offset_mhz, repeater.band);
  const inputFreq = getInputFrequency(repeater.frequency, normOffset);
  const qualityColor = itmResult ? getQualityColor(itmResult.quality) : null;
  const qualityBadge = itmResult ? getQualityBadge(itmResult.quality) : null;

  return (
    <div
      className={`rounded-2xl p-4 border ${
        reachable
          ? "bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-700/50 border-blue-100 dark:border-slate-600"
          : "bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-700/50 border-amber-200 dark:border-amber-900"
      }`}
    >
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

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-2xl font-mono font-bold text-gray-900 dark:text-slate-100 leading-tight">
            {repeater.callsign}
          </p>

          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 leading-tight mt-1">
            {repeater.frequency?.toFixed(4)}{" "}
            <span className="text-base font-normal text-gray-400">MHz</span>
          </p>

          {inputFreq != null && (
            <p className="text-sm text-gray-400 dark:text-slate-500 leading-tight mt-0.5 flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              {inputFreq.toFixed(4)} MHz
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="font-medium text-gray-700 dark:text-slate-200">
              Offset:{" "}
              <span className={normOffset > 0 ? "text-green-600" : "text-red-500"}>
                {normOffset > 0 ? "+" : ""}
                {normOffset.toFixed(1)}
              </span>
            </span>
            {repeater.tone && (
              <span className="font-medium text-gray-700 dark:text-slate-200">
                Tone: <span className="text-gray-900 dark:text-slate-100">{repeater.tone}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span
              className="px-2 py-0.5 text-xs font-bold text-white rounded-full"
              style={{ backgroundColor: color }}
            >
              {getModeLabel(repeater.primary_mode)}
            </span>
            <span className="text-xs text-gray-500 dark:text-slate-400">
              {repeater.band || "?"}
            </span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1 justify-end">
            <Navigation
              className="w-4 h-4 text-gray-400"
              style={{ transform: `rotate(${azimuth || 0}deg)` }}
            />
            <span className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {distance?.toFixed(0)}
            </span>
            <span className="text-xs text-gray-400">km</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {azimuth != null ? `${azimuth}°` : ""}
          </p>
        </div>
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

      {repeater.location_name && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-slate-400">
          <MapPin className="w-3 h-3" />
          <span>{repeater.location_name}</span>
          {repeater.country && <span>· {repeater.country}</span>}
        </div>
      )}
    </div>
  );
}