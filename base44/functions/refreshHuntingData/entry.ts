import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from '../../shared/internalAuth.ts';
import {
  fetchDxSpotsInline, fetchPropagationInline,
  fetchSotaSpotsInline, fetchSotaAlertsInline,
  fetchPotaSpotsInline, fetchWwffSpotsInline, fetchGmaSpotsInline,
} from '../../shared/huntingFetchers.ts';

// v0.9025: refreshHuntingData — COMPLETE REWRITE with inline fetch logic.
// No more base44.functions.invoke() sub-function calls (caused 403 Forbidden).
// All fetch logic runs directly via shared huntingFetchers module.
// Uses base44.asServiceRole for ALL entity operations.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const results: any = { dxSpots: null, propagation: null, errors: [] };

    // 1. Cleanup: Delete live spots older than 30 minutes
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      await sr.entities.ActivitySpot.deleteMany({ is_future: false, spot_time: { $lt: thirtyMinAgo } });
    } catch (e: any) { results.errors.push(`cleanup live: ${e.message}`); }

    // 2. Cleanup: Delete expired alerts (is_future: true, spot_time in past)
    try {
      const nowIso = new Date().toISOString();
      await sr.entities.ActivitySpot.deleteMany({ is_future: true, spot_time: { $lt: nowIso } });
    } catch (e: any) { results.errors.push(`cleanup alerts: ${e.message}`); }

    // 3. QRT records: Mark existing spots with "QRT" as inactive
    try {
      const allSpots = await sr.entities.ActivitySpot.list('-spot_time', 500);
      const qrtUpdates = (allSpots || [])
        .filter((s: any) => /\bQRT\b/i.test(s.comments || '') && s.is_active !== false)
        .map((s: any) => ({ id: s.id, is_active: false }));
      if (qrtUpdates.length > 0) {
        await sr.entities.ActivitySpot.bulkUpdate(qrtUpdates);
      }
    } catch {}

    // 4. Delete WWBOTA spots (domain dead)
    try { await sr.entities.ActivitySpot.deleteMany({ activity_type: 'WWBOTA' as any }); } catch {}

    // 5-8. Fetch ALL data sources IN PARALLEL — prevents StartToClose timeout.
    // Previously sequential: 7 API calls + 500+ entity lookups = 380s. Now max(parallel) ≈ 30-60s.
    results.activities = {};
    const parallelFetches: { name: string; key: string; fn: () => Promise<any> }[] = [
      { name: 'dxSpots', key: 'top', fn: () => fetchDxSpotsInline(base44, body) },
      { name: 'propagation', key: 'top', fn: () => fetchPropagationInline(base44) },
      { name: 'sotaSpots', key: 'activities', fn: () => fetchSotaSpotsInline(base44, body) },
      { name: 'sotaAlerts', key: 'activities', fn: () => fetchSotaAlertsInline(base44) },
      { name: 'potaSpots', key: 'activities', fn: () => fetchPotaSpotsInline(base44, body) },
      { name: 'wwffSpots', key: 'activities', fn: () => fetchWwffSpotsInline(base44, body) },
      { name: 'gmaSpots', key: 'activities', fn: () => fetchGmaSpotsInline(base44, body) },
      { name: 'llotaSpots', key: 'activities', fn: async () => {
        const r = await base44.functions.invoke('fetchLlotaSpots', { ...body, scheduled: true });
        return r?.data || r;
      }},
    ];

    const settled = await Promise.allSettled(parallelFetches.map(f => f.fn()));
    for (let i = 0; i < parallelFetches.length; i++) {
      const { name, key } = parallelFetches[i];
      const res = settled[i];
      if (res.status === 'fulfilled') {
        const val = res.value;
        if (key === 'top' && name === 'propagation') {
          results[name] = { success: val.success, bestBand: val.bestBand, solarFlux: val.solarFlux };
        } else if (key === 'top') {
          results[name] = { success: true, saved: val.saved, warning: val.warning || null };
        } else {
          results.activities[name] = { success: true, saved: val?.saved ?? 0, warning: val?.warning || null };
        }
      } else {
        const errMsg = res.reason?.message || String(res.reason);
        if (key === 'top') {
          results[name] = { success: false, error: errMsg };
        } else {
          results.activities[name] = { success: false, error: errMsg };
        }
        results.errors.push(`${name}: ${errMsg}`);
      }
    }

    // 9. Skip loading all activities — frontend loads them separately from DB.
    // Loading here causes rate-limit errors after many entity operations.
    results.allActivities = [];

    // v0.95: success stays true even if individual sources fail (e.g. LLOTA 403).
    // The errors array records which sources failed — the orchestrator itself succeeded.
    return Response.json({
      success: true,
      ...results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}