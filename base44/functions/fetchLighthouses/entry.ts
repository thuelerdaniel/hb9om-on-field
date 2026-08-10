import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchLighthouseData } from '../../shared/referenceFetchers.ts';

// Worldwide lighthouse data — fetched from OpenStreetMap (Overpass API).
// Uses 2 continental batches (instead of 5) to avoid timeout.
// Logic lives in base44/shared/referenceFetchers.ts (shared with refreshAllData).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const allLighthouses = await fetchLighthouseData();

    // Upsert into ReferenceData
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'lighthouse' });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
        references: allLighthouses,
        total_count: allLighthouses.length,
        source: 'OSM Overpass (worldwide, 2 batches) + ARLHS WLOL (Swiss verified)',
        last_updated: now
      });
    } else {
      await base44.asServiceRole.entities.ReferenceData.create({
        type: 'lighthouse',
        references: allLighthouses,
        total_count: allLighthouses.length,
        source: 'OSM Overpass (worldwide, 2 batches) + ARLHS WLOL (Swiss verified)',
        last_updated: now
      });
    }

    return Response.json({
      saved: true,
      count: allLighthouses.length,
      source: 'OSM Overpass (worldwide, 2 batches) + ARLHS WLOL (Swiss verified)',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});