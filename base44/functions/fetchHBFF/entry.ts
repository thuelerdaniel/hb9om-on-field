import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchWwffData } from '../../shared/referenceFetchers.ts';
import { upsertPointsByCode } from '../../shared/pointUpsert.ts';
import { isInternalCall } from '../../shared/internalAuth.ts';

// WWFF (World Wide Flora & Fauna) — worldwide data source.
// v0.95: Uses upsertPointsByCode (update in place by code) — no more duplicates on timeout.
// CSV source: https://wwff.co/wwff-data/wwff_directory.csv

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch worldwide WWFF references
    const references = await fetchWwffData();

    if (references.length > 0) {
      const points = references.map((r: any) => ({
        code: r.code,
        name: r.name || r.code,
        lat: r.lat,
        lng: r.lng,
        link: r.link || 'https://wwff.co/directory/',
      }));
      // v0.95: upsertPointsByCode — update in place by code, no duplicates
      const upsertResult = await upsertPointsByCode(base44, 'WwffPoint', 'hbff', points, 'wwff.co CSV (worldwide)');
      return Response.json({
        saved: true,
        created: upsertResult.created,
        updated: upsertResult.updated,
        total: upsertResult.total,
        source: 'WWFF directory (worldwide)',
        error: upsertResult.error
      });
    }

    return Response.json({ saved: true, count: 0, source: 'WWFF directory (worldwide)' });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});