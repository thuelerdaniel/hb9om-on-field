import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// getClubLog — v0.9003 Problem 6
// Returns ALL club station QSOs (is_clubstation: true) via service-role.
// Bypasses RLS so every club member sees the shared club log.
// Paginated — loads up to 100k records.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const sr = base44.asServiceRole;
    const allClubLogs: any[] = [];
    const LIMIT = 5000;
    const MAX_PAGES = 20;

    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await sr.entities.Log.filter(
        { is_clubstation: true, status: 'active' },
        '-qso_date', LIMIT, page * LIMIT
      );
      if (!Array.isArray(batch) || batch.length === 0) break;
      allClubLogs.push(...batch);
      if (batch.length < LIMIT) break;
    }

    return Response.json({
      status: 'success',
      count: allClubLogs.length,
      logs: allClubLogs,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}