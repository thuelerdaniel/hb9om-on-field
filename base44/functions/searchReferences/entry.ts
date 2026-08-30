import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Searches cached references (worldwide) by code or name.
// Used by the QSO Log Form autocomplete.
//
// Key finding: $regex on a SINGLE field works, but $or and $gte/$lte on strings do NOT.
// Strategy: two separate filter() calls (code + name), merged and deduped.

const REFERENCE_TYPES = ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse', 'tota', 'llota'];

const POINT_TYPES: Record<string, { entity: string; normalize: (r: any) => any }> = {
  sota: {
    entity: 'SotaPoint',
    normalize: (r) => ({ code: r.code, name: r.name, lat: r.lat, lng: r.lng })
  },
  pota: {
    entity: 'PotaPoint',
    normalize: (r) => ({ code: r.code, reference: r.code, name: r.name, lat: r.lat, lng: r.lng, parkType: r.parkType, active: r.active })
  },
  hbff: {
    entity: 'WwffPoint',
    normalize: (r) => ({ code: r.code, name: r.name, lat: r.lat, lng: r.lng, link: r.link })
  },
  tota: {
    entity: 'TotaPoint',
    normalize: (r) => ({ code: r.code, name: r.name, lat: r.lat, lng: r.lng, type: r.type, subtype: r.subtype })
  },
  llota: {
    entity: 'LlotaRef',
    normalize: (r) => ({ code: r.code, reference: r.code, name: r.name, lat: r.lat, lng: r.lng, country_name: r.country_name, country_code: r.country_code, region: r.region, activation_count: r.activation_count, info_url: r.info_url })
  },
};

// Types stored in ReferenceData.references array (small datasets — safe to load fully)
const REFERENCE_DATA_TYPES = ['wwbota', 'castle', 'iota', 'lighthouse'];

const MAX_PER_TYPE = 20;
const PAGE_SIZE = 5000;
const MAX_PAGES = 8;
const TIME_LIMIT_MS = 10000;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function dedupAndSort(matches: any[], center: any): any[] {
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const m of matches) {
    const code = (m.code || m.reference || '').toLowerCase();
    if (code && !seen.has(code)) {
      seen.add(code);
      deduped.push({
        ...m,
        _distance: center && m.lat != null && m.lng != null
          ? haversine(center.lat, center.lng, m.lat, m.lng)
          : null,
      });
    }
  }
  if (center) {
    deduped.sort((a, b) => (a._distance ?? 9999) - (b._distance ?? 9999));
  }
  return deduped.slice(0, MAX_PER_TYPE).map(({ _distance, ...r }) => r);
}

// Database-level regex search: anchored prefix match (^query) on code + name.
// Anchored regex uses index prefix scan (~200ms); unanchored regex does full scan (29s+).
async function searchWithRegex(base44: any, entityName: string, q: string): Promise<any[]> {
  const allResults: any[] = [];
  const seen = new Set<string>();
  const anchoredQ = '^' + q;

  // Search by code (anchored prefix) — high limit because DB has ~50 duplicate entries per code
  try {
    const codeResults = await base44.asServiceRole.entities[entityName].filter(
      { code: { $regex: anchoredQ } },
      'code',
      1000
    );
    for (const r of (codeResults || [])) {
      const key = r.id || r._id || r.code || JSON.stringify(r);
      if (!seen.has(key)) {
        seen.add(key);
        allResults.push(r);
      }
    }
  } catch {}

  // Skip name search if code search already found enough unique results
  if (allResults.length < MAX_PER_TYPE) {
    try {
      const nameResults = await base44.asServiceRole.entities[entityName].filter(
        { name: { $regex: anchoredQ } },
        'code',
        500
      );
      for (const r of (nameResults || [])) {
        const key = r.id || r._id || r.code || JSON.stringify(r);
        if (!seen.has(key)) {
          seen.add(key);
          allResults.push(r);
        }
      }
    } catch {}
  }

  return allResults;
}

// Paginated scan fallback (for name matches if regex returns nothing, or large datasets)
async function searchPointTypePaginated(base44: any, type: string, q: string, center: any): Promise<any[]> {
  const ptConfig = POINT_TYPES[type];
  if (!ptConfig) return [];

  const matches: any[] = [];
  const startTime = Date.now();

  for (let page = 0; page < MAX_PAGES; page++) {
    if (matches.length >= MAX_PER_TYPE || Date.now() - startTime > TIME_LIMIT_MS) break;

    let points: any[];
    try {
      points = await base44.asServiceRole.entities[ptConfig.entity].list('code', PAGE_SIZE, page * PAGE_SIZE);
    } catch {
      break;
    }

    if (!points || points.length === 0) break;

    for (const r of points) {
      const normalized = ptConfig.normalize(r);
      const code = (normalized.code || '').toLowerCase();
      const name = (normalized.name || '').toLowerCase();
      if (code.includes(q) || name.includes(q)) {
        matches.push(normalized);
        if (matches.length >= MAX_PER_TYPE * 2) break;
      }
    }

    if (points.length < PAGE_SIZE) break;
  }

  return dedupAndSort(matches, center);
}

async function searchPointType(base44: any, type: string, q: string, center: any): Promise<any[]> {
  const ptConfig = POINT_TYPES[type];
  if (!ptConfig) return [];

  // 1. Try database-level regex search (instant)
  const regexResults = await searchWithRegex(base44, ptConfig.entity, q);
  if (regexResults.length > 0) {
    const normalized = regexResults.map(ptConfig.normalize);
    return dedupAndSort(normalized, center);
  }

  // 2. Fall back to paginated scan (if regex returned nothing)
  return searchPointTypePaginated(base44, type, q, center);
}

// Search ReferenceData types (small datasets — safe to load fully from ReferenceData)
async function searchReferenceDataType(base44: any, type: string, q: string, center: any): Promise<any[]> {
  try {
    const records = await base44.asServiceRole.entities.ReferenceData.filter({ type });
    if (!records || records.length === 0) return [];

    const matches: any[] = [];
    for (const rec of records) {
      if (Array.isArray(rec.references)) {
        for (const ref of rec.references) {
          const code = (ref.code || ref.reference || '').toLowerCase();
          const name = (ref.name || '').toLowerCase();
          if (code.includes(q) || name.includes(q)) {
            matches.push({ ...ref, code: ref.code || ref.reference, reference: ref.reference || ref.code });
          }
        }
      }
    }
    return dedupAndSort(matches, center);
  } catch {
    return [];
  }
}

// Search repeaters (separate entity, moderate dataset)
async function searchRepeaters(base44: any, q: string, center: any): Promise<any[]> {
  try {
    // Anchored regex on callsign + location_name
    let repeaters: any[] = [];
    const seen = new Set<string>();
    const anchoredQ = '^' + q;

    try {
      const callResults = await base44.asServiceRole.entities.Repeater.filter(
        { callsign: { $regex: anchoredQ } },
        '-created_date',
        30
      );
      for (const r of (callResults || [])) {
        const key = r.id || r._id || r.callsign;
        if (!seen.has(key)) { seen.add(key); repeaters.push(r); }
      }
    } catch {}

    try {
      const locResults = await base44.asServiceRole.entities.Repeater.filter(
        { location_name: { $regex: anchoredQ } },
        '-created_date',
        30
      );
      for (const r of (locResults || [])) {
        const key = r.id || r._id || r.callsign;
        if (!seen.has(key)) { seen.add(key); repeaters.push(r); }
      }
    } catch {}

    const matches = (repeaters || [])
      .filter(r => r.lat != null && r.lng != null)
      .map(r => ({
        code: r.callsign,
        reference: r.callsign,
        name: `${r.callsign} ${r.frequency != null ? r.frequency.toFixed(4) + ' MHz' : ''}`.trim() + (r.location_name ? ` · ${r.location_name}` : ''),
        lat: r.lat,
        lng: r.lng,
        frequency: r.frequency,
        location_name: r.location_name,
        country: r.country,
        country_code: r.country_code,
        primary_mode: r.primary_mode,
      }));

    return dedupAndSort(matches, center);
  } catch {
    return [];
  }
}

// Search APRS stations (separate entity)
async function searchAprsStations(base44: any, q: string, center: any): Promise<any[]> {
  try {
    let stations: any[] = [];
    const seen = new Set<string>();

    try {
      const callResults = await base44.asServiceRole.entities.AprsStation.filter(
        { callsign: { $regex: '^' + q } },
        '-created_date',
        30
      );
      for (const r of (callResults || [])) {
        const key = r.id || r._id || r.callsign;
        if (!seen.has(key)) { seen.add(key); stations.push(r); }
      }
    } catch {}

    const matches = (stations || [])
      .filter(r => r.lat != null && r.lng != null)
      .map(r => ({
        code: r.callsign,
        reference: r.callsign,
        name: r.callsign + (r.symbol_description ? ` · ${r.symbol_description}` : ''),
        lat: r.lat,
        lng: r.lng,
        station_type: r.station_type,
        symbol: r.symbol,
      }));

    return dedupAndSort(matches, center);
  } catch {
    return [];
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { query, types, center } = body || {};
    console.log(`[searchReferences] query="${query}" types=${JSON.stringify(types)} hasCenter=${!!center}`);

    if (!query || typeof query !== 'string' || query.length < 2) {
      return Response.json({ references: {}, count: 0 });
    }

    const q = query.toLowerCase().trim();
    const qOriginal = query.trim(); // Original case for $regex (codes are uppercase)
    const hasCenter = center && typeof center.lat === 'number' && typeof center.lng === 'number';
    const searchCenter = hasCenter ? center : null;

    const allTypes = Array.isArray(types) && types.length > 0
      ? types
      : [...REFERENCE_TYPES, 'repeater', 'aprs'];

    // Search each type in parallel
    const results = await Promise.all(
      allTypes.map(async (type: string) => {
        try {
          let matches: any[] = [];
          if (type === 'repeater') {
            matches = await searchRepeaters(base44, qOriginal, searchCenter);
          } else if (type === 'aprs') {
            matches = await searchAprsStations(base44, qOriginal, searchCenter);
          } else if (POINT_TYPES[type]) {
            matches = await searchPointType(base44, type, qOriginal, searchCenter);
          } else if (REFERENCE_DATA_TYPES.includes(type)) {
            matches = await searchReferenceDataType(base44, type, q, searchCenter);
          }
          return { type, matches };
        } catch {
          return { type, matches: [] };
        }
      })
    );

    const references: Record<string, any[]> = {};
    let count = 0;
    for (const r of results) {
      references[r.type] = r.matches;
      count += r.matches.length;
    }

    return Response.json({ references, count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}