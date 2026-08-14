import React, { memo, useMemo } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { Radio, MapPin, Clock } from "lucide-react";

// Render a small, shared icon cache keyed by device type
const iconCache = new Map();

function getPublicIcon(deviceType, isOwn) {
  const key = `${deviceType}-${isOwn}`;
  if (iconCache.has(key)) return iconCache.get(key);

  const colors = isOwn ? "#16a34a" : "#6366f1";
  const ring = isOwn ? "#22c55e" : "#818cf8";
  const html = `
    <div style="position:relative;width:32px;height:32px;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:${colors}33;border:2px solid ${ring};box-shadow:0 0 6px ${colors}88;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:${colors};border:2px solid white;"></div>
      ${isOwn ? '<div style="position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#22c55e;border:1.5px solid white;"></div>' : ''}
    </div>
  `;
  const icon = L.divIcon({ html, className: "public-position-icon", iconSize: [32, 32], iconAnchor: [16, 16] });
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
  const visible = useMemo(() =>
    (positions || []).filter(p => p.lat != null && p.lng != null),
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
            icon={getPublicIcon(p.device_type, isOwn)}
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