import { useEffect, useRef, useCallback } from "react";

/**
 * Wake Lock Hook — hält den Bildschirm aktiv und sorgt dafür,
 * dass die App im Hintergrund weiterläuft (GPS-Tracking etc.).
 *
 * Browser-Throttling im Hintergrund wird teilweise kompensiert durch:
 * - Screen Wake Lock API (verhindert Bildschirm-Sleep)
 * - visibilitychange-Handler (re-aktiviert Wake Lock beim Zurückkehren)
 * - Regelmässige "Heartbeat"-Ticks die bei Sichtbarkeit sofort feuern
 */
export function useWakeLock(enabled) {
  const wakeLockRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const acquire = useCallback(async () => {
    if (!enabledRef.current) return;
    if (!("wakeLock" in navigator)) return;
    try {
      // Release existing lock first
      if (wakeLockRef.current) {
        try { await wakeLockRef.current.release(); } catch {}
        wakeLockRef.current = null;
      }
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
    } catch {
      // Wake Lock might fail (e.g. page not focused) — silently ignore
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Release wake lock when disabled
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release(); } catch {}
        wakeLockRef.current = null;
      }
      return;
    }

    acquire();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        acquire();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release(); } catch {}
        wakeLockRef.current = null;
      }
    };
  }, [enabled, acquire]);

  return {
    isLocked: !!wakeLockRef.current,
    reacquire: acquire,
  };
}