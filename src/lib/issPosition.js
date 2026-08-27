// ISS Position Fetcher — wheretheiss.at (HTTPS) primär, Open Notify (HTTP) als Fallback.
// Aktualisiert alle 5 Sekunden. Gibt {lat, lon, altitude, velocity} zurück.

let cachedPosition = null;

export async function fetchIssPosition() {
  // Primär: wheretheiss.at (HTTPS — funktioniert auf HTTPS-Sites)
  try {
    const resp = await fetch('https://api.wheretheiss.at/v1/satellites/25544', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.latitude != null && data?.longitude != null) {
        cachedPosition = {
          lat: data.latitude,
          lon: data.longitude,
          altitude: data.altitude || 408,
          velocity: data.velocity || 27600,
        };
        return cachedPosition;
      }
    }
  } catch (e) {
    console.warn('[ISS] wheretheiss.at failed:', e.message);
  }

  // Fallback: Open Notify (HTTP — kann auf HTTPS-Sites durch Mixed-Content blockiert werden)
  try {
    const resp = await fetch('http://api.open-notify.org/iss-now.json', {
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.iss_position) {
        cachedPosition = {
          lat: parseFloat(data.iss_position.latitude),
          lon: parseFloat(data.iss_position.longitude),
          altitude: 408,
          velocity: 27600,
        };
        return cachedPosition;
      }
    }
  } catch (e) {
    console.warn('[ISS] open-notify failed:', e.message);
  }

  return cachedPosition;
}

export function getCachedIssPosition() {
  return cachedPosition;
}