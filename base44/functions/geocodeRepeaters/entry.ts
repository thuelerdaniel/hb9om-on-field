import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { parseRepeaterDetail, maidenheadToLatLng } from '../../shared/repeaterScraper.ts';

// Geocode repeaters that lack coordinates.
//
// Strategy (in priority order):
// 1. RepeaterBook detail page — fetch the detail page for repeaters with a source_id.
//    Detail pages contain exact coordinates (Google Maps links) + Maidenhead locator.
//    This gives EXACT coordinates, not city-center approximations.
// 2. Maidenhead locator → lat/lng conversion (if locator exists but coords don't)
// 3. Nominatim/OSM geocoding from location_name + country (city-level accuracy)
//
// Rate limits:
// - RepeaterBook detail pages: fetched in parallel batches of 10 (no strict rate limit)
// - Nominatim: 1 request per second (non-commercial use policy)
//
// This function processes a limited number per call to stay within the 30s timeout.
// The admin can trigger it multiple times to process more.

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const RATE_LIMIT_MS = 1100;
const DETAIL_BATCH = 10;
const DETAIL_FETCH_TIMEOUT = 5000;
const MAX_DETAIL_PER_CALL = 40;
const MAX_NOMINATIM_PER_CALL = 10;
const BATCH_SIZE = 5000;

const ROW_DETAIL_BASE = 'https://www.repeaterbook.com/row_repeaters/details.php';
const NA_DETAIL_BASE = 'https://www.repeaterbook.com/repeaters/details.php';

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Fetch coordinates from a RepeaterBook detail page.
// Returns { lat, lng, locator } or null if no coordinates found.
async function fetchDetailCoords(
  sourceId: string,
  countryCode: string,
  isNA: boolean,
): Promise<{ lat: number; lng: number; locator: string | null } | null> {
  const url = isNA
    ? `${NA_DETAIL_BASE}?state_id=${countryCode}&country_code=${countryCode}&ID=${sourceId}`
    : `${ROW_DETAIL_BASE}?state_id=${countryCode}&ID=${sourceId}`;
  const html = await fetchWithTimeout(url, DETAIL_FETCH_TIMEOUT);
  if (!html) return null;
  const detail = parseRepeaterDetail(html);
  if (detail.lat != null && detail.lng != null) {
    return { lat: detail.lat, lng: detail.lng, locator: detail.locator };
  }
  // Detail page might have a locator but no direct coords — convert locator
  if (detail.locator) {
    const coords = maidenheadToLatLng(detail.locator);
    if (coords) return { lat: coords[0], lng: coords[1], locator: detail.locator };
  }
  return null;
}

async function geocodePlace(query: string, countryCode?: string): Promise<{ lat: number; lng: number } | null> {
  try {
    let url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    if (countryCode && countryCode.length === 2) {
      url += `&countrycodes=${countryCode.toLowerCase()}`;
    }
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  } catch {}
  return null;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
      }
    }

    const startTime = Date.now();
    const countryCodeFilter = body.country_code || null;

    // Step 1: Fetch repeaters without coordinates (lat = null)
    const unmatched: any[] = [];
    const seenIds = new Set<string>();
    let skip = 0;
    const filterQuery: any = countryCodeFilter
      ? { lat: null, country_code: countryCodeFilter }
      : { lat: null };
    for (let i = 0; i < 20; i++) {
      const batch = await base44.asServiceRole.entities.Repeater.filter(filterQuery, 'id', BATCH_SIZE, skip);
      if (!batch || batch.length === 0) break;
      for (const r of batch) {
        if (r.id && !seenIds.has(r.id)) {
          seenIds.add(r.id);
          unmatched.push(r);
        }
      }
      skip += batch.length;
      if (batch.length < BATCH_SIZE) break;
    }

    if (unmatched.length === 0) {
      return Response.json({
        status: 'success',
        message: 'Keine Relais ohne Koordinaten gefunden',
        geocoded: 0,
        total_unmatched: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Step 2: Try RepeaterBook detail pages for repeaters with source_id
    // Non-NA repeaters (CH, DE, FR, etc.) use the row_repeaters detail URL.
    // NA repeaters (US, CA, MX) use the repeaters detail URL but need a state_id
    // we don't store — skip those for detail fetch, use Nominatim instead.
    const NA_COUNTRIES = new Set(['US', 'CA', 'MX']);
    const detailCandidates = unmatched.filter(
      (r) => r.source_id && r.country_code && !NA_COUNTRIES.has(r.country_code),
    );
    const detailToFetch = detailCandidates.slice(0, MAX_DETAIL_PER_CALL);

    let detailCoordsCount = 0;
    const detailUpdates: any[] = [];
    for (let i = 0; i < detailToFetch.length; i += DETAIL_BATCH) {
      const batch = detailToFetch.slice(i, i + DETAIL_BATCH);
      const results = await Promise.all(
        batch.map(async (r) => {
          const coords = await fetchDetailCoords(r.source_id, r.country_code, false);
          return { rep: r, coords };
        }),
      );
      for (const { rep, coords } of results) {
        if (coords) {
          detailUpdates.push({
            id: rep.id,
            lat: coords.lat,
            lng: coords.lng,
            locator: coords.locator || rep.locator || '',
            coords_from_locator: coords.locator ? true : false,
            coords_geocoded: false,
          });
          detailCoordsCount++;
        }
      }
    }

    // Bulk update detail-fetched coordinates
    for (let i = 0; i < detailUpdates.length; i += 100) {
      const batch = detailUpdates.slice(i, i + 100);
      try {
        await base44.asServiceRole.entities.Repeater.bulkUpdate(batch);
      } catch {}
    }

    // Step 3: For remaining repeaters (no source_id, NA repeaters, or failed detail fetch)
    // fall back to Nominatim geocoding from location_name + country.
    const detailIds = new Set(detailUpdates.map((u) => u.id));
    const remaining = unmatched.filter((r) => !detailIds.has(r.id));

    // Group by unique location_name + country_code
    const placeMap = new Map<string, any[]>();
    for (const rep of remaining) {
      const placeName = (rep.location_name || '').trim();
      const country = (rep.country || rep.country_code || '').trim();
      if (!placeName && !country) continue;
      const query = [placeName, country].filter(Boolean).join(', ');
      if (!query) continue;
      if (!placeMap.has(query)) placeMap.set(query, []);
      placeMap.get(query)!.push(rep);
    }

    const uniquePlaces = Array.from(placeMap.keys());
    const toGeocode = uniquePlaces.slice(0, MAX_NOMINATIM_PER_CALL);

    const geocodedPlaces = new Map<string, { lat: number; lng: number }>();
    for (const place of toGeocode) {
      const placeReps = placeMap.get(place) || [];
      const cc = placeReps[0]?.country_code || '';
      const coords = await geocodePlace(place, cc);
      if (coords) geocodedPlaces.set(place, coords);
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    // Update Nominatim-geocoded repeaters
    let nominatimCount = 0;
    const nominatimUpdates: any[] = [];
    for (const [place, coords] of geocodedPlaces) {
      const repeaters = placeMap.get(place) || [];
      for (const rep of repeaters) {
        nominatimUpdates.push({
          id: rep.id,
          lat: coords.lat,
          lng: coords.lng,
          coords_geocoded: true,
        });
      }
    }
    for (let i = 0; i < nominatimUpdates.length; i += 100) {
      const batch = nominatimUpdates.slice(i, i + 100);
      try {
        await base44.asServiceRole.entities.Repeater.bulkUpdate(batch);
        nominatimCount += batch.length;
      } catch {}
    }

    return Response.json({
      status: 'success',
      detail_page_coords: detailCoordsCount,
      nominatim_coords: nominatimCount,
      total_geocoded: detailCoordsCount + nominatimCount,
      total_unmatched: unmatched.length,
      detail_candidates: detailCandidates.length,
      detail_fetched: detailToFetch.length,
      nominatim_places: uniquePlaces.length,
      nominatim_processed: toGeocode.length,
      nominatim_remaining: Math.max(0, uniquePlaces.length - toGeocode.length),
      duration_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    return Response.json({
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}