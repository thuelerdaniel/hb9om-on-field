import React, { memo, useMemo } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { Radio, MapPin, Clock, MessageSquare } from "lucide-react";
import { getAprsSymbolSvg } from "@/lib/aprsSymbols";

// Render icon cache keyed by symbol+isOwn
const iconCache = new Map();

function getPublicIcon(aprsSymbol, isOwn) {
  const symbol = aprsSymbol || "mobile";
  const key = `${symbol}-${isOwn}`;
  if (iconCache.has(key)) return iconCache.get(key);

  const color = isOwn ? "#16a34a" : "#6366f1";
  const svg = getAprsSymbolSvg(symbol, color);
  const html = `
    <div style="position:relative;width:28px;height:28px;">
      ${svg}
      ${isOwn ? '<div style="position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#22c55e;border:1.5px solid white;"></div>' : ''}
    </div>
  `;
  const icon = L.divIcon({ html, className: "public-position-icon", iconSize: [28, 28], iconAnchor: [14, 14] });
  iconCache.set(key, icon);
  return icon;
}

function formatTimeAgo(iso) {
  if (!iso) return "unbekannt";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade jetzt";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tag${d > 1 ? "en" : ""}`;
}

function PublicPositionLayerInner({ positions, userCallsign }) {
  // Filter out own position — GpsTracker renders the user's own symbol
  // directly at the GPS coordinates, so we don't duplicate it here.
  const visible = useMemo(() =>
    (positions || []).filter(p => p.lat != null && p.lng != null && !p.is_own),
    [positions]
  );

  return (
    <>
      {visible.map(p => {
        const isOwn = p.is_own || (userCallsign && p.callsign === userCallsign);
        return (
          <Marker
            key={p.id || `${p.callsign}-${p.lat}-${p.lng}`}
            position={[p.lat, p.lng]}
            icon={getPublicIcon(p.aprs_symbol, isOwn)}
            zIndexOffset={isOwn ? 850 : 800}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.92}>
              <span style={{ fontWeight: 600 }}>
                {isOwn ? "📍 Mein Standort" : `📡 ${p.callsign || "Unbekannt"}`}
              </span>
            </Tooltip>
            <Popup>
              <div className="text-xs space-y-1 min-w-[160px]">
                <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" style={{ color: isOwn ? "#16a34a" : "#6366f1" }} />
                  {isOwn ? "Mein öffentlicher Standort" : p.callsign || "Unbekannt"}
                </div>
                {p.label && <div className="text-[11px] text-gray-500">{p.label}</div>}
                <div className="flex items-center gap-1 text-[11px] text-gray-600">
                  <MapPin className="w-3 h-3" />
                  {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Clock className="w-3 h-3" />
                  Aktualisiert {formatTimeAgo(p.last_updated)}
                </div>
                {p.device_type && (
                  <div className="text-[10px] text-gray-400">
                    Typ: {p.device_type}
                  </div>
                )}
                {p.comment && (
                  <div className="flex items-start gap-1 text-[11px] text-gray-700 bg-gray-50 rounded p-1.5 mt-1">
                    <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400" />
                    <span className="break-words">{p.comment}</span>
                  </div>
                )}
                {isOwn && (
                  <div className="text-[10px] text-green-600 font-medium pt-1 border-t border-gray-100">
                    Öffentlich sichtbar für alle Benutzer
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export default memo(PublicPositionLayerInner);