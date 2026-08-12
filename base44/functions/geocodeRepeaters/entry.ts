import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Geocode repeaters that lack coordinates by using their location_name + country
// as a search query against the OpenStreetMap Nominatim API.
//
// Nominatim rate limit: 1 request per second (for non-commercial use).
// This function processes up to `maxGeocodes` unique place names per call
// (default 25 — stays within the 30s function timeout with 1.1s delay per request).
// The admin can trigger it multiple times to process more.
//
// Repeateers that get geocoded are marked with coords_from_locator=true
// (imprecise — city-level accuracy, not exact repeater site).

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const RATE_LIMIT_MS = 1100; // 1.1s between requests (Nominatim allows 1/s)
const MAX_GEOCODES_PER_CALL = 25;
const BATCH_SIZE = 5000;

async function geocodePlace(query: string, countryCode?: string): Promise<{ lat: number; lng: number } | null> {
  try {
    let url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
    // Restrict results to the repeater's country — dramatically improves accuracy
    // for US/CA repeaters where city names are ambiguous (e.g., "Springfield" exists in 30+ states)
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

    // Authorization: only admins can trigger geocoding
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
      }
    }

    const maxGeocodes = Math.min(body.maxGeocodes || MAX_GEOCODES_PER_CALL, 30);
    const startTime = Date.now();

    // Step 1: Fetch ALL repeaters without coordinates using skip-based pagination.
    // _id cursor pagination doesn't work on this platform — use skip/offset with id sort.
    // 30000+ repeaters may lack coordinates; fetch all to get complete unique place list.
    const unmatched: any[] = [];
    const seenIds = new Set<string>();
    let skip = 0;
    for (let i = 0; i < 20; i++) {
      const batch = await base44.asServiceRole.entities.Repeater.filter({ lat: null }, 'id', BATCH_SIZE, skip);
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

    // Step 2: Group by unique location_name + country_code
    const placeMap = new Map<string, any[]>();
    for (const rep of unmatched) {
      const placeName = (rep.location_name || '').trim();
      const country = (rep.country || rep.country_code || '').trim();
      if (!placeName && !country) continue;
      const query = [placeName, country].filter(Boolean).join(', ');
      if (!query) continue;
      if (!placeMap.has(query)) placeMap.set(query, []);
      placeMap.get(query)!.push(rep);
    }

    const uniquePlaces = Array.from(placeMap.keys());
    const toGeocode = uniquePlaces.slice(0, maxGeocodes);

    // Step 3: Geocode each unique place name (with rate limiting)
    // Pass the country_code from the first repeater for this place to restrict
    // Nominatim results to the correct country — critical for US/CA where city
    // names like "Springfield" exist in many states.
    const geocodedPlaces = new Map<string, { lat: number; lng: number }>();
    for (const place of toGeocode) {
      const placeReps = placeMap.get(place) || [];
      const cc = placeReps[0]?.country_code || '';
      const coords = await geocodePlace(place, cc);
      if (coords) geocodedPlaces.set(place, coords);
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }

    // Step 4: Update repeaters with geocoded coordinates
    let updatedCount = 0;
    const updates: any[] = [];
    for (const [place, coords] of geocodedPlaces) {
      const repeaters = placeMap.get(place) || [];
      for (const rep of repeaters) {
        updates.push({
          id: rep.id,
          lat: coords.lat,
          lng: coords.lng,
          coords_from_locator: true,
          coords_geocoded: true,
        });
      }
    }

    // Bulk update in batches of 100
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      try {
        await base44.asServiceRole.entities.Repeater.bulkUpdate(batch);
        updatedCount += batch.length;
      } catch {}
    }

    return Response.json({
      status: 'success',
      geocoded: geocodedPlaces.size,
      updated_repeaters: updatedCount,
      total_unmatched: unmatched.length,
      unique_places: uniquePlaces.length,
      places_processed: toGeocode.length,
      places_remaining: Math.max(0, uniquePlaces.length - toGeocode.length),
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