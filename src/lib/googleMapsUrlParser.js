// Google Maps URL Parser — extrahiert Koordinaten/Wegpunkte aus verschiedenen Google Maps URL-Formaten.
// v0.9020: Wenn /dir/ vorhanden ist, NUR /dir/ auswerten (kein Fallback auf @lat,lon).
//          Das verhindert die Regression dass URLs mit Ortsnamen nur 1 Punkt (Kartenmitte) zurückgaben.
//
// Unterstützte Formate:
//   1. /dir/LAT1,LON1/LAT2,LON2/...  (Routen mit Koordinaten) — exklusiv wenn /dir/ vorhanden
//   2. !3dLAT!4dLON                   (Google's neues URL-Format mit verschachtelten Koordinaten)
//   3. ?q=LAT,LON oder ?query=LAT,LON (Suche/Marker)
//   4. @LAT,LON,ZOOMz                 (Kartenmittelpunkt)
//   5. /place/LAT,LON                 (Place-Koordinaten)

export function parseGoogleMapsUrl(url) {
  const waypoints = [];
  const hasDir = url.includes("/dir/");

  try {
    // Format 1: /dir/lat,lon/lat,lon/... — exklusiv wenn /dir/ vorhanden
    if (hasDir) {
      const dirMatch = url.match(/\/dir\/([^?@]+)/);
      if (dirMatch) {
        const segments = dirMatch[1].split("/");
        for (const seg of segments) {
          const decoded = decodeURIComponent(seg).trim();
          const match = decoded.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
          if (match) {
            const lat = parseFloat(match[1]);
            const lon = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lon)) {
              waypoints.push({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, order: waypoints.length });
            }
          }
        }
      }
      // WICHTIG: Wenn /dir/ vorhanden ist, NICHT auf andere Formate zurückfallen.
      // URLs mit Ortsnamen (keine Koordinaten) geben [] zurück → Frontend fällt auf Backend zurück.
      return waypoints;
    }

    // Format 2: !3dLAT!4dLON (Google's neues URL-Format — nur wenn kein /dir/)
    const d3 = url.match(/!3d(-?\d+\.?\d*)/g);
    const d4 = url.match(/!4d(-?\d+\.?\d*)/g);
    if (d3 && d4) {
      for (let i = 0; i < Math.min(d3.length, d4.length); i++) {
        const lat = parseFloat(d3[i].replace("!3d", ""));
        const lon = parseFloat(d4[i].replace("!4d", ""));
        if (!isNaN(lat) && !isNaN(lon)) {
          waypoints.push({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, order: waypoints.length });
        }
      }
    }

    if (waypoints.length > 0) return waypoints;

    // Format 3: ?q=LAT,LON oder ?query=LAT,LON
    const qMatch = url.match(/[?&](?:q|query)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lon = parseFloat(qMatch[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        waypoints.push({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, order: 0 });
      }
    }

    if (waypoints.length > 0) return waypoints;

    // Format 4: @LAT,LON,ZOOMz — Kartenmittelpunkt
    const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lon = parseFloat(atMatch[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        waypoints.push({ lat, lon, name: `Kartenmitte ${lat.toFixed(4)}, ${lon.toFixed(4)}`, order: 0 });
      }
    }

    if (waypoints.length > 0) return waypoints;

    // Format 5: /place/LAT,LON
    const placeMatch = url.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (placeMatch) {
      const lat = parseFloat(placeMatch[1]);
      const lon = parseFloat(placeMatch[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        waypoints.push({ lat, lon, name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, order: 0 });
      }
    }

  } catch (err) {
    return [];
  }

  return waypoints;
}

// Hilfsfunktion: Prüft ob URL /dir/ mit Ortsnamen (nicht Koordinaten) enthält
export function hasPlaceNamesButNoCoords(url) {
  const dirMatch = url.match(/\/dir\/([^?@]+)/);
  if (dirMatch) {
    const segments = dirMatch[1].split("/");
    return segments.some(seg => {
      const decoded = decodeURIComponent(seg).trim();
      return decoded.length > 0 && !decoded.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    });
  }
  return false;
}