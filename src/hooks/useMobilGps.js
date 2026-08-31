// useMobilGps — Hook für GPS-Position und Wake Lock im Mobil-Tab.
// Startet watchPosition mit enableHighAccuracy und hält den Bildschirm aktiv.
// Bereinigt alles beim Unmount.

import { useState, useEffect, useRef, useCallback } from "react";
import { requestWakeLock, releaseWakeLock } from "@/lib/wakeLockManager";

export function useMobilGps(active) {
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const watchIdRef = useRef(null);
  const localWakeLockRef = useRef(null);

  useEffect(() => {
    if (!active) {
      // Tab nicht aktiv — alles stoppen
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGpsActive(false);
      return;
    }

    // Wake Lock anfordern (zusätzlich zum globalen)
    const acquireWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          localWakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch (e) {
        // Wake Lock kann fehlschlagen — nicht kritisch
      }
    };
    acquireWakeLock();

    // Re-acquire Wake Lock bei visibilitychange
    const handleVisibility = async () => {
      if (document.visibilityState === "visible" && !localWakeLockRef.current) {
        try {
          if ("wakeLock" in navigator) {
            localWakeLockRef.current = await navigator.wakeLock.request("screen");
          }
        } catch (e) {}
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // GPS watchPosition starten
    if ("geolocation" in navigator) {
      setGpsActive(true);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          setAccuracy(pos.coords.accuracy);
          setGpsError(null);
        },
        (err) => {
          setGpsError(err.message);
          setGpsActive(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    } else {
      setGpsError("GPS nicht verfügbar");
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (localWakeLockRef.current) {
        localWakeLockRef.current.release();
        localWakeLockRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      setGpsActive(false);
    };
  }, [active]);

  return { position, accuracy, gpsActive, gpsError };
}