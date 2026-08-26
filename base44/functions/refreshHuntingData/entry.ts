import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Combined refresh function for the Hunting automation.
// Calls fetchDxSpots and fetchPropagation via service-role invoke.
// Supports scheduled mode (no user auth) and manual mode (admin only).

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Scheduled runs: no user. Manual runs: admin only.
    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const results = { dxSpots: null, propagation: null, errors: [] };

    // fetchDxSpots aufrufen
    try {
      const dxRes = await base44.asServiceRole.functions.invoke('fetchDxSpots', { scheduled: true });
      results.dxSpots = {
        success: dxRes?.success ?? true,
        saved: dxRes?.saved ?? 0,
        warning: dxRes?.warning || null,
      };
    } catch (e) {
      results.errors.push(`fetchDxSpots: ${e.message || 'failed'}`);
    }

    // fetchPropagation aufrufen
    try {
      const propRes = await base44.asServiceRole.functions.invoke('fetchPropagation', { scheduled: true });
      results.propagation = {
        success: propRes?.success ?? true,
        bestBand: propRes?.bestBand?.band || null,
        solarFlux: propRes?.propagation?.solar_flux ?? null,
      };
    } catch (e) {
      results.errors.push(`fetchPropagation: ${e.message || 'failed'}`);
    }

    return Response.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}