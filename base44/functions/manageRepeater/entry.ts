import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { calculateCoverage, buildRepeaterParams } from '../../shared/coverageCalc.ts';

// Admin-only function to manage individual repeater records.
// Actions:
// - setWebUrl: Set or update the web_url for a repeater (admin can supplement found links)
// - setCoords: Admin manually sets/overrides coordinates for a repeater
// - triggerCoverage: Calculate terrain-LOS coverage for a single repeater directly
//   (uses shared module — NOT functions.invoke — to avoid 524 gateway timeout)

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    let body = req.body;
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      try { body = await req.json(); } catch { body = {}; }
    }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body) body = {};
    const action = body?.action;
    const repeaterId = body?.repeater_id;

    if (!action || !repeaterId) {
      return Response.json({ error: 'action and repeater_id required' }, { status: 400 });
    }

    if (action === 'setWebUrl') {
      const webUrl = body?.web_url || '';
      const updated = await base44.asServiceRole.entities.Repeater.update(repeaterId, { web_url: webUrl });
      return Response.json({ success: true, repeater: updated });
    }

    if (action === 'setCoords') {
      const lat = parseFloat(body?.lat);
      const lng = parseFloat(body?.lng);
      if (isNaN(lat) || isNaN(lng)) {
        return Response.json({ error: 'Valid lat and lng required' }, { status: 400 });
      }
      const updated = await base44.asServiceRole.entities.Repeater.update(repeaterId, {
        lat,
        lng,
        coords_from_locator: false,
      });
      return Response.json({ success: true, repeater: updated });
    }

    if (action === 'triggerCoverage') {
      // Load the repeater record
      const repeater = await base44.asServiceRole.entities.Repeater.get(repeaterId);
      if (!repeater) {
        return Response.json({ error: 'Repeater nicht gefunden' }, { status: 404 });
      }
      if (repeater.lat == null || repeater.lng == null) {
        return Response.json({ error: 'Repeater hat keine Koordinaten — Abdeckung nicht moeglich' }, { status: 400 });
      }

      // Clear old coverage data BEFORE calculating new one
      await base44.asServiceRole.entities.Repeater.update(repeaterId, {
        coverage_polygon: null,
        coverage_radius_km: null,
        needs_recalc: true,
      });

      // Build propagation parameters from frequency and mode
      const f_MHz = repeater.frequency;
      const mode = repeater.primary_mode || (repeater.modes?.[0] || 'FM');
      const params = buildRepeaterParams(f_MHz, mode);
      const bandMaxRange = params.params.max_range_flat_km;

      // Run coverage calculation directly (shared module — no functions.invoke HTTP call)
      const result = await calculateCoverage(
        { lat: repeater.lat, lng: repeater.lng, elevation_m: repeater.elevation_m },
        params,
        { radials: 36, max_range_km: bandMaxRange }
      );

      // Save the calculated coverage to the database
      const refinementPct = result.coverage_source === 'terrain_los' ? 100 : 30;
      await base44.asServiceRole.entities.Repeater.update(repeaterId, {
        coverage_radius_km: result.avg_range_km,
        coverage_source: result.coverage_source,
        coverage_polygon: result.polygon,
        coverage_refinement_pct: refinementPct,
        coverage_updated: new Date().toISOString(),
        elevation_m: result.elevation_m,
        terrain_factor: result.terrain_factor,
        needs_recalc: false,
      });

      return Response.json({
        success: true,
        result: {
          repeater_id: repeaterId,
          coverage_radius_km: result.avg_range_km,
          coverage_source: result.coverage_source,
          coverage_refinement_pct: refinementPct,
          elevation_m: result.elevation_m,
          terrain_factor: result.terrain_factor,
          polygon: result.polygon,
          radials: result.radials.length,
          max_direction: result.max_direction,
          min_direction: result.min_direction,
          terrain_blocked: result.terrain_blocked_count,
          power_limited: result.power_limited_count,
        },
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('manageRepeater error:', error);
    return Response.json({ error: error?.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}