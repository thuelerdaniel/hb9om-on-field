import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { inflateRawSync } from 'node:zlib';

function readUInt16LE(buf, offset) {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUInt32LE(buf, offset) {
  return ((buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0);
}

// --- WCA ODS parsing ---
async function parseWCAList() {
  const odsResp = await fetch('https://wcagroup.org/FORMS/WCALIST.ods', {
    headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
  });
  if (!odsResp.ok) throw new Error('Failed to download WCA list');

  const odsBuffer = new Uint8Array(await odsResp.arrayBuffer());

  let offset = 0;
  let contentEntry = null;
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
  const decompressed = inflateRawSync(compressedData);
  const xml = new TextDecoder().decode(decompressed);

  const hbTableStart = xml.indexOf('table:name="HB-HB0"');
  if (hbTableStart === -1) throw new Error('HB-HB0 table not found in WCA list');
  const hbTableEnd = xml.indexOf('</table:table>', hbTableStart);
  const hbTableXml = xml.substring(hbTableStart, hbTableEnd);

  const wcaEntries = [];
  const rowRegex = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g;
  let match;

  while ((match = rowRegex.exec(hbTableXml)) !== null) {
    const rowContent = match[1];
    if (rowContent.includes('number-rows-repeated')) continue;
    if (rowContent.includes('number-columns-repeated="256"') && !rowContent.includes('text:p')) continue;

    const cells = [];
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

    if (cells.length >= 4 && cells[0] && cells[0].match(/^HB-\d{5}$/)) {
      wcaEntries.push({
        wca: cells[0],
        name: (cells[3] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&"),
        location: (cells[4] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&")
      });
    }
  }
  return wcaEntries;
}

// --- OSM Overpass: castles ---
async function fetchOSMCastles() {
  const query = `[out:json][timeout:30];(
    node["historic"~"castle|tower|fort|ruins|manor|city_gate|archaeological_site|fortification"](45.8,5.9,48.0,10.6);
    way["historic"~"castle|tower|fort|ruins|manor|city_gate|archaeological_site|fortification"](45.8,5.9,48.0,10.6);
  );out center 50000;`;

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HB9OM-OnField/1.0' },
    body: 'data=' + encodeURIComponent(query)
  });
  if (!resp.ok) throw new Error('Overpass API failed');

  const data = await resp.json();
  const elements = data.elements || [];
  const castles = [];
  for (const e of elements) {
    if (!e.tags?.name) continue;
    const lat = e.lat || e.center?.lat;
    const lng = e.lon || e.center?.lon;
    if (isNaN(lat) || isNaN(lng)) continue;
    castles.push({
      name: e.tags.name.toUpperCase(),
      lat, lng,
      location: (e.tags?.['addr:city'] || '').toUpperCase()
    });
  }
  return castles;
}

// --- OSM Overpass: places by name (targeted lookup) ---
async function fetchOSMPlaces(locationNames) {
  if (locationNames.length === 0) return [];
  // Build regex of location names (URL-safe, Overpass supports ~ with regex)
  const nameRegex = locationNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const query = `[out:json][timeout:30];(
    node["place"~"city|town|village|municipality|hamlet|suburb|quarter"]["name"~"^(${nameRegex})$", i](45.8,5.9,48.0,10.6);
  );out 5000;`;

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HB9OM-OnField/1.0' },
    body: 'data=' + encodeURIComponent(query)
  });
  if (!resp.ok) return [];

  const data = await resp.json();
  const elements = data.elements || [];
  const places = [];
  for (const e of elements) {
    if (isNaN(e.lat) || isNaN(e.lon)) continue;
    places.push({ name: (e.tags?.name || '').toUpperCase(), lat: e.lat, lng: e.lon });
  }
  return places;
}

// --- Wikidata SPARQL fetch ---
async function fetchWikidataCastles() {
  const sparqlQuery = `SELECT ?item ?itemLabel ?coord ?cantonLabel ?cityLabel WHERE {
    { ?item wdt:P31/wdt:P279* wd:Q23413 . } UNION { ?item wdt:P31/wdt:P279* wd:Q57821 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1763828 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1255038 . } UNION { ?item wdt:P31/wdt:P279* wd:Q3289106 . } UNION { ?item wdt:P31/wdt:P279* wd:Q174782 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1270920 . }
    ?item wdt:P17 wd:Q39 . ?item wdt:P625 ?coord .
    OPTIONAL { ?item wdt:P131 ?canton . }
    OPTIONAL { ?item wdt:P276 ?city . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en,fr,it" . }
  } LIMIT 3000`;

  const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' }
  });
  if (!resp.ok) throw new Error('Wikidata SPARQL failed');

  const data = await resp.json();
  const bindings = data.results?.bindings || [];
  const seen = new Set();
  const results = [];
  for (const b of bindings) {
    const uri = b.item?.value || '';
    if (seen.has(uri)) continue;
    seen.add(uri);
    const coordMatch = (b.coord?.value || '').match(/Point\(([\d.-]+)\s+([\d.-]+)\)/);
    if (!coordMatch) continue;
    results.push({
      name: (b.itemLabel?.value || '').toUpperCase(),
      lat: parseFloat(coordMatch[2]),
      lng: parseFloat(coordMatch[1]),
      location: (b.cityLabel?.value || b.cantonLabel?.value || '').toUpperCase()
    });
  }
  return results;
}

// --- Haversine distance in meters ---
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Matching ---
const SKIP_WORDS = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL', 'CASTELLO',
  'FESTUNG', 'RUINE', 'BURGRUINE', 'SCHLOSSE', 'RUIN', 'OF', 'DE', 'LA', 'LE', 'THE',
  'ALT', 'NEU', 'ALTES', 'NEUES', 'GROSSES', 'KLEINES', 'MIT', 'UND', 'ST', 'SANKT',
  'DER', 'DIE', 'DAS', 'EIN', 'EINE']);

const GENERIC_NAMES = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL', 'CASTELLO',
  'FESTUNG', 'RUINE', 'TURM', 'TURN', 'TOUR', 'TORRE', 'GATE', 'TOR', 'HAUS',
  'SCHLOSSLI', 'BURGLI', 'TURMLI']);

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
  return normalizeText(name)
    .split(/\s+/)
    .filter(w => w.length > 2 && !SKIP_WORDS.has(w))
    .join(' ')
    .trim();
}

function normalizeForCompare(text) {
  // Remove all spaces for fuzzy comparison (handles concatenated names)
  return normalizeText(text).replace(/\s+/g, '');
}

// Suffixes that form compound words: "Pulverturm" → "Pulver Turm", "Obertor" → "Ober Tor"
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
    if (norm.includes(suffix) && norm.length > suffix.length + 2) {
      const idx = norm.indexOf(suffix);
      if (idx > 2 && idx + suffix.length < norm.length) {
        // Also try splitting in the middle: "HALBTURM" → "HALB TURM"
        // Only if the part before and after are both > 2 chars
      }
    }
  }
  return variations;
}

function matchWcaToGeo(wcaEntries, geoSources, places) {
  // Build place lookup: normalized name → coordinates
  const placeMap = new Map();
  for (const p of places) {
    const key = normalizeText(p.name);
    if (!placeMap.has(key)) placeMap.set(key, [p.lat, p.lng]);
  }

  // Build name index: normalized name → geo sources (O(1) lookup)
  // Also index compound variations: "Pulver Turm" → also index "Pulverturm"
  const nameIndex = new Map();
  const addToIndex = (key, geo) => {
    if (!key) return;
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    if (!nameIndex.get(key).includes(geo)) nameIndex.get(key).push(geo);
  };
  for (const geo of geoSources) {
    const key = normalizeName(geo.name);
    addToIndex(key, geo);
    // Add compound variations: "Pulver Turm" → "PULVERTURM" (spaceless)
    if (key && key.includes(' ')) {
      addToIndex(key.replace(/\s+/g, ''), geo);
    }
    // Add suffix-split variations: "Pulverturm" → "PULVER TURM"
    for (const v of generateCompoundVariations(geo.name)) {
      if (v !== key) addToIndex(v, geo);
    }
  }

  // Pre-normalize geo locations for text matching
  for (const geo of geoSources) {
    geo._locNorm = geo.location ? normalizeText(geo.location) : '';
  }

  const castles = [];

  for (const wca of wcaEntries) {
    const wcaNameNorm = normalizeName(wca.name);
    const wcaLoc = wca.location;
    const isGeneric = GENERIC_NAMES.has(wca.name.trim()) || wcaNameNorm.length === 0;
    const wcaLocNorm = normalizeText(wcaLoc);
    const placeCoords = placeMap.get(wcaLocNorm);

    // Find candidates via name index (avoids scanning all geoSources)
    let candidates = [];
    if (wcaNameNorm && nameIndex.has(wcaNameNorm)) {
      candidates = nameIndex.get(wcaNameNorm);
    } else if (!isGeneric) {
      // Try compound variations: "Pulverturm" → "PULVER TURM", "PULVERTURM"
      const variations = generateCompoundVariations(wca.name);
      for (const v of variations) {
        if (nameIndex.has(v)) {
          candidates = candidates.concat(nameIndex.get(v));
        }
      }
      // Try spaceless match for concatenated names
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

    // For generic names, filter geo sources by location text
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

    castles.push({
      code: wca.wca,
      name: wca.name.charAt(0) + wca.name.slice(1).toLowerCase(),
      lat: bestMatch ? bestMatch.lat : null,
      lng: bestMatch ? bestMatch.lng : null,
      canton: bestMatch?.location || wcaLoc,
      link: 'https://wcagroup.org/?page_id=207',
      wcaName: wca.name,
      wcaLocation: wcaLoc
    });
  }

  return castles;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Parse WCA list
    const wcaEntries = await parseWCAList();

    // 2. Extract unique location names for targeted place lookup
    const uniqueLocations = [...new Set(wcaEntries.map(w => w.location))].filter(l => l.length > 0);

    // 3. Fetch OSM castles, OSM places (by name), and Wikidata in parallel
    const [osmCastlesResult, osmPlacesResult, wdResult] = await Promise.allSettled([
      fetchOSMCastles(),
      fetchOSMPlaces(uniqueLocations),
      fetchWikidataCastles()
    ]);

    const osmCastles = osmCastlesResult.status === 'fulfilled' ? osmCastlesResult.value : [];
    const osmPlaces = osmPlacesResult.status === 'fulfilled' ? osmPlacesResult.value : [];
    const wdCastles = wdResult.status === 'fulfilled' ? wdResult.value : [];
    const geoSources = [...osmCastles, ...wdCastles];

    // 4. Match WCA entries to geo sources
    const castles = matchWcaToGeo(wcaEntries, geoSources, osmPlaces);
    const withCoords = castles.filter(c => c.lat !== null).length;

    return Response.json({
      castles,
      count: castles.length,
      totalWCA: wcaEntries.length,
      matchedWithCoords: withCoords,
      geoSourceCount: geoSources.length,
      placeCount: osmPlaces.length,
      source: 'WCA list (wcagroup.org) + OSM + Wikidata'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});