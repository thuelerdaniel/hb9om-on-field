import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fetchPotaParks, POTA_ENTITIES } from '../../shared/potaFetcher.ts';
import { upsertPoints } from '../../shared/pointUpsert.ts';
import { isInternalCall } from '../../shared/internalAuth.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    // v0.9025: Allow internal calls (from automation) without auth
    if (!isInternalCall(body)) {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entities, maxEntities } = body;

    // Determine entity codes to fetch
    let entityCodes: string[];
    if (!entities || entities === 'all') {
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
      // Always use the full hardcoded POTA_ENTITIES list as the base, then add any
      // additional entities from the API. The API entity list endpoint is unreliable
      // and sometimes returns only a few entities (e.g. only GB/CH/IE).
      entityCodes = [...new Set([...POTA_ENTITIES, ...apiEntities])];
    } else if (Array.isArray(entities)) {
      entityCodes = entities;
    } else {
      entityCodes = [entities];
    }
    entityCodes = [...new Set(entityCodes)];
    if (maxEntities && maxEntities > 0) {
      entityCodes = entityCodes.slice(0, maxEntities);
    }

    // Fetch all parks worldwide
    const result = await fetchPotaParks(entityCodes);

    // Save as individual PotaPoint records — avoids MongoDB's 16MB document limit
    if (result.parks.length > 0) {
      const points = result.parks.map(p => ({
        code: p.reference,
        name: p.name || p.reference,
        lat: p.lat,
        lng: p.lng,
        parkType: p.parkType || '',
        active: p.active !== false,
      }));
      const upsertResult = await upsertPoints(base44, 'PotaPoint', 'pota', points, 'api.pota.app');
      return Response.json({
        saved: true,
        count: upsertResult.created,
        total: upsertResult.total,
        entity_count: entityCodes.length,
        error: upsertResult.error
      });
    }

    return Response.json({ saved: true, count: 0, entity_count: entityCodes.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});