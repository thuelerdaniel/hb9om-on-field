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

async function fetchCastleData() {
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
        location: (cells[4] || '').toUpperCase().replace(/&APOS;/g, "'").replace(/&AMP;/g, "&")
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

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Enrich geo sources with nearest place names for those without location
  for (const geo of geoSources) {
    if (geo.location) continue;
    let nearestPlace = null;
    let nearestDist = 10000;
    for (const p of osmPlaces) {
      const dLat = (p.lat - geo.lat) * Math.PI / 180;
      const dLng = (p.lng - geo.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(geo.lat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist < nearestDist) { nearestDist = dist; nearestPlace = p; }
    }
    if (nearestPlace) geo.location = nearestPlace.name;
  }

  // Build place lookup: normalized name → coordinates
  const placeMap = new Map();
  for (const p of osmPlaces) {
    const key = normalizeText(p.name);
    if (!placeMap.has(key)) placeMap.set(key, [p.lat, p.lng]);
  }

  const castles = [];
  for (const wca of wcaEntries) {
    const wcaNameNorm = normalizeName(wca.name);
    const wcaLoc = wca.location;
    const isGeneric = GENERIC_NAMES.has(wca.name.trim()) || wcaNameNorm.length === 0;
    const wcaLocNorm = normalizeText(wcaLoc);
    const placeCoords = placeMap.get(wcaLocNorm);
    let bestMatch = null;
    let bestDist = Infinity;

    for (const geo of geoSources) {
      const geoNameNorm = normalizeName(geo.name);
      let nameMatch = false;
      if (geoNameNorm && wcaNameNorm) {
        if (geoNameNorm === wcaNameNorm) nameMatch = true;
        else if (wcaNameNorm.length > 3 && geoNameNorm.includes(wcaNameNorm)) nameMatch = true;
        else if (geoNameNorm.length > 3 && wcaNameNorm.includes(geoNameNorm)) nameMatch = true;
        else {
          const wcaFlat = normalizeForCompare(wca.name);
          const geoFlat = normalizeForCompare(geo.name);
          if (wcaFlat.length > 4 && (wcaFlat === geoFlat || geoFlat.includes(wcaFlat) || wcaFlat.includes(geoFlat))) nameMatch = true;
        }
      }

      const geoLocNorm = geo.location ? normalizeText(geo.location) : '';
      const locTextMatch = geoLocNorm && (geoLocNorm.includes(wcaLocNorm) || wcaLocNorm.includes(geoLocNorm));

      if (isGeneric) {
        if (locTextMatch) {
          let dist = 0;
          if (placeCoords) dist = haversine(geo.lat, geo.lng, placeCoords[0], placeCoords[1]);
          if (dist < bestDist) { bestMatch = geo; bestDist = dist; }
        }
      } else if (nameMatch) {
        if (placeCoords) {
          const dist = haversine(geo.lat, geo.lng, placeCoords[0], placeCoords[1]);
          if (dist < 15000 && dist < bestDist) { bestMatch = geo; bestDist = dist; }
        } else if (locTextMatch) {
          if (bestDist === Infinity) { bestMatch = geo; bestDist = 0; }
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
    const taskDefs = [
      { type: 'sota', fn: fetchSotaData },
      { type: 'pota', fn: fetchPotaData },
      { type: 'hbff', fn: fetchHbffData },
      { type: 'wwbota', fn: fetchWwbotaData },
      { type: 'lighthouse', fn: fetchLighthouseData },
      { type: 'castle', fn: fetchCastleData },
    ];

    const settled = await Promise.allSettled(taskDefs.map(async (t) => {
      const taskStart = Date.now();
      const items = await t.fn();
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

      return { type: t.type, status: 'success', count: items.length, duration_ms: Date.now() - taskStart };
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