// Worldwide WCA castle fetcher — shared by fetchCastles and refreshAllData.
// Parses ALL country tables from the WCA ODS file (not just Swiss HB-HB0),
// geocodes Swiss entries with Swiss-specific methods (map.admin.ch, Swiss Nominatim),
// non-Swiss entries with worldwide Nominatim, and combines with OSM/Wikidata worldwide.

// fetchCastleDataWorldwide (OSM + Wikidata worldwide in continental batches) is not used here
// to avoid timeout. The WCA ODS list provides worldwide coverage; OSM/Wikidata matching uses
// a single Swiss OSM bbox query + worldwide Wikidata (LIMIT 5000) for direct name matches only.

// --- ODS ZIP parsing helpers ---
function readUInt16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}
function readUInt32LE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0);
}

// --- Parse ALL tables from WCA ODS (worldwide, not just Swiss HB-HB0) ---
async function parseWcaOdsWorldwide(): Promise<any[]> {
  const odsResp = await fetch('https://wcagroup.org/FORMS/WCALIST.ods', {
    headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
  });
  if (!odsResp.ok) throw new Error('Failed to download WCA list');

  const odsBuffer = new Uint8Array(await odsResp.arrayBuffer());

  // Find content.xml in the ZIP (ODS = ZIP archive)
  let offset = 0;
  let contentEntry: { compressedSize: number; localHeaderOffset: number } | null = null;
  while (offset < odsBuffer.length - 4) {
    if (odsBuffer[offset] === 0x50 && odsBuffer[offset + 1] === 0x4B &&
        odsBuffer[offset + 2] === 0x01 && odsBuffer[offset + 3] === 0x02) {
      const compressedSize = readUInt32LE(odsBuffer, offset + 20);
      const fileNameLength = readUInt16LE(odsBuffer, offset + 28);
      const extraFieldLength = readUInt16LE(odsBuffer, offset + 30);
      const fileCommentLength = readUInt16LE(odsBuffer, offset + 32);
      const localHeaderOffset = readUInt32LE(odsBuffer, offset + 42);
      const fileName = new TextDecoder().decode(odsBuffer.slice(offset + 46, offset + 46 + fileNameLength));
      if (fileName === 'content.xml') {
        contentEntry = { compressedSize, localHeaderOffset };
        break;
      }
      offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    } else {
      offset++;
    }
  }
  if (!contentEntry) throw new Error('content.xml not found in ODS file');

  const lho = contentEntry.localHeaderOffset;
  const localFileNameLength = readUInt16LE(odsBuffer, lho + 26);
  const localExtraFieldLength = readUInt16LE(odsBuffer, lho + 28);
  const dataStart = lho + 30 + localFileNameLength + localExtraFieldLength;
  const compressedData = odsBuffer.slice(dataStart, dataStart + contentEntry.compressedSize);
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([compressedData]).stream().pipeThrough(ds);
  const xml = await new Response(stream).text();

  // Parse ALL tables — WCA ODS has one table per country (HB-HB0, DL-DL0, F-F0, etc.)
  // Instead of looking for a specific table, parse ALL rows from ALL tables.
  // WCA reference codes match pattern: [A-Z]{1,3}-\d{5} (e.g. HB-00001, DL-00001, F-00001)
  const wcaEntries: any[] = [];
  const rowRegex = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1];
    if (rowContent.includes('number-rows-repeated')) continue;
    if (rowContent.includes('number-columns-repeated="256"') && !rowContent.includes('text:p')) continue;

    const cells: string[] = [];
    const cellRegex = /<table:table-cell[^>]*>([\s\S]*?)<\/table:table-cell>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellContent = cellMatch[1];
      const textMatches = cellContent.match(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g);
      if (textMatches) {
        cells.push(textMatches.map(t => t.replace(/<[^>]+>/g, '')).join(' ').trim());
      } else {
        cells.push('');
      }
    }

    // Accept any WCA reference code pattern: [A-Z]{1,3}-\d{5}
    if (cells.length >= 4 && cells[0] && cells[0].match(/^[A-Z]{1,3}-\d{5}$/)) {
      wcaEntries.push({
        wca: cells[0],
        name: (cells[3] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&"),
        location: (cells[4] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&"),
        locator: (cells[5] || '').toUpperCase().trim(),
        countryPrefix: cells[0].split('-')[0],
      });
    }
  }

  return wcaEntries;
}

// --- OSM Overpass: castles within a bbox ---
async function fetchOsmCastlesInBbox(south: number, west: number, north: number, east: number): Promise<any[]> {
  const query = `[out:json][timeout:15];(
    node["historic"~"castle|tower|fort|ruins|manor|city_gate|archaeological_site|fortification"](${south},${west},${north},${east});
    way["historic"~"castle|tower|fort|ruins|manor|city_gate|archaeological_site|fortification"](${south},${west},${north},${east});
  );out center 50000;`;
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HB9OM-OnField/1.0' },
    body: 'data=' + encodeURIComponent(query)
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  const castles: any[] = [];
  for (const e of (data.elements || [])) {
    if (!e.tags?.name) continue;
    const lat = e.lat || e.center?.lat;
    const lng = e.lon || e.center?.lon;
    if (isNaN(lat) || isNaN(lng)) continue;
    castles.push({
      name: e.tags.name.toUpperCase(),
      lat, lng,
      location: (e.tags?.['addr:city'] || '').toUpperCase(),
      country: e.tags?.['addr:country'] || '',
    });
  }
  return castles;
}

// --- Wikidata SPARQL: castles for a specific country (or worldwide) ---
async function fetchWikidataCastles(countryQId: string | null): Promise<any[]> {
  const countryFilter = countryQId ? `?item wdt:P17 wd:${countryQId} .` : '';
  const sparqlQuery = `SELECT ?item ?itemLabel ?coord ?cantonLabel ?cityLabel WHERE {
    { ?item wdt:P31/wdt:P279* wd:Q23413 . } UNION { ?item wdt:P31/wdt:P279* wd:Q57821 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1763828 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1255038 . } UNION { ?item wdt:P31/wdt:P279* wd:Q3289106 . } UNION { ?item wdt:P31/wdt:P279* wd:Q174782 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1270920 . }
    ${countryFilter}
    ?item wdt:P625 ?coord .
    OPTIONAL { ?item wdt:P131 ?canton . }
    OPTIONAL { ?item wdt:P276 ?city . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en,fr,it,es,pt,ru,ja,zh" . }
  } LIMIT 5000`;
  const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
  });
  if (!resp.ok) return [];
  const data = await resp.json();
  const seen = new Set<string>();
  const results: any[] = [];
  for (const b of (data.results?.bindings || [])) {
    const uri = b.item?.value || '';
    if (seen.has(uri)) continue;
    seen.add(uri);
    const coordMatch = (b.coord?.value || '').match(/Point\(([\d.-]+)\s+([\d.-]+)\)/);
    if (!coordMatch) continue;
    results.push({
      name: (b.itemLabel?.value || '').toUpperCase(),
      lat: parseFloat(coordMatch[2]),
      lng: parseFloat(coordMatch[1]),
      location: (b.cityLabel?.value || b.cantonLabel?.value || '').toUpperCase(),
    });
  }
  return results;
}

// --- Haversine distance in meters ---
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Maidenhead grid locator to lat/lng ---
function maidenheadToLatLng(locator: string): { lat: number; lng: number } | null {
  if (!locator || locator.length < 4) return null;
  const loc = locator.toUpperCase();
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

// --- Swiss-specific: map.admin.ch search ---
async function searchMapAdminCh(name: string, location: string): Promise<{ lat: number; lng: number } | null> {
  const searchText = location ? `${name} ${location}` : name;
  try {
    const resp = await fetch(`https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(searchText)}&type=locations&limit=5`, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0' }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const results = data.results || [];
    const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!nameLower || nameLower.length < 3) return null;
    for (const r of results) {
      const detail = (r.attrs?.detail || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]/g, '');
      if (detail.includes(nameLower)) {
        const lat = r.attrs?.lat;
        const lng = r.attrs?.lon;
        if (isNaN(lat) || isNaN(lng)) continue;
        if (lat < 45.5 || lat > 48.0 || lng < 5.8 || lng > 10.7) continue;
        return { lat, lng };
      }
    }
    return null;
  } catch { return null; }
}

async function batchSearchMapAdminCh(entries: any[]): Promise<any[]> {
  const CONCURRENCY = 8;
  const results = new Array(entries.length).fill(null);
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(e => searchMapAdminCh(e.name, e.location)));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }
  return results;
}

// --- Swiss-specific: Nominatim with countrycodes=ch ---
async function searchNominatimSwiss(name: string, location: string): Promise<{ lat: number; lng: number } | null> {
  const query = location ? `${name} ${location} Schweiz` : `${name} Schweiz`;
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=ch&format=json&limit=1`,
      { headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < 45.5 || lat > 48.0 || lng < 5.8 || lng > 10.7) return null;
    return { lat, lng };
  } catch { return null; }
}

// --- Worldwide Nominatim (no country restriction) ---
async function searchNominatimWorldwide(name: string, location: string): Promise<{ lat: number; lng: number } | null> {
  const query = location ? `${name} ${location}` : name;
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch { return null; }
}

// --- Swiss-specific: Wikipedia article coordinates ---
async function searchWikipediaSwiss(name: string, location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const searchQuery = (location ? `${name} ${location}` : name) + ' Burg Schloss Schweiz';
    const resp = await fetch(
      `https://de.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(searchQuery)}&gsrnamespace=0&gsrlimit=3&prop=coordinates&format=json&origin=*`,
      { headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const pages = data.query?.pages || {};
    const sorted = Object.values(pages).sort((a: any, b: any) => (a.index || 999) - (b.index || 999));
    for (const page of sorted as any[]) {
      if (page.coordinates?.length > 0) {
        const c = page.coordinates[0];
        if (isNaN(c.lat) || isNaN(c.lon)) continue;
        if (c.lat < 45.5 || c.lat > 48.0 || c.lon < 5.8 || c.lon > 10.7) continue;
        return { lat: c.lat, lng: c.lon };
      }
    }
    return null;
  } catch { return null; }
}

// --- Text normalization helpers ---
const SKIP_WORDS = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL', 'CASTELLO',
  'FESTUNG', 'RUINE', 'BURGRUINE', 'SCHLOSSE', 'RUIN', 'OF', 'DE', 'LA', 'LE', 'THE',
  'ALT', 'NEU', 'ALTES', 'NEUES', 'GROSSES', 'KLEINES', 'MIT', 'UND', 'ST', 'SANKT',
  'DER', 'DIE', 'DAS', 'EIN', 'EINE']);

const GENERIC_NAMES = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL', 'CASTELLO',
  'FESTUNG', 'RUINE', 'TURM', 'TURN', 'TOUR', 'TORRE', 'GATE', 'TOR', 'HAUS',
  'SCHLOSSLI', 'BURGLI', 'TURMLI']);

function normalizeText(text: string): string {
  return text.replace(/&APOS;/g, "'").replace(/&AMP;/g, "&")
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE')
    .replace(/ä/g, 'AE').replace(/ö/g, 'OE').replace(/ü/g, 'UE')
    .replace(/é/g, 'E').replace(/è/g, 'E').replace(/ê/g, 'E')
    .replace(/à/g, 'A').replace(/â/g, 'A').replace(/ç/g, 'C')
    .replace(/î/g, 'I').replace(/ï/g, 'I').replace(/ô/g, 'O')
    .replace(/[()\[\]/'",.\-]/g, ' ')
    .toUpperCase()
    .trim();
}

function normalizeName(name: string): string {
  return normalizeText(name).split(/\s+/).filter(w => w.length > 2 && !SKIP_WORDS.has(w)).join(' ').trim();
}

function normalizeForCompare(text: string): string {
  return normalizeText(text).replace(/\s+/g, '');
}

const COMPOUND_SUFFIXES = ['TURM', 'TOR', 'TURN', 'TOUR', 'TORRE', 'GATE', 'HAUS',
  'SCHLOSS', 'BURG', 'FESTUNG', 'RUINE', 'HOF', 'BERG', 'BACH', 'FELD', 'WALD',
  'STEIN', 'MAUER', 'PLATZ', 'BRUCKE', 'BRUECKE', 'GRABEN', 'TAL', 'SEE', 'BACH'];

function generateCompoundVariations(name: string): string[] {
  const norm = normalizeText(name);
  const variations = [norm];
  for (const suffix of COMPOUND_SUFFIXES) {
    if (norm.endsWith(suffix) && norm.length > suffix.length + 2) {
      const prefix = norm.slice(0, -suffix.length);
      variations.push(prefix + ' ' + suffix);
    }
  }
  return variations;
}

// --- Match WCA entries to geo sources (OSM + Wikidata) ---
function matchWcaToGeo(wcaEntries: any[], geoSources: any[]): any[] {
  // Build name index
  const nameIndex = new Map<string, any[]>();
  const addToIndex = (key: string, geo: any) => {
    if (!key) return;
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    if (!nameIndex.get(key)!.includes(geo)) nameIndex.get(key)!.push(geo);
  };
  for (const geo of geoSources) {
    const key = normalizeName(geo.name);
    addToIndex(key, geo);
    if (key && key.includes(' ')) addToIndex(key.replace(/\s+/g, ''), geo);
    for (const v of generateCompoundVariations(geo.name)) {
      if (v !== key) addToIndex(v, geo);
    }
  }
  for (const geo of geoSources) {
    geo._locNorm = geo.location ? normalizeText(geo.location) : '';
  }

  const castles: any[] = [];

  for (const wca of wcaEntries) {
    const wcaNameNorm = normalizeName(wca.name);
    const wcaLoc = wca.location;
    const isGeneric = GENERIC_NAMES.has(wca.name.trim()) || wcaNameNorm.length === 0;
    const wcaLocNorm = normalizeText(wcaLoc);

    let candidates: any[] = [];
    if (wcaNameNorm && nameIndex.has(wcaNameNorm)) {
      candidates = nameIndex.get(wcaNameNorm)!;
    } else if (!isGeneric && wca.countryPrefix === 'HB') {
      // Only do expensive O(n×m) fallback matching for Swiss entries,
      // since geo sources (OSM + Wikidata) are Swiss-only. Skipping this
      // for non-Swiss entries avoids 250M+ iterations with worldwide WCA data.
      const variations = generateCompoundVariations(wca.name);
      for (const v of variations) {
        if (nameIndex.has(v)) {
          candidates = candidates.concat(nameIndex.get(v)!);
        }
      }
      if (candidates.length === 0) {
        const wcaFlat = normalizeForCompare(wca.name);
        if (wcaFlat.length > 4) {
          for (const [key, sources] of nameIndex) {
            const keyFlat = key.replace(/\s+/g, '');
            if (keyFlat === wcaFlat || (keyFlat.length > 4 && keyFlat.includes(wcaFlat)) || (keyFlat.length > 4 && wcaFlat.includes(keyFlat))) {
              candidates = candidates.concat(sources);
            }
          }
        }
      }
    }

    if (isGeneric) {
      candidates = geoSources.filter(g => g._locNorm && (g._locNorm.includes(wcaLocNorm) || wcaLocNorm.includes(g._locNorm)));
    }

    let bestMatch: any = null;
    let bestDist = Infinity;

    for (const geo of candidates) {
      const locTextMatch = geo._locNorm && (geo._locNorm.includes(wcaLocNorm) || wcaLocNorm.includes(geo._locNorm));
      if (isGeneric) {
        if (locTextMatch && bestDist === Infinity) { bestMatch = geo; bestDist = 0; }
      } else {
        if (locTextMatch && bestDist === Infinity) {
          bestMatch = geo; bestDist = 0;
        }
      }
    }

    castles.push({
      code: wca.wca,
      name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
      lat: bestMatch ? bestMatch.lat : null,
      lng: bestMatch ? bestMatch.lng : null,
      canton: bestMatch?.location || wcaLoc,
      link: 'https://wcagroup.org/?page_id=207',
      wcaName: wca.name,
      wcaLocation: wcaLoc,
      countryPrefix: wca.countryPrefix,
      matchSource: bestMatch ? 'osm-wikidata' : null,
    });
  }

  return castles;
}

// --- Main entry point: fetch ALL castles worldwide (WCA list + Maidenhead locators) ---
// Simplified: skips OSM/Wikidata matching to avoid timeouts.
// WCA ODS provides ~69k entries with Maidenhead locators (~5km accuracy).
export async function fetchCastleDataComplete(castleOverrides?: Map<string, any>): Promise<any[]> {
  console.log('[castleFetcher] Step 1: Parsing WCA ODS worldwide...');
  const wcaEntries = await parseWcaOdsWorldwide();
  console.log(`[castleFetcher] Step 1 done: ${wcaEntries.length} WCA entries`);

  // 2. Build castle records using Maidenhead locator from WCA ODS (~5km accuracy)
  //    Skips OSM/Wikidata matching entirely — avoids platform timeouts.
  const castles = wcaEntries.map(wca => {
    let lat: number | null = null;
    let lng: number | null = null;
    let matchSource: string | null = null;

    // Use Maidenhead locator from WCA ODS
    if (wca.locator && wca.locator.length >= 4) {
      const coords = maidenheadToLatLng(wca.locator);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
        matchSource = 'locator';
      }
    }

    return {
      code: wca.wca,
      name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
      lat, lng,
      canton: wca.location,
      link: 'https://wcagroup.org/?page_id=207',
      wcaName: wca.name,
      wcaLocation: wca.location,
      countryPrefix: wca.countryPrefix,
      matchSource,
    };
  });
  console.log(`[castleFetcher] Step 2 done: ${castles.length} castles, ${castles.filter(c => c.lat !== null).length} with coords`);

  // 5. Apply manual overrides
  for (const c of castles) {
    if (!castleOverrides) continue;
    const override = castleOverrides.get(c.code);
    if (!override) continue;
    if (override.manual_lat != null && override.manual_lng != null) {
      c.lat = override.manual_lat;
      c.lng = override.manual_lng;
      c.matchSource = 'manual-override';
    }
    if (override.adjusted_name) {
      c.name = override.adjusted_name.charAt(0) + override.adjusted_name.slice(1).toLowerCase();
    }
    if (override.web_reference) c.link = override.web_reference;
  }

  return castles;
}