import React, { useState, useEffect, useRef } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";

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

export default function GpsTracker({ onPublicPositionUpdate }) {
  const [position, setPosition] = useState(null);
  const intervalRef = useRef(null);
  const lastBroadcastRef = useRef(0);

  useEffect(() => {
    const startTracking = () => {
      const enabled = localStorage.getItem("hb9om_gps_tracking_enabled") === "true";
      const intervalSec = parseInt(localStorage.getItem("hb9om_gps_tracking_interval") || "60");
      const publicEnabled = localStorage.getItem("hb9om_gps_public_enabled") === "true";

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (!enabled) {
        setPosition(null);
        // If public mode was on, remove our public position
        if (publicEnabled) {
          base44.functions.invoke("managePublicPosition", { action: "remove" }).catch(() => {});
        }
        return;
      }

      const fetchPosition = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const newPos = [pos.coords.latitude, pos.coords.longitude];
            setPosition(newPos);

            // Broadcast to public position if enabled — but at most once per 30s
            if (publicEnabled) {
              const now = Date.now();
              if (now - lastBroadcastRef.current > 30000) {
                lastBroadcastRef.current = now;
                const callsign = localStorage.getItem("hb9om_user_callsign") || "";
                const deviceType = localStorage.getItem("hb9om_cov_device") || "mobil";
                base44.functions.invoke("managePublicPosition", {
                  action: "set",
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  callsign,
                  device_type: deviceType,
                }).then(res => {
                  if (onPublicPositionUpdate && res?.id) {
                    onPublicPositionUpdate({ id: res.id, lat: pos.coords.latitude, lng: pos.coords.longitude, is_own: true });
                  }
                }).catch(() => {});
              }
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      };

      fetchPosition();
      intervalRef.current = setInterval(fetchPosition, intervalSec * 1000);
    };

    startTracking();
    window.addEventListener("gps-tracking-changed", startTracking);
    window.addEventListener("gps-public-changed", startTracking);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("gps-tracking-changed", startTracking);
      window.removeEventListener("gps-public-changed", startTracking);
    };
  }, [onPublicPositionUpdate]);

  if (!position) return null;

  return (
    <Marker position={position} icon={getGpsIcon()} zIndexOffset={900}>
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
        📍 Mein GPS-Standort
      </Tooltip>
    </Marker>
  );
}