import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch WWBOTA master reference list CSV
    const resp = await fetch('https://api.wwbota.org/bunkers/?format=CSV');
    if (!resp.ok) {
      return Response.json({ error: 'Failed to fetch WWBOTA data' }, { status: 502 });
    }
    const csv = await resp.text();
    const lines = csv.trim().split('\n');

    // Proper CSV parser — handles quoted fields with commas (e.g., "Chisholm, AB, Red Deer Filter Centre")
    function parseCsvLine(line: string): string[] {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (char === ',' && !inQuotes) {
          fields.push(current); current = '';
        } else { current += char; }
      }
      fields.push(current);
      return fields;
    }

    // Maidenhead locator → lat/lng fallback
    function maidenheadToLatLng(locator: string): { lat: number; lng: number } | null {
      if (!locator || locator.length < 4) return null;
      const loc = locator.toUpperCase().trim();
      const c1 = loc.charCodeAt(0) - 65;
      const c2 = loc.charCodeAt(1) - 65;
      if (c1 < 0 || c1 > 17 || c2 < 0 || c2 > 17) return null;
      let lng = c1 * 20 - 180;
      let lat = c2 * 10 - 90;
      const s1 = parseInt(loc[2]);
      const s2 = parseInt(loc[3]);
      if (isNaN(s1) || isNaN(s2)) return null;
      lng += s1 * 2;
      lat += s2;
      if (loc.length >= 6) {
        const ss1 = loc.charCodeAt(4) - 65;
        const ss2 = loc.charCodeAt(5) - 65;
        if (ss1 < 0 || ss1 > 23 || ss2 < 0 || ss2 > 23) return null;
        lng += ss1 * (5 / 60);
        lat += ss2 * (2.5 / 60);
        lng += 2.5 / 60;
        lat += 1.25 / 60;
      } else {
        lng += 1;
        lat += 0.5;
      }
      return { lat, lng };
    }

    const bunkers = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCsvLine(line);
      if (cols.length < 8) continue;

      const scheme = cols[0];
      const dxcc = cols[1];
      const reference = cols[2];
      const name = cols[3];
      const type = cols[4];
      const lat = parseFloat(cols[5]);
      const lng = parseFloat(cols[6]);
      const locator = cols[7];

      // Worldwide: include ALL schemes (HBBOTA, DLBOTA, F-BOTA, CABOTA, USBOTA, etc.)
      if (!isNaN(lat) && !isNaN(lng)) {
        bunkers.push({
          code: reference,
          name: name,
          type: type,
          lat: lat,
          lng: lng,
          locator: locator,
          scheme: scheme,
          dxcc: dxcc,
          link: `https://wwbota.net/map/`
        });
      } else if (locator) {
        const coords = maidenheadToLatLng(locator);
        if (coords) {
          bunkers.push({
            code: reference,
            name: name,
            type: type,
            lat: coords.lat,
            lng: coords.lng,
            locator: locator,
            scheme: scheme,
            dxcc: dxcc,
            link: `https://wwbota.net/map/`
          });
        }
      }
    }

    return Response.json({ bunkers, count: bunkers.length, source: 'WWBOTA API' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});