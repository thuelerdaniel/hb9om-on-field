import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchIotaData } from '../../shared/referenceFetchers.ts';

// IOTA (Islands on the Air) — worldwide island groups from iota-world.org.
// Fetches the full IOTA list (~1200 island groups) with coordinates.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let references: any[] = [];
    let source = '';

    // Try external IOTA data source
    try {
      references = await fetchIotaData();
      source = 'iota-world.org CSV';
    } catch (e) {
      // Fallback: empty — frontend local data will be used
      references = [];
      source = 'fallback (local data)';
    }

    // Filter out entries without coordinates (can't be displayed on map)
    const withCoords = references.filter(r => r.lat != null && r.lng != null);

    // Upsert into ReferenceData
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'iota' });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
        references: withCoords,
        total_count: withCoords.length,
        source,
        last_updated: now
      });
    } else {
      await base44.asServiceRole.entities.ReferenceData.create({
        type: 'iota',
        references: withCoords,
        total_count: withCoords.length,
        source,
        last_updated: now
      });
    }

    return Response.json({
      saved: true,
      count: withCoords.length,
      source,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});