import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchPotaParks } from '../../shared/potaFetcher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { entities, maxEntities } = body;

    const result = await fetchPotaParks(entities || 'all', maxEntities);

    // Save worldwide data to ReferenceData (server-side cache)
    if (result.parks.length > 10) {
      try {
        const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'pota' });
        const refs = result.parks.map(p => ({
          reference: p.reference, name: p.name, lat: p.lat, lng: p.lng,
          locationDesc: p.locationDesc, parkType: p.parkType, active: p.active
        }));
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
            references: refs,
            total_count: refs.length,
            source: 'api.pota.app',
            last_updated: new Date().toISOString()
          });
        } else {
          await base44.asServiceRole.entities.ReferenceData.create({
            type: 'pota',
            references: refs,
            total_count: refs.length,
            source: 'api.pota.app',
            last_updated: new Date().toISOString()
          });
        }
      } catch (e) { /* save failure is non-fatal */ }
    }

    return Response.json({ saved: true, count: result.parks.length, entity_count: result.entity_count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});