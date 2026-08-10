import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchWwffData } from '../../shared/referenceFetchers.ts';

// WWFF (World Wide Flora & Fauna) — worldwide data source.
// Replaces the former Swiss-only HBFF (hbff.ch) with the global WWFF directory CSV.
// The WWFF CSV contains 40,000+ nature reserves worldwide with coordinates.
// CSV source: https://wwff.co/wwff-data/wwff_directory.csv

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch worldwide WWFF references
    const references = await fetchWwffData();

    // Upsert into ReferenceData (type 'hbff' kept for backward compatibility with logs)
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'hbff' });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
        references,
        total_count: references.length,
        source: 'wwff.co CSV (worldwide)',
        last_updated: now
      });
    } else {
      await base44.asServiceRole.entities.ReferenceData.create({
        type: 'hbff',
        references,
        total_count: references.length,
        source: 'wwff.co CSV (worldwide)',
        last_updated: now
      });
    }

    return Response.json({
      saved: true,
      count: references.length,
      source: 'WWFF directory (worldwide)',
      note: 'Replaces Swiss-only HBFF with global WWFF data'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});