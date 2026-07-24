import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Checks ONLY the connectivity and correct functioning of the data sources that
// refreshAllData actually uses to build reference points on the map.
// It does NOT compare counts or decide "new_data" — that is the job of
// "Daten aktualisieren" (refreshAllData). It also reports references in the cache
// that have no coordinates (data gaps for map reference points).

const REFERENCE_SOURCES = [
  {
    type: 'sota',
    label: 'SOTA – Summits on the Air',
    source: 'api2.sota.org.uk',
    url: 'https://api2.sota.org.uk/api/associations/HB',
    auto_updated: true,
    check: async (resp) => {
      const data = await resp.json();
      if (!data || !Array.isArray(data.regions)) {
        return { ok: false, detail: 'Antwort enthält keine Regionen-Liste' };
      }
      return { ok: true, detail: `${data.regions.length} Regionen erreichbar` };
    },
  },
  {
    type: 'pota',
    label: 'POTA – Parks on the Air',
    source: 'api.pota.app',
    url: 'https://api.pota.app/program/parks/CH',
    auto_updated: true,
    check: async (resp) => {
      const data = await resp.json();
      const count = Array.isArray(data) ? data.length : (data?.parks?.length || 0);
      if (count === 0) return { ok: false, detail: 'Keine Parks in Antwort' };
      return { ok: true, detail: `${count} Parks erreichbar` };
    },
  },
  {
    type: 'hbff',
    label: 'HBFF – Flora & Fauna',
    source: 'hbff.ch',
    url: 'https://hbff.ch/Refs/HBFFReferenceSlim.html',
    auto_updated: true,
    check: async (resp) => {
      const html = await resp.text();
      if (!html.includes('HBFF-')) return { ok: false, detail: 'Referenzliste nicht in HTML gefunden' };
      return { ok: true, detail: 'Referenzliste abrufbar' };
    },
  },
  {
    type: 'wwbota',
    label: 'WWBOTA – Bunkers on the Air',
    source: 'api.wwbota.org',
    url: 'https://api.wwbota.org/bunkers/?format=CSV',
    auto_updated: true,
    check: async (resp) => {
      const csv = await resp.text();
      if (!csv.includes('HBBOTA')) return { ok: false, detail: 'CSV enthält keine HBBOTA-Einträge' };
      return { ok: true, detail: 'CSV abrufbar' };
    },
  },
  {
    type: 'lighthouse',
    label: 'Leuchttürme (ILLW)',
    source: 'wllw.org',
    url: 'https://wllw.org/ILLW-flat.txt',
    auto_updated: true,
    check: async (resp) => {
      const text = await resp.text();
      if (!text.includes('CH00')) return { ok: false, detail: 'Keine Schweizer Leuchttürme (CH00*) in Antwort' };
      return { ok: true, detail: 'Leuchtturm-Liste abrufbar' };
    },
  },
  {
    type: 'castle',
    label: 'Burgen & Schlösser (WCA)',
    source: 'wcagroup.org',
    url: 'https://wcagroup.org/FORMS/WCALIST.ods',
    auto_updated: true,
    check: async (resp) => {
      // Verify it is a valid ODS (ZIP) without downloading the whole file
      const reader = resp.body.getReader();
      const { value } = await reader.read();
      try { reader.releaseLock(); } catch {}
      if (!value || value[0] !== 0x50 || value[1] !== 0x4B) {
        return { ok: false, detail: 'Datei ist kein gültiges ODS/ZIP-Archiv' };
      }
      return { ok: true, detail: 'ODS-Datei abrufbar' };
    },
  },
];

// Geocoding helper sources used by the castle pipeline to supplement coordinates.
const GEOCODING_SOURCES = [
  {
    type: 'osm_overpass',
    label: 'OpenStreetMap Overpass',
    source: 'overpass-api.de',
    url: 'https://overpass-api.de/api/status',
    auto_updated: false,
    check: async (resp) => {
      const text = await resp.text();
      if (!/rate|connected|endpoint/i.test(text)) return { ok: false, detail: 'Status-Antwort unerwartet' };
      return { ok: true, detail: 'Overpass-API erreichbar' };
    },
  },
  {
    type: 'wikidata',
    label: 'Wikidata SPARQL',
    source: 'query.wikidata.org',
    url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent('SELECT ?item WHERE { ?item wdt:P17 wd:Q39 . } LIMIT 1'),
    auto_updated: false,
    check: async (resp) => {
      const data = await resp.json();
      if (!data?.results) return { ok: false, detail: 'Keine SPARQL-Ergebnisstruktur' };
      return { ok: true, detail: 'SPARQL-Endpoint erreichbar' };
    },
  },
  {
    type: 'map_admin_ch',
    label: 'map.geo.admin.ch Search',
    source: 'api3.geo.admin.ch',
    url: 'https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=Bern&type=locations&limit=1',
    auto_updated: false,
    check: async (resp) => {
      const data = await resp.json();
      if (!data?.results || data.results.length === 0) return { ok: false, detail: 'Suche liefert keine Ergebnisse' };
      return { ok: true, detail: 'Geo-Suche erreichbar' };
    },
  },
];

async function attemptFetch(src, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(src.url, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: '*/*' },
      signal: controller.signal,
    });
    if (!resp.ok) return { status: 'error', http_status: resp.status, detail: `HTTP ${resp.status}` };
    const result = await src.check(resp);
    return { status: result.ok ? 'ok' : 'error', http_status: resp.status, detail: result.detail };
  } catch (e) {
    return { status: 'error', http_status: null, detail: e.name === 'AbortError' ? 'Timeout' : (e.message || 'Netzwerkfehler') };
  } finally {
    clearTimeout(timer);
  }
}

async function checkSource(src, timeoutMs = 10000) {
  const start = Date.now();
  let res = await attemptFetch(src, timeoutMs);
  // Single retry ONLY on explicit rate-limiting (429), not on timeouts/network errors
  if (res.status === 'error' && res.http_status === 429) {
    await new Promise(r => setTimeout(r, 1200));
    res = await attemptFetch(src, timeoutMs);
  }
  return {
    type: src.type, label: src.label, source: src.source, url: src.url, auto_updated: src.auto_updated,
    status: res.status, http_status: res.http_status, duration_ms: Date.now() - start, detail: res.detail,
  };
}

// Analyze cached ReferenceData for references without coordinates (data gaps for map points)
function analyzeGaps(cached) {
  const gaps = [];
  for (const entry of (cached || [])) {
    const refs = entry.references || [];
    if (!Array.isArray(refs) || refs.length === 0) continue;
    const withoutCoords = refs.filter(r => r.lat == null || r.lng == null || (typeof r.lat === 'number' && isNaN(r.lat)) || (typeof r.lng === 'number' && isNaN(r.lng)));
    if (withoutCoords.length === 0) continue;
    gaps.push({
      type: entry.type,
      label: TYPE_LABELS[entry.type] || entry.type,
      total: refs.length,
      without_coords: withoutCoords.length,
      references: withoutCoords.slice(0, 50).map(r => ({ code: r.code || r.reference || '', name: r.name || '' })),
    });
  }
  return gaps;
}

const TYPE_LABELS = {
  sota: 'SOTA', pota: 'POTA', hbff: 'HBFF', wwbota: 'WWBOTA',
  castle: 'Burgen/Schlösser', lighthouse: 'Leuchttürme', iota: 'IOTA',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.action !== 'check' && body.action !== undefined) {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const startTime = Date.now();

    // 1. Check connectivity/function of all reference data sources + geocoding helpers
    const [refResults, geoResults, cached] = await Promise.all([
      Promise.all(REFERENCE_SOURCES.map(s => checkSource(s))),
      Promise.all(GEOCODING_SOURCES.map(s => checkSource(s))),
      base44.asServiceRole.entities.ReferenceData.list(),
    ]);

    // 2. Analyze references without coordinates (data gaps for map reference points)
    const gaps = analyzeGaps(cached);
    const totalWithoutCoords = gaps.reduce((sum, g) => sum + g.without_coords, 0);

    const refOk = refResults.filter(r => r.status === 'ok').length;
    const geoOk = geoResults.filter(r => r.status === 'ok').length;
    const refErrors = refResults.filter(r => r.status === 'error').length;
    const geoErrors = geoResults.filter(r => r.status === 'error').length;

    return Response.json({
      checked_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      summary: {
        sources_total: refResults.length,
        sources_ok: refOk,
        sources_errors: refErrors,
        geo_total: geoResults.length,
        geo_ok: geoOk,
        geo_errors: geoErrors,
        gaps_types: gaps.length,
        gaps_without_coords: totalWithoutCoords,
      },
      sources: refResults,
      geocoding: geoResults,
      gaps,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});