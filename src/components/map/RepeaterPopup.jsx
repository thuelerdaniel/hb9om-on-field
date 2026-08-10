import React from "react";
import { Radio, Globe, Headphones, Link2, ExternalLink, Signal, Navigation, MapPin } from "lucide-react";
import { MODE_COLORS, MODE_LABELS, STATUS_LABELS } from "@/lib/repeaterModes";

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function RepeaterPopup({ repeater, linkedRepeaters = [], userPosition }) {
  const statusInfo = STATUS_LABELS[repeater.status] || STATUS_LABELS.unknown;
  const hasCoords = repeater.lat != null && repeater.lng != null;
  const navUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${repeater.lat},${repeater.lng}`
    : null;
  const distance = hasCoords && userPosition
    ? haversineKm(userPosition[0], userPosition[1], repeater.lat, repeater.lng)
    : null;

  return (
    <div className="text-xs min-w-[200px] max-w-[260px]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" style={{ color: MODE_COLORS[repeater.primary_mode] || "#6b7280" }} />
            {repeater.callsign}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{repeater.location_name}</div>
          {repeater.country && (
            <div className="text-[10px] text-gray-400 mt-0.5">{repeater.country}</div>
          )}
        </div>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
        >
          {statusInfo.label}
        </span>
      </div>

      <div className="bg-gray-50 rounded-lg p-2 mb-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 uppercase">Frequenz</span>
          <span className="font-mono font-bold text-sm text-gray-900">
            {repeater.frequency.toFixed(4)} MHz
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-400 uppercase">Offset</span>
          <span className="font-mono text-[11px] text-gray-600">
            {repeater.offset_mhz > 0 ? "+" : ""}{repeater.offset_mhz?.toFixed(2) || "0.00"} MHz
          </span>
        </div>
        {repeater.tone && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400 uppercase">Zugang</span>
            <span className="font-mono text-[11px] text-gray-600">{repeater.tone}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-2">
        {(repeater.modes || []).map((mode, i) => (
          <span
            key={i}
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{
              color: MODE_COLORS[mode] || "#6b7280",
              backgroundColor: (MODE_COLORS[mode] || "#6b7280") + "15",
            }}
          >
            {MODE_LABELS[mode] || mode}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-2">
        <Signal className="w-3 h-3" />
        <span>Band: <span className="font-medium text-gray-700">{repeater.band}</span></span>
      </div>

      {repeater.fm_funknetz && (
        <div className="flex items-center gap-1 text-[11px] text-green-600 mb-1.5 bg-green-50 rounded px-1.5 py-1">
          <Headphones className="w-3 h-3" />
          <span>Auf FM-Funknetz.de anhörbar</span>
        </div>
      )}

      {repeater.echolink_node && (
        <div className="flex items-center gap-1 text-[11px] text-indigo-600 mb-1.5">
          <Link2 className="w-3 h-3" />
          <span>EchoLink: <span className="font-mono font-medium">{repeater.echolink_node}</span></span>
        </div>
      )}

      {distance != null && (
        <div className="flex items-center gap-1 text-[11px] text-blue-600 mb-1.5 bg-blue-50 rounded px-1.5 py-1">
          <MapPin className="w-3 h-3" />
          <span>Entfernung: <span className="font-bold">{formatDistance(distance)}</span></span>
        </div>
      )}

      {linkedRepeaters.length > 0 && (
        <div className="mb-2 border-t border-gray-100 pt-2">
          <div className="text-[10px] text-gray-400 uppercase mb-1 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Verlinkte Relais ({linkedRepeaters.length})
          </div>
          <div className="space-y-0.5">
            {linkedRepeaters.map((lr, i) => (
              <div key={i} className="text-[11px] font-mono text-gray-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {lr}
              </div>
            ))}
          </div>
        </div>
      )}

      {repeater.web_url && (
        <a
          href={repeater.web_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 hover:underline mt-1"
        >
          <Globe className="w-3 h-3" />
          <span className="truncate">{repeater.web_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
        </a>
      )}

      {navUrl && (
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Navigation className="w-3 h-3" />
          Navigieren (Google Maps)
        </a>
      )}

      <div className="text-[9px] text-gray-300 mt-2 pt-1 border-t border-gray-100">
        Quelle: RepeaterBook.com
      </div>
    </div>
  );
}