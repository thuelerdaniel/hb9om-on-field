import React, { useState, useEffect, useRef, useCallback } from "react";
import { Marker, Circle, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";
import { getAprsSymbolSvg } from "@/lib/aprsSymbols";
import { useWakeLock } from "@/hooks/useWakeLock";
import PositionPopupContent from "@/components/map/PositionPopupContent";

// ---------------------------------------------------------------------------
// Two independent concepts:
//   • "My GPS Position"   (hb9om_gps_tracking_enabled) — local crosshair, no label
//     Toggle: "center on position" button on the map (left side)
//     Click marker → full popup with circle, dimensions, GPS coordinates
//   • "Public GPS Position" (hb9om_gps_public_enabled) — APRS symbol + callsign
//     Toggle: in Settings (GpsPublicConfig)
//     Click marker → coordinates only (no circle)
// GPS tracking (reading coordinates) runs when EITHER is ON.
// ---------------------------------------------------------------------------

// Blue crosshair icon — NO callsign label (per user request)
let gpsIconCache = null;
function getGpsIcon() {
  if (gpsIconCache) return gpsIconCache;
  const html = `
    <div style="position: relative; width: 28px; height: 28px;">
      <div style="position:absolute;top:50%;left:0;width:100%;height:2px;background:#2563eb;transform:translateY(-50%);box-shadow:0 0 4px rgba(37,99,235,0.7);"></div>
      <div style="position:absolute;left:50%;top:0;width:2px;height:100%;background:#2563eb;transform:translateX(-50%);box-shadow:0 0 4px rgba(37,99,235,0.7);"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>
    </div>
  `;
  gpsIconCache = L.divIcon({ html, className: "gps-tracker-icon", iconSize: [28, 28], iconAnchor: [14, 14] });
  return gpsIconCache;
}

// APRS symbol icon WITH callsign label — used for "Public GPS Position"
const aprsIconCache = new Map();
function getAprsGpsIcon(aprsSymbol, callsign) {
  const symbol = aprsSymbol || "dot";
  const cs = callsign || "";
  const key = `${symbol}-${cs}`;
  if (aprsIconCache.has(key)) return aprsIconCache.get(key);

  const svg = getAprsSymbolSvg(symbol, "#16a34a");
  const labelHtml = cs
    ? `<div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(22,163,74,0.92);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.3);letter-spacing:0.3px;">${cs}</div>`
    : "";
  const html = `
    <div style="position:relative;width:28px;height:28px;">
      ${svg}
      ${labelHtml}
    </div>
  `;
  const icon = L.divIcon({ html, className: "gps-tracker-icon aprs", iconSize: [28, 28], iconAnchor: [14, 14] });
  aprsIconCache.set(key, icon);
  return icon;
}

function latLngToGrid(lat, lng) {
  const adjLng = lng + 180;
  const adjLat = lat + 90;
  const fieldLng = Math.floor(adjLng / 20);
  const fieldLat = Math.floor(adjLat / 10);
  const squareLng = Math.floor((adjLng % 20) / 2);
  const squareLat = Math.floor(adjLat % 10);
  const subSqLng = Math.floor((adjLng % 20 % 2) * 12);
  const subSqLat = Math.floor((adjLat % 10 % 1) * 24);
  return (
    String.fromCharCode(65 + fieldLng) +
    String.fromCharCode(65 + fieldLat) +
    squareLng + squareLat +
    String.fromCharCode(97 + subSqLng) +
    String.fromCharCode(97 + subSqLat)
  );
}

export default function GpsTracker({ onPublicPositionUpdate, radius, onRadiusChange, onPositionChange, onCacheDownload }) {
  const [position, setPosition] = useState(null);
  const [currentAprsSymbol, setCurrentAprsSymbol] = useState(
    () => localStorage.getItem("hb9om_gps_public_symbol") || "dot"
  );
  const [settingsVersion, setSettingsVersion] = useState(0);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const lastBroadcastRef = useRef(0);
  const settingsRef = useRef({});

  const refreshSettings = useCallback(() => {
    settingsRef.current = {
      gpsEnabled: localStorage.getItem("hb9om_gps_tracking_enabled") !== "false",
      publicEnabled: localStorage.getItem("hb9om_gps_public_enabled") !== "false",
      intervalSec: parseInt(localStorage.getItem("hb9om_gps_tracking_interval") || "60"),
      callsign: localStorage.getItem("hb9om_my_callsign") || "",
      deviceType: localStorage.getItem("hb9om_cov_device") || "mobil",
      comment: localStorage.getItem("hb9om_gps_public_comment") || "",
      aprsSymbol: localStorage.getItem("hb9om_gps_public_symbol") || "dot",
    };
    setCurrentAprsSymbol(settingsRef.current.aprsSymbol);
  }, []);

  const s = settingsRef.current;
  const wakeLockEnabled = s.gpsEnabled || s.publicEnabled;
  useWakeLock(wakeLockEnabled);

  const broadcastPosition = useCallback((lat, lng) => {
    const cfg = settingsRef.current;
    if (!cfg.publicEnabled) return;
    const now = Date.now();
    if (now - lastBroadcastRef.current < 30000) return;
    lastBroadcastRef.current = now;
    base44.functions.invoke("managePublicPosition", {
      action: "set",
      lat,
      lng,
      callsign: cfg.callsign,
      device_type: cfg.deviceType,
      comment: cfg.comment,
      aprs_symbol: cfg.aprsSymbol,
    }).then(res => {
      if (onPublicPositionUpdate && res?.id) {
        onPublicPositionUpdate({ id: res.id, lat, lng, is_own: true });
      }
    }).catch(() => {});
  }, [onPublicPositionUpdate]);

  useEffect(() => {
    refreshSettings();
    const cfg = settingsRef.current;
    const shouldTrack = cfg.gpsEnabled || cfg.publicEnabled;

    if (!shouldTrack) {
      setPosition(null);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (cfg.publicEnabled) {
        base44.functions.invoke("managePublicPosition", { action: "remove" }).catch(() => {});
      }
      return;
    }

    const onSuccess = (pos) => {
      const newPos = [pos.coords.latitude, pos.coords.longitude];
      setPosition(newPos);
      broadcastPosition(pos.coords.latitude, pos.coords.longitude);
    };

    const onError = () => {};

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onSuccess,
        onError,
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 }
      );
    }

    const intervalSec = cfg.intervalSec || 60;
    intervalRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 30000
      });
    }, intervalSec * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(onSuccess, onError, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 10000
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [broadcastPosition, refreshSettings, settingsVersion]);

  useEffect(() => {
    const handleSettingsChange = () => {
      refreshSettings();
      setSettingsVersion(v => v + 1);
    };
    window.addEventListener("gps-tracking-changed", handleSettingsChange);
    window.addEventListener("gps-public-changed", handleSettingsChange);
    window.addEventListener("storage", handleSettingsChange);
    return () => {
      window.removeEventListener("gps-tracking-changed", handleSettingsChange);
      window.removeEventListener("gps-public-changed", handleSettingsChange);
      window.removeEventListener("storage", handleSettingsChange);
    };
  }, [refreshSettings]);

  if (!position) return null;

  const cfg = settingsRef.current;
  const [lat, lng] = position;

  // --- Public GPS Position: APRS symbol + callsign, NO circle, simple popup ---
  if (cfg.publicEnabled) {
    return (
      <Marker position={position} icon={getAprsGpsIcon(currentAprsSymbol, cfg.callsign)} zIndexOffset={900}>
        <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
          📍 {cfg.callsign || "Mein Standort"} (öffentlich)
        </Tooltip>
        <Popup>
          <div className="text-xs space-y-1 min-w-[160px]">
            <div className="font-bold text-sm text-gray-900 pb-1 border-b border-gray-100">
              📡 {cfg.callsign || "Mein Standort"}
            </div>
            <div>
              <span className="text-gray-500">WGS84:</span>{" "}
              <span className="font-mono font-bold text-gray-900">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
            </div>
            <div>
              <span className="text-gray-500">Maidenhead:</span>{" "}
              <span className="font-mono font-bold text-gray-900">{latLngToGrid(lat, lng)}</span>
            </div>
          </div>
        </Popup>
      </Marker>
    );
  }

  // --- My GPS Position: crosshair (no label) + circle + full popup ---
  return (
    <>
      <Circle
        center={position}
        radius={radius || 5000}
        interactive={false}
        pathOptions={{
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "6 4",
        }}
      />
      <Marker position={position} icon={getGpsIcon()} zIndexOffset={900}>
        <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
          📍 Mein GPS-Standort
        </Tooltip>
        <Popup>
          <PositionPopupContent
            lat={lat}
            lng={lng}
            radius={radius || 5000}
            onRadiusChange={onRadiusChange}
            onPositionChange={onPositionChange}
            onCacheDownload={onCacheDownload}
            title="📍 GPS-Position"
          />
        </Popup>
      </Marker>
    </>
  );
}