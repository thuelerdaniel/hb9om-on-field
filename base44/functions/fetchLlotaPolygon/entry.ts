import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from "../../shared/internalAuth.ts";
import { fetchLakePolygon } from "../../shared/llotaPolygonFetcher.ts";

// Fetches the actual lake outline (polygon) for a single LLOTA reference.
// The polygon is cached in the LlotaRef entity for subsequent requests.
// Uses the shared llotaPolygonFetcher module (also used by the batch function).

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, lat, lng, name } = body;
    if (!code || lat == null || lng == null) {
      return Response.json({ error: 'Missing code, lat, or lng' }, { status: 400 });
    }

    // Check if polygon is already cached in the entity
    let existingId: string | null = null;
    try {
      const existing = await base44.asServiceRole.entities.LlotaRef.filter({ code });
      if (existing && existing.length > 0) {
        existingId = existing[0].id;
        if (existing[0].polygon && Array.isArray(existing[0].polygon) && existing[0].polygon.length > 2) {
          return Response.json({
            success: true,
            code,
            polygon: existing[0].polygon,
            cached: true,
          });
        }
      }
    } catch {}

    // Fetch polygon using shared module
    const result = await fetchLakePolygon(lat, lng, name || '');

    if (!result.polygon || result.polygon.length < 3) {
      return Response.json({
        success: false,
        error: result.error || 'No water body found near coordinates',
        code, lat, lng,
      }, { status: 404 });
    }

    // Cache the polygon in the entity
    if (existingId) {
      try {
        await base44.asServiceRole.entities.LlotaRef.update(existingId, {
          polygon: result.polygon,
        });
      } catch {}
    }

    return Response.json({
      success: true,
      code,
      polygon: result.polygon,
      source: result.source,
      cached: false,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}