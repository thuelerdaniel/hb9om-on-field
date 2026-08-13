import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  detectCountryFromCallsign,
  coordsInCountry,
  validateCoords,
  validateRepeaterGeo,
} from '../../shared/repeaterCountryDetection.ts';
import { maidenheadToLatLng } from '../../shared/repeaterScraper.ts';

// Comprehensive one-time cleanup for repeater geo data:
// 1. Null out (0,0) Null Island coordinates
// 2. Convert Maidenhead locators to lat/lng for repeaters with locator but no coords
// 3. Validate country_code against coordinates + callsign — fix mismatches
// 4. Null out coordinates that don't match any known country (likely garbage)
//
// Processes in batches to stay within the 30s function timeout.
// Admin can trigger multiple times to process more.

const BATCH_SIZE = 5000;
const MAX_PROCESS = 20000; // Per call — keeps within timeout

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
    const stats = {
      null_island_fixed: 0,
      locator_converted: 0,
      country_fixed: 0,
      coords_nulled: 0,
      total_processed: 0,
      total_scanned: 0,
    };

    // Step 1: Fix Null Island (0,0) coordinates
    const nullIsland = await base44.asServiceRole.entities.Repeater.filter({ lat: 0, lng: 0 }, 'id', 5000);
    if (nullIsland && nullIsland.length > 0) {
      const updates = nullIsland.map((r: any) => ({ id: r.id, lat: null, lng: null }));
      for (let i = 0; i < updates.length; i += 100) {
        try {
          await base44.asServiceRole.entities.Repeater.bulkUpdate(updates.slice(i, i + 100));
        } catch {}
      }
      stats.null_island_fixed = nullIsland.length;
    }

    // Step 2: Convert locators to coordinates for repeaters with locator but no lat/lng
    const noCoordsWithLocator = await base44.asServiceRole.entities.Repeater.filter(
      { lat: null, locator: { $ne: '' } }, 'id', 5000,
    );
    if (noCoordsWithLocator && noCoordsWithLocator.length > 0) {
      const updates: any[] = [];
      for (const r of noCoordsWithLocator) {
        if (!r.locator) continue;
        const coords = maidenheadToLatLng(r.locator);
        if (coords && validateCoords(coords[0], coords[1])) {
          updates.push({
            id: r.id,
            lat: coords[0],
            lng: coords[1],
            coords_from_locator: true,
          });
        }
      }
      for (let i = 0; i < updates.length; i += 100) {
        try {
          await base44.asServiceRole.entities.Repeater.bulkUpdate(updates.slice(i, i + 100));
        } catch {}
      }
      stats.locator_converted = updates.length;
    }

    // Step 3: Validate country codes against coordinates + callsign
    // Scan all repeaters with coordinates and check for mismatches
    const seenIds = new Set<string>();
    let skip = 0;
    let processed = 0;
    for (let page = 0; page < 20 && processed < MAX_PROCESS; page++) {
      const batch = await base44.asServiceRole.entities.Repeater.list('id', BATCH_SIZE, skip);
      if (!batch || batch.length === 0) break;
      skip += batch.length;
      stats.total_scanned += batch.length;

      const updates: any[] = [];
      for (const r of batch) {
        if (seenIds.has(r.id)) continue;
        seenIds.add(r.id);
        processed++;
        stats.total_processed++;

        if (!r.lat || !r.lng) continue; // Skip repeaters without coords

        // Skip invalid coords
        if (!validateCoords(r.lat, r.lng)) {
          updates.push({ id: r.id, lat: null, lng: null });
          stats.coords_nulled++;
          continue;
        }

        // Validate country against coords + callsign
        const correction = validateRepeaterGeo(
          r.callsign || '',
          r.lat,
          r.lng,
          r.country_code || '',
          r.location_name || '',
        );

        if (correction) {
          if (correction.mismatch_type === 'null_island') {
            updates.push({ id: r.id, lat: null, lng: null });
            stats.coords_nulled++;
          } else if (correction.mismatch_type === 'coords_outside_country_no_fix') {
            // Can't determine correct country — null out coords
            updates.push({ id: r.id, lat: null, lng: null });
            stats.coords_nulled++;
          } else if (correction.corrected_cc !== r.country_code) {
            // Fix the country code
            updates.push({ id: r.id, country_code: correction.corrected_cc });
            stats.country_fixed++;
          }
        }
      }

      // Apply updates in batches of 100
      for (let i = 0; i < updates.length; i += 100) {
        try {
          await base44.asServiceRole.entities.Repeater.bulkUpdate(updates.slice(i, i + 100));
        } catch {}
      }

      if (batch.length < BATCH_SIZE) break;
    }

    return Response.json({
      status: 'success',
      ...stats,
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