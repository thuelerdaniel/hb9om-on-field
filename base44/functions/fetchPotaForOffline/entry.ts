import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchPotaParks, POTA_ENTITIES } from '../../shared/potaFetcher.ts';

// Fetches POTA park data directly from the POTA API for offline caching.
// Bypasses the SDK's 6500-record database read limit by going straight to the source API.
// Accepts: { entities: "all" | string[] } — array of POTA entity codes (ISO2 country codes).
// Returns: { parks: [...], count, entity_count, source }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { entities } = body;

    let entityCodes: string[];
    if (!entities || entities === 'all' || (Array.isArray(entities) && entities.length === 0)) {
      // Fetch all entities worldwide
      let apiEntities: string[] = [];
      try {
        const listResp = await fetch('https://api.pota.app/program/entities', {
          headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' }
        });
        if (listResp.ok) {
          const listData = await listResp.json();
          apiEntities = (Array.isArray(listData) ? listData : (listData.entities || []))
            .map((e: any) => e.entityCode || e.code || e)
            .filter((c: any) => typeof c === 'string' && c.length > 0);
        }
      } catch { /* API entity list broken — use hardcoded fallback */ }
      entityCodes = apiEntities.length > 0 ? [...new Set(apiEntities)] : POTA_ENTITIES;
    } else if (Array.isArray(entities)) {
      entityCodes = entities;
    } else {
      entityCodes = [entities];
    }
    entityCodes = [...new Set(entityCodes)];

    const result = await fetchPotaParks(entityCodes);

    return Response.json({
      parks: result.parks,
      count: result.parks.length,
      entity_count: entityCodes.length,
      source: result.source
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}