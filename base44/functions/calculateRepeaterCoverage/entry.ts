import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  calculateCoverage, buildRepeaterParams, getBandFromFrequency, BAND_PARAMS, haversineKm,
} from '../../shared/coverageCalc.ts';

// Calculate terrain-based coverage for a single repeater or a batch of CH repeaters.
// Uses SRTM 30m elevation data via OpenTopoData API + LOS + link budget.
// Generates an asymmetric GeoJSON polygon (36 radials) and stores it in coverage_polygon.

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => (typeof req.body === 'object' ? req.body : {}));

    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const repeaterId = body?.repeater_id;
    const forceRecalc = body?.force_recalc === true || body?.force === true;
    const numRadials = body?.radials || 36;
    const maxRangeOverride = body?.max_range_km || null;
    const countryCode = body?.country_code;

    // --- Single repeater mode ---
    if (repeaterId) {
      const repeater = await base44.asServiceRole.entities.Repeater.get(repeaterId);
      if (!repeater || repeater.lat == null || repeater.lng == null) {
        return Response.json({ error: 'Repeater nicht gefunden oder keine Koordinaten' }, { status: 404 });
      }

      if (!forceRecalc && repeater.coverage_source === 'terrain_los' && repeater.coverage_updated != null) {
        const ageH = (Date.now() - new Date(repeater.coverage_updated).getTime()) / (1000 * 60 * 60);
        if (ageH < 168) {
          return Response.json({
            repeater_id: repeaterId, skipped: true,
            coverage_radius_km: repeater.coverage_radius_km,
            coverage_source: repeater.coverage_source,
            coverage_polygon: repeater.coverage_polygon,
          });
        }
      }

      const f_MHz = repeater.frequency;
      const mode = repeater.primary_mode || (repeater.modes?.[0] || 'FM');
      const params = buildRepeaterParams(f_MHz, mode);
      const bandMaxRange = maxRangeOverride || params.params.max_range_terrain_km;

      const result = await calculateCoverage(
        { lat: repeater.lat, lng: repeater.lng, elevation_m: repeater.elevation_m },
        params,
        { radials: numRadials, max_range_km: bandMaxRange }
      );

      await base44.asServiceRole.entities.Repeater.update(repeaterId, {
        coverage_radius_km: result.avg_range_km,
        coverage_source: result.coverage_source,
        coverage_polygon: result.polygon,
        coverage_refinement_pct: result.coverage_source === 'terrain_los' ? 100 : 30,
        coverage_updated: new Date().toISOString(),
        elevation_m: result.elevation_m,
        terrain_factor: result.terrain_factor,
        needs_recalc: false,
      });

      return Response.json({
        repeater_id: repeaterId,
        coverage_radius_km: result.avg_range_km,
        coverage_source: result.coverage_source,
        elevation_m: result.elevation_m,
        terrain_factor: result.terrain_factor,
        polygon: result.polygon,
        radials: result.radials.length,
        max_direction: result.max_direction,
        min_direction: result.min_direction,
        terrain_blocked: result.terrain_blocked_count,
        power_limited: result.power_limited_count,
      });
    }

    // --- Batch mode (admin) ---
    const scope = countryCode || 'CH';
    const filter = scope === 'all' ? {} : { country_code: scope };
    const repeaters = await base44.asServiceRole.entities.Repeater.filter(filter, '-created_date', 500);

    let calculated = 0, errors = 0, skipped = 0;
    const errorDetails: string[] = [];
    const startTime = Date.now();

    for (const r of repeaters) {
      if (r.lat == null || r.lng == null) { skipped++; continue; }
      if (!forceRecalc && r.coverage_source === 'terrain_los' && r.coverage_updated != null) {
        const ageH = (Date.now() - new Date(r.coverage_updated).getTime()) / (1000 * 60 * 60);
        if (ageH < 168) { skipped++; continue; }
      }
      try {
        const f_MHz = r.frequency;
        const mode = r.primary_mode || (r.modes?.[0] || 'FM');
        const params = buildRepeaterParams(f_MHz, mode);
        const bandMaxRange = params.params.max_range_terrain_km;

        const result = await calculateCoverage(
          { lat: r.lat, lng: r.lng, elevation_m: r.elevation_m },
          params,
          { radials: numRadials, max_range_km: bandMaxRange }
        );

        await base44.asServiceRole.entities.Repeater.update(r.id, {
          coverage_radius_km: result.avg_range_km,
          coverage_source: result.coverage_source,
          coverage_polygon: result.polygon,
          coverage_refinement_pct: result.coverage_source === 'terrain_los' ? 100 : 30,
          coverage_updated: new Date().toISOString(),
          elevation_m: result.elevation_m,
          terrain_factor: result.terrain_factor,
          needs_recalc: false,
        });
        calculated++;
        await new Promise(resolve => setTimeout(resolve, 3000)); // Rate limit
      } catch (e: any) {
        errors++;
        errorDetails.push(`${r.callsign} ${r.frequency}: ${e?.message || 'Fehler'}`);
      }
    }

    return Response.json({
      success: true, scope, total: repeaters.length,
      calculated, errors, skipped,
      duration_ms: Date.now() - startTime,
      error_details: errorDetails.slice(0, 10),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}