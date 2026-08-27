// Wake Lock Manager — hält den Bildschirm aktiv während der App-Nutzung.
// Re-aktiviert nach Tab-Wechsel und überwacht alle 30 Sekunden.

let wakeLock = null;

export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] aktiviert');
      document.addEventListener('visibilitychange', async () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
          try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
        }
      });
      return true;
    }
    return false;
  } catch(e) { console.error('[WakeLock] Fehler:', e.message); return false; }
}

export function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

export function startWakeLockMonitor() {
  return setInterval(async () => {
    if (document.visibilityState === 'visible' && wakeLock === null) {
      await requestWakeLock();
    }
  }, 30000);
}