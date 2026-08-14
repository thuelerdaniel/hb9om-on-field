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
    const statsOnly = body?.stats_only === true;

    // --- Stats-only mode: return global coverage statistics without calculating ---
    if (statsOnly) {
      // Fetch repeaters WITH coordinates only — those without coords can't be calculated.
      const withCoordRepeaters = await base44.asServiceRole.entities.Repeater.filter({ lat: { $ne: null } }, '-created_date', 500);
      // Also fetch total count from ReferenceData for the "total" display
      let totalRepeaters = 0;
      try {
        const refData = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'repeater' });
        for (const rec of refData) {
          if (rec.total_count && rec.total_count > totalRepeaters) totalRepeaters = rec.total_count;
        }
      } catch {}
      if (totalRepeaters === 0) totalRepeaters = withCoordRepeaters.length;

      let withCoords = withCoordRepeaters.length, aprsRefined = 0, terrainAdjusted = 0, calculated = 0, pendingRecalc = 0;
      let refinementSum = 0;
      const countriesSet = new Set();

      for (const r of withCoordRepeaters) {
        if (r.coverage_source === 'aprs_refined') aprsRefined++;
        if (r.coverage_source === 'terrain_los' || r.coverage_source === 'terrain_adjusted') terrainAdjusted++;
        if (r.coverage_updated != null) calculated++;
        if (r.needs_recalc === true) pendingRecalc++;
        if (r.coverage_refinement_pct != null) refinementSum += r.coverage_refinement_pct;
        if (r.country_code) countriesSet.add(r.country_code);
      }

      const avgRefinementPct = withCoords > 0 ? Math.round((refinementSum / withCoords) * 10) / 10 : 0;

      return Response.json({
        global: {
          totalRepeaters,
          withCoords,
          aprsRefined,
          terrainAdjusted,
          calculated,
          pendingRecalc,
          avgRefinementPct,
          countriesCovered: countriesSet.size,
        },
      });
    }

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

    // --- Batch mode (admin or cron) ---
    // Worldwide coverage: process repeaters that haven't been calculated yet (oldest/null first).
    // This ensures all repeaters get coverage within ~1 year of daily cron runs.
    // A specific country can be requested via country_code; 'all' or omitting it processes worldwide.
    const scope = countryCode || 'all';
    // Filter for repeaters WITH coordinates — those without can't be coverage-calculated.
    // Sort by coverage_updated ASCENDING — null/oldest first, so uncalculated repeaters
    // are prioritized. This ensures the cron job progresses through all repeaters over time.
    const filter = scope === 'all'
      ? { lat: { $ne: null } }
      : { country_code: scope, lat: { $ne: null } };
    const repeaters = await base44.asServiceRole.entities.Repeater.filter(filter, 'coverage_updated', 500);

    let calculated = 0, errors = 0, skipped = 0;
    const errorDetails: string[] = [];
    const startTime = Date.now();
    // Batch limit per run — keeps within function timeout. fetchElevations already
    // rate-limits internally (250ms between 100-point batches), so 1s between repeaters
    // is sufficient. ~50 repeaters per run × 365 daily runs = 18,250/year.
    const BATCH_LIMIT = body?.batch_limit || 50;
    const delayMs = body?.delay_ms || 1000;

    for (const r of repeaters) {
      if (calculated >= BATCH_LIMIT) break;
      if (r.lat == null || r.lng == null) { skipped++; continue; }
      // Skip if already has terrain_los coverage newer than 168h (7 days) unless forced.
      // This prevents recalculating the same repeaters every run.
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
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (e: any) {
        errors++;
        errorDetails.push(`${r.callsign} ${r.frequency}: ${e?.message || 'Fehler'}`);
      }
    }

    return Response.json({
      success: true, scope, total: repeaters.length,
      calculated, errors, skipped,
      batch_limit: BATCH_LIMIT,
      duration_ms: Date.now() - startTime,
      error_details: errorDetails.slice(0, 10),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}