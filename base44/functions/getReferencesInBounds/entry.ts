import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { loadAllPoints, loadPointsInBounds } from '../../shared/pointUpsert.ts';

// Returns only references within the given map bounds — avoids sending 180k+ worldwide
// references to the client on initial load. The client calls this on map ready and on
// pan/zoom, accumulating results.
//
// Accepts BOTH:
//   - types: string[]         (e.g. ["sota", "pota", "aprs"])
//   - entityType: string      (e.g. "AprsStation" or "sota" — single type)
//
// Each type maps to a specific entity. Returns data under the requested type key.
// Deduplicates by record ID (not just code) to prevent the same point appearing dozens of times.

const typeCache: Record<string, { refs: any[]; time: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Entity name aliases — allows callers to pass either the type key or the entity name
const TYPE_ALIASES: Record<string, string> = {
  'SotaPoint': 'sota',
  'PotaPoint': 'pota',
  'WwffPoint': 'hbff',
  'TotaPoint': 'tota',
  'IotaPoint': 'iota',
  'Lighthouse': 'lighthouse',
  'AprsStation': 'aprs',
  'Repeater': 'repeater',
  'PrivateNode': 'brandmeister',
};

// Types stored as individual point entities (not in ReferenceData.references)
const POINT_TYPES: Record<string, { entity: 'SotaPoint' | 'PotaPoint' | 'WwffPoint' | 'TotaPoint' | 'IotaPoint' | 'Repeater' | 'PrivateNode' | 'Lighthouse' | 'AprsStation'; normalize: (r: any) => any; sourceFilter?: (r: any) => boolean; dedupField: string }> = {
  sota: {
    entity: 'SotaPoint',
    dedupField: 'code',
    normalize: (r) => ({
      code: r.code, name: r.name, lat: r.lat, lng: r.lng,
      altitude: r.altitude_m, points: r.points,
      country_code: r.code ? r.code.split('/')[0] : undefined,
      country: r.code ? r.code.split('/')[0] : undefined,
    })
  },
  pota: {
    entity: 'PotaPoint',
    dedupField: 'code',
    normalize: (r) => ({
      code: r.code, reference: r.code, name: r.name, lat: r.lat, lng: r.lng,
      parkType: r.parkType, active: r.active,
      country_code: r.code ? r.code.split('-')[0] : undefined,
      country: r.code ? r.code.split('-')[0] : undefined,
    })
  },
  hbff: {
    entity: 'WwffPoint',
    dedupField: 'code',
    normalize: (r) => ({
      code: r.code, name: r.name, lat: r.lat, lng: r.lng, link: r.link,
      country_code: r.code ? r.code.replace(/FF.*/, '').replace(/-.*$/, '') : undefined,
      country: r.code ? r.code.replace(/FF.*/, '').replace(/-.*$/, '') : undefined,
    })
  },
  tota: {
    entity: 'TotaPoint',
    dedupField: 'code',
    normalize: (r) => ({
      code: r.code, name: r.name, type: r.type, subtype: r.subtype,
      lat: r.lat, lng: r.lng, country: r.country, country_code: r.country_code,
      source: r.source, usage: r.usage, locator: r.locator,
      height_m: r.height_m, spot_height_m: r.spot_height_m,
    })
  },
  iota: {
    entity: 'IotaPoint',
    dedupField: 'code',
    normalize: (r) => ({
      code: r.code, name: r.name, lat: r.lat, lng: r.lng,
      dxcc_num: r.dxcc_num, status: r.status, island_count: r.island_count,
      pc_credited: r.pc_credited, grp_region: r.grp_region,
      link: 'https://www.iota-world.org/'
    })
  },
  repeater: {
    entity: 'Repeater',
    dedupField: 'id',
    normalize: (r) => r
  },
  // "aprs" maps to AprsStation entity (actual APRS stations from aprs.fi)
  aprs: {
    entity: 'AprsStation',
    dedupField: 'callsign',
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
  // "brandmeister" maps to PrivateNode entity (DMR hotspots/nodes)
  brandmeister: {
    entity: 'PrivateNode',
    dedupField: 'callsign',
    normalize: (r) => r,
    sourceFilter: (r: any) => {
      const src = (r.source || '').toLowerCase();
      return src.includes('brandmeister');
    },
  },
  lighthouse: {
    entity: 'Lighthouse',
    dedupField: 'illw_number',
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
  if (POINT_TYPES[type]) {
    const ptConfig = POINT_TYPES[type];
    if (bounds) {
      let points = await loadPointsInBounds(base44, ptConfig.entity, bounds);
      if (ptConfig.sourceFilter) {
        points = points.filter(ptConfig.sourceFilter);
      }
      if (points.length > 0) return points.map(ptConfig.normalize);
      if (type !== 'repeater' && type !== 'aprs' && type !== 'brandmeister') return loadReferenceData(base44, type);
      return [];
    }
    let points = await loadAllPoints(base44, ptConfig.entity as any);
    if (ptConfig.sourceFilter) {
      points = points.filter(ptConfig.sourceFilter);
    }
    if (points.length > 0) return points.map(ptConfig.normalize);
    if (type !== 'repeater' && type !== 'aprs' && type !== 'brandmeister') return loadReferenceData(base44, type);
    return [];
  }

  // Non-point types (wwbota, castle) use ReferenceData arrays
  const cached = typeCache[type];
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.refs;

  const refs = await loadReferenceData(base44, type);

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
    let { bounds, types, entityType, max_per_type } = body || {};

    if (!bounds || typeof bounds.north !== 'number' || typeof bounds.south !== 'number' ||
        typeof bounds.east !== 'number' || typeof bounds.west !== 'number') {
      return Response.json({ error: 'Valid bounds required {north, south, east, west}' }, { status: 400 });
    }

    // Accept entityType as alternative to types — convert to types array
    // entityType can be the entity name (e.g. "AprsStation") or the type key (e.g. "aprs")
    let allTypes: string[];
    if (Array.isArray(types) && types.length > 0) {
      allTypes = types.map((t: string) => TYPE_ALIASES[t] || t);
    } else if (typeof entityType === 'string' && entityType.length > 0) {
      allTypes = [TYPE_ALIASES[entityType] || entityType];
    } else {
      allTypes = ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse', 'tota', 'aprs'];
    }

    const effectiveMax = (typeof max_per_type === 'number' && max_per_type > 0) ? max_per_type : MAX_PER_TYPE;

    // Load each type in parallel with a per-type timeout (25s)
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
          const seenKeys = new Set<string>(); // Deduplicate by dedupField (code/callsign/id)
          const ptConfig = POINT_TYPES[type];
          const dedupField = ptConfig?.dedupField || 'code';
          for (const ref of refs) {
            if (ref.lat == null || ref.lng == null) continue;
            if (ref.lat <= bounds.north && ref.lat >= bounds.south &&
                ref.lng >= bounds.west && ref.lng <= bounds.east) {
              // Deduplicate by the configured field for ALL types
              const dedupKey = ref[dedupField] || ref.code || ref.callsign || ref.id;
              if (dedupKey) {
                if (seenKeys.has(dedupKey)) continue;
                seenKeys.add(dedupKey);
              }
              filtered.push(ref);
            }
          }
          // Sort by country code before capping — ensures geographic diversity
          if (filtered.length > effectiveMax && (type === 'sota' || type === 'pota' || type === 'hbff' || type === 'tota' || type === 'iota')) {
            filtered.sort((a, b) => {
              const ccA = a.country_code || (a.code || '').split(/[/ -]/)[0] || '';
              const ccB = b.country_code || (b.code || '').split(/[/ -]/)[0] || '';
              return ccA.localeCompare(ccB);
            });
          }
          return { type, filtered: filtered.length > effectiveMax ? filtered.slice(0, effectiveMax) : filtered };
        } catch {
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