import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// getClubLog — v0.9003
// Returns club station QSOs (is_clubstation: true) via service-role (bypasses RLS).
// Parameters: limit (default 500), skip (default 0)
// Response: { success: true, records: [...], count: N, has_more: boolean }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const limit = parseInt(body.limit) || 500;
    const skip = parseInt(body.skip) || 0;

    const sr = base44.asServiceRole;
    const records = await sr.entities.Log.filter(
      { is_clubstation: true, status: 'active' },
      '-qso_date', limit, skip
    );

    const count = Array.isArray(records) ? records.length : 0;
    const has_more = count === limit;

    return Response.json({
      success: true,
      records: records || [],
      count,
      has_more,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}