import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Searches ALL cached references (worldwide, not bounds-limited) by code or name.
// Used by the QSO Log Form autocomplete to find references that are not yet loaded
// in the current map viewport — e.g. user types "DL/AL-001" while the map shows
// only Switzerland. This returns the matching reference so the form can display it.
//
// Returns up to 30 matches per type, prioritized by distance to the optional center.

const typeCache: Record<string, { refs: any[]; time: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function loadType(base44, type: string): Promise<any[]> {
  const cached = typeCache[type];
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.refs;

  const records = await base44.asServiceRole.entities.ReferenceData.filter({ type });
  if (!records || records.length === 0) return [];
  const refs = records[0].references || [];
  typeCache[type] = { refs, time: Date.now() };
  return refs;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAX_PER_TYPE = 30;
const MIN_QUERY_LENGTH = 2;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { query, types, center } = body || {};

    if (!query || typeof query !== 'string' || query.length < MIN_QUERY_LENGTH) {
      return Response.json({ references: {}, count: 0 });
    }

    const q = query.toLowerCase().trim();
    const allTypes = Array.isArray(types) && types.length > 0
      ? types
      : ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse'];

    const hasCenter = center && typeof center.lat === 'number' && typeof center.lng === 'number';

    // Search each type in parallel
    const results = await Promise.all(
      allTypes.map(async (type) => {
        try {
          const refs = await loadType(base44, type);
          if (!refs || refs.length === 0) return { type, matches: [] };

          const matches: any[] = [];
          for (const ref of refs) {
            const code = (ref.code || ref.reference || '').toLowerCase();
            const name = (ref.name || '').toLowerCase();
            if (code.includes(q) || name.includes(q)) {
              matches.push({
                ...ref,
                _distance: hasCenter && ref.lat != null && ref.lng != null
                  ? haversine(center.lat, center.lng, ref.lat, ref.lng)
                  : null
              });
            }
            if (matches.length >= 100) break; // cap pre-sort
          }

          // Sort by distance if center provided, otherwise keep original order
          if (hasCenter) {
            matches.sort((a, b) => (a._distance ?? 9999) - (b._distance ?? 9999));
          }

          return { type, matches: matches.slice(0, MAX_PER_TYPE).map(({ _distance, ...r }) => r) };
        } catch {
          return { type, matches: [] };
        }
      })
    );

    const references: Record<string, any[]> = {};
    let count = 0;
    for (const { type, matches } of results) {
      references[type] = matches;
      count += matches.length;
    }

    return Response.json({ references, count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}