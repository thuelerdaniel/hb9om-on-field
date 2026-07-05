import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch ILLW flat text file
    const resp = await fetch('https://wllw.org/ILLW-flat.txt', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0' }
    });
    if (!resp.ok) {
      return Response.json({ error: 'Failed to fetch ILLW data' }, { status: 502 });
    }
    const text = await resp.text();

    // Parse the flat file: lines like "CH0001=Name"
    const lighthouses = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const code = trimmed.substring(0, eqIdx).trim();
      const name = trimmed.substring(eqIdx + 1).trim();
      lighthouses.push({ code, name });
    }

    // Swiss lighthouses with known coordinates (CH0001-CH0006)
    const swissCoords = {
      'CH0001': { lat: 46.5103, lng: 6.4950, location: 'Morges, Lake Geneva' },
      'CH0002': { lat: 46.5097, lng: 6.4960, location: 'Morges, Lake Geneva' },
      'CH0003': { lat: 47.4740, lng: 9.4980, location: 'Rorschach, Lake Constance' },
      'CH0004': { lat: 47.5660, lng: 9.3780, location: 'Romanshorn, Lake Constance' },
      'CH0005': { lat: 46.2080, lng: 6.1540, location: 'Geneva, Lake Geneva' },
      'CH0006': { lat: 46.2100, lng: 6.1560, location: 'Geneva (Les Pâquis), Lake Geneva' },
    };

    // Return only Swiss lighthouses with coordinates
    const swissLights = lighthouses
      .filter(l => swissCoords[l.code])
      .map(l => ({
        code: l.code,
        name: l.name,
        lat: swissCoords[l.code].lat,
        lng: swissCoords[l.code].lng,
        location: swissCoords[l.code].location,
        link: 'https://wllw.org/index.php/en/'
      }));

    return Response.json({
      lighthouses: swissLights,
      worldwideCount: lighthouses.length,
      swissCount: swissLights.length,
      source: 'ILLW Official List'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});