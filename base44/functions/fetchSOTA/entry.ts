import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchSotaSummits } from '../../shared/sotaFetcher.ts';
import { upsertPoints } from '../../shared/pointUpsert.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { associations, maxAssociations } = body;

    const result = await fetchSotaSummits(associations || 'all', maxAssociations);

    // Save as individual SotaPoint records — avoids MongoDB's 16MB document limit
    // that occurs when storing 180k+ summits in a single ReferenceData.references array.
    if (result.summits.length > 0) {
      const points = result.summits.map(s => ({
        code: s.code,
        name: s.name || s.code,
        lat: s.lat,
        lng: s.lng,
        altitude_m: s.alt || 0,
        points: s.points || 0,
      }));
      const upsertResult = await upsertPoints(base44, 'SotaPoint', 'sota', points, 'sotadata.org.uk CSV');
      return Response.json({
        saved: true,
        count: upsertResult.created,
        total: upsertResult.total,
        association_count: result.association_count,
        error: upsertResult.error
      });
    }

    return Response.json({ saved: true, count: 0, association_count: result.association_count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});