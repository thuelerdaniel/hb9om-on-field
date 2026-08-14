import React, { useState, useEffect, useRef, useCallback } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";
import { getAprsSymbolSvg } from "@/lib/aprsSymbols";
import { useWakeLock } from "@/hooks/useWakeLock";

// Blue crosshair icon — used when public position is OFF
let gpsIcon = null;
function getGpsIcon() {
  if (!gpsIcon) {
    const html = `
      <div style="position: relative; width: 28px; height: 28px;">
        <div style="position:absolute;top:50%;left:0;width:100%;height:2px;background:#2563eb;transform:translateY(-50%);box-shadow:0 0 4px rgba(37,99,235,0.7);"></div>
        <div style="position:absolute;left:50%;top:0;width:2px;height:100%;background:#2563eb;transform:translateX(-50%);box-shadow:0 0 4px rgba(37,99,235,0.7);"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>
      </div>
    `;
    gpsIcon = L.divIcon({ html, className: "gps-tracker-icon", iconSize: [28, 28], iconAnchor: [14, 14] });
  }
  return gpsIcon;
}

// APRS symbol icon cache — used when public position is ON.
// The user's chosen APRS symbol is rendered exactly at the GPS position,
// with the callsign as a visible permanent label below the symbol.
const aprsIconCache = new Map();
function getAprsGpsIcon(aprsSymbol, callsign) {
  const symbol = aprsSymbol || "dot";
  const cs = callsign || "";
  const key = `${symbol}-${cs}`;
  if (aprsIconCache.has(key)) return aprsIconCache.get(key);

  const svg = getAprsSymbolSvg(symbol, "#16a34a");
  // Wrap SVG in a centered container with a small position dot at the exact center,
  // so the marker is 100% at the GPS coordinates. The callsign is shown as a
  // permanent label below the symbol.
  const labelHtml = cs
    ? `<div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(22,163,74,0.92);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.3);letter-spacing:0.3px;">${cs}</div>`
    : "";
  const html = `
    <div style="position:relative;width:28px;height:28px;">
      ${svg}
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:4px;height:4px;border-radius:50%;background:#ffffff;border:1.5px solid #16a34a;box-shadow:0 0 3px rgba(22,163,74,0.8);z-index:10;"></div>
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
  // Bump this to force the tracking effect to re-run when settings change
  const [settingsVersion, setSettingsVersion] = useState(0);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);
  const lastBroadcastRef = useRef(0);
  const settingsRef = useRef({});

  // Read latest settings from localStorage (updated by Settings page).
  // Does NOT trigger a re-render — callers that need the effect to re-run
  // must also call setSettingsVersion(v => v + 1).
  const refreshSettings = useCallback(() => {
    settingsRef.current = {
      enabled: localStorage.getItem("hb9om_gps_tracking_enabled") !== "false",
      intervalSec: parseInt(localStorage.getItem("hb9om_gps_tracking_interval") || "60"),
      publicEnabled: localStorage.getItem("hb9om_gps_public_enabled") !== "false",
      callsign: localStorage.getItem("hb9om_user_callsign") || "",
      deviceType: localStorage.getItem("hb9om_cov_device") || "mobil",
      comment: localStorage.getItem("hb9om_gps_public_comment") || "",
      aprsSymbol: localStorage.getItem("hb9om_gps_public_symbol") || "dot",
    };
    setCurrentAprsSymbol(settingsRef.current.aprsSymbol);
  }, []);

  // Wake Lock — keeps the screen active and app running in background
  const s = settingsRef.current;
  const wakeLockEnabled = s.enabled;
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

  // Main tracking effect — uses watchPosition for continuous tracking
  // (works in background, less throttled than setInterval + getCurrentPosition)
  useEffect(() => {
    refreshSettings();
    const cfg = settingsRef.current;

    if (!cfg.enabled) {
      setPosition(null);
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
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

    // Use watchPosition for continuous background tracking
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onSuccess,
        onError,
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 }
      );
    }

    // Also poll at the configured interval as a fallback (watchPosition may not fire
    // often enough on some devices, especially in background)
    const intervalSec = cfg.intervalSec || 60;
    intervalRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 30000
      });
    }, intervalSec * 1000);

    // Refresh position immediately when the page becomes visible again
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

  // Re-read settings when they change (via custom events from Settings page)
  useEffect(() => {
    const handleSettingsChange = () => {
      refreshSettings();
      // Bump version to force the main tracking effect to re-run with new settings
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

  // Use APRS symbol when public position is enabled, blue crosshair otherwise.
  // When public, the callsign is shown as a permanent visible label on the marker.
  const publicEnabled = settingsRef.current.publicEnabled;
  const callsign = settingsRef.current.callsign;
  const icon = publicEnabled ? getAprsGpsIcon(currentAprsSymbol, callsign) : getGpsIcon();

  return (
    <Marker position={position} icon={icon} zIndexOffset={900}>
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
        {publicEnabled ? `📍 ${callsign || "Mein Standort"} (öffentlich)` : "📍 Mein GPS-Standort"}
      </Tooltip>
    </Marker>
  );
}