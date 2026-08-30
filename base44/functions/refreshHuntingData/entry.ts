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

    // 5. Fetch DX Spots (inline — no sub-function call)
    try {
      const dxResult = await fetchDxSpotsInline(base44, body);
      results.dxSpots = { success: true, saved: dxResult.saved, warning: dxResult.warning };
    } catch (e: any) {
      results.dxSpots = { success: false, error: e.message };
      results.errors.push(`fetchDxSpots: ${e.message}`);
    }

    // 6. Fetch Propagation (inline)
    try {
      const propResult = await fetchPropagationInline(base44);
      results.propagation = { success: propResult.success, bestBand: propResult.bestBand, solarFlux: propResult.solarFlux };
    } catch (e: any) {
      results.propagation = { success: false, error: e.message };
      results.errors.push(`fetchPropagation: ${e.message}`);
    }

    // 7. Fetch Activity Spots (all inline — no sub-function calls)
    results.activities = {};
    const activityFetches: { name: string; fn: () => Promise<any> }[] = [
      { name: 'sotaSpots', fn: () => fetchSotaSpotsInline(base44, body) },
      { name: 'sotaAlerts', fn: () => fetchSotaAlertsInline(base44) },
      { name: 'potaSpots', fn: () => fetchPotaSpotsInline(base44, body) },
      { name: 'wwffSpots', fn: () => fetchWwffSpotsInline(base44, body) },
      { name: 'gmaSpots', fn: () => fetchGmaSpotsInline(base44, body) },
    ];

    for (const { name, fn } of activityFetches) {
      try {
        const result = await fn();
        results.activities[name] = { success: true, saved: result.saved, warning: result.warning || null };
      } catch (e: any) {
        results.activities[name] = { success: false, error: e.message };
        results.errors.push(`${name}: ${e.message}`);
      }
    }

    // 8. Fetch LLOTA Spots (via sub-function call — isInternalCall allows it)
    try {
      const llotaResp = await base44.functions.invoke('fetchLlotaSpots', { ...body, scheduled: true });
      const llotaData = llotaResp?.data || llotaResp;
      results.activities.llotaSpots = { success: true, saved: llotaData?.saved || 0, warning: llotaData?.warning || null };
    } catch (e: any) {
      results.activities.llotaSpots = { success: false, error: e.message };
      results.errors.push(`llotaSpots: ${e.message}`);
    }

    // 9. Skip loading all activities — frontend loads them separately from DB.
    // Loading here causes rate-limit errors after many entity operations.
    results.allActivities = [];

    return Response.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}