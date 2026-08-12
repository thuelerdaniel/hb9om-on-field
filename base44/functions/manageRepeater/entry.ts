import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Admin-only function to manage individual repeater records.
// Actions:
// - setWebUrl: Set or update the web_url for a repeater (admin can supplement found links)
// - triggerCoverage: Mark a single repeater for coverage recalculation

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    let body = req.body;
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      try { body = await req.json(); } catch { body = {}; }
    }
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body) body = {};
    const action = body?.action;
    const repeaterId = body?.repeater_id;

    if (!action || !repeaterId) {
      return Response.json({ error: 'action and repeater_id required' }, { status: 400 });
    }

    if (action === 'setWebUrl') {
      const webUrl = body?.web_url || '';
      const updated = await base44.asServiceRole.entities.Repeater.update(repeaterId, { web_url: webUrl });
      return Response.json({ success: true, repeater: updated });
    }

    if (action === 'triggerCoverage') {
      // Mark single repeater for recalculation
      await base44.asServiceRole.entities.Repeater.update(repeaterId, { needs_recalc: true });
      // Trigger coverage calculation for this specific repeater
      const result = await base44.asServiceRole.functions.invoke('calculateRepeaterCoverage', {
        repeater_ids: [repeaterId],
        force: true,
      });
      return Response.json({ success: true, result: result?.data || result });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('manageRepeater error:', error);
    return Response.json({ error: error?.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}