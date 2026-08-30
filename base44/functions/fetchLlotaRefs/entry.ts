import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { upsertPoints } from '../../shared/pointUpsert.ts';
import { isInternalCall } from '../../shared/internalAuth.ts';

// Fetch LLOTA references (8.357 worldwide) + country stats from llota.app API.
// Single API call for all references (~5.6MB), no pagination needed.
// Uses upsertPoints for safe full-refresh (create new first, then delete old).

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch all references (single call, ~5.6MB)
    let refs: any[] = [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      const resp = await fetch('https://llota.app/api/public/references', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        const bodyText = await resp.text().catch(() => '').then(t => t.substring(0, 300));
        return Response.json({ error: `LLOTA API HTTP ${resp.status}: ${bodyText}` }, { status: 502 });
      }
      refs = await resp.json();
      if (!Array.isArray(refs)) refs = [];
    } catch (e: any) {
      return Response.json({ error: `LLOTA fetch error: ${e?.message || e}` }, { status: 502 });
    }

    // 2. Fetch country stats
    let stats: any[] = [];
    try {
      const statsResp = await fetch('https://llota.app/api/public/countries-stats', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' },
      });
      if (statsResp.ok) {
        stats = await statsResp.json();
        if (!Array.isArray(stats)) stats = [];
      }
    } catch {}

    // 3. Upsert country stats into LlotaCountry
    let countriesSaved = 0;
    if (stats.length > 0) {
      try {
        // Delete old country records first (small dataset, safe to replace)
        await base44.asServiceRole.entities.LlotaCountry.deleteMany({});
        const countryRecords = stats.map((c: any) => ({
          code: c.code || '',
          name: c.name || '',
          flag_image_url: c.flag_image_url || '',
          is_dxcc_entity: c.is_dxcc_entity || 0,
          parent_country_code: c.parent_country_code || '',
          total_references: c.total_references || 0,
          total_activations: c.total_activations || 0,
          last_synced: new Date().toISOString(),
        })).filter((c: any) => c.code);
        // BulkCreate in batches of 100
        for (let i = 0; i < countryRecords.length; i += 100) {
          const batch = countryRecords.slice(i, i + 100);
          try {
            await base44.asServiceRole.entities.LlotaCountry.bulkCreate(batch);
            countriesSaved += batch.length;
          } catch {}
        }
      } catch (e: any) {
        console.error('[fetchLlotaRefs] country upsert error:', e?.message);
      }
    }

    // 4. Normalize references to match existing entity pattern (code, lat, lng)
    const points = refs.map((r: any) => ({
      code: r.reference_code || '',
      name: r.name || r.reference_code || '',
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      region: r.region || '',
      grid_locator: r.grid_locator || '',
      description: (r.description || '').substring(0, 1000),
      access_info: r.access_info || '',
      info_url: r.info_url || '',
      country_name: r.country_name || '',
      country_code: r.country_code || '',
      activation_count: r.activation_count || 0,
      last_synced: new Date().toISOString(),
    })).filter((p: any) => p.code && !isNaN(p.lat) && !isNaN(p.lng));

    // 5. Upsert references using shared upsertPoints (safe full-refresh)
    const upsertResult = await upsertPoints(base44, 'LlotaRef', 'llota', points, 'llota.app');

    return Response.json({
      success: true,
      fetched: refs.length,
      saved: upsertResult.created,
      total: upsertResult.total,
      countries: stats.length,
      countriesSaved,
      error: upsertResult.error,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}