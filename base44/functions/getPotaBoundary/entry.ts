import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from '../../shared/internalAuth.ts';

// Fetches boundary polygons from pota-map.fr (authoritative source).
// Supports POTA, WWFF, and LLOTA references — same API endpoint, same cache.
//
// API: GET https://pota-map.fr/api/boundary/{reference}
// Response: { reference, name, boundary: GeoJSON | null }
//   - GeoJSON MultiPolygon/Polygon, coordinates [lng, lat]
//   - boundary: null when no polygon available (clean "no boundary" signal)
//
// Programs:
//   - pota  (default): POTA parks (e.g. CH-0224, US-0001) → persist to PotaPoint.boundary
//   - wwff:           WWFF reserves (e.g. DLFF-0001, HBFF-0001) → persist to WwffPoint.boundary
//   - llota:          LLOTA lakes (e.g. LLCH-0002) → persist to LlotaRef.polygon
//
// Caching strategy:
//   - PotaBoundaryCache entity stores the raw GeoJSON + converted polygon + has_boundary flag + program
//   - Null results are cached as has_boundary=false (areas without boundaries are never re-fetched)
//   - Successful polygons are also persisted to the program-specific entity for instant frontend loading
//
// Rate limiting: max ~2 requests/second (500ms delay between fetches during prefetch).
//
// Actions:
//   - { reference: "CH-0224", program: "pota" }  → single POTA lookup
//   - { reference: "DLFF-0001", program: "wwff" } → single WWFF lookup
//   - { reference: "LLCH-0002", program: "llota" } → single LLOTA lookup
//   - { action: "prefetch_dach" }                 → prefetch CH/DE/AT/LI POTA parks
//   - { action: "prefetch_dach", limit }          → limit number of parks to prefetch

const API_BASE = 'https://pota-map.fr/api/boundary';
const USER_AGENT = 'HB9OM-OnField/0.951 (amateur radio)';
const CACHE_MAX_AGE_DAYS = 90; // Re-fetch after 90 days
const PREFETCH_DELAY_MS = 550; // ~1.8 req/s — fair to the free service

// Convert GeoJSON [lng, lat] coordinates to [lat, lng] and extract the largest polygon.
function extractLargestPolygon(geojson: any): [number, number][] | null {
  if (!geojson) return null;

  let rings: number[][][] | null = null;

  if (geojson.type === 'Polygon') {
    rings = geojson.coordinates || [];
  } else if (geojson.type === 'MultiPolygon') {
    // Flatten: find the polygon with the most points in its outer ring
    const polygons = geojson.coordinates || [];
    if (polygons.length === 0) return null;
    let largest: number[][] | null = null;
    for (const poly of polygons) {
      const outer = poly[0];
      if (outer && (largest === null || outer.length > largest.length)) {
        largest = outer;
      }
    }
    if (!largest) return null;
    rings = [largest];
  } else {
    return null;
  }

  if (!rings || rings.length === 0) return null;

  // Take the outer ring (first ring) of the polygon
  const outerRing = rings[0];
  if (!outerRing || outerRing.length < 3) return null;

  // GeoJSON [lng, lat] → [lat, lng]
  return outerRing.map((c: number[]) => [c[1], c[0]] as [number, number]);
}

// Simplify polygon to max points (every Nth point + close the ring)
function simplifyPolygon(polygon: [number, number][], maxPoints = 200): [number, number][] {
  if (polygon.length <= maxPoints) return polygon;
  const step = Math.ceil(polygon.length / maxPoints);
  const simplified = polygon.filter((_, i) => i % step === 0);
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first);
  return simplified;
}

// Fetch a single boundary from pota-map.fr
async function fetchFromApi(reference: string): Promise<{ boundary: any; name: string; has_boundary: boolean }> {
  const url = `${API_BASE}/${encodeURIComponent(reference)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.status === 404) {
      return { boundary: null, name: '', has_boundary: false };
    }
    if (!resp.ok) {
      throw new Error(`pota-map.fr returned ${resp.status}`);
    }

    const data = await resp.json();
    const boundary = data.boundary || null;
    const name = data.name || '';
    const has_boundary = boundary != null && (boundary.type === 'Polygon' || boundary.type === 'MultiPolygon');

    return { boundary, name, has_boundary };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// Cache a boundary result in PotaBoundaryCache + program-specific entity
async function cacheResult(
  base44: any,
  reference: string,
  boundary: any,
  name: string,
  has_boundary: boolean,
  program: string = 'pota',
): Promise<[number, number][] | null> {
  let polygon: [number, number][] | null = null;

  if (has_boundary && boundary) {
    polygon = extractLargestPolygon(boundary);
    if (polygon && polygon.length >= 3) {
      polygon = simplifyPolygon(polygon);
    } else {
      has_boundary = false;
      polygon = null;
    }
  }

  // Save to PotaBoundaryCache (shared cache for all programs)
  try {
    const existing = await base44.asServiceRole.entities.PotaBoundaryCache.filter(
      { reference }, undefined, 1, 0,
    );
    const now = new Date().toISOString();
    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.PotaBoundaryCache.update(existing[0].id, {
        boundary: has_boundary ? boundary : null,
        polygon: polygon || [],
        has_boundary,
        park_name: name,
        program,
        fetched_date: now,
      });
    } else {
      await base44.asServiceRole.entities.PotaBoundaryCache.create({
        reference,
        boundary: has_boundary ? boundary : null,
        polygon: polygon || [],
        has_boundary,
        park_name: name,
        program,
        fetched_date: now,
      });
    }
  } catch (e) {
    console.warn(`PotaBoundaryCache save failed for ${reference}:`, e.message);
  }

  // Persist polygon to the program-specific entity for instant frontend loading
  if (polygon && polygon.length >= 3) {
    try {
      if (program === 'wwff') {
        const existingWwff = await base44.asServiceRole.entities.WwffPoint.filter(
          { code: reference }, undefined, 1, 0,
        );
        if (existingWwff && existingWwff.length > 0) {
          await base44.asServiceRole.entities.WwffPoint.update(existingWwff[0].id, {
            boundary: polygon,
            boundary_source: 'pota-map-fr',
          });
        }
      } else if (program === 'llota') {
        const existingLlota = await base44.asServiceRole.entities.LlotaRef.filter(
          { code: reference }, undefined, 1, 0,
        );
        if (existingLlota && existingLlota.length > 0) {
          await base44.asServiceRole.entities.LlotaRef.update(existingLlota[0].id, {
            polygon: polygon,
          });
        }
      } else {
        // Default: POTA
        const existingPota = await base44.asServiceRole.entities.PotaPoint.filter(
          { code: reference }, undefined, 1, 0,
        );
        if (existingPota && existingPota.length > 0) {
          await base44.asServiceRole.entities.PotaPoint.update(existingPota[0].id, {
            boundary: polygon,
            boundary_source: 'pota-map-fr',
          });
        }
      }
    } catch (e) {
      console.warn(`Entity boundary save failed for ${reference} (${program}):`, e.message);
    }
  }

  return polygon;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reference, action, limit, program } = body;
    const prog = (program === 'wwff' || program === 'llota') ? program : 'pota';

    // --- DACH Prefetch: sequential fetch for CH/DE/AT/LI parks ---
    if (action === 'prefetch_dach') {
      const maxParks = limit || 200;
      const prefixes = ['CH-', 'DE-', 'AT-', 'LI-'];

      // Fetch all PotaPoints in batches, filter by DACH prefix
      const dachParks: { code: string; name: string }[] = [];
      for (let skip = 0; dachParks.length < maxParks; skip += 500) {
        const batch = await base44.asServiceRole.entities.PotaPoint.list(
          '-created_date', 500, skip,
        );
        if (!batch || batch.length === 0) break;
        for (const p of batch) {
          if (prefixes.some((pre) => (p.code || '').startsWith(pre))) {
            dachParks.push({ code: p.code, name: p.name || '' });
          }
        }
        if (batch.length < 500) break;
      }

      // Check which parks are already cached
      const cachedRefs = new Set<string>();
      for (let skip = 0; ; skip += 500) {
        const batch = await base44.asServiceRole.entities.PotaBoundaryCache.list(
          '-fetched_date', 500, skip,
        );
        if (!batch || batch.length === 0) break;
        for (const c of batch) cachedRefs.add(c.reference);
        if (batch.length < 500) break;
      }

      const toFetch = dachParks.slice(0, maxParks).filter((p) => !cachedRefs.has(p.code));
      let fetched = 0;
      let withBoundary = 0;
      let errors = 0;

      for (const park of toFetch) {
        try {
          const result = await fetchFromApi(park.code);
          const polygon = await cacheResult(
            base44, park.code, result.boundary, result.name, result.has_boundary,
          );
          fetched++;
          if (result.has_boundary && polygon) withBoundary++;
        } catch (e) {
          errors++;
          console.warn(`Prefetch failed for ${park.code}:`, e.message);
        }
        // Rate limit: ~1.8 req/s
        await new Promise((r) => setTimeout(r, PREFETCH_DELAY_MS));
      }

      return Response.json({
        success: true,
        action: 'prefetch_dach',
        total_dach_parks: dachParks.length,
        already_cached: cachedRefs.size,
        fetched,
        with_boundary: withBoundary,
        errors,
      });
    }

    // --- Single reference lookup ---
    if (!reference || typeof reference !== 'string') {
      return Response.json({ error: 'Missing reference parameter' }, { status: 400 });
    }

    // 1. Check PotaBoundaryCache
    try {
      const cached = await base44.asServiceRole.entities.PotaBoundaryCache.filter(
        { reference }, undefined, 1, 0,
      );
      if (cached && cached.length > 0) {
        const entry = cached[0];
        // Check cache age — re-fetch if older than CACHE_MAX_AGE_DAYS
        const ageDays = entry.fetched_date
          ? (Date.now() - new Date(entry.fetched_date).getTime()) / 86400000
          : Infinity;
        if (ageDays < CACHE_MAX_AGE_DAYS) {
          return Response.json({
            success: true,
            reference,
            polygon: entry.polygon || null,
            has_boundary: entry.has_boundary || false,
            name: entry.park_name || '',
            source: 'pota-map-fr',
            cached: true,
          });
        }
      }
    } catch (e) {
      console.warn(`PotaBoundaryCache lookup failed for ${reference}:`, e.message);
    }

    // 2. Fetch from pota-map.fr
    try {
      const result = await fetchFromApi(reference);
      const polygon = await cacheResult(
        base44, reference, result.boundary, result.name, result.has_boundary, prog,
      );

      return Response.json({
        success: true,
        reference,
        program: prog,
        polygon: polygon,
        has_boundary: result.has_boundary && polygon != null,
        name: result.name,
        source: 'pota-map-fr',
        cached: false,
      });
    } catch (error: any) {
      return Response.json({
        success: false,
        reference,
        has_boundary: false,
        polygon: null,
        error: error.message || 'Failed to fetch from pota-map.fr',
      }, { status: 502 });
    }
  } catch (error: any) {
    return Response.json(
      { error: error.message || 'Unknown error' },
      { status: 500 },
    );
  }
}