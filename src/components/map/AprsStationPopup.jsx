import React, { useEffect, useState } from "react";
import { Radio, Navigation, MapPin, Gauge, Compass, Mountain, Route, Info, CloudSnow, Wind, Droplets, Thermometer, ExternalLink } from "lucide-react";
import { getAprsDetail } from "@/lib/aprsDetailBatch";
import { NODE_TYPE_LABELS, NODE_COLORS } from "@/lib/aprsNodeStyle";

// Popup für APRS-IS-Stationen.
// Zeigt zuerst die eigenen APRS-IS-Daten (immer vorhanden), ergänzt sie beim
// Öffnen durch die aprs.fi-Detailabfrage (nur mit eigenem Key, 5-Minuten-Cache,
// gebündelt) und führt zurück zu aprs.fi.

const APRS_FI_URL = "https://aprs.fi/";

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function fmtAgo(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std. ${min % 60} Min.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

function fmtUhr(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.toISOString().slice(11, 16)} UTC`;
}

function Row({ icon: Icon, label, value, tone = "text-gray-600" }) {
  if (value == null || value === "") return null;
  return (
    <div className={`flex items-start gap-1.5 text-[11px] ${tone} mb-1`}>
      <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" />
      <span className="text-gray-400">{label}:</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}

export default function AprsStationPopup({ node, userPosition }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const callsign = String(node.callsign || "").toUpperCase();

  // Detailabfrage erst beim Öffnen des Popups (dieses Element wird erst dann
  // gerendert) — nie beim Laden oder Pannen der Karte.
  useEffect(() => {
    let cancelled = false;
    if (!callsign) return undefined;
    setLoading(true);
    getAprsDetail(callsign)
      .then((res) => {
        if (!cancelled) setDetail(res || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [callsign]);

  const color = NODE_COLORS[node.node_type] || NODE_COLORS.other;
  const typeLabel = NODE_TYPE_LABELS[node.node_type] || "APRS";
  const loc = detail?.loc || null;
  const wx = detail?.wx || node.wx || null;

  const speed = node.speed ?? loc?.speed ?? null;
  const course = node.course ?? loc?.course ?? null;
  const altitude = node.altitude ?? loc?.altitude ?? null;
  const comment = node.comment || loc?.comment || "";
  const status = node.status || loc?.status || "";
  const path = node.path || loc?.path || "";
  const phg = node.phg || loc?.phg || "";
  const lasttime = detail?.loc?.lasttime || node.last_heard || null;

  const distance = userPosition && Number.isFinite(node.lat) && Number.isFinite(node.lng)
    ? haversineKm(userPosition[0], userPosition[1], node.lat, node.lng)
    : null;

  const hasWx = wx && Object.values(wx).some((v) => v !== null && v !== undefined);
  const noKey = detail?.reason === "no_key";
  const upstreamError = detail?.reason && detail.reason !== "no_key" ? detail.message : null;

  return (
    <div className="text-xs min-w-[220px] max-w-[280px]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" style={{ color }} />
            {node.callsign}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {lasttime
              ? `zuletzt gehört: ${fmtAgo(lasttime)} · ${fmtUhr(lasttime)}`
              : "zuletzt gehört: unbekannt"}
          </div>
        </div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ color, backgroundColor: color + "15" }}>
          {typeLabel}
        </span>
      </div>

      {(speed != null || course != null || altitude != null) && (
        <div className="bg-gray-50 rounded px-1.5 py-1 mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-700">
          {speed != null && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{speed} km/h</span>}
          {course != null && <span className="flex items-center gap-1"><Compass className="w-3 h-3" />{Math.round(course)}°</span>}
          {altitude != null && <span className="flex items-center gap-1"><Mountain className="w-3 h-3" />{Math.round(altitude)} m</span>}
        </div>
      )}

      {comment && <p className="text-[11px] text-gray-600 mb-1 break-words">{comment}</p>}
      {status && (
        <div className="text-[11px] text-indigo-700 bg-indigo-50 rounded px-1.5 py-1 mb-1 break-words">
          <span className="text-indigo-400">Status:</span> {status}
        </div>
      )}
      <Row icon={Route} label="Pfad" value={path} />
      <Row icon={Info} label="PHG" value={phg} />

      {hasWx && (
        <div className="bg-emerald-50 rounded px-1.5 py-1 mb-1.5 text-[11px] text-emerald-800 space-y-0.5">
          <div className="flex items-center gap-1 font-medium"><CloudSnow className="w-3 h-3" />Wetter</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {wx.temp_c != null && <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" />{wx.temp_c} °C</span>}
            {wx.humidity != null && <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{wx.humidity} %</span>}
            {wx.wind_kmh != null && (
              <span className="flex items-center gap-1">
                <Wind className="w-3 h-3" />{wx.wind_kmh} km/h{wx.wind_dir != null ? ` aus ${wx.wind_dir}°` : ""}
                {wx.gust_kmh != null ? ` (Böen ${wx.gust_kmh})` : ""}
              </span>
            )}
            {wx.pressure_hpa != null && <span>{wx.pressure_hpa} hPa</span>}
            {wx.rain_1h_mm != null && <span>Regen 1 h: {wx.rain_1h_mm} mm</span>}
            {wx.rain_24h_mm != null && <span>24 h: {wx.rain_24h_mm} mm</span>}
          </div>
        </div>
      )}

      {distance != null && (
        <div className="flex items-center gap-1 text-[11px] text-blue-600 mb-1.5 bg-blue-50 rounded px-1.5 py-1">
          <MapPin className="w-3 h-3" />
          <span>Entfernung: <span className="font-bold">{fmtDistance(distance)}</span></span>
        </div>
      )}

      {loading && <div className="text-[10px] text-gray-400 mb-1">aprs.fi-Details werden geladen…</div>}
      {noKey && (
        <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-1 mb-1.5">
          Nur APRS-IS-Daten — für Details einen eigenen APRS.fi-Key in den Einstellungen hinterlegen.
        </div>
      )}
      {upstreamError && (
        <div className="text-[10px] text-red-600 bg-red-50 rounded px-1.5 py-1 mb-1.5">{upstreamError}</div>
      )}

      <a
        href={`${APRS_FI_URL}#!call=a%2F${encodeURIComponent(callsign)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
      >
        <Navigation className="w-3 h-3" />
        Auf aprs.fi öffnen
      </a>

      <div className="text-[9px] text-gray-400 mt-2 pt-1 border-t border-gray-100 leading-relaxed">
        Daten: APRS-IS (eigener Sammler){detail?.loc ? " + " : " · "}
        {detail?.loc ? (
          <a href={APRS_FI_URL} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline inline-flex items-center gap-0.5">
            Details von aprs.fi<ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : (
          <a href={APRS_FI_URL} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">aprs.fi</a>
        )}
      </div>
    </div>
  );
}