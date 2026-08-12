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

    const apiKey = process.env.APRS_FI_API_KEY;
    if (!apiKey) {
      return Response.json({ status: 'failed', error: 'APRS_FI_API_KEY secret not set' }, { status: 500 });
    }

    const result = await fetchAprsData(base44, apiKey);

    return Response.json({
      status: 'success',
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