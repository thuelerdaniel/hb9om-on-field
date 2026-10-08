import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { recordOwnRun } from '../../shared/sourceRunner.ts';
import {
  calculateCoverage, buildRepeaterParams, BAND_PARAMS, haversineKm,
  bandEstimateCoverage, OPEN_METEO_ELEVATION_URL,
} from '../../shared/coverageCalc.ts';

// Calculate terrain-based coverage for a single repeater or a batch of repeaters.
// Uses SRTM 30m elevation data + LOS + link budget.
// Generates an asymmetric GeoJSON polygon (36/72 radials) and stores it in coverage_polygon.
//
// v0.959-HF2: Batch uses Open-Meteo elevation (100 points/call, 2 concurrent) instead of
// OpenTopoData (1 call/s) — one repeater dropped from ~15s to ~3s. 2 attempts per repeater
// with a 10s timeout; on failure the old polygon is kept and the repeater is requeued
// (needs_recalc=true) so it's retried later instead of being left with no coverage.
// Progress (total/done/remaining) is stored in AppSetting 'repeater_coverage_progress'.

const BATCH_LIMIT_DEFAULT = 10;
const BATCH_LIMIT_MAX = 15;
const TIME_BUDGET_MS = 75000;        // stop starting new repeaters after 75s (< 100s gateway)
const MIN_REMAINING_MS = 25000;     // don't start a new repeater if < 25s budget remains
const ATTEMPT_TIMEOUT_MS = 20000;   // per attempt — Open-Meteo batched fetch + LOS compute
const MAX_ATTEMPTS = 1;             // no retry — failed repeaters are requeued (needs_recalc)
const BATCH_RADIALS = 24;            // fewer radials = fewer elevation points = faster
const DEFAULT_DELAY_MS = 200;
const PROGRESS_KEY = 'repeater_coverage_progress';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
  ]);
}

async function getCoverageProgress(base44: any, scope: string): Promise<{ total: number; done: number; remaining: number }> {
  const scopeFilter = scope === 'all' ? {} : { country_code: scope };
  const totalFilter = { ...scopeFilter, lat: { $ne: null } };
  // v0.959-HF2: count() does not support $or — use coverage_polygon:null (no polygon = not done).
  const pendingFilter = { ...scopeFilter, lat: { $ne: null }, coverage_polygon: null };
  let total = 0, remaining = 0;
  try {
    total = await base44.asServiceRole.entities.Repeater.count(totalFilter);
  } catch {}
  try {
    remaining = await base44.asServiceRole.entities.Repeater.count(pendingFilter);
  } catch {}
  return { total, done: Math.max(0, total - remaining), remaining };
}

async function runBatch(base44: any, body: any): Promise<any> {
  const Rep = base44.asServiceRole.entities.Repeater;
  const start = Date.now();
  const scope = body?.country_code || 'all';
  const scopeFilter = scope === 'all' ? {} : { country_code: scope };
  const batchLimit = Math.min(Math.max(body?.batch_limit || BATCH_LIMIT_DEFAULT, 1), BATCH_LIMIT_MAX);
  const delayMs = body?.delay_ms ?? DEFAULT_DELAY_MS;

  // v0.959-HF2: count/filter don't support $or — fetch needs_recalc and no-polygon
  // separately and merge (dedup by id). Positional filter() form returns an array.
  let queue: any[] = await Rep.filter(
    { ...scopeFilter, lat: { $ne: null }, needs_recalc: true },
    'coverage_updated', batchLimit * 2,
  );
  if (queue.length < batchLimit * 2) {
    const noPoly = await Rep.filter(
      { ...scopeFilter, lat: { $ne: null }, coverage_polygon: null },
      'coverage_updated', Math.max(1, batchLimit * 2 - queue.length),
    );
    const seen = new Set(queue.map((r: any) => r.id));
    for (const r of noPoly) {
      if (!seen.has(r.id)) { queue.push(r); seen.add(r.id); }
    }
  }

  let calculated = 0, fallback = 0, retried = 0, errors = 0, processed = 0;
  const errorDetails: string[] = [];

  for (const r of queue) {
    if (processed >= batchLimit) break;
    if (Date.now() - start > TIME_BUDGET_MS) break;
    if (Date.now() - start > TIME_BUDGET_MS - MIN_REMAINING_MS) break;
    processed++;

    const f_MHz = r.frequency;
    const mode = r.primary_mode || (r.modes?.[0] || 'FM');
    const params = buildRepeaterParams(f_MHz, mode);
    const bandMaxRange = params.params.max_range_flat_km;
    let result: any = null;
    let lastErr = '';
    let okAfterRetry = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        result = await withTimeout(
          calculateCoverage(
            { lat: r.lat, lng: r.lng, elevation_m: r.elevation_m },
            params,
            { radials: BATCH_RADIALS, max_range_km: bandMaxRange, elevationApiUrl: OPEN_METEO_ELEVATION_URL },
          ),
          ATTEMPT_TIMEOUT_MS,
        );
        if (attempt > 0) { retried++; okAfterRetry = true; }
        break;
      } catch (e: any) {
        lastErr = e?.message === 'TIMEOUT' ? `Timeout (>${ATTEMPT_TIMEOUT_MS / 1000}s)` : (e?.message || 'Fehler');
      }
    }

    if (result) {
      const isTerrain = result.coverage_source === 'terrain_los' || result.coverage_source === 'terrain_adjusted';
      try {
        await Rep.update(r.id, {
          coverage_radius_km: result.avg_range_km,
          coverage_source: result.coverage_source,
          coverage_polygon: result.polygon,
          coverage_refinement_pct: isTerrain ? 100 : 30,
          coverage_updated: new Date().toISOString(),
          elevation_m: result.elevation_m,
          terrain_factor: result.terrain_factor,
          needs_recalc: !isTerrain, // band-estimate → requeue for a real terrain pass later
        });
        if (isTerrain) calculated++; else fallback++;
      } catch (e: any) {
        errors++;
        errorDetails.push(`${r.callsign}: save failed — ${e?.message || e}`);
      }
    } else {
      // Keep old polygon (if any), requeue for a later retry.
      try {
        await Rep.update(r.id, {
          needs_recalc: true,
          coverage_updated: new Date().toISOString(),
        });
      } catch {}
      errors++;
      errorDetails.push(`${r.callsign} ${r.frequency}: ${lastErr}`);
    }

    if (delayMs > 0) await new Promise(res => setTimeout(res, delayMs));
  }

  const batchStats = { calculated, fallback, retried, errors, processed, queue_remaining: queue.length - processed };
  const now = new Date().toISOString();
  try {
    const rows = await base44.asServiceRole.entities.AppSetting.filter({ key: PROGRESS_KEY });
    const value = JSON.stringify({ last_run: now, last_batch: batchStats });
    if (rows.length > 0) await base44.asServiceRole.entities.AppSetting.update(rows[0].id, { value });
    else await base44.asServiceRole.entities.AppSetting.create({ key: PROGRESS_KEY, value });
  } catch {}

  const note = `${calculated} terrain, ${fallback} grob${retried ? `, ${retried} retry` : ''}, ${errors} Fehler · ${processed} verarbeitet`;
  return {
    success: true, scope, total: queue.length, ...batchStats,
    duration_ms: Date.now() - start, error_details: errorDetails.slice(0, 10),
    note, count: calculated + fallback,
  };
}

export default async function(req: any): Promise<Response> {
  const start = Date.now();
  let batchMode = false;
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
    const numRadials = body?.radials || 72;
    const maxRangeOverride = body?.max_range_km || null;
    const countryCode = body?.country_code;
    const statsOnly = body?.stats_only === true;

    // ─── Stats-only mode ───
    if (statsOnly) {
      const withCoordsRepeaters = await base44.asServiceRole.entities.Repeater.filter({ lat: { $ne: null } }, '-created_date', 50000);
      let totalRepeaters = 0;
      try {
        const refData = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'repeater' });
        for (const rec of refData) {
          if (rec.total_count && rec.total_count > totalRepeaters) totalRepeaters = rec.total_count;
        }
      } catch {}
      if (totalRepeaters === 0) totalRepeaters = withCoordsRepeaters.length;

      let aprsRefined = 0, terrainAdjusted = 0, calculated = 0, pendingRecalc = 0;
      let refinementSum = 0;
      const countriesSet = new Set();

      for (const r of withCoordsRepeaters) {
        if (r.coverage_source === 'aprs_refined') aprsRefined++;
        if (r.coverage_source === 'terrain_los' || r.coverage_source === 'terrain_adjusted') terrainAdjusted++;
        if (r.coverage_updated != null) calculated++;
        if (r.needs_recalc === true) pendingRecalc++;
        if (r.coverage_refinement_pct != null) refinementSum += r.coverage_refinement_pct;
        if (r.country_code) countriesSet.add(r.country_code);
      }

      const withCoords = withCoordsRepeaters.length;
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
          done: calculated,
          remaining: Math.max(0, withCoords - calculated),
        },
      });
    }

    // ─── Single repeater mode ───
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

      await base44.asServiceRole.entities.Repeater.update(repeaterId, {
        coverage_polygon: null,
        coverage_radius_km: null,
        needs_recalc: true,
      });

      const f_MHz = repeater.frequency;
      const mode = repeater.primary_mode || (repeater.modes?.[0] || 'FM');
      const params = buildRepeaterParams(f_MHz, mode);
      const bandMaxRange = maxRangeOverride || params.params.max_range_flat_km;

      const result = await calculateCoverage(
        { lat: repeater.lat, lng: repeater.lng, elevation_m: repeater.elevation_m },
        params,
        { radials: numRadials, max_range_km: bandMaxRange },
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

    // ─── Batch mode (admin or cron) ───
    batchMode = !body?._runner;
    const trigger = body?.scheduled ? 'scheduled' : 'manual';
    const result = await runBatch(base44, body);
    if (batchMode) await recordOwnRun(base44, 'repeater_coverage', result, Date.now() - start, trigger);
    return Response.json(result);
  } catch (error: any) {
    if (batchMode) {
      try {
        const base44 = createClientFromRequest(req);
        await recordOwnRun(base44, 'repeater_coverage', { error: error.message || String(error), status: 'failed' }, Date.now() - start, 'manual');
      } catch {}
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}