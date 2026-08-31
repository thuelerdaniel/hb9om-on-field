import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAprsData } from '../../shared/aprsFetcher.ts';

// APRS.fi + APRS-IS API integration — fetches APRS station positions.
// Core logic lives in base44/shared/aprsFetcher.ts (shared with refreshAllData).
// API docs: https://aprs.fi/page/api

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Scheduled runs have no user context — allow if scheduled flag is set.
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
      }
    }

    // APRS.fi API key priority: personal (user entity) → club config → global secret
    let apiKey = (user as any)?.aprs_fi_api_key || '';
    if (!apiKey) {
      // Try club config
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'club_callsign_config' });
        if (settings?.length > 0) {
          const config = JSON.parse(settings[0].value || '{}');
          apiKey = config.aprs_fi_api_key || '';
        }
      } catch {}
    }
    if (!apiKey) {
      apiKey = process.env.APRS_FI_API_KEY || '';
    }
    if (!apiKey) {
      return Response.json({ status: 'failed', error: 'APRS.fi API-Key nicht konfiguriert (persönlich, Club oder global)' }, { status: 500 });
    }

    // Fix 4: For scheduled runs, skip the slow repeater/log callsign enrichment (131s → ~60s).
    // Only do BrandMeister devices + BrandMeister linking. Manual runs still do full enrichment.
    const skipEnrichment = body.scheduled === true;
    const result = await fetchAprsData(base44, apiKey, skipEnrichment);

    return Response.json({
      status: 'success',
      count: (result.brandmeister_devices_saved || 0) + (result.private_nodes_saved || 0),
      ...result,
    });
  } catch (error: any) {
    return Response.json({ 
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}