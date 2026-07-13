import React, { useState, useEffect, useRef } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

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

export default function GpsTracker() {
  const [position, setPosition] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const startTracking = () => {
      const enabled = localStorage.getItem("hb9om_gps_tracking_enabled") === "true";
      const intervalSec = parseInt(localStorage.getItem("hb9om_gps_tracking_interval") || "60");

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (!enabled) {
        setPosition(null);
        return;
      }

      const fetchPosition = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      };

      fetchPosition();
      intervalRef.current = setInterval(fetchPosition, intervalSec * 1000);
    };

    startTracking();
    window.addEventListener("gps-tracking-changed", startTracking);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("gps-tracking-changed", startTracking);
    };
  }, []);

  if (!position) return null;

  return (
    <Marker position={position} icon={getGpsIcon()} zIndexOffset={900}>
      <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
        📍 Mein GPS-Standort
      </Tooltip>
    </Marker>
  );
}