import React, { useState, useEffect, useRef, useCallback } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";
import { getAprsSymbolSvg } from "@/lib/aprsSymbols";
import { useWakeLock } from "@/hooks/useWakeLock";

// ---------------------------------------------------------------------------
// Two independent concepts:
//   • "My GPS Position"   (hb9om_gps_tracking_enabled) — local blue crosshair
//   • "Public GPS Position" (hb9om_gps_public_enabled) — APRS symbol + broadcast
// GPS tracking (reading coordinates) runs when EITHER is ON.
// Only ONE marker is rendered at the GPS position:
//   - APRS symbol with callsign  when public is ON
//   - Blue crosshair with callsign when public is OFF but local tracking is ON
// ---------------------------------------------------------------------------

// Blue crosshair icon with callsign label — used for "My GPS Position" (local only)
let gpsIconCache = new Map();
function getGpsIcon(callsign) {
  const cs = callsign || "";
  const key = `cross-${cs}`;
  if (gpsIconCache.has(key)) return gpsIconCache.get(key);

  const labelHtml = cs
    ? `<div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(37,99,235,0.92);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.3);letter-spacing:0.3px;">${cs}</div>`
    : "";
  const html = `
    <div style="position: relative; width: 28px; height: 28px;">
      <div style="position:absolute;top:50%;left:0;width:100%;height:2px;background:#2563eb;transform:translateY(-50%);box-shadow:0 0 4px rgba(37,99,235,0.7);"></div>
      <div style="position:absolute;left:50%;top:0;width:2px;height:100%;background:#2563eb;transform:translateX(-50%);box-shadow:0 0 4px rgba(37,99,235,0.7);"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>
      ${labelHtml}
    </div>
  `;
  const icon = L.divIcon({ html, className: "gps-tracker-icon", iconSize: [28, 28], iconAnchor: [14, 14] });
  gpsIconCache.set(key, icon);
  return icon;
}

// APRS symbol icon with callsign label — used for "Public GPS Position"
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

export default function GpsTracker({ onPublicPositionUpdate }) {
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
      // "My GPS Position" — local crosshair indicator (toggle on map)
      gpsEnabled: localStorage.getItem("hb9om_gps_tracking_enabled") !== "false",
      // "Public GPS Position" — APRS symbol + broadcast (toggle in settings)
      publicEnabled: localStorage.getItem("hb9om_gps_public_enabled") !== "false",
      intervalSec: parseInt(localStorage.getItem("hb9om_gps_tracking_interval") || "60"),
      callsign: localStorage.getItem("hb9om_my_callsign") || "",
      deviceType: localStorage.getItem("hb9om_cov_device") || "mobil",
      comment: localStorage.getItem("hb9om_gps_public_comment") || "",
      aprsSymbol: localStorage.getItem("hb9om_gps_public_symbol") || "dot",
    };
    setCurrentAprsSymbol(settingsRef.current.aprsSymbol);
  }, []);

  // Wake Lock — keeps the screen active while GPS tracking is running
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

  // Main tracking effect — runs when EITHER toggle is ON
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
      // If public was on, remove the broadcast
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

  // Re-read settings when they change
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
  const callsign = cfg.callsign;

  // Public GPS Position takes precedence — shows APRS symbol with callsign.
  // When public is OFF but local tracking is ON — shows blue crosshair with callsign.
  const icon = cfg.publicEnabled
    ? getAprsGpsIcon(currentAprsSymbol, callsign)
    : getGpsIcon(callsign);

  const tooltipText = cfg.publicEnabled
    ? `📍 ${callsign || "Mein Standort"} (öffentlich)`
    : `📍 ${callsign || "Mein GPS-Standort"}`;

  return (
    <Marker position={position} icon={icon} zIndexOffset={900}>
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
        {tooltipText}
      </Tooltip>
    </Marker>
  );
}