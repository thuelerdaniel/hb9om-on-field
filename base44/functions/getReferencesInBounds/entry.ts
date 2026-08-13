import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { loadAllPoints, loadPointsInBounds } from '../../shared/pointUpsert.ts';

// Returns only references within the given map bounds — avoids sending 180k+ worldwide
// references to the client on initial load. The client calls this on map ready and on
// pan/zoom, accumulating results.
//
// SOTA, POTA, and WWFF are stored as individual records (SotaPoint, PotaPoint, WwffPoint)
// to avoid MongoDB's 16MB BSON document limit. Other types (wwbota, castle, iota, lighthouse)
// remain in ReferenceData.references arrays (well under the limit).

const typeCache: Record<string, { refs: any[]; time: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Types stored as individual point entities (not in ReferenceData.references)
const POINT_TYPES: Record<string, { entity: 'SotaPoint' | 'PotaPoint' | 'WwffPoint'; normalize: (r: any) => any }> = {
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
    normalize: (r) => ({
      code: r.code, name: r.name, type: r.type, subtype: r.subtype,
      lat: r.lat, lng: r.lng, country: r.country, country_code: r.country_code,
      source: r.source, usage: r.usage, locator: r.locator,
      height_m: r.height_m, spot_height_m: r.spot_height_m,
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
  // Point types (sota, pota, hbff) — use database-level bounds filtering to avoid
  // loading ALL records (181k SotaPoint exceeds the read traffic volume limit).
  // Falls back to loadAllPoints only if bounds are not provided (e.g. offline cache).
  if (POINT_TYPES[type]) {
    const ptConfig = POINT_TYPES[type];
    if (bounds) {
      const points = await loadPointsInBounds(base44, ptConfig.entity, bounds);
      if (points.length > 0) return points.map(ptConfig.normalize);
      // Fallback: load from ReferenceData (pre-migration data)
      return loadReferenceData(base44, type);
    }
    // No bounds — load all (used by offline cache downloads)
    const points = await loadAllPoints(base44, ptConfig.entity);
    if (points.length > 0) return points.map(ptConfig.normalize);
    return loadReferenceData(base44, type);
  }

  // Non-point types (wwbota, castle, iota, lighthouse) use ReferenceData arrays —
  // these are slower to load, so keep the 10-minute cache.
  const cached = typeCache[type];
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.refs;

  const refs = await loadReferenceData(base44, type);

  // Only cache non-empty results — empty results might be temporary
  if (refs.length > 0) {
    typeCache[type] = { refs, time: Date.now() };
  }
  return refs;
}

const MAX_PER_TYPE = 10000;

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
      : ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse', 'tota'];

    // max_per_type overrides the default cap — used by offline cache downloads to get all points
    const effectiveMax = (typeof max_per_type === 'number' && max_per_type > 0) ? max_per_type : MAX_PER_TYPE;

    // Load each type in parallel with a per-type timeout (3s) — prevents one slow type
    // (e.g. 181k SotaPoint bounds query) from blocking the entire response
    const results = await Promise.all(
      allTypes.map(async (type) => {
        try {
          const typeTimeout = new Promise<any[]>((_, reject) =>
            setTimeout(() => reject(new Error('type_timeout')), 3000)
          );
          const refs = await Promise.race([
            loadType(base44, type, bounds),
            typeTimeout,
          ]);
          if (!refs || refs.length === 0) return { type, filtered: [] };

          const filtered: any[] = [];
          for (const ref of refs) {
            if (ref.lat == null || ref.lng == null) continue;
            if (ref.lat <= bounds.north && ref.lat >= bounds.south &&
                ref.lng >= bounds.west && ref.lng <= bounds.east) {
              filtered.push(ref);
            }
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