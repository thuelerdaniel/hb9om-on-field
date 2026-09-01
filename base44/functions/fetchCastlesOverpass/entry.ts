import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Fetch castles from OpenStreetMap Overpass API for countries with sparse WCA coverage.
// Stores Overpass castles in a SEPARATE ReferenceData entry (type='castle_overpass')
// to avoid loading the large WCA castle document (16k+ entries).
// The frontend merges 'castle' (WCA) and 'castle_overpass' (OSM) when loading.
// Generates WCA-compatible reference codes (TA-00001, SX-00001, etc.).

interface CountryConfig {
  prefix: string;
  name: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

const COUNTRIES: CountryConfig[] = [
  { prefix: 'TA', name: 'Türkei', south: 35.0, west: 25.0, north: 43.0, east: 45.0 },
  { prefix: 'SX', name: 'Griechenland', south: 34.0, west: 19.0, north: 42.0, east: 28.0 },
  { prefix: '4L', name: 'Georgien', south: 41.0, west: 40.0, north: 43.0, east: 47.0 },
  { prefix: 'EK', name: 'Armenien', south: 38.0, west: 43.0, north: 42.0, east: 47.0 },
  { prefix: 'LZ', name: 'Bulgarien', south: 41.0, west: 22.0, north: 44.0, east: 28.0 },
  { prefix: 'YO', name: 'Rumänien', south: 43.0, west: 20.0, north: 48.0, east: 30.0 },
  { prefix: 'YU', name: 'Serbien', south: 42.0, west: 18.0, north: 46.0, east: 23.0 },
  { prefix: 'ZA', name: 'Albanien', south: 39.0, west: 19.0, north: 43.0, east: 21.0 },
  { prefix: 'Z3', name: 'Nordmazedonien', south: 40.0, west: 20.0, north: 43.0, east: 23.0 },
  { prefix: 'E7', name: 'Bosnien', south: 42.0, west: 15.0, north: 45.0, east: 20.0 },
  { prefix: '4O', name: 'Montenegro', south: 41.0, west: 18.0, north: 43.0, east: 21.0 },
  { prefix: 'CN', name: 'Marokko', south: 27, west: -10, north: 36, east: 0 },
  { prefix: '3V', name: 'Tunesien', south: 30, west: 7, north: 38, east: 12 },
  { prefix: 'OD', name: 'Libanon', south: 33, west: 34, north: 35, east: 37 },
  { prefix: 'JY', name: 'Jordanien', south: 29, west: 34, north: 33, east: 40 },
];

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

async function fetchOverpassCountry(country: CountryConfig): Promise<any[]> {
  const query = `[out:json][timeout:90];
(
  node["historic"="castle"](${country.south},${country.west},${country.north},${country.east});
  node["historic"="fortress"](${country.south},${country.west},${country.north},${country.east});
  way["historic"="castle"](${country.south},${country.west},${country.north},${country.east});
  way["historic"="fortress"](${country.south},${country.west},${country.north},${country.east});
);
out center 2000;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`[fetchCastlesOverpass] Trying endpoint: ${endpoint}`);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!resp.ok) {
        console.log(`[fetchCastlesOverpass] ${endpoint} returned ${resp.status}`);
        continue;
      }
      const text = await resp.text();
      const data = JSON.parse(text);
      if (data && data.elements && data.elements.length > 0) {
        console.log(`[fetchCastlesOverpass] ${endpoint} returned ${data.elements.length} elements`);
        return data.elements;
      }
      if (data && data.elements && data.elements.length === 0) {
        console.log(`[fetchCastlesOverpass] ${endpoint} returned 0 elements`);
        return [];
      }
    } catch (e) {
      console.log(`[fetchCastlesOverpass] ${endpoint} error: ${e.message}`);
    }
  }
  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetPrefix = body.country_prefix || null;
    const countries = targetPrefix
      ? COUNTRIES.filter(c => c.prefix === targetPrefix)
      : COUNTRIES;

    // 1. Load existing Overpass castle data (separate from WCA 'castle' type)
    // Use type='castle_overpass' to avoid loading the large WCA document
    const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'castle_overpass' });
    let existingCastles: any[] = [];
    let primaryId: string | null = null;
    if (existing.length > 0) {
      existing.sort((a, b) => (b.total_count || 0) - (a.total_count || 0));
      primaryId = existing[0].id;
      existingCastles = existing[0].references || [];
    }

    // Build set of existing codes to avoid duplicates
    const existingCodes = new Set(existingCastles.map((c: any) => c.code));

    // 2. Fetch Overpass data for each country
    const newCastles: any[] = [];
    const stats: Record<string, number> = {};

    for (const country of countries) {
      console.log(`[fetchCastlesOverpass] Fetching ${country.name} (${country.prefix})...`);
      const elements = await fetchOverpassCountry(country);

      const named = elements.filter((el: any) => {
        const tags = el.tags || {};
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        return tags.name && lat != null && lng != null;
      });

      // Count existing castles for this prefix to continue numbering
      const existingPrefixCount = existingCastles.filter((c: any) =>
        c.code && c.code.startsWith(country.prefix + '-')
      ).length;
      let counter = existingPrefixCount;

      for (const el of named) {
        const tags = el.tags || {};
        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        counter++;
        const code = `${country.prefix}-${String(counter).padStart(5, '0')}`;

        if (existingCodes.has(code)) continue;

        let link = 'https://wcagroup.org/?page_id=207';
        if (tags.wikidata) {
          link = `https://www.wikidata.org/wiki/${tags.wikidata}`;
        } else if (tags.wikipedia) {
          const wiki = tags.wikipedia;
          if (wiki.includes(':')) {
            const [lang, title] = wiki.split(':');
            link = `https://${lang}.wikipedia.org/wiki/${title}`;
          } else {
            link = `https://de.wikipedia.org/wiki/${wiki}`;
          }
        }

        newCastles.push({
          code,
          name: tags.name,
          lat,
          lng,
          canton: country.name,
          link,
          countryPrefix: country.prefix,
          source: 'OSM',
        });
      }

      stats[country.prefix] = named.length;
      console.log(`[fetchCastlesOverpass] ${country.name}: ${named.length} castles found`);

      await new Promise(r => setTimeout(r, 500));
    }

    // 3. Merge existing Overpass castles + new ones
    const merged = [...existingCastles, ...newCastles];

    // 4. Save to ReferenceData type='castle_overpass'
    const now = new Date().toISOString();
    const source = 'Overpass API (Turkey, Greece, Balkans, MENA)';

    if (primaryId) {
      await base44.asServiceRole.entities.ReferenceData.update(primaryId, {
        references: merged,
        total_count: merged.length,
        source,
        last_updated: now
      });
    } else {
      const created = await base44.asServiceRole.entities.ReferenceData.create({
        type: 'castle_overpass',
        references: merged,
        total_count: merged.length,
        source,
        last_updated: now
      });
    }

    console.log(`[fetchCastlesOverpass] DONE: ${newCastles.length} new castles, ${merged.length} total Overpass castles`);

    return Response.json({
      saved: true,
      new_castles: newCastles.length,
      total_overpass: merged.length,
      by_country: stats,
      source
    });
  } catch (error) {
    console.error('[fetchCastlesOverpass] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});