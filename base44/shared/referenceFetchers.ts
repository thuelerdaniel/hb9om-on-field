// Shared reference data fetchers — imported by refreshAllData and refreshDataSource.
// Centralizes all external data fetching logic to avoid duplication.

import { fetchSotaSummits } from './sotaFetcher.ts';
import { fetchPotaParks } from './potaFetcher.ts';
import { fetchRepeaterData } from './repeaterScraper.ts';

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

export async function fetchWwbotaData(): Promise<any[]> {
  const resp = await fetch('https://api.wwbota.org/bunkers/?format=CSV');
  if (!resp.ok) throw new Error('WWBOTA API failed');
  const csv = await resp.text();
  const lines = csv.trim().split('\n');
  const bunkers: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 8) continue;
    // Worldwide: include ALL schemes (HBBOTA, DLBOTA, F-BOTA, etc.), not just Swiss
    const scheme = cols[0];
    const lat = parseFloat(cols[5]);
    const lng = parseFloat(cols[6]);
    if (!isNaN(lat) && !isNaN(lng)) {
      bunkers.push({
        code: cols[2], name: cols[3], lat, lng,
        parkType: cols[4], scheme,
        link: `https://wwbota.net/map/`
      });
    }
  }
  return bunkers;
}

export async function fetchLighthouseData(): Promise<any[]> {
  const resp = await fetch('https://wllw.org/ILLW-flat.txt', { headers: { 'User-Agent': 'HB9OM-OnField/1.0' } });
  if (!resp.ok) throw new Error('ILLW fetch failed');
  const text = await resp.text();
  const lighthouses: any[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const code = trimmed.substring(0, eqIdx).trim();
    const name = trimmed.substring(eqIdx + 1).trim();
    // Parse coordinates from the name if available (format: "Name|lat,lng" or just store without coords)
    lighthouses.push({ code, name, lat: null, lng: null, link: 'https://wllw.org/index.php/en/' });
  }
  return lighthouses;
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
export async function fetchIotaData(): Promise<any[]> {
  // IOTA program provides a CSV with all ~1200 island groups
  // Try the official data source first
  try {
    const resp = await fetch('https://www.iota-world.org/iota-data/iota_list.csv', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
    });
    if (resp.ok) {
      const csv = await resp.text();
      const lines = csv.trim().split('\n');
      const iota: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 5) continue;
        const code = cols[0]?.trim();
        const name = cols[1]?.trim();
        const lat = parseFloat(cols[2]);
        const lng = parseFloat(cols[3]);
        const country = cols[4]?.trim() || '';
        if (!code || !name) continue;
        iota.push({
          code,
          name,
          lat: isNaN(lat) ? null : lat,
          lng: isNaN(lng) ? null : lng,
          country,
          link: 'https://www.iota-world.org/'
        });
      }
      if (iota.length > 0) return iota;
    }
  } catch {}

  // Fallback: try alternative URL formats
  const altUrls = [
    'https://raw.githubusercontent.com/AmateurRadio/IOTA-Data/master/iota_list.csv',
    'https://www.iota-world.org/export/iota_list.csv',
  ];
  for (const url of altUrls) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
      });
      if (!resp.ok) continue;
      const csv = await resp.text();
      const lines = csv.trim().split('\n');
      const iota: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 5) continue;
        const code = cols[0]?.trim();
        const name = cols[1]?.trim();
        const lat = parseFloat(cols[2]);
        const lng = parseFloat(cols[3]);
        const country = cols[4]?.trim() || '';
        if (!code || !name) continue;
        iota.push({
          code, name,
          lat: isNaN(lat) ? null : lat,
          lng: isNaN(lng) ? null : lng,
          country,
          link: 'https://www.iota-world.org/'
        });
      }
      if (iota.length > 0) return iota;
    } catch {}
  }

  throw new Error('IOTA data source unavailable — all URLs failed');
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
  lighthouse: 'Leuchttürme',
  iota: 'IOTA (Weltweit)',
  repeater: 'Relais (RepeaterBook)',
};