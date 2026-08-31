// MobilActiveRepeaterPanel — Prominente Anzeige des empfohlenen Repeaters im Start-Modus.
// Große Schrift, alle wichtigen Daten, "außerhalb Reichweite" Warnung bei Fallback.

import React from "react";
import { Radio, Navigation, MapPin, AlertCircle, AlertTriangle } from "lucide-react";
import { getModeColor, getModeLabel } from "@/lib/repeaterModes";

export default function MobilActiveRepeaterPanel({ repeater, distance, azimuth, reachable, gpsActive }) {
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
          {/* Callsign — groß */}
          <p className="text-2xl font-mono font-bold text-gray-900 dark:text-slate-100 leading-tight">
            {repeater.callsign}
          </p>

          {/* Frequency — groß, prominent */}
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 leading-tight mt-1">
            {repeater.frequency?.toFixed(4)}{" "}
            <span className="text-base font-normal text-gray-400">MHz</span>
          </p>

          {/* Offset + Tone */}
          <div className="flex items-center gap-3 mt-2 text-sm">
            {repeater.offset_mhz != null && (
              <span className="font-medium text-gray-700 dark:text-slate-200">
                Offset:{" "}
                <span className={repeater.offset_mhz > 0 ? "text-green-600" : "text-red-500"}>
                  {repeater.offset_mhz > 0 ? "+" : ""}
                  {repeater.offset_mhz.toFixed(3)}
                </span>
              </span>
            )}
            {repeater.tone && (
              <span className="font-medium text-gray-700 dark:text-slate-200">
                Tone: <span className="text-gray-900 dark:text-slate-100">{repeater.tone}</span>
              </span>
            )}
          </div>

          {/* Mode + Band */}
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

        {/* Distanz + Azimuth — rechts */}
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

      {/* Standort */}
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