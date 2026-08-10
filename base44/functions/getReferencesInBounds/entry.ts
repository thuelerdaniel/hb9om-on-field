import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns only references within the given map bounds — avoids sending 180k+ worldwide
// references to the client on initial load. The client calls this on map ready and on
// pan/zoom, accumulating results.
//
// Loads ONLY the requested types individually (not all 7 ReferenceData records), so
// small types (lighthouse, iota) are fast even when large types (sota) exist.

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

const MAX_PER_TYPE = 3000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { bounds, types } = body || {};

    if (!bounds || typeof bounds.north !== 'number' || typeof bounds.south !== 'number' ||
        typeof bounds.east !== 'number' || typeof bounds.west !== 'number') {
      return Response.json({ error: 'Valid bounds required {north, south, east, west}' }, { status: 400 });
    }

    const allTypes = Array.isArray(types) && types.length > 0
      ? types
      : ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse'];

    // Load each type in parallel — small types finish fast, large types take longer
    const results = await Promise.all(
      allTypes.map(async (type) => {
        try {
          const refs = await loadType(base44, type);
          if (!refs || refs.length === 0) return { type, filtered: [] };

          const filtered: any[] = [];
          for (const ref of refs) {
            if (ref.lat == null || ref.lng == null) continue;
            if (ref.lat <= bounds.north && ref.lat >= bounds.south &&
                ref.lng >= bounds.west && ref.lng <= bounds.east) {
              filtered.push(ref);
            }
          }
          return { type, filtered: filtered.length > MAX_PER_TYPE ? filtered.slice(0, MAX_PER_TYPE) : filtered };
        } catch {
          // If one type fails (timeout/memory), others still succeed
          return { type, filtered: [] };
        }
      })
    );

    const references: Record<string, any[]> = {};
    let count = 0;
    for (const { type, filtered } of results) {
      references[type] = filtered;
      count += filtered.length;
    }

    return Response.json({ references, count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}