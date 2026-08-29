import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadAllPoints, loadPointsInBounds } from '../../shared/pointUpsert.ts';

// Returns only references within the given map bounds — avoids sending 180k+ worldwide
// references to the client on initial load. The client calls this on map ready and on
// pan/zoom, accumulating results.
//
// SOTA, POTA, and WWFF are stored as individual records (SotaPoint, PotaPoint, WwffPoint)
// to avoid MongoDB's 16MB BSON document limit. Other types (wwbota, castle, iota, lighthouse)
// remain in ReferenceData.references arrays (well under the limit).
// Repeaters are also loaded viewport-based from the Repeater entity.

const typeCache: Record<string, { refs: any[]; time: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Types stored as individual point entities (not in ReferenceData.references)
const POINT_TYPES: Record<string, { entity: 'SotaPoint' | 'PotaPoint' | 'WwffPoint' | 'TotaPoint' | 'IotaPoint' | 'Repeater' | 'PrivateNode' | 'Lighthouse' | 'AprsStation'; normalize: (r: any) => any; sourceFilter?: (r: any) => boolean }> = {
  sota: {
    entity: 'SotaPoint',
    normalize: (r) => ({
      code: r.code, name: r.name, lat: r.lat, lng: r.lng,
      altitude: r.altitude_m, points: r.points,
      // Extract country_code from SOTA code prefix (e.g. "HB/VS-001" → "HB", "I/LO-001" → "I", "W7Y/TT-161" → "W7")
      country_code: r.code ? r.code.split('/')[0] : undefined,
      country: r.code ? r.code.split('/')[0] : undefined,
    })
  },
  pota: {
    entity: 'PotaPoint',
    normalize: (r) => ({
      code: r.code, reference: r.code, name: r.name, lat: r.lat, lng: r.lng,
      parkType: r.parkType, active: r.active,
      // Extract country_code from POTA code prefix (e.g. "US-1504" → "US", "IE-0231" → "IE")
      country_code: r.code ? r.code.split('-')[0] : undefined,
      country: r.code ? r.code.split('-')[0] : undefined,
    })
  },
  hbff: {
    entity: 'WwffPoint',
    normalize: (r) => ({
      code: r.code, name: r.name, lat: r.lat, lng: r.lng, link: r.link,
      // WWFF codes: "DLFF-0001" → "DL", "ZSFF-0439" → "ZS", "HBFF-0001" → "HB"
      // Strip "FF" suffix from prefix to get country code
      country_code: r.code ? r.code.replace(/FF.*/, '').replace(/-.*$/, '') : undefined,
      country: r.code ? r.code.replace(/FF.*/, '').replace(/-.*$/, '') : undefined,
    })
  },
  tota: {
    entity: 'TotaPoint',
    normalize: (r) => ({
      code: r.code, name: r.name, type: r.type, subtype: r.subtype,
      lat: r.lat, lng: r.lng, country: r.country, country_code: r.country_code,
      source: r.source, usage: r.usage, locator: r.locator,
      height_m: r.height_m, spot_height_m: r.spot_height_m,
    })
  },
  iota: {
    entity: 'IotaPoint',
    normalize: (r) => ({
      code: r.code, name: r.name, lat: r.lat, lng: r.lng,
      dxcc_num: r.dxcc_num, status: r.status, island_count: r.island_count,
      pc_credited: r.pc_credited, grp_region: r.grp_region,
      link: 'https://www.iota-world.org/'
    })
  },
  repeater: {
    entity: 'Repeater',
    normalize: (r) => r
  },
  aprs: {
    entity: 'PrivateNode',
    normalize: (r) => r,
    sourceFilter: (r: any) => {
      const src = (r.source || '').toLowerCase();
      return src.includes('aprs') || !src.includes('brandmeister');
    },
  },
  brandmeister: {
    entity: 'PrivateNode',
    normalize: (r) => r,
    sourceFilter: (r: any) => {
      const src = (r.source || '').toLowerCase();
      return src.includes('brandmeister');
    },
  },
  lighthouse: {
    entity: 'Lighthouse',
    normalize: (r) => ({
      name: r.name, lat: r.lat, lng: r.lng,
      country: r.country, country_code: r.country_code,
      continent: r.continent,
      code: r.illw_number, illw_number: r.illw_number,
      illw_active: r.illw_active, illw_year_active: r.illw_year_active,
      illw_callsign: r.illw_callsign, illw_country: r.illw_country,
      dxcc: r.dxcc, source: r.source, link: r.link,
    })
  },
  aprs_station: {
    entity: 'AprsStation',
    normalize: (r) => ({
      callsign: r.callsign, lat: r.lat, lng: r.lng,
      symbol: r.symbol, symbol_description: r.symbol_description,
      station_type: r.station_type, comment: r.comment,
      last_heard: r.last_heard, source_callsign: r.source_callsign,
      is_swiss: r.is_swiss,
      source: 'aprs.fi',
      node_type: r.station_type || 'other',
      country_code: r.is_swiss ? 'CH' : undefined,
    })
  },
};

async function loadReferenceData(base44, type: string): Promise<any[]> {
  const records = await base44.asServiceRole.entities.ReferenceData.filter({ type });
  if (!records || records.length === 0) return [];
  let refs: any[] = [];
  for (const rec of records) {
    if (Array.isArray(rec.references)) refs = refs.concat(rec.references);
  }
  return refs;
}

async function loadType(base44, type: string, bounds?: { north: number; south: number; east: number; west: number }): Promise<any[]> {
  // Point types (sota, pota, hbff, repeater) — use database-level bounds filtering to avoid
  // loading ALL records (181k SotaPoint / 48k Repeater exceeds the read traffic volume limit).
  // Falls back to loadAllPoints only if bounds are not provided (e.g. offline cache).
  if (POINT_TYPES[type]) {
    const ptConfig = POINT_TYPES[type];
    if (bounds) {
      let points = await loadPointsInBounds(base44, ptConfig.entity, bounds);
      if (ptConfig.sourceFilter) {
        points = points.filter(ptConfig.sourceFilter);
      }
      if (points.length > 0) return points.map(ptConfig.normalize);
      // Fallback: load from ReferenceData (pre-migration data) — not for repeaters/private nodes
      if (type !== 'repeater' && type !== 'aprs' && type !== 'brandmeister') return loadReferenceData(base44, type);
      return [];
    }
    // No bounds — load all (used by offline cache downloads)
    let points = await loadAllPoints(base44, ptConfig.entity as any);
    if (ptConfig.sourceFilter) {
      points = points.filter(ptConfig.sourceFilter);
    }
    if (points.length > 0) return points.map(ptConfig.normalize);
    if (type !== 'repeater' && type !== 'aprs' && type !== 'brandmeister') return loadReferenceData(base44, type);
    return [];
  }

  // Non-point types (wwbota, castle, iota) use ReferenceData arrays —
  // these are slower to load, so keep the 10-minute cache.
  // Note: lighthouse is now a point type (Lighthouse entity) — not cached here.
  const cached = typeCache[type];
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.refs;

  const refs = await loadReferenceData(base44, type);

  // Only cache non-empty results — empty results might be temporary
  if (refs.length > 0) {
    typeCache[type] = { refs, time: Date.now() };
  }
  return refs;
}

const MAX_PER_TYPE = 20000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { bounds, types, max_per_type } = body || {};

    if (!bounds || typeof bounds.north !== 'number' || typeof bounds.south !== 'number' ||
        typeof bounds.east !== 'number' || typeof bounds.west !== 'number') {
      return Response.json({ error: 'Valid bounds required {north, south, east, west}' }, { status: 400 });
    }

    const allTypes = Array.isArray(types) && types.length > 0
      ? types
      : ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse', 'tota', 'aprs_station'];

    // max_per_type overrides the default cap — used by offline cache downloads to get all points
    const effectiveMax = (typeof max_per_type === 'number' && max_per_type > 0) ? max_per_type : MAX_PER_TYPE;

    // Load each type in parallel with a per-type timeout (10s) — prevents one slow type
    // (e.g. 181k SotaPoint bounds query) from blocking the entire response
    const results = await Promise.all(
      allTypes.map(async (type) => {
        try {
          const typeTimeout = new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error('type_timeout')), 25000)
          );
          const refs = await Promise.race([
            loadType(base44, type, bounds),
            typeTimeout,
          ]);
          if (!refs || refs.length === 0) return { type, filtered: [] };

          const filtered: any[] = [];
          const seenCodes = new Set<string>(); // Deduplicate by code — WwffPoint has 40k+ records with duplicates
          for (const ref of refs) {
            if (ref.lat == null || ref.lng == null) continue;
            if (ref.lat <= bounds.north && ref.lat >= bounds.south &&
                ref.lng >= bounds.west && ref.lng <= bounds.east) {
              // Deduplicate by code for point types (sota, pota, hbff, tota, iota) —
              // the WwffPoint entity has massive duplicates from repeated sync runs
              const dedupKey = ref.code || ref.reference;
              if (dedupKey && (type === 'sota' || type === 'pota' || type === 'hbff' || type === 'tota' || type === 'iota')) {
                if (seenCodes.has(dedupKey)) continue;
                seenCodes.add(dedupKey);
              }
              filtered.push(ref);
            }
          }
          // Sort by country code before capping — ensures geographic diversity when the cap is hit.
          // Without this, MongoDB's natural order groups records by sync run, and the cap cuts off
          // later countries (e.g. Italy, Nordic) while over-representing earlier ones (e.g. Ireland).
          if (filtered.length > effectiveMax && (type === 'sota' || type === 'pota' || type === 'hbff' || type === 'tota' || type === 'iota')) {
            filtered.sort((a, b) => {
              const ccA = a.country_code || (a.code || '').split(/[/ -]/)[0] || '';
              const ccB = b.country_code || (b.code || '').split(/[/ -]/)[0] || '';
              return ccA.localeCompare(ccB);
            });
          }
          return { type, filtered: filtered.length > effectiveMax ? filtered.slice(0, effectiveMax) : filtered };
        } catch {
          // If one type fails (timeout/memory), others still succeed
          return { type, filtered: [] };
        }
      })
    );

    const references: Record<string, any[]> = {};
    let count = 0;
    for (const { type, filtered } of results) {
      references[type] = filtered;
      count += filtered.length;
    }

    return Response.json({ references, count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}