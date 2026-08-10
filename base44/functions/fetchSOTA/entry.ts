import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchSotaSummits } from '../../shared/sotaFetcher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { associations, maxAssociations } = body;

    const result = await fetchSotaSummits(associations || 'all', maxAssociations);

    // Save worldwide data to ReferenceData (server-side cache) so it persists
    if (result.summits.length > 100) {
      try {
        const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'sota' });
        const refs = result.summits.map(s => ({
          code: s.code, name: s.name, lat: s.lat, lng: s.lng,
          alt: s.alt, points: s.points, activationCount: s.activationCount, region: s.region
        }));
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
            references: refs,
            total_count: refs.length,
            source: 'sotadata.org.uk CSV',
            last_updated: new Date().toISOString()
          });
        } else {
          await base44.asServiceRole.entities.ReferenceData.create({
            type: 'sota',
            references: refs,
            total_count: refs.length,
            source: 'sotadata.org.uk CSV',
            last_updated: new Date().toISOString()
          });
        }
      } catch (e) { /* save failure is non-fatal */ }
    }

    return Response.json({ saved: true, count: result.summits.length, association_count: result.association_count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});