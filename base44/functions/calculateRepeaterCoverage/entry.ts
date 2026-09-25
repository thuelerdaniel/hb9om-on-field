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
    // 72 radials for smoother, more natural coverage shapes
    const numRadials = body?.radials || 72;
    const maxRangeOverride = body?.max_range_km || null;
    const countryCode = body?.country_code;
    const statsOnly = body?.stats_only === true;

    // --- Stats-only mode: return global coverage statistics without calculating ---
    if (statsOnly) {
      // Fetch ALL repeaters WITH coordinates — those without coords can't be calculated.
      // Use 50000 limit to exceed the default 5000 cap and capture all ~2500+ repeaters.
      const withCoordRepeaters = await base44.asServiceRole.entities.Repeater.filter({ lat: { $ne: null } }, '-created_date', 50000);
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

      // Clear old coverage data BEFORE calculating new one — prevents stale
      // polygon/radius from remaining if the new calculation fails partway through.
      await base44.asServiceRole.entities.Repeater.update(repeaterId, {
        coverage_polygon: null,
        coverage_radius_km: null,
        needs_recalc: true,
      });

      const f_MHz = repeater.frequency;
      const mode = repeater.primary_mode || (repeater.modes?.[0] || 'FM');
      const params = buildRepeaterParams(f_MHz, mode);
      // Use max_range_flat_km (not max_range_terrain_km) as the cap — the actual
      // terrain LOS and link budget will naturally limit the range. For mountain-top
      // repeaters like Säntis (2502m), LOS extends well beyond the terrain-limited cap.
      // The calculateVHFCoverage function also computes a dynamic LOS horizon distance
      // and uses the larger of the two — so high repeaters get proportionally more range.
      const bandMaxRange = maxRangeOverride || params.params.max_range_flat_km;

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
    // BUG 1: Process only repeaters with needs_recalc=true OR without coverage_polygon.
    // Batch of 50 per run with a 250s time budget to stay within the 300s platform timeout.
    const scope = countryCode || 'all';
    // Priority 1: repeaters with needs_recalc=true
    const filterRecalc = scope === 'all'
      ? { lat: { $ne: null }, needs_recalc: true }
      : { country_code: scope, lat: { $ne: null }, needs_recalc: true };
    let repeaters = await base44.asServiceRole.entities.Repeater.filter(filterRecalc, 'coverage_updated', 500);

    // Priority 2: if not enough needs_recalc, also fetch those without coverage_polygon
    if (repeaters.length < 50) {
      const filterNoCov = scope === 'all'
        ? { lat: { $ne: null }, coverage_polygon: null }
        : { country_code: scope, lat: { $ne: null }, coverage_polygon: null };
      const noCovRepeaters = await base44.asServiceRole.entities.Repeater.filter(filterNoCov, 'coverage_updated', 500 - repeaters.length);
      // Merge and deduplicate by id
      const seenIds = new Set(repeaters.map((r: any) => r.id));
      for (const r of noCovRepeaters) {
        if (!seenIds.has(r.id)) { repeaters.push(r); seenIds.add(r.id); }
      }
    }

    let calculated = 0, errors = 0, skipped = 0;
    const errorDetails: string[] = [];
    const startTime = Date.now();
    // v0.955: Batch limit 15 pro Lauf — verteilt Rechenlast über mehrere kleine Läufe statt einem 125s-Lauf der abkippt.
    // Resume-Cursor: needs_recalc=false nach Verarbeitung fungiert als impliziter Cursor — nächste Run holt andere Repeaters.
    const BATCH_LIMIT = body?.batch_limit || 15;
    const TIME_BUDGET_MS = 250000; // 250 seconds
    const delayMs = body?.delay_ms || 500;
    // Use fewer radials in batch mode for speed (36 instead of 72)
    const batchRadials = body?.radials || 36;

    // v0.955: Resume-Cursor in AppSetting — speichert Fortschritt für Report/Visibility
    let progressCursor: any = { last_run: null, total_calculated: 0, estimated_remaining: 0 };
    try {
      const cursorSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'repeater_coverage_progress' });
      if (cursorSettings && cursorSettings.length > 0) {
        progressCursor = JSON.parse(cursorSettings[0].value || '{}');
      }
    } catch {}

    for (const r of repeaters) {
      if (calculated >= BATCH_LIMIT) break;
      // BUG 1: Time budget check — stop if approaching platform timeout
      if (Date.now() - startTime > TIME_BUDGET_MS) break;
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
        const bandMaxRange = params.params.max_range_flat_km;

        const result = await calculateCoverage(
          { lat: r.lat, lng: r.lng, elevation_m: r.elevation_m },
          params,
          { radials: batchRadials, max_range_km: bandMaxRange }
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
        // Note: old coverage is overwritten atomically by the update above.
        // No separate "clear" step needed in batch mode — the update replaces all fields.
        calculated++;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (e: any) {
        errors++;
        errorDetails.push(`${r.callsign} ${r.frequency}: ${e?.message || 'Fehler'}`);
      }
    }

    // v0.955: Resume-Cursor aktualisieren — Fortschritt für nächste Run sichtbar
    progressCursor.last_run = new Date().toISOString();
    progressCursor.total_calculated = (progressCursor.total_calculated || 0) + calculated;
    progressCursor.estimated_remaining = Math.max(0, repeaters.length - calculated);
    try {
      const cursorSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'repeater_coverage_progress' });
      const cursorValue = JSON.stringify(progressCursor);
      if (cursorSettings && cursorSettings.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(cursorSettings[0].id, { value: cursorValue });
      } else {
        await base44.asServiceRole.entities.AppSetting.create({ key: 'repeater_coverage_progress', value: cursorValue });
      }
    } catch {}

    return Response.json({
      success: true, scope, total: repeaters.length,
      calculated, errors, skipped,
      batch_limit: BATCH_LIMIT,
      duration_ms: Date.now() - startTime,
      error_details: errorDetails.slice(0, 10),
      progress: progressCursor,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}