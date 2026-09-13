// resolveGoogleMapsLink — Löst Google Maps Short-Links (maps.app.goo.gl) auf
// und extrahiert ALLE Waypoints aus der finalen URL.
// Folgt Redirects serverseitig, da der Browser CORS-Redirects nicht lesen kann.
//
// Unterstützte Formate:
//   /dir/LAT1,LON1/LAT2,LON2/Name/@.../data=...  → alle LAT,LON Paare im Pfad
//   !2dLON!2dLAT im data-Block                   → Ziel-Koordinaten
//   @LAT,LON                                     → Kartenmitte (Fallback)
//   ?q=LAT,LON                                   → Suchergebnis (Fallback)

// Parse coordinates directly from a Google Maps URL (no redirect needed).
// v0.951-hotfix: Avoids Google anti-bot "sorry" redirects by extracting coords from the URL itself.
function parseCoordsFromUrl(url: string): any[] {
  const waypoints: any[] = [];

  // Format 1: /dir/LAT,LON/LAT,LON/...
  const dirMatch = url.match(/\/dir\/([^?@]+)/);
  if (dirMatch) {
    const segments = dirMatch[1].split('/');
    for (const seg of segments) {
      const decoded = decodeURIComponent(seg).trim();
      const match = decoded.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng, name: 'WP ' + (waypoints.length + 1) });
        }
      }
    }
    if (waypoints.length > 0) return waypoints;
  }

  // Format 2: !3dLAT!4dLON (Google's nested coordinate format)
  const d3 = url.match(/!3d(-?\d+\.?\d*)/g);
  const d4 = url.match(/!4d(-?\d+\.?\d*)/g);
  if (d3 && d4) {
    for (let i = 0; i < Math.min(d3.length, d4.length); i++) {
      const lat = parseFloat(d3[i].replace('!3d', ''));
      const lng = parseFloat(d4[i].replace('!4d', ''));
      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({ lat, lng, name: 'WP ' + (waypoints.length + 1) });
      }
    }
  }
  if (waypoints.length > 0) return waypoints;

  // Format 3: !2dLON!2dLAT
  const dataCoords = url.match(/!2d(-?\d+\.?\d*)!2d(-?\d+\.?\d*)/g);
  if (dataCoords) {
    for (const dc of dataCoords) {
      const m = dc.match(/!2d(-?\d+\.?\d*)!2d(-?\d+\.?\d*)/);
      if (m) {
        const lat = parseFloat(m[2]);
        const lng = parseFloat(m[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng, name: 'Ziel' });
        }
      }
    }
  }
  if (waypoints.length > 0) return waypoints;

  // Format 4: @LAT,LON (map center)
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      waypoints.push({ lat, lng, name: 'Position' });
    }
  }
  if (waypoints.length > 0) return waypoints;

  // Format 5: ?q=LAT,LON or ?destination=LAT,LON
  const qMatch = url.match(/[?&](?:q|destination|query)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      waypoints.push({ lat, lng, name: 'Ziel' });
    }
  }
  if (waypoints.length > 0) return waypoints;

  // Format 6: /place/LAT,LON
  const placeMatch = url.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      waypoints.push({ lat, lng, name: 'Ziel' });
    }
  }

  return waypoints;
}

export default async function(req: Request): Promise<Response> {
  try {
    let url = '';
    try {
      const body = await req.json();
      url = body?.url || '';
    } catch {
      try {
        const u = new URL(req.url);
        url = u.searchParams.get('url') || '';
      } catch {}
    }

    if (!url) {
      return Response.json({ success: false, error: 'URL erforderlich' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json({ success: false, error: 'Ungültige URL' });
    }

    // v0.951-hotfix: Parse coordinates from the URL directly first (avoids Google anti-bot redirects).
    // Only follow redirects for short links (maps.app.goo.gl, goo.gl) that don't contain coordinates.
    const isShortLink = /maps\.app\.goo\.gl|goo\.gl/i.test(url);
    if (!isShortLink) {
      const directWaypoints = parseCoordsFromUrl(url);
      if (directWaypoints.length > 0) {
        return Response.json({ success: true, waypoints: directWaypoints, resolved_url: url });
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'HB9OM-OnField-App/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const finalUrl = response.url || url;
    const waypoints: any[] = [];

    // Format 1: /dir/LAT1,LON1/LAT2,LON2/Name/...
    // Extrahiere den gesamten Pfad nach /dir/ bis zum nächsten /@, /data=, ? oder Ende
    const dirPathMatch = finalUrl.match(/\/dir\/(.+?)(?:\/@|\/data=|\?|$)/);
    if (dirPathMatch) {
      const pathSegments = dirPathMatch[1].split('/');
      for (const seg of pathSegments) {
        // Exakt "LAT,LON" ohne weitere Zeichen (keine Ortsnamen)
        const coordMatch = seg.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
        if (coordMatch) {
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          if (!isNaN(lat) && !isNaN(lng)) {
            waypoints.push({ lat, lng, name: 'WP ' + (waypoints.length + 1) });
          }
        }
      }
    }

    // Format 2: !2dLON!2dLAT im data-Block (Ziel-Koordinaten)
    // Beispiel: !2m2!1d8.5935627!2d46.6339116
    if (waypoints.length === 0) {
      const dataCoords = finalUrl.match(/!2d(-?\d+\.?\d*)!2d(-?\d+\.?\d*)/g);
      if (dataCoords) {
        for (const dc of dataCoords) {
          const m = dc.match(/!2d(-?\d+\.?\d*)!2d(-?\d+\.?\d*)/);
          if (m) {
            const lat = parseFloat(m[2]);
            const lng = parseFloat(m[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              waypoints.push({ lat, lng, name: 'Ziel' });
            }
          }
        }
      }
    }

    // Format 3: @LAT,LON (Kartenmitte)
    if (waypoints.length === 0) {
      const atMatch = finalUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (atMatch) {
        const lat = parseFloat(atMatch[1]);
        const lng = parseFloat(atMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng, name: 'Position' });
        }
      }
    }

    // Format 4: ?q=LAT,LON oder ?destination=LAT,LON
    if (waypoints.length === 0) {
      const qMatch = finalUrl.match(/[?&](?:q|destination|query)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (qMatch) {
        const lat = parseFloat(qMatch[1]);
        const lng = parseFloat(qMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng, name: 'Ziel' });
        }
      }
    }

    // Format 5: /place/LAT,LON
    if (waypoints.length === 0) {
      const placeMatch = finalUrl.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (placeMatch) {
        const lat = parseFloat(placeMatch[1]);
        const lng = parseFloat(placeMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng, name: 'Ziel' });
        }
      }
    }

    // ZUSÄTZLICH: Prüfe data-Block auf Ziel-Koordinaten (!2m2!1dLON!2dLAT)
    // auch wenn bereits Waypoints aus /dir/ gefunden wurden — das Ziel kann dort stehen
    const dataDestMatch = finalUrl.match(/!2m2!1d(-?\d+\.?\d*)!2d(-?\d+\.?\d*)/);
    if (dataDestMatch) {
      const destLat = parseFloat(dataDestMatch[2]);
      const destLng = parseFloat(dataDestMatch[1]);
      if (!isNaN(destLat) && !isNaN(destLng)) {
        const exists = waypoints.some(
          (w) => Math.abs(w.lat - destLat) < 0.001 && Math.abs(w.lng - destLng) < 0.001
        );
        if (!exists) {
          waypoints.push({ lat: destLat, lng: destLng, name: 'Ziel' });
        }
      }
    }

    if (waypoints.length === 0) {
      return Response.json({
        success: false,
        error: 'Keine Koordinaten gefunden',
        resolved_url: finalUrl,
      });
    }

    return Response.json({
      success: true,
      waypoints,
      resolved_url: finalUrl,
    });
  } catch (error: any) {
    return Response.json(
      { success: false, error: error.message || String(error) },
      { status: 500 }
    );
  }
}