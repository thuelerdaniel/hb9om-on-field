import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchPotaParks, POTA_ENTITIES } from '../../shared/potaFetcher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { entities, maxEntities } = body;

    // Determine entity codes to fetch
    let entityCodes: string[];
    if (!entities || entities === 'all') {
      // Try API entity list first
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
    if (maxEntities && maxEntities > 0) {
      entityCodes = entityCodes.slice(0, maxEntities);
    }

    // Load existing ReferenceData to merge with (prevents data loss on timeout)
    let existingRef: any = null;
    let allParks: any[] = [];
    try {
      const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'pota' });
      if (existing && existing.length > 0) {
        existingRef = existing[0];
        allParks = existing[0].references || [];
      }
    } catch {}
    const existingRefs = new Set(allParks.map((p: any) => p.reference));

    // Fetch in small batches, saving after each batch.
    // This prevents data loss if the function times out before reaching all continents.
    const BATCH_SIZE = 12;
    let batchesCompleted = 0;

    for (let i = 0; i < entityCodes.length; i += BATCH_SIZE) {
      const chunk = entityCodes.slice(i, i + BATCH_SIZE);
      try {
        const result = await fetchPotaParks(chunk);
        let newCount = 0;
        for (const park of result.parks) {
          if (!existingRefs.has(park.reference)) {
            allParks.push(park);
            existingRefs.add(park.reference);
            newCount++;
          }
        }
        batchesCompleted++;

        // Save after each batch (merge with existing data)
        if (allParks.length > 10) {
          try {
            const refs = allParks.map(p => ({
              reference: p.reference, name: p.name, lat: p.lat, lng: p.lng,
              locationDesc: p.locationDesc, parkType: p.parkType, active: p.active
            }));
            if (existingRef) {
              await base44.asServiceRole.entities.ReferenceData.update(existingRef.id, {
                references: refs,
                total_count: refs.length,
                source: 'api.pota.app',
                last_updated: new Date().toISOString()
              });
            } else {
              existingRef = await base44.asServiceRole.entities.ReferenceData.create({
                type: 'pota',
                references: refs,
                total_count: refs.length,
                source: 'api.pota.app',
                last_updated: new Date().toISOString()
              });
            }
          } catch (e) { /* save failure is non-fatal */ }
        }
      } catch { /* batch failure — continue with next batch */ }
    }

    return Response.json({
      saved: true,
      count: allParks.length,
      entity_count: entityCodes.length,
      batches_completed: batchesCompleted
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});