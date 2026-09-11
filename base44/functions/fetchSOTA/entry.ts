import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchSotaSummits } from '../../shared/sotaFetcher.ts';
import { upsertPointsByCode } from '../../shared/pointUpsert.ts';
import { isInternalCall } from '../../shared/internalAuth.ts';

// SOTA worldwide sync — uses upsertPointsByCode (update in place by code).
// v0.95: Replaced create-all-then-delete-old (caused 450k+ duplicates on timeout).
// Now: load existing by code → update matching, create new. No delete phase = no duplicates.

export default async function(req: any) {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Download CSV and parse all summits
    const result = await fetchSotaSummits('all');
    const allSummits = result.summits;

    if (!allSummits || allSummits.length === 0) {
      return Response.json({ saved: true, count: 0, error: 'CSV leer oder nicht erreichbar' });
    }

    // Map to points
    const points = allSummits.map((s: any) => ({
      code: s.code,
      name: s.name || s.code,
      lat: s.lat,
      lng: s.lng,
      altitude_m: s.alt || 0,
      points: s.points || 0,
    }));

    // Upsert by code — no duplicates, no delete phase
    const upsertResult = await upsertPointsByCode(base44, 'SotaPoint', 'sota', points, 'sotadata.org.uk CSV');

    // Clear old chunked-sync AppSettings (no longer needed)
    try {
      const offsetSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'sota_csv_offset' });
      if (offsetSettings.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(offsetSettings[0].id, { value: '0' });
      }
      const syncStartSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'sota_sync_start_time' });
      if (syncStartSettings.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(syncStartSettings[0].id, { value: '' });
      }
    } catch {}

    return Response.json({
      saved: true,
      created: upsertResult.created,
      updated: upsertResult.updated,
      total: upsertResult.total,
      source: 'sotadata.org.uk CSV',
      error: upsertResult.error,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}