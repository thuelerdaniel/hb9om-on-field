import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Fetches amateur radio contests from contestclock.com API (CC BY 4.0, no auth needed).
// API: https://contestclock.com/api/contests?year=YYYY
// Returns all contests with dates, modes, bands, sponsor.
// Stores them in the Contest entity for offline use and countdown display.

const API_BASE = 'https://contestclock.com/api/contests';
const FETCH_TIMEOUT_MS = 15000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Admin-only for manual sync; scheduled calls pass scheduled=true
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized — nicht angemeldet' }, { status: 401 });
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden — nur Administratoren' }, { status: 403 });
      }
    }

    const year = body.year || new Date().getUTCFullYear();

    // Fetch contests from contestclock.com
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let apiData: any;
    try {
      const resp = await fetch(`${API_BASE}?year=${year}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio app)' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        return Response.json({ error: `ContestClock API returned ${resp.status}` }, { status: 502 });
      }
      apiData = await resp.json();
    } catch (e: any) {
      clearTimeout(timer);
      return Response.json({ error: `ContestClock API nicht erreichbar: ${e.message || e}` }, { status: 502 });
    }

    const occurrences = apiData.occurrences || [];
    if (!Array.isArray(occurrences) || occurrences.length === 0) {
      return Response.json({ status: 'success', count: 0, message: 'Keine Contests gefunden' });
    }

    // Delete existing contests for this year
    const existing = await base44.asServiceRole.entities.Contest.filter({ year });
    for (const ex of existing) {
      await base44.asServiceRole.entities.Contest.delete(ex.id);
    }

    // Map and bulk-create new contest records
    const records: any[] = [];
    for (const occ of occurrences) {
      const startUtc = occ.start || '';
      if (!occ.contest_id || !occ.name || !startUtc) continue;
      records.push({
        contest_id: occ.contest_id,
        name: occ.name,
        sponsor: occ.sponsor || '',
        start_utc: startUtc,
        end_utc: occ.end || '',
        duration_hours: occ.duration_hours || 0,
        modes: Array.isArray(occ.modes) ? occ.modes : [],
        bands: Array.isArray(occ.bands) ? occ.bands : [],
        rules_url: occ.rules_url || '',
        country: occ.country || '',
        eligibility_scope: occ.eligibility_scope || 'worldwide',
        uid: occ.uid || `${occ.contest_id}-${startUtc}`,
        start_date: occ.start_date || startUtc.substring(0, 10),
        year,
        verified: occ.verified === true,
        can_enter: occ.can_enter !== false,
        duration_bucket: occ.duration_bucket || '',
        mode_families: Array.isArray(occ.mode_families) ? occ.mode_families : [],
        band_families: Array.isArray(occ.band_families) ? occ.band_families : [],
        last_synced: new Date().toISOString(),
      });
    }

    // Bulk create in batches of 100
    let created = 0;
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      await base44.asServiceRole.entities.Contest.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({
      status: 'success',
      year,
      count: created,
      message: `${created} Contests für ${year} synchronisiert`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({
      status: 'failed',
      error: error.message || String(error),
    }, { status: 500 });
  }
}