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

  // Find content.xml in ZIP central directory
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

  // Extract and decompress content.xml
  const lho = contentEntry.localHeaderOffset;
  const localFileNameLength = readUInt16LE(odsBuffer, lho + 26);
  const localExtraFieldLength = readUInt16LE(odsBuffer, lho + 28);
  const dataStart = lho + 30 + localFileNameLength + localExtraFieldLength;
  const compressedData = odsBuffer.slice(dataStart, dataStart + contentEntry.compressedSize);
  const decompressed = inflateRawSync(compressedData);
  const xml = new TextDecoder().decode(decompressed);

  // Parse HB-HB0 table (Swiss castles)
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
        const text = textMatches.map(t => t.replace(/<[^>]+>/g, '')).join(' ').trim();
        cells.push(text);
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

// --- OSM Overpass fetch ---
async function fetchOSMCastles() {
  const query = `[out:json][timeout:25];(
    node["historic"~"castle|tower|fort|ruins"](46,5.9,47.9,10.6);
    way["historic"~"castle|tower|fort|ruins"](46,5.9,47.9,10.6);
  );out center 5000;`;

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HB9OM-OnField/1.0' },
    body: 'data=' + encodeURIComponent(query)
  });
  if (!resp.ok) throw new Error('Overpass API failed');

  const data = await resp.json();
  const elements = data.elements || [];
  const results = [];
  for (const e of elements) {
    if (!e.tags?.name) continue;
    const lat = e.lat || e.center?.lat;
    const lng = e.lon || e.center?.lon;
    if (isNaN(lat) || isNaN(lng)) continue;
    results.push({
      name: e.tags.name.toUpperCase(),
      lat, lng,
      location: (e.tags?.['addr:city'] || '').toUpperCase()
    });
  }
  return results;
}

// --- Wikidata SPARQL fetch ---
async function fetchWikidataCastles() {
  const sparqlQuery = `SELECT ?item ?itemLabel ?coord ?cantonLabel WHERE {
    { ?item wdt:P31/wdt:P279* wd:Q23413 . } UNION { ?item wdt:P31/wdt:P279* wd:Q57821 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1763828 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1255038 . } UNION { ?item wdt:P31/wdt:P279* wd:Q3289106 . } UNION { ?item wdt:P31/wdt:P279* wd:Q174782 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1270920 . }
    ?item wdt:P17 wd:Q39 . ?item wdt:P625 ?coord .
    OPTIONAL { ?item wdt:P131 ?canton . }
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
      location: (b.cantonLabel?.value || '').toUpperCase()
    });
  }
  return results;
}

// --- Matching ---
const SKIP_WORDS = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL', 'CASTELLO',
  'FESTUNG', 'RUINE', 'BURGRUINE', 'SCHLOSSE', 'RUIN', 'OF', 'DE', 'LA', 'LE', 'THE',
  'ALT', 'NEU', 'ALTES', 'NEUES', 'GROSSES', 'KLEINES', 'MIT', 'UND', 'ST', 'SANKT',
  'DER', 'DIE', 'DAS', 'EIN', 'EINE']);

const GENERIC_NAMES = new Set(['SCHLOSS', 'BURG', 'CHATEAU', 'CHÂTEAU', 'CASTEL', 'CASTELLO',
  'FESTUNG', 'RUINE', 'TURM', 'TURN', 'TOUR', 'TORRE', 'GATE', 'TOR', 'HAUS',
  'SCHLOSSLI', 'BURGLI', 'TURMLI']);

function normalizeName(name) {
  return name.replace(/&APOS;/g, "'").replace(/&AMP;/g, "&")
    .replace(/[()\[\]/'",.\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !SKIP_WORDS.has(w))
    .join(' ')
    .trim();
}

function matchWcaToGeo(wcaEntries, geoSources) {
  const castles = [];

  for (const wca of wcaEntries) {
    const wcaNameNorm = normalizeName(wca.name);
    const wcaLoc = wca.location;
    const isGeneric = GENERIC_NAMES.has(wca.name.trim()) || wcaNameNorm.length === 0;
    let bestMatch = null;

    for (const geo of geoSources) {
      const geoNameNorm = normalizeName(geo.name);
      const locMatch = geo.location && (geo.location.includes(wcaLoc) || wcaLoc.includes(geo.location));

      let nameMatch = false;
      if (geoNameNorm && wcaNameNorm) {
        if (geoNameNorm === wcaNameNorm) nameMatch = true;
        else if (wcaNameNorm.length > 3 && geoNameNorm.includes(wcaNameNorm)) nameMatch = true;
        else if (geoNameNorm.length > 3 && wcaNameNorm.includes(geoNameNorm)) nameMatch = true;
      }

      if (isGeneric) {
        if (locMatch) { bestMatch = geo; break; }
      } else {
        if (nameMatch && locMatch) { bestMatch = geo; break; }
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

    // 1. Parse WCA list (all 943 entries from HB-HB0 tab)
    const wcaEntries = await parseWCAList();

    // 2. Fetch geo coordinates from OSM + Wikidata in parallel
    const [osmResult, wdResult] = await Promise.allSettled([
      fetchOSMCastles(),
      fetchWikidataCastles()
    ]);

    const geoSources = [
      ...(osmResult.status === 'fulfilled' ? osmResult.value : []),
      ...(wdResult.status === 'fulfilled' ? wdResult.value : [])
    ];

    // 3. Match WCA entries to geo sources
    const castles = matchWcaToGeo(wcaEntries, geoSources);
    const withCoords = castles.filter(c => c.lat !== null).length;

    return Response.json({
      castles,
      count: castles.length,
      totalWCA: wcaEntries.length,
      matchedWithCoords: withCoords,
      geoSourceCount: geoSources.length,
      source: 'WCA list (wcagroup.org) + OSM + Wikidata'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});