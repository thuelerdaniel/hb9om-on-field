import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from "../../shared/internalAuth.ts";
import { fetchLakePolygon } from "../../shared/llotaPolygonFetcher.ts";

// Batch-fetches lake polygons for LLOTA references that don't have one yet.
// Processes lakes in priority order:
//   1. Swiss lakes first (SwissTopo API — fast, reliable)
//   2. Then worldwide lakes via Overpass/OSM (slower, rate-limited)
//
// Parameters:
//   limit       — max lakes to process per call (default 15, max 50)
//   swiss_only — if true, only process Swiss lakes (default false)
//   force      — if true, re-fetch even for lakes with existing polygons (default false)
//
// The function is designed to be called repeatedly (via automation or manual
// trigger) to gradually fill in polygons for all 8357 LLOTA references.
// Each call processes a small batch to avoid timeouts and rate limits.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    const limit = Math.min(Math.max(parseInt(body.limit) || 15, 1), 50);
    const swissOnly = body.swiss_only === true;
    const force = body.force === true;

    // Fetch all LLOTA refs with pagination (8357 total, max 5000 per call)
    const allRefs: any[] = [];
    let hasMore = true;
    let skip = 0;
    while (hasMore && skip < 10000) {
      const page = await base44.asServiceRole.entities.LlotaRef.list('-created_date', 5000, skip);
      if (!page || page.length === 0) { hasMore = false; break; }
      allRefs.push(...page);
      hasMore = page.length === 5000;
      skip += page.length;
    }

    // Filter: refs without polygons (or all if force=true)
    let refsToProcess = allRefs.filter(r => {
      if (force) return true;
      return !r.polygon || !Array.isArray(r.polygon) || r.polygon.length <= 2;
    });

    // Swiss lakes first: lat 45.8-47.9, lng 5.9-10.6
    const swissLakes = refsToProcess.filter(r =>
      r.lat >= 45.8 && r.lat <= 47.9 && r.lng >= 5.9 && r.lng <= 10.6
    );
    const worldLakes = refsToProcess.filter(r =>
      !(r.lat >= 45.8 && r.lat <= 47.9 && r.lng >= 5.9 && r.lng <= 10.6)
    );

    // Prioritize Swiss lakes, then worldwide
    let batch: any[] = [];
    if (swissOnly) {
      batch = swissLakes.slice(0, limit);
    } else {
      // First process Swiss lakes, then fill with worldwide
      const swissBatch = swissLakes.slice(0, Math.min(limit, swissLakes.length));
      const remainingSlots = limit - swissBatch.length;
      const worldBatch = remainingSlots > 0 ? worldLakes.slice(0, remainingSlots) : [];
      batch = [...swissBatch, ...worldBatch];
    }

    if (batch.length === 0) {
      // Check remaining counts for status report
      const totalWithout = refsToProcess.length;
      const swissWithout = swissLakes.length;
      const worldWithout = worldLakes.length;
      return Response.json({
        success: true,
        message: 'No lakes to process — all polygons already cached',
        processed: 0,
        remaining: totalWithout,
        remainingSwiss: swissWithout,
        remainingWorld: worldWithout,
      });
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const results: any[] = [];
    const errors: any[] = [];

    for (const ref of batch) {
      try {
        const result = await fetchLakePolygon(ref.lat, ref.lng, ref.name || '');

        if (result.polygon && result.polygon.length >= 3) {
          // Cache the polygon in the entity
          try {
            await base44.asServiceRole.entities.LlotaRef.update(ref.id, {
              polygon: result.polygon,
            });
            succeeded++;
            results.push({
              code: ref.code,
              name: ref.name,
              source: result.source,
              polygonPoints: result.polygon.length,
            });
          } catch (e: any) {
            failed++;
            errors.push({ code: ref.code, error: `Update failed: ${e?.message || e}` });
          }
        } else {
          failed++;
          errors.push({ code: ref.code, error: result.error || 'No polygon found' });
        }
        processed++;
      } catch (e: any) {
        failed++;
        errors.push({ code: ref.code, error: e?.message || 'Unknown error' });
        processed++;
      }

      // Small delay between Overpass requests to avoid rate limiting
      // (SwissTopo doesn't need delays, but Overpass does)
      if (!isInSwissBounds(ref.lat, ref.lng)) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Count remaining for status
    const remainingSwiss = swissLakes.length - batch.filter(r =>
      r.lat >= 45.8 && r.lat <= 47.9 && r.lng >= 5.9 && r.lng <= 10.6
    ).length;
    const remainingWorld = worldLakes.length - batch.filter(r =>
      !(r.lat >= 45.8 && r.lat <= 47.9 && r.lng >= 5.9 && r.lng <= 10.6)
    ).length;

    return Response.json({
      success: true,
      processed,
      succeeded,
      failed,
      remainingSwiss: Math.max(0, remainingSwiss),
      remainingWorld: Math.max(0, remainingWorld),
      results: results.slice(0, 20),
      errors: errors.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}

function isInSwissBounds(lat: number, lng: number): boolean {
  return lat >= 45.8 && lat <= 47.9 && lng >= 5.9 && lng <= 10.6;
}