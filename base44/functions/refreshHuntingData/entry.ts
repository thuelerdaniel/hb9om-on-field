import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall, getInternalSecret } from '../../shared/internalAuth.ts';

// Fix v0.9032: refreshHuntingData orchestrator — calls sub-functions via
// base44.functions.invoke() (standard SDK method, same as runDailySyncBatch).
// The SDK handles auth and routing internally — no 403/404 issues.
// Sub-functions receive { scheduled: true, internal_secret } in the body,
// which bypasses their per-user auth check (isInternalCall / scheduled flag).

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

    const results: any = { dxSpots: null, propagation: null, errors: [] };

    // Fix v0.9031: ActivitySpot Cleanup VOR dem Speichern neuer Spots
    // 1. Lösche Live-Spots älter als 30 Minuten (is_future: false)
    try {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        is_future: false,
        spot_time: { $lt: thirtyMinAgo },
      });
    } catch (e: any) { results.errors.push(`cleanup live: ${e.message}`); }

    // 2. Lösche veraltete Alerts (is_future: true, spot_time in Vergangenheit)
    try {
      const nowIso = new Date().toISOString();
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        is_future: true,
        spot_time: { $lt: nowIso },
      });
    } catch (e: any) { results.errors.push(`cleanup alerts: ${e.message}`); }

    // Fix v0.9031: QRT-Records — bestehende Records mit "QRT" in comments auf is_active: false setzen
    try {
      const allSpots = await base44.asServiceRole.entities.ActivitySpot.list('-spot_time', 500);
      const qrtUpdates = (allSpots || [])
        .filter((s: any) => /\bQRT\b/i.test(s.comments || '') && s.is_active !== false)
        .map((s: any) => ({ id: s.id, is_active: false }));
      if (qrtUpdates.length > 0) {
        await base44.asServiceRole.entities.ActivitySpot.bulkUpdate(qrtUpdates);
      }
    } catch {}

    // Fix v0.9031: WWBOTA entfernen (Domain wwbota.ch tot — keine DNS-Einträge mehr)
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({ activity_type: 'WWBOTA' as any });
    } catch {}
    // DataSourceStatus für WWBOTA auf ERROR/INACTIVE setzen
    try {
      const existing = await base44.asServiceRole.entities.DataSourceStatus.filter({ source_name: 'WWBOTA' });
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.DataSourceStatus.update(existing[0].id, {
          status: 'FAIL',
          is_active: false,
          last_check: new Date().toISOString(),
          error_message: 'Domain wwbota.ch tot — Dienst nicht mehr verfügbar',
        });
      }
    } catch {}

    const internalSecret = getInternalSecret();

    // Fix v0.9031: Use base44.functions.invoke (standard SDK) instead of HTTP fetch.
    // The SDK handles auth and routing internally — no 403/404 issues.
    const callSubFunction = async (functionName: string, payload: any): Promise<any> => {
      return await base44.functions.invoke(functionName, { ...payload, internal_secret: internalSecret });
    };

    // fetchDxSpots
    try {
      const dxRaw = await callSubFunction('fetchDxSpots', { scheduled: true });
      const dxData = dxRaw?.data || dxRaw;
      results.dxSpots = {
        success: dxData?.success ?? true,
        saved: dxData?.saved ?? 0,
        warning: dxData?.warning || null,
      };
    } catch (e: any) {
      results.errors.push(`fetchDxSpots: ${e.message || 'failed'}`);
    }

    // fetchPropagation
    try {
      const propRaw = await callSubFunction('fetchPropagation', { scheduled: true });
      const propData = propRaw?.data || propRaw;
      results.propagation = {
        success: propData?.success ?? true,
        bestBand: propData?.bestBand?.band || null,
        solarFlux: propData?.propagation?.solar_flux ?? null,
      };
    } catch (e: any) {
      results.errors.push(`fetchPropagation: ${e.message || 'failed'}`);
    }

    // Activity-Spots: SOTA, POTA, WWFF, GMA + SOTA-Alerts
    // Fix v0.9031: WWBOTA entfernt (Domain tot)
    results.activities = {};
    const activityApis = [
      { name: 'sotaSpots', fn: 'fetchSotaSpots', payload: { scheduled: true } },
      { name: 'sotaAlerts', fn: 'fetchSotaSpots', payload: { scheduled: true, alerts: true } },
      { name: 'potaSpots', fn: 'fetchPotaSpots', payload: { scheduled: true } },
      { name: 'wwffSpots', fn: 'fetchWwffSpots', payload: { scheduled: true } },
      { name: 'gmaSpots', fn: 'fetchGmaSpots', payload: { scheduled: true } },
    ];
    for (const api of activityApis) {
      try {
        const raw = await callSubFunction(api.fn, api.payload);
        const data = raw?.data || raw;
        results.activities[api.name] = {
          success: data?.success ?? true,
          saved: data?.saved ?? 0,
          warning: data?.warning || null,
        };
      } catch (e: any) {
        results.activities[api.name] = { success: false, error: e.message || 'failed' };
        results.errors.push(`${api.name}: ${e.message || 'failed'}`);
      }
    }

    return Response.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}