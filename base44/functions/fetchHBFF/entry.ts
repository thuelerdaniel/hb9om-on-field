import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchWwffData } from '../../shared/referenceFetchers.ts';
import { upsertPointsByCode } from '../../shared/pointUpsert.ts';

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

    // Save as individual WwffPoint records — avoids MongoDB's 16MB document limit
    if (references.length > 0) {
      const points = references.map(r => ({
        code: r.code,
        name: r.name || r.code,
        lat: r.lat,
        lng: r.lng,
        link: r.link || 'https://wwff.co/directory/',
      }));
      // v0.9018: Use upsertPointsByCode (parallel, no deletion, resumable) — fixes incomplete WWFF data
      const upsertResult = await upsertPointsByCode(base44, 'WwffPoint', 'hbff', points, 'wwff.co CSV (worldwide)');
      return Response.json({
        saved: true,
        count: upsertResult.created,
        total: upsertResult.total,
        source: 'WWFF directory (worldwide)',
        error: upsertResult.error
      });
    }

    return Response.json({ saved: true, count: 0, source: 'WWFF directory (worldwide)' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});