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
    const headers = lines[0].split(',');

    const bunkers = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < 8) continue;

      const scheme = cols[0];
      const dxcc = cols[1];
      const reference = cols[2];
      const name = cols[3];
      const type = cols[4];
      const lat = parseFloat(cols[5]);
      const lng = parseFloat(cols[6]);
      const locator = cols[7];

      // Worldwide: include ALL schemes (HBBOTA, DLBOTA, F-BOTA, etc.)
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
      }
    }

    return Response.json({ bunkers, count: bunkers.length, source: 'WWBOTA API' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});