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
  const sparqlQuery = `SELECT ?item ?itemLabel ?coord WHERE {
    { ?item wdt:P31/wdt:P279* wd:Q23413 . } UNION { ?item wdt:P31/wdt:P279* wd:Q57821 . } UNION { ?item wdt:P31/wdt:P279* wd:Q1763828 . }
    ?item wdt:P17 wd:Q39 . ?item wdt:P625 ?coord .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en,fr,it" . }
  } LIMIT 2000`;
  const resp = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' }
  });
  if (!resp.ok) throw new Error('Wikidata SPARQL failed');
  const data = await resp.json();
  const bindings = data.results?.bindings || [];
  const seen = new Set();
  const castles = [];
  let codeNum = 1;
  for (const b of bindings) {
    const uri = b.item?.value || '';
    if (seen.has(uri)) continue;
    seen.add(uri);
    const match = (b.coord?.value || '').match(/Point\(([\d.-]+)\s+([\d.-]+)\)/);
    if (!match) continue;
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (isNaN(lat) || isNaN(lng)) continue;
    castles.push({ code: `HB-W${String(codeNum).padStart(4, '0')}`, name: b.itemLabel?.value || `Castle`, lat, lng, link: uri });
    codeNum++;
  }
  return castles;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}

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

    await base44.asServiceRole.entities.SyncLog.create({
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