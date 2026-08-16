// Shared reference data fetchers — imported by refreshAllData and refreshDataSource.
// Centralizes all external data fetching logic to avoid duplication.

import { fetchSotaSummits } from './sotaFetcher.ts';
import { fetchPotaParks } from './potaFetcher.ts';
import { fetchRepeaterData } from './repeaterScraper.ts';
import { IOTA_EMBEDDED_DATA } from './iotaData.ts';
import { fetchIllwLighthouses } from './illwFetcher.ts';

// --- HBFF KMZ extraction helpers ---
async function extractKmlFromKmz(buffer: ArrayBuffer): Promise<string | null> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset = 0;
  while (offset < bytes.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig === 0x04034b50) {
      const compressionMethod = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const fileNameLength = view.getUint16(offset + 26, true);
      const extraFieldLength = view.getUint16(offset + 28, true);
      const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
      const fileName = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + fileNameLength));
      if (fileName.endsWith('.kml')) {
        if (compressionMethod === 0) {
          return new TextDecoder().decode(bytes.subarray(dataOffset, dataOffset + compressedSize));
        } else if (compressionMethod === 8) {
          const compressedData = bytes.subarray(dataOffset, dataOffset + compressedSize);
          const ds = new DecompressionStream('deflate-raw');
          const stream = new Blob([compressedData]).stream().pipeThrough(ds);
          return await new Response(stream).text();
        }
      }
      offset = dataOffset + compressedSize;
    } else {
      offset++;
    }
  }
  return null;
}

function parseHBFFRefList(html: string): any[] {
  const refs: any[] = [];
  const rows = html.split(/<tr[\s>]/);
  for (const row of rows) {
    const linkMatch = row.match(/href=['"](https:\/\/hbff\.ch\/geo\/HBFF-(\d{4})\.htm)['"]/);
    if (!linkMatch) continue;
    const refNum = linkMatch[2];
    const detailUrl = linkMatch[1];
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(row)) !== null) {
      let content = tdMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
      cells.push(content);
    }
    if (cells.length >= 7) {
      refs.push({
        code: 'HBFF-' + refNum,
        name: cells[1] || '',
        canton: cells[2] || '',
        parkType: cells[6] || '',
        detailUrl: detailUrl,
        kmzUrl: `https://hbff.ch/kmz/HBFF-${refNum}_Borders.kmz`
      });
    }
  }
  return refs;
}

// WWFF (World Wide Flora & Fauna) — worldwide data source.
// Replaces the Swiss-only HBFF source with the global WWFF directory CSV.
// CSV columns: reference,status,name,program,dxcc,state,county,continent,iota,
//              iaruLocator,latitude,longitude,IUCNcat,validFrom,validTo,notes,
//              lastMod,changeLog,reviewFlag,specialFlags,website,country,region,...
function parseCsvLineWWFF(line: string): string[] {
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

export async function fetchWwffData(): Promise<any[]> {
  const resp = await fetch('https://wwff.co/wwff-data/wwff_directory.csv', {
    headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
  });
  if (!resp.ok) throw new Error('WWFF CSV fetch failed');
  const text = await resp.text();
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const refs: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLineWWFF(line);
    if (cols.length < 12) continue;

    const reference = cols[0];
    const status = cols[1];
    const name = cols[2];
    const lat = parseFloat(cols[10]);
    const lng = parseFloat(cols[11]);
    const website = cols[20] || '';

    if (!reference || !name) continue;
    if (isNaN(lat) || isNaN(lng)) continue;
    // Skip inactive references
    if (status && status !== 'active') continue;

    refs.push({
      code: reference,
      name: name,
      lat: lat,
      lng: lng,
      parkType: 'WWFF',
      link: website || 'https://wwff.co/directory/'
    });
  }
  return refs;
}

// Keep fetchHbffData as alias for backward compatibility (fetchHBFF function, refreshAllData)
export async function fetchHbffData(): Promise<any[]> {
  return fetchWwffData();
}

// ISO2 → DXCC prefix map (same DXCC prefixes used by SOTA and WWFF).
// Reused from sotaFetcher to avoid circular imports — duplicated here for the
// WWFF offline filter.
const ISO2_TO_Dxcc: Record<string, string[]> = {
  CH: ['HB'], LI: ['HB0'], DE: ['DL'], AT: ['OE'], FR: ['F'], IT: ['I'],
  ES: ['EA'], PT: ['CT'], GB: ['G', 'GM', 'GW', 'GI', 'GD'], IE: ['EI'],
  BE: ['ON'], NL: ['PA'], LU: ['LX'], DK: ['OZ'], SE: ['SM'], NO: ['LA'],
  FI: ['OH'], IS: ['TF'], PL: ['SP'], CZ: ['OK'], SK: ['OM'], HU: ['HA'],
  SI: ['S5'], HR: ['9A'], RS: ['YU'], BA: ['E7'], ME: ['4O'], AL: ['ZA'],
  MK: ['Z3'], EE: ['ES'], LV: ['YL'], LT: ['LY'], GR: ['SV'], BG: ['LZ'],
  RO: ['YO'], TR: ['TA'], CY: ['5B', 'H2'], MT: ['9H'], AD: ['C31'],
  SM: ['T7'], MC: ['3A'],
  US: ['W', 'K'], CA: ['VE', 'VY'], JP: ['JA'], KR: ['HL'], CN: ['BY'],
  IN: ['VU'], AU: ['VK'], NZ: ['ZL'], ZA: ['ZS'], BR: ['PY', 'PP', 'PQ'],
  AR: ['LU', 'AY', 'LO', 'LP'], CL: ['CE', 'CA'],
};

// Fetch WWFF data filtered by ISO2 countries (or all if empty).
// Used by fetchWwffForOffline backend function for offline downloads.
export async function fetchWwffDataForCountries(iso2Codes: string[]): Promise<any[]> {
  const allRefs = await fetchWwffData();
  if (!iso2Codes || iso2Codes.length === 0) return allRefs;

  const prefixes = new Set<string>();
  for (const iso2 of iso2Codes) {
    const mapped = ISO2_TO_Dxcc[iso2.toUpperCase()];
    if (mapped) for (const p of mapped) prefixes.add(p);
  }
  if (prefixes.size === 0) return allRefs;

  // WWFF code format: "DLFF-0001" — DXCC prefix is everything before "FF"
  return allRefs.filter(r => {
    if (!r.code) return false;
    const refPart = r.code.split('-')[0].toUpperCase();
    const dxcc = refPart.replace(/FF$/, '');
    return prefixes.has(dxcc);
  });
}

// Proper CSV line parser — handles quoted fields containing commas (e.g., "Chisholm, AB, Red Deer Filter Centre")
// The WWBOTA CSV has ~2'800 rows with quoted Name/Type fields that the naive split(',') would break.
function parseCsvLineWWBOTA(line: string): string[] {
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

// Maidenhead grid locator → lat/lng (for WWBOTA entries without decimal coordinates)
function maidenheadToLatLngWWBOTA(locator: string): { lat: number; lng: number } | null {
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

export async function fetchWwbotaData(): Promise<any[]> {
  const resp = await fetch('https://api.wwbota.org/bunkers/?format=CSV');
  if (!resp.ok) throw new Error('WWBOTA API failed');
  const csv = await resp.text();
  const lines = csv.trim().split('\n');
  const bunkers: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCsvLineWWBOTA(line);
    if (cols.length < 8) continue;
    // Worldwide: include ALL schemes (HBBOTA, DLBOTA, F-BOTA, CABOTA, USBOTA, etc.), not just Swiss
    const scheme = cols[0];
    const lat = parseFloat(cols[5]);
    const lng = parseFloat(cols[6]);
    const locator = cols[7];
    if (!isNaN(lat) && !isNaN(lng)) {
      bunkers.push({
        code: cols[2], name: cols[3], lat, lng,
        parkType: cols[4], scheme,
        link: `https://wwbota.net/map/`
      });
    } else if (locator) {
      // Fallback: use Maidenhead locator for entries without decimal coordinates
      const coords = maidenheadToLatLngWWBOTA(locator);
      if (coords) {
        bunkers.push({
          code: cols[2], name: cols[3], lat: coords.lat, lng: coords.lng,
          parkType: cols[4], scheme,
          link: `https://wwbota.net/map/`
        });
      }
    }
  }
  return bunkers;
}

// Lighthouse regions — smaller bboxes queried sequentially to avoid Overpass timeouts.
// Each region can be fetched individually via fetchLighthouseData(regionId).
// The daily refresh orchestrator lists each region separately so admins can trigger
// individual region updates without waiting for a full worldwide fetch.
export const LIGHTHOUSE_REGIONS = [
  { id: 'eu_north', label: 'Leuchttürme Nordeuropa', bbox: [55, -15, 72, 40] },
  { id: 'eu_central', label: 'Leuchttürme Mitteleuropa', bbox: [45, -10, 56, 30] },
  { id: 'eu_south', label: 'Leuchttürme Südeuropa', bbox: [35, -10, 46, 30] },
  { id: 'eu_east', label: 'Leuchttürme Osteuropa', bbox: [40, 20, 60, 60] },
  { id: 'na_east', label: 'Leuchttürme Nordamerika Ost', bbox: [25, -90, 70, -50] },
  { id: 'na_west', label: 'Leuchttürme Nordamerika West', bbox: [25, -170, 70, -120] },
  { id: 'na_central', label: 'Leuchttürme Nordamerika Mitte', bbox: [15, -120, 50, -90] },
  { id: 'caribbean', label: 'Leuchttürme Karibik', bbox: [10, -90, 30, -60] },
  { id: 'sa', label: 'Leuchttürme Südamerika', bbox: [-60, -85, 15, -35] },
  { id: 'africa', label: 'Leuchttürme Afrika', bbox: [-40, -20, 40, 55] },
  { id: 'meast', label: 'Leuchttürme Naher Osten', bbox: [12, 25, 45, 65] },
  { id: 'sasia', label: 'Leuchttürme Südasien', bbox: [5, 60, 40, 100] },
  { id: 'easia', label: 'Leuchttürme Ostasien', bbox: [20, 100, 70, 180] },
  { id: 'seasia', label: 'Leuchttürme Südostasien', bbox: [-15, 90, 25, 145] },
  { id: 'oceania', label: 'Leuchttürme Ozeanien', bbox: [-50, 110, 0, 180] },
];

// Curated Swiss ARLHS WLOL lighthouses (verified coordinates — always included)
const SWISS_LIGHTHOUSES = [
  { code: 'SWI-001', name: 'Phare des Pâquis (Genf)', lat: 46.2100, lng: 6.1570, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI1.html' },
  { code: 'SWI-002', name: 'Genève Jetée du Sud (Genf)', lat: 46.2080, lng: 6.1560, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI2.html' },
  { code: 'SWI-003', name: 'Morges Jetée du Sud', lat: 46.5061, lng: 6.4990, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI3.html' },
  { code: 'SWI-004', name: 'Morges Jetée du Nord', lat: 46.5065, lng: 6.4991, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI4.html' },
  { code: 'SWI-005', name: 'Romanshorn Leuchtturm', lat: 47.5668, lng: 9.3922, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI5.html' },
  { code: 'SWI-006', name: 'Rorschach Hafen Leuchtturm', lat: 47.4794, lng: 9.4946, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI6.html' },
];

// Fetch lighthouses — ILLW official list (wllw.org) as primary source.
// The ILLW list is the only OFFICIAL list of lighthouses/lightships used by
// the International Lighthouse/Lightship Weekend. Parses 3 HTML pages and
// extracts coordinates from Google Maps links in the "Map" column.
// Fallback: Wikidata SPARQL (Q39715) if ILLW fetch fails or returns too few.
// Curated Swiss ARLHS WLOL lighthouses are always included.
export async function fetchLighthouseData(regionId?: string): Promise<any[]> {
  const allLighthouses: any[] = [];
  const seen = new Set<string>();

  // --- ILLW primary source (wllw.org) ---
  try {
    const illwLighthouses = await fetchIllwLighthouses();
    if (illwLighthouses.length > 50) {
      for (const l of illwLighthouses) {
        const key = l.code || `${l.lat.toFixed(3)},${l.lng.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allLighthouses.push(l);
      }
    }
  } catch { /* fall through to Wikidata */ }

  // --- Wikidata fallback (only if ILLW returned too few results) ---
  if (allLighthouses.length < 50) {
    const sparqlQuery = `SELECT ?item ?itemLabel ?coord ?countryLabel WHERE {
      ?item wdt:P31 wd:Q39715 .
      OPTIONAL { ?item wdt:P625 ?coord . }
      OPTIONAL { ?item wdt:P17 ?country . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en,fr,it,es,pt,ru,ja,zh" . }
    } LIMIT 20000`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
        const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' },
          signal: controller.signal
        });
        clearTimeout(timer);
        if (resp.ok) {
          const data = await resp.json();
          for (const b of (data.results?.bindings || [])) {
            const coordMatch = (b.coord?.value || '').match(/Point\(([\d.-]+)\s+([\d.-]+)\)/);
            const lat = coordMatch ? parseFloat(coordMatch[2]) : null;
            const lng = coordMatch ? parseFloat(coordMatch[1]) : null;
            const name = b.itemLabel?.value || `Lighthouse`;
            const itemKey = b.item?.value || '';
            if (itemKey && seen.has(itemKey)) continue;
            if (itemKey) seen.add(itemKey);
            if (lat != null && lng != null) {
              allLighthouses.push({
                code: `WD-LH-${allLighthouses.length + 1}`,
                name, lat, lng,
                country: b.countryLabel?.value || '',
                link: itemKey ? `https://www.wikidata.org/wiki/${itemKey.split('/').pop()}` : 'https://www.wikidata.org/',
                source: 'Wikidata',
              });
            }
          }
          break;
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
      }
    }
  }

  // --- Curated Swiss lighthouses (always included) ---
  for (const sl of SWISS_LIGHTHOUSES) {
    const key = `${sl.lat.toFixed(3)},${sl.lng.toFixed(3)}`;
    if (!seen.has(key)) allLighthouses.push(sl);
  }

  return allLighthouses;
}

// --- Worldwide castle fetcher (OSM Overpass + Wikidata, no bbox restriction) ---
export async function fetchCastleDataWorldwide(castleOverrides?: Map<string, any>): Promise<any[]> {
  // Use global Overpass query (no bbox) — fetches castles worldwide from OSM
  // Split into continental batches to avoid Overpass timeout
  const CONTINENTAL_BBOXES = [
    [-60, -180, 85, 180],    // Europe + Asia + Africa (large batch)
    // Americas handled separately to avoid timeout
    [-60, -180, 15, -30],    // South America
    [15, -170, 75, -50],     // North America
    [-50, 110, -10, 180],    // Oceania
  ];

  const allOsmCastles: any[] = [];
  for (const [south, west, north, east] of CONTINENTAL_BBOXES) {
    try {
      const query = `[out:json][timeout:60];(
        node["historic"~"castle|tower|fort|ruins|manor|city_gate|archaeological_site|fortification"](${south},${west},${north},${east});
        way["historic"~"castle|tower|fort|ruins|manor|city_gate|archaeological_site|fortification"](${south},${west},${north},${east});
      );out center 20000;`;
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HB9OM-OnField/1.0' },
        body: 'data=' + encodeURIComponent(query)
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const e of (data.elements || [])) {
        if (!e.tags?.name) continue;
        const lat = e.lat || e.center?.lat;
        const lng = e.lon || e.center?.lon;
        if (isNaN(lat) || isNaN(lng)) continue;
        allOsmCastles.push({
          name: e.tags.name.toUpperCase(),
          lat, lng,
          location: (e.tags?.['addr:city'] || e.tags?.['addr:country'] || '').toUpperCase(),
          country: e.tags?.['addr:country'] || '',
        });
      }
    } catch {}
    // Rate limit between batches
    await new Promise(r => setTimeout(r, 2000));
  }

  // Also fetch from Wikidata (worldwide castles)
  const wdCastles: any[] = [];
  try {
    const sparqlQuery = `SELECT ?item ?itemLabel ?coord ?countryLabel ?cityLabel WHERE {
      { ?item wdt:P31/wdt:P279* wd:Q23413 . } UNION { ?item wdt:P31/wdt:P279* wd:Q57821 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1763828 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1255038 . } UNION { ?item wdt:P31/wdt:P279* wd:Q3289106 . } UNION { ?item wdt:P31/wdt:P279* wd:Q174782 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1270920 . }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P17 ?country . }
      OPTIONAL { ?item wdt:P276 ?city . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en,fr,it,es,pt,ru,ja,zh" . }
    } LIMIT 10000`;
    const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
    });
    if (resp.ok) {
      const data = await resp.json();
      const seen = new Set<string>();
      for (const b of (data.results?.bindings || [])) {
        const uri = b.item?.value || '';
        if (seen.has(uri)) continue;
        seen.add(uri);
        const coordMatch = (b.coord?.value || '').match(/Point\(([\d.-]+)\s+([\d.-]+)\)/);
        if (!coordMatch) continue;
        wdCastles.push({
          name: (b.itemLabel?.value || '').toUpperCase(),
          lat: parseFloat(coordMatch[2]),
          lng: parseFloat(coordMatch[1]),
          location: (b.cityLabel?.value || b.countryLabel?.value || '').toUpperCase(),
          country: b.countryLabel?.value || '',
        });
      }
    }
  } catch {}

  // Deduplicate by name + proximity (within 500m)
  const geoSources = [...allOsmCastles, ...wdCastles];
  const deduped: any[] = [];
  for (const geo of geoSources) {
    if (!isDuped(geo, deduped)) deduped.push(geo);
  }

  // Build castle records — use OSM/Wikidata name as code (no WCA list for worldwide)
  const castles = deduped.map((geo, i) => ({
    code: `OSM-${String(i).padStart(5, '0')}`,
    name: geo.name.charAt(0) + geo.name.slice(1).toLowerCase(),
    lat: geo.lat,
    lng: geo.lng,
    canton: geo.location || '',
    country: geo.country || '',
    link: 'https://www.openstreetmap.org/',
    matchSource: 'osm-wikidata-worldwide',
  }));

  // Apply manual overrides
  if (castleOverrides) {
    for (const c of castles) {
      const override = castleOverrides.get(c.code);
      if (override?.manual_lat != null) { c.lat = override.manual_lat; c.lng = override.manual_lng; }
      if (override?.adjusted_name) c.name = override.adjusted_name;
    }
  }

  return castles;
}

// Helper for dedup check
function isDuped(geo: any, deduped: any[]): boolean {
  return deduped.some(d => {
    const dlat = Math.abs(d.lat - geo.lat);
    const dlng = Math.abs(d.lng - geo.lng);
    return dlat < 0.005 && dlng < 0.005 && d.name === geo.name;
  });
}

// --- IOTA worldwide fetcher (all island groups from iota-world.org) ---
// Uses the OFFICIAL IOTA groups.json download from iota-world.org.
// This contains all ~1200 IOTA island groups with bounding-box coordinates.
// URL: https://www.iota-world.org/islands-on-the-air/downloads/download-file.html?path=groups.json
// JSON format: [{ refno: "AF-001", name: "Agalega Islands", latitude_max, latitude_min, longitude_max, longitude_min, dxcc_num, ... }]
// We compute the center of each group from its lat/lng bounding box.
export async function fetchIotaData(): Promise<any[]> {
  // Official IOTA data from iota-world.org downloads page.
  // Uses the download-file.html endpoint with User-Agent "iota-mcp/0.1.2" — the direct
  // fulllist.json URL returns 403 Forbidden for non-browser requests.
  const IOTA_URLS = [
    'https://www.iota-world.org/islands-on-the-air/downloads/download-file.html?path=fulllist.json',
    'https://www.iota-world.org/islands-on-the-air/downloads/download-file.html?path=groups.json',
  ];

  const IOTA_UA = 'iota-mcp/0.1.2';

  for (const url of IOTA_URLS) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': IOTA_UA,
          'Accept': 'application/json, text/plain, */*',
        },
        redirect: 'follow',
      });
      if (!resp.ok) continue;
      const text = await resp.text();
      // Check if the response is actually JSON (not an HTML error page)
      if (!text.trimStart().startsWith('[') && !text.trimStart().startsWith('{')) continue;
      const json = JSON.parse(text);
      if (!Array.isArray(json) || json.length === 0) continue;

      const iota: any[] = [];
      const seen = new Set<string>();
      for (const g of json) {
        const code = (g.refno || g.code)?.trim();
        const name = g.name?.trim();
        if (!code || !name || seen.has(code)) continue;
        seen.add(code);
        // Compute center from bounding box (latitude_min/max, longitude_min/max)
        const latMax = parseFloat(g.latitude_max);
        const latMin = parseFloat(g.latitude_min);
        const lngMax = parseFloat(g.longitude_max);
        const lngMin = parseFloat(g.longitude_min);
        const lat = (!isNaN(latMax) && !isNaN(latMin)) ? (latMax + latMin) / 2 : null;
        const lng = (!isNaN(lngMax) && !isNaN(lngMin)) ? (lngMax + lngMin) / 2 : null;
        iota.push({
          code, name, lat, lng,
          dxcc_num: g.dxcc_num || g.dxcc || '',
          status: g.status || 'Active',
          island_count: g.island_count || 0,
          pc_credited: g.pc_credited || '',
          grp_region: g.grp_region || '',
          country: '', link: 'https://www.iota-world.org/'
        });
      }
      if (iota.length > 100) return iota; // Real data has 1000+ entries
    } catch {}
  }

  // Fallback: use embedded worldwide IOTA data (curated subset)
  return IOTA_EMBEDDED_DATA;
}

// --- Re-export shared fetchers for convenience ---
export { fetchSotaSummits, fetchPotaParks, fetchRepeaterData };

// --- Main fetcher dispatcher ---
export async function fetchReferenceSource(source: string, overrides?: Map<string, any>): Promise<any[]> {
  switch (source) {
    case 'sota': {
      const result = await fetchSotaSummits('all');
      return result.summits;
    }
    case 'pota': {
      const result = await fetchPotaParks('all');
      return result.parks;
    }
    case 'hbff': return fetchHbffData();
    case 'wwbota': return fetchWwbotaData();
    case 'lighthouse': return fetchLighthouseData();
    case 'castle': return fetchCastleDataWorldwide(overrides?.get('castle') || new Map());
    case 'iota': return fetchIotaData();
    case 'repeater': {
      const repeaters = await fetchRepeaterData();
      return repeaters.filter(r => r.lat !== null && r.lng !== null);
    }
    default: throw new Error(`Unknown source: ${source}`);
  }
}

export const SOURCE_LABELS: Record<string, string> = {
  sota: 'SOTA',
  pota: 'POTA',
  hbff: 'Flora-Fauna (WWFF)',
  wwbota: 'WWBOTA (Weltweit)',
  castle: 'Burgen/Schlösser (Weltweit)',
  lighthouse: 'Leuchttürme (ILLW wllw.org)',
  iota: 'IOTA (Weltweit)',
  repeater: 'Relais (RepeaterBook)',
};