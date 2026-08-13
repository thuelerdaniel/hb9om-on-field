import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { detectRepeaterCountry, validateCoords } from '../../shared/repeaterCountryDetection.ts';

// One-time cleanup: corrects repeaters that were incorrectly tagged as 'CA'
// (Kanada) but are actually US repeaters (K/N/W callsigns, US state in location,
// or coordinates in the US bounding box). Also nulls out invalid coordinates
// (0,0 = Null Island, out-of-range values).
//
// Root cause: fetchHearhamRepeaters previously assigned country_code 'CA' to ALL
// repeaters in the "canada" bounding box (lat 41-83, lng -141 to -52), which
// includes northern US states (MN, WA, ND, MT, ME, VT, etc.). This function
// fixes the existing data after the sync function was corrected.

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    let totalCA = 0;
    let correctedToUS = 0;
    let invalidCoordsNulled = 0;
    const updates: any[] = [];

    // Paginate through all repeaters with country_code 'CA'
    let skip = 0;
    const BATCH = 5000;
    while (true) {
      const batch = await base44.asServiceRole.entities.Repeater.filter(
        { country_code: 'CA' }, 'id', BATCH, skip,
      );
      if (!batch || batch.length === 0) break;
      totalCA += batch.length;

      for (const r of batch) {
        // Check for invalid coordinates (0,0, out of range → null)
        let needsCoordFix = false;
        if (r.lat != null && r.lng != null) {
          const valid = validateCoords(r.lat, r.lng);
          if (!valid) needsCoordFix = true;
        }

        // Check if country_code should be US instead of CA
        const detected = detectRepeaterCountry(r.callsign, r.lat, r.lng, r.location_name);
        let needsCountryFix = false;
        if (detected.cc === 'US' && r.country_code === 'CA') {
          needsCountryFix = true;
        }

        if (needsCountryFix || needsCoordFix) {
          const update: any = { id: r.id };
          if (needsCountryFix) {
            update.country_code = 'US';
            update.country = 'United States';
            correctedToUS++;
          }
          if (needsCoordFix) {
            update.lat = null;
            update.lng = null;
            invalidCoordsNulled++;
          }
          updates.push(update);
        }
      }

      if (batch.length < BATCH) break;
      skip += BATCH;
    }

    // Apply updates in batches of 500
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      await base44.asServiceRole.entities.Repeater.bulkUpdate(batch);
    }

    return Response.json({
      status: 'success',
      total_ca_repeaters: totalCA,
      corrected_to_us: correctedToUS,
      invalid_coords_nulled: invalidCoordsNulled,
      total_updates_applied: updates.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}