// Google Maps URL Parser — extrahiert Koordinaten/Wegpunkte aus verschiedenen Google Maps URL-Formaten.
// Unterstützte Formate:
//   1. https://www.google.com/maps/dir/LAT1,LON1/LAT2,LON2/...
//   2. https://maps.google.com/?q=LAT,LON
//   3. https://www.google.com/maps/search/?api=1&query=LAT,LON
//   4. https://www.google.com/maps/dir/ORT1/ORT2/... (Ortsnamen — gibt leeres Array zurück, braucht Geokodierung)
//   5. https://www.google.com/maps/place/LAT,LON

export function parseGoogleMapsUrl(url) {
  try {
    const u = new URL(url);
    const waypoints = [];

    // Format 1: /maps/dir/LAT1,LON1/LAT2,LON2/...
    // Path: /maps/dir/47.5,8.5/47.6,8.6/...
    const pathParts = u.pathname.split("/").filter(Boolean);
    if (pathParts.includes("dir")) {
      const dirIdx = pathParts.indexOf("dir");
      for (let i = dirIdx + 1; i < pathParts.length; i++) {
        const part = decodeURIComponent(pathParts[i]);
        const match = part.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lon = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lon)) {
            waypoints.push({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, order: waypoints.length });
          }
        }
      }
    }

    // Format 2 & 3: ?q=LAT,LON oder ?query=LAT,LON
    if (waypoints.length === 0) {
      const q = u.searchParams.get("q") || u.searchParams.get("query");
      if (q) {
        // Kann "LAT,LON" oder "ORT" sein
        const match = q.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lon = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lon)) {
            waypoints.push({ lat, lon, name: q, order: 0 });
          }
        }
      }
    }

    // Format 5: /maps/place/LAT,LON
    if (waypoints.length === 0) {
      if (pathParts.includes("place")) {
        const placeIdx = pathParts.indexOf("place");
        for (let i = placeIdx + 1; i < pathParts.length; i++) {
          const part = decodeURIComponent(pathParts[i]);
          const match = part.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lon = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lon)) {
              waypoints.push({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, order: waypoints.length });
            }
          }
        }
      }
    }

    // Format: @LAT,LON,ZOOMz — Zentrum der Karte
    if (waypoints.length === 0) {
      const atMatch = u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
      if (atMatch) {
        const lat = parseFloat(atMatch[1]);
        const lon = parseFloat(atMatch[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
          waypoints.push({ lat, lon, name: `Kartenmitte ${lat.toFixed(4)}, ${lon.toFixed(4)}`, order: 0 });
        }
      }
    }

    return waypoints;
  } catch (err) {
    return [];
  }
}