import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// --- HBFF KMZ extraction helpers (inlined from fetchHBFF) ---
async function extractKmlFromKmz(buffer) {
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

function parseHBFFRefList(html) {
  const refs = [];
  const rows = html.split(/<tr[\s>]/);
  for (const row of rows) {
    const linkMatch = row.match(/href=['"](https:\/\/hbff\.ch\/geo\/HBFF-(\d{4})\.htm)['"]/);
    if (!linkMatch) continue;
    const refNum = linkMatch[2];
    const detailUrl = linkMatch[1];
    const cells = [];
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

async function extractCoordsFromKMZ(kmzUrl) {
  try {
    const resp = await fetch(kmzUrl);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const kmlText = await extractKmlFromKmz(buffer);
    if (!kmlText) return null;
    const coordMatches = kmlText.matchAll(/<coordinates>([\d.\-,\s]+)<\/coordinates>/g);
    let sumLat = 0, sumLng = 0, count = 0;
    for (const m of coordMatches) {
      const pairs = m[1].trim().split(/\s+/);
      for (const pair of pairs) {
        const parts = pair.split(',');
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) { sumLat += lat; sumLng += lng; count++; }
      }
    }
    if (count > 0) return { lat: sumLat / count, lng: sumLng / count };
    return null;
  } catch { return null; }
}

// --- Data fetchers ---

async function fetchSotaData() {
  const resp = await fetch('https://api2.sota.org.uk/api/associations/HB', { headers: { 'Accept': 'application/json' } });
  if (!resp.ok) throw new Error('SOTA API failed');
  const data = await resp.json();
  const summits = [];
  if (data.regions) {
    for (const region of data.regions) {
      try {
        const regionResp = await fetch(`https://api2.sota.org.uk/api/regions/HB/${region.regionCode}`, { headers: { 'Accept': 'application/json' } });
        if (regionResp.ok) {
          const regionData = await regionResp.json();
          if (regionData.summits) {
            for (const s of regionData.summits) {
              summits.push({ code: s.summitCode, name: s.name, lat: s.latitude, lng: s.longitude, alt: s.altM, points: s.points });
            }
          }
        }
      } catch {}
    }
  }
  return summits;
}

async function fetchPotaData() {
  for (const entityCode of ['CH', 'HB']) {
    try {
      const resp = await fetch(`https://api.pota.app/program/parks/${entityCode}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' } });
      if (resp.ok) {
        const parks = await resp.json();
        const arr = Array.isArray(parks) ? parks : (parks.parks || []);
        return arr.filter(p => p.latitude && p.longitude).map(p => ({
          code: p.reference || p.parkId, name: p.name || '', lat: parseFloat(p.latitude), lng: parseFloat(p.longitude), parkType: p.parkType || ''
        }));
      }
    } catch {}
  }
  return [];
}

async function fetchHbffData() {
  const resp = await fetch('https://hbff.ch/Refs/HBFFReferenceSlim.html');
  if (!resp.ok) throw new Error('HBFF list fetch failed');
  const html = await resp.text();
  const allRefs = parseHBFFRefList(html);
  const results = [];
  const concurrencyLimit = 30;
  for (let i = 0; i < allRefs.length; i += concurrencyLimit) {
    const chunk = allRefs.slice(i, i + concurrencyLimit);
    const chunkResults = await Promise.all(chunk.map(async (ref) => {
      const coords = await extractCoordsFromKMZ(ref.kmzUrl);
      return { code: ref.code, name: ref.name, lat: coords?.lat || null, lng: coords?.lng || null, parkType: ref.parkType, link: ref.detailUrl };
    }));
    results.push(...chunkResults);
  }
  return results.filter(r => r.lat !== null);
}

async function fetchWwbotaData() {
  const resp = await fetch('https://api.wwbota.org/bunkers/?format=CSV');
  if (!resp.ok) throw new Error('WWBOTA API failed');
  const csv = await resp.text();
  const lines = csv.trim().split('\n');
  const bunkers = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 8) continue;
    if (cols[0] === 'HBBOTA') {
      const lat = parseFloat(cols[5]);
      const lng = parseFloat(cols[6]);
      if (!isNaN(lat) && !isNaN(lng)) {
        bunkers.push({ code: cols[2], name: cols[3], lat, lng, parkType: cols[4], link: 'https://wwbota.net/map/' });
      }
    }
  }
  return bunkers;
}

async function fetchLighthouseData() {
  const resp = await fetch('https://wllw.org/ILLW-flat.txt', { headers: { 'User-Agent': 'HB9OM-OnField/1.0' } });
  if (!resp.ok) throw new Error('ILLW fetch failed');
  const text = await resp.text();
  const swissCoords = {
    'CH0001': { lat: 46.5103, lng: 6.4950 }, 'CH0002': { lat: 46.5097, lng: 6.4960 },
    'CH0003': { lat: 47.4740, lng: 9.4980 }, 'CH0004': { lat: 47.5660, lng: 9.3780 },
    'CH0005': { lat: 46.2080, lng: 6.1540 }, 'CH0006': { lat: 46.2100, lng: 6.1560 },
  };
  const lighthouses = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const code = trimmed.substring(0, eqIdx).trim();
    const name = trimmed.substring(eqIdx + 1).trim();
    if (swissCoords[code]) {
      lighthouses.push({ code, name, lat: swissCoords[code].lat, lng: swissCoords[code].lng, link: 'https://wllw.org/index.php/en/' });
    }
  }
  return lighthouses;
}

async function fetchCastleData(castleOverrides) {
  // 1. Download WCA ODS and parse HB-HB0 table (all Swiss castles)
  const odsResp = await fetch('https://wcagroup.org/FORMS/WCALIST.ods', {
    headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
  });
  if (!odsResp.ok) throw new Error('WCA list download failed');
  const odsBuffer = new Uint8Array(await odsResp.arrayBuffer());

  // Parse ZIP to find content.xml
  let zipOffset = 0;
  let contentEntry = null;
  while (zipOffset < odsBuffer.length - 4) {
    if (odsBuffer[zipOffset] === 0x50 && odsBuffer[zipOffset + 1] === 0x4B &&
        odsBuffer[zipOffset + 2] === 0x01 && odsBuffer[zipOffset + 3] === 0x02) {
      const compressedSize = ((odsBuffer[zipOffset + 20] | (odsBuffer[zipOffset + 21] << 8) | (odsBuffer[zipOffset + 22] << 16) | (odsBuffer[zipOffset + 23] << 24)) >>> 0);
      const fileNameLength = odsBuffer[zipOffset + 28] | (odsBuffer[zipOffset + 29] << 8);
      const extraFieldLength = odsBuffer[zipOffset + 30] | (odsBuffer[zipOffset + 31] << 8);
      const fileCommentLength = odsBuffer[zipOffset + 32] | (odsBuffer[zipOffset + 33] << 8);
      const localHeaderOffset = ((odsBuffer[zipOffset + 42] | (odsBuffer[zipOffset + 43] << 8) | (odsBuffer[zipOffset + 44] << 16) | (odsBuffer[zipOffset + 45] << 24)) >>> 0);
      const fileName = new TextDecoder().decode(odsBuffer.slice(zipOffset + 46, zipOffset + 46 + fileNameLength));
      if (fileName === 'content.xml') { contentEntry = { compressedSize, localHeaderOffset }; break; }
      zipOffset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    } else { zipOffset++; }
  }
  if (!contentEntry) throw new Error('content.xml not found in WCA ODS');

  const lho = contentEntry.localHeaderOffset;
  const localFileNameLength = odsBuffer[lho + 26] | (odsBuffer[lho + 27] << 8);
  const localExtraFieldLength = odsBuffer[lho + 28] | (odsBuffer[lho + 29] << 8);
  const dataStart = lho + 30 + localFileNameLength + localExtraFieldLength;
  const compressedData = odsBuffer.slice(dataStart, dataStart + contentEntry.compressedSize);
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([compressedData]).stream().pipeThrough(ds);
  const xml = await new Response(stream).text();

  // Parse HB-HB0 table
  const hbTableStart = xml.indexOf('table:name="HB-HB0"');
  if (hbTableStart === -1) throw new Error('HB-HB0 table not found in WCA list');
  const hbTableEnd = xml.indexOf('</table:table>', hbTableStart);
  const hbTableXml = xml.substring(hbTableStart, hbTableEnd);

  const wcaEntries = [];
  const rowRegex = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(hbTableXml)) !== null) {
    const rowContent = rowMatch[1];
    if (rowContent.includes('number-rows-repeated')) continue;
    if (rowContent.includes('number-columns-repeated="256"') && !rowContent.includes('text:p')) continue;
    const cells = [];
    const cellRegex = /<table:table-cell[^>]*>([\s\S]*?)<\/table:table-cell>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellContent = cellMatch[1];
      const textMatches = cellContent.match(/<text:p[^>]*>([\s\S]*?)<\/text:p>/g);
      if (textMatches) { cells.push(textMatches.map(t => t.replace(/<[^>]+>/g, '')).join(' ').trim()); }
      else { cells.push(''); }
    }
    if (cells.length >= 4 && cells[0] && cells[0].match(/^HB-\d{5}$/)) {
      wcaEntries.push({
        wca: cells[0],
        name: (cells[3] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&"),
        location: (cells[4] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&"),
        locator: (cells[5] || '').toUpperCase().trim()
      });
    }
  }

  // 2. Extract unique location names for targeted place lookup
  const uniqueLocations = [...new Set(wcaEntries.map(w => w.location))].filter(l => l.length > 0);

  // 3. Fetch OSM castles, OSM places (by name), and Wikidata in parallel
  const [osmCastlesResult, osmPlacesResult, wdResult] = await Promise.allSettled([
    (async () => {
      const query = `[out:json][timeout:30];(node["historic"~"castle|tower|fort|ruins|manor|city_gate|archaeological_site|fortification"](45.8,5.9,48.0,10.6);way["historic"~"castle|tower|fort|ruins|manor|city_gate|archaeological_site|fortification"](45.8,5.9,48.0,10.6););out center 50000;`;
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HB9OM-OnField/1.0' },
        body: 'data=' + encodeURIComponent(query)
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const castles = [];
      for (const e of (data.elements || [])) {
        if (!e.tags?.name) continue;
        const lat = e.lat || e.center?.lat;
        const lng = e.lon || e.center?.lon;
        if (isNaN(lat) || isNaN(lng)) continue;
        castles.push({ name: e.tags.name.toUpperCase(), lat, lng, location: (e.tags?.['addr:city'] || '').toUpperCase() });
      }
      return castles;
    })(),
    (async () => {
      if (uniqueLocations.length === 0) return [];
      const nameRegex = uniqueLocations.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const query = `[out:json][timeout:30];(node["place"~"city|town|village|municipality|hamlet|suburb|quarter"]["name"~"^(${nameRegex})$", i](45.8,5.9,48.0,10.6););out 5000;`;
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HB9OM-OnField/1.0' },
        body: 'data=' + encodeURIComponent(query)
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const places = [];
      for (const e of (data.elements || [])) {
        if (isNaN(e.lat) || isNaN(e.lon)) continue;
        places.push({ name: (e.tags?.name || '').toUpperCase(), lat: e.lat, lng: e.lon });
      }
      return places;
    })(),
    (async () => {
      const sparqlQuery = `SELECT ?item ?itemLabel ?coord ?cantonLabel ?cityLabel WHERE { { ?item wdt:P31/wdt:P279* wd:Q23413 . } UNION { ?item wdt:P31/wdt:P279* wd:Q57821 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1763828 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1255038 . } UNION { ?item wdt:P31/wdt:P279* wd:Q3289106 . } UNION { ?item wdt:P31/wdt:P279* wd:Q174782 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1270920 . } ?item wdt:P17 wd:Q39 . ?item wdt:P625 ?coord . OPTIONAL { ?item wdt:P131 ?canton . } OPTIONAL { ?item wdt:P276 ?city . } SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en,fr,it" . } } LIMIT 3000`;
      const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' }
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      const seen = new Set();
      const results = [];
      for (const b of (data.results?.bindings || [])) {
        const uri = b.item?.value || '';
        if (seen.has(uri)) continue;
        seen.add(uri);
        const coordMatch = (b.coord?.value || '').match(/Point\(([\d.-]+)\s+([\d.-]+)\)/);
        if (!coordMatch) continue;
        results.push({ name: (b.itemLabel?.value || '').toUpperCase(), lat: parseFloat(coordMatch[2]), lng: parseFloat(coordMatch[1]), location: (b.cityLabel?.value || b.cantonLabel?.value || '').toUpperCase() });
      }
      return results;
    })()
  ]);

  const osmCastles = osmCastlesResult.status === 'fulfilled' ? osmCastlesResult.value : [];
  const osmPlaces = osmPlacesResult.status === 'fulfilled' ? osmPlacesResult.value : [];
  const wdCastles = wdResult.status === 'fulfilled' ? wdResult.value : [];
  const geoSources = [...osmCastles, ...wdCastles];

  // Helper: Maidenhead grid locator to lat/lng
  function maidenheadToLatLng(locator) {
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

  // Helper: search map.admin.ch for Swiss castles by name
  async function searchMapAdminCh(name, location) {
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

  async function batchSearchMapAdminCh(entries) {
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

  // Helper: Nominatim internet geocoding (final fallback)
  async function searchNominatim(name, location) {
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

  // 4. Match WCA entries to geo sources using name + proximity
  const SKIP_WORDS = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL', 'CASTELLO', 'FESTUNG', 'RUINE', 'BURGRUINE', 'SCHLOSSE', 'RUIN', 'OF', 'DE', 'LA', 'LE', 'THE', 'ALT', 'NEU', 'ALTES', 'NEUES', 'GROSSES', 'KLEINES', 'MIT', 'UND', 'ST', 'SANKT', 'DER', 'DIE', 'DAS', 'EIN', 'EINE']);
  const GENERIC_NAMES = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL', 'CASTELLO', 'FESTUNG', 'RUINE', 'TURM', 'TURN', 'TOUR', 'TORRE', 'GATE', 'TOR', 'HAUS', 'SCHLOSSLI', 'BURGLI', 'TURMLI']);

  function normalizeText(text) {
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

  function normalizeName(name) {
    return normalizeText(name).split(/\s+/).filter(w => w.length > 2 && !SKIP_WORDS.has(w)).join(' ').trim();
  }

  function normalizeForCompare(text) {
    return normalizeText(text).replace(/\s+/g, '');
  }

  const COMPOUND_SUFFIXES = ['TURM', 'TOR', 'TURN', 'TOUR', 'TORRE', 'GATE', 'HAUS',
    'SCHLOSS', 'BURG', 'FESTUNG', 'RUINE', 'HOF', 'BERG', 'BACH', 'FELD', 'WALD',
    'STEIN', 'MAUER', 'PLATZ', 'BRUCKE', 'BRUECKE', 'GRABEN', 'TAL', 'SEE', 'BACH'];

  function generateCompoundVariations(name) {
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

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Build place lookup: normalized name → coordinates
  const placeMap = new Map();
  for (const p of osmPlaces) {
    const key = normalizeText(p.name);
    if (!placeMap.has(key)) placeMap.set(key, [p.lat, p.lng]);
  }

  // Build name index with compound variations
  const nameIndex = new Map();
  const addToIndex = (key, geo) => {
    if (!key) return;
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    if (!nameIndex.get(key).includes(geo)) nameIndex.get(key).push(geo);
  };
  for (const geo of geoSources) {
    const key = normalizeName(geo.name);
    addToIndex(key, geo);
    if (key && key.includes(' ')) {
      addToIndex(key.replace(/\s+/g, ''), geo);
    }
    for (const v of generateCompoundVariations(geo.name)) {
      if (v !== key) addToIndex(v, geo);
    }
  }

  // Pre-normalize geo locations for text matching
  for (const geo of geoSources) {
    geo._locNorm = geo.location ? normalizeText(geo.location) : '';
  }

  // === MATCHING: override → locator → map.admin.ch → OSM/Wikidata → Nominatim ===
  const castles = [];

  // Step 0: Apply manual overrides, use adjusted name/location for remaining
  const afterOverrides = [];
  for (const wca of wcaEntries) {
    const override = castleOverrides?.get(wca.wca);
    if (override?.manual_lat != null && override?.manual_lng != null) {
      const displayName = override.adjusted_name || wca.name;
      castles.push({
        code: wca.wca,
        name: displayName.charAt(0) + displayName.slice(1).toLowerCase(),
        lat: override.manual_lat,
        lng: override.manual_lng,
        canton: override.adjusted_location || wca.location,
        link: override.web_reference || 'https://wcagroup.org/?page_id=207',
        wcaName: wca.name,
        wcaLocation: wca.location,
        matchSource: 'manual-override'
      });
    } else {
      afterOverrides.push({
        ...wca,
        name: override?.adjusted_name || wca.name,
        location: override?.adjusted_location || wca.location
      });
    }
  }

  const afterLocator = [];

  // Step 1: Maidenhead locator (6+ chars only for ~5km precision)
  for (const wca of afterOverrides) {
    if (wca.locator && wca.locator.length >= 6) {
      const coords = maidenheadToLatLng(wca.locator);
      if (coords) {
        castles.push({
          code: wca.wca,
          name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
          lat: coords.lat, lng: coords.lng,
          canton: wca.location,
          link: 'https://wcagroup.org/?page_id=207',
          wcaName: wca.name, wcaLocation: wca.location,
          matchSource: 'locator'
        });
        continue;
      }
    }
    afterLocator.push(wca);
  }

  // Step 2: OSM/Wikidata name matching (accurate, takes priority over map.admin.ch)
  const afterOSM = [];
  for (const wca of afterLocator) {
    const wcaNameNorm = normalizeName(wca.name);
    const wcaLoc = wca.location;
    const isGeneric = GENERIC_NAMES.has(wca.name.trim()) || wcaNameNorm.length === 0;
    const wcaLocNorm = normalizeText(wcaLoc);
    const placeCoords = placeMap.get(wcaLocNorm);

    let candidates = [];
    if (wcaNameNorm && nameIndex.has(wcaNameNorm)) {
      candidates = nameIndex.get(wcaNameNorm);
    } else if (!isGeneric) {
      const variations = generateCompoundVariations(wca.name);
      for (const v of variations) {
        if (nameIndex.has(v)) {
          candidates = candidates.concat(nameIndex.get(v));
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

    let bestMatch = null;
    let bestDist = Infinity;

    for (const geo of candidates) {
      const locTextMatch = geo._locNorm && (geo._locNorm.includes(wcaLocNorm) || wcaLocNorm.includes(geo._locNorm));
      if (isGeneric) {
        if (placeCoords) {
          const dist = haversine(geo.lat, geo.lng, placeCoords[0], placeCoords[1]);
          if (dist < bestDist) { bestMatch = geo; bestDist = dist; }
        } else if (locTextMatch && bestDist === Infinity) {
          bestMatch = geo; bestDist = 0;
        }
      } else {
        if (placeCoords) {
          const dist = haversine(geo.lat, geo.lng, placeCoords[0], placeCoords[1]);
          if (dist < 15000 && dist < bestDist) { bestMatch = geo; bestDist = dist; }
        } else if (locTextMatch && bestDist === Infinity) {
          bestMatch = geo; bestDist = 0;
        }
      }
    }

    if (bestMatch) {
      castles.push({
        code: wca.wca,
        name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
        lat: bestMatch.lat, lng: bestMatch.lng,
        canton: bestMatch.location || wcaLoc,
        link: 'https://wcagroup.org/?page_id=207',
        wcaName: wca.name, wcaLocation: wcaLoc,
        matchSource: 'osm-wikidata'
      });
    } else {
      afterOSM.push(wca);
    }
  }

  // Step 3: map.admin.ch fallback for remaining unmatched
  const afterAdmin = [];
  if (afterOSM.length > 0) {
    const adminResults = await batchSearchMapAdminCh(
      afterOSM.map(w => ({ name: w.name, location: w.location }))
    );
    for (let i = 0; i < afterOSM.length; i++) {
      if (adminResults[i]) {
        castles.push({
          code: afterOSM[i].wca,
          name: afterOSM[i].name.charAt(0) + afterOSM[i].name.slice(1).toLowerCase(),
          lat: adminResults[i].lat, lng: adminResults[i].lng,
          canton: afterOSM[i].location,
          link: 'https://wcagroup.org/?page_id=207',
          wcaName: afterOSM[i].name, wcaLocation: afterOSM[i].location,
          matchSource: 'map.admin.ch'
        });
      } else {
        afterAdmin.push(afterOSM[i]);
      }
    }
  } else {
    afterAdmin.push(...afterOSM);
  }

  // Step 4: 4-char locator fallback (imprecise ~100km, last resort before Nominatim)
  const afterShortLoc = [];
  for (const wca of afterAdmin) {
    if (wca.locator && wca.locator.length >= 4) {
      const coords = maidenheadToLatLng(wca.locator);
      if (coords) {
        castles.push({
          code: wca.wca,
          name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
          lat: coords.lat, lng: coords.lng,
          canton: wca.location,
          link: 'https://wcagroup.org/?page_id=207',
          wcaName: wca.name, wcaLocation: wca.location,
          matchSource: 'locator-4char'
        });
        continue;
      }
    }
    afterShortLoc.push(wca);
  }

  // Step 5: Nominatim internet geocoding (rate-limited: 1.1s per request, max 40 lookups)
  let nominatimCount = 0;
  for (const wca of afterShortLoc) {
    if (GENERIC_NAMES.has(wca.name.trim())) {
      castles.push({
        code: wca.wca,
        name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
        lat: null, lng: null,
        canton: wca.location,
        link: 'https://wcagroup.org/?page_id=207',
        wcaName: wca.name, wcaLocation: wca.location,
        matchSource: null
      });
      continue;
    }
    if (nominatimCount >= 25) {
      castles.push({
        code: wca.wca,
        name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
        lat: null, lng: null,
        canton: wca.location,
        link: 'https://wcagroup.org/?page_id=207',
        wcaName: wca.name, wcaLocation: wca.location,
        matchSource: null
      });
      continue;
    }
    const coords = await searchNominatim(wca.name, wca.location);
    nominatimCount++;
    castles.push({
      code: wca.wca,
      name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
      lat: coords ? coords.lat : null,
      lng: coords ? coords.lng : null,
      canton: wca.location,
      link: 'https://wcagroup.org/?page_id=207',
      wcaName: wca.name, wcaLocation: wca.location,
      matchSource: coords ? 'geocoding' : null
    });
    await new Promise(r => setTimeout(r, 1000));
  }

  // Apply non-coordinate overrides to all castles
  for (const c of castles) {
    const override = castleOverrides?.get(c.code);
    if (!override) continue;
    if (override.web_reference) c.link = override.web_reference;
    if (override.adjusted_name && c.matchSource !== 'manual-override') {
      c.name = override.adjusted_name.charAt(0) + override.adjusted_name.slice(1).toLowerCase();
    }
  }

  return castles;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}

    // Skip scheduled runs if auto-update is disabled (manual runs always proceed)
    if (!user) {
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'auto_update' });
        if (settings.length > 0 && settings[0].enabled === false) {
          return Response.json({ skipped: true, message: 'Automatische Aktualisierung deaktiviert' });
        }
      } catch {}
    }

    const startTime = Date.now();

    // Fetch admin overrides for reference data
    const allOverrides = await base44.asServiceRole.entities.ReferenceOverride.list("-created_date", 500);
    const overridesByType = new Map();
    for (const ov of (allOverrides || [])) {
      if (!overridesByType.has(ov.reference_type)) overridesByType.set(ov.reference_type, new Map());
      overridesByType.get(ov.reference_type).set(ov.original_code, ov);
    }

    const taskDefs = [
      { type: 'sota', fn: fetchSotaData },
      { type: 'pota', fn: fetchPotaData },
      { type: 'hbff', fn: fetchHbffData },
      { type: 'wwbota', fn: fetchWwbotaData },
      { type: 'lighthouse', fn: fetchLighthouseData },
      { type: 'castle', fn: () => fetchCastleData(overridesByType.get('castle') || new Map()) },
    ];

    const settled = await Promise.allSettled(taskDefs.map(async (t) => {
      const taskStart = Date.now();
      const items = await t.fn();
      // Apply admin overrides for non-castle types
      if (t.type !== 'castle' && overridesByType.has(t.type)) {
        const typeOverrides = overridesByType.get(t.type);
        for (const item of items) {
          const code = item.code || item.reference;
          if (code && typeOverrides.has(code)) {
            const ov = typeOverrides.get(code);
            if (ov.manual_lat != null) { item.lat = ov.manual_lat; item.lng = ov.manual_lng; }
            if (ov.adjusted_name) item.name = ov.adjusted_name;
            if (ov.web_reference) item.link = ov.web_reference;
          }
        }
      }
      const now = new Date().toISOString();

      // Upsert ReferenceData
      const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: t.type });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
          references: items, total_count: items.length, source: t.type, last_updated: now
        });
      } else {
        await base44.asServiceRole.entities.ReferenceData.create({
          type: t.type, references: items, total_count: items.length, source: t.type, last_updated: now
        });
      }

      const result = { type: t.type, status: 'success', count: items.length, duration_ms: Date.now() - taskStart };
      if (t.type === 'castle') {
        const matched = items.filter(c => c.lat !== null).length;
        const bySource = {};
        for (const c of items) {
          const src = c.matchSource || 'unmatched';
          bySource[src] = (bySource[src] || 0) + 1;
        }
        result.castleStats = { matched, total: items.length, unmatched: items.length - matched, bySource };
      }
      return result;
    }));

    const results = taskDefs.map((t, i) => {
      if (settled[i].status === 'fulfilled') return settled[i].value;
      return { type: t.type, status: 'failed', count: 0, error: settled[i].reason?.message || String(settled[i].reason), duration_ms: 0 };
    });

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const overallStatus = successCount === results.length ? 'success' : successCount > 0 ? 'partial' : 'failed';

    // SyncLog pro User: nutzerspezifisch wenn angemeldet, sonst service role (scheduled)
    const syncLogClient = user ? base44.entities.SyncLog : base44.asServiceRole.entities.SyncLog;
    await syncLogClient.create({
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      total_duration_ms: totalDuration,
      results: results,
      trigger: user ? 'manual' : 'scheduled'
    });

    return Response.json({ overall_status: overallStatus, total_duration_ms: totalDuration, results: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});