// resolveGoogleMapsLink — Löst Google Maps Short-Links (maps.app.goo.gl) auf
// und extrahiert Koordinaten aus der finalen URL.
// Folgt Redirects serverseitig, da der Browser CORS-Redirects nicht lesen kann.

export default async function(req: Request): Promise<Response> {
  try {
    let url = '';
    try {
      const body = await req.json();
      url = body?.url || '';
    } catch {
      // GET fallback — try query param
      try {
        const u = new URL(req.url);
        url = u.searchParams.get('url') || '';
      } catch {}
    }

    if (!url) {
      return Response.json({ success: false, error: 'URL erforderlich' });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return Response.json({ success: false, error: 'Ungültige URL' });
    }

    // Fetch with redirect following
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

    // Format 1: /dir/LAT1,LON1/LAT2,LON2/...
    const dirMatches = finalUrl.match(/\/dir\/(-?\d+\.?\d*),(-?\d+\.?\d*)/g);
    if (dirMatches) {
      dirMatches.forEach((m: string) => {
        const coords = m.replace('/dir/', '').split(',');
        const lat = parseFloat(coords[0]);
        const lng = parseFloat(coords[1]);
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng, name: 'WP ' + (waypoints.length + 1) });
        }
      });
    }

    // Format 2: @LAT,LON (map center)
    if (waypoints.length === 0) {
      const atMatch = finalUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (atMatch) {
        const lat = parseFloat(atMatch[1]);
        const lng = parseFloat(atMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          waypoints.push({ lat, lng, name: 'Ziel' });
        }
      }
    }

    // Format 3: ?q=LAT,LON or ?destination=LAT,LON
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

    // Format 4: /place/LAT,LON
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