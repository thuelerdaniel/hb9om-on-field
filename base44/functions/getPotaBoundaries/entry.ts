import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from '../../shared/internalAuth.ts';

// Batch boundary lookup — reads ALL cached boundaries for a list of references
// from PotaBoundaryCache in ONE call. NO upstream fetches (fairness to pota-map.fr).
//
// Use case: "Alle anzeigen" mode in POTA/WWFF/LLOTA filters.
// The frontend calls this once with all visible park references → parks with
// cached boundaries get polygons immediately. Parks without cached boundaries
// stay as circles and are progressively refilled by the background queue.
//
// Input:
//   { references: ["CH-0224", "DE-0001", ...], program: "pota"|"wwff"|"llota" }
//   Max 200 references per call (frontend chunks if needed).
//
// Output:
//   { success: true, boundaries: { "CH-0224": { polygon, has_boundary, name }, ... },
//     found: number, missing: ["DE-0001", ...] }
//
// The `missing` list tells the frontend which references need progressive refill.

const MAX_REFS_PER_CALL = 200;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { references, program } = body;
    const prog = (program === 'wwff' || program === 'llota') ? program : 'pota';

    if (!Array.isArray(references) || references.length === 0) {
      return Response.json({ error: 'Missing references array' }, { status: 400 });
    }

    // Cap at MAX_REFS_PER_CALL to prevent abuse
    const refs = references.slice(0, MAX_REFS_PER_CALL);

    // 1. Batch read from PotaBoundaryCache using $in operator
    const boundaries: Record<string, any> = {};
    const found = new Set<string>();

    try {
      const cached = await base44.asServiceRole.entities.PotaBoundaryCache.filter(
        { reference: { $in: refs } },
        undefined, MAX_REFS_PER_CALL, 0,
      );
      if (cached && cached.length > 0) {
        for (const entry of cached) {
          found.add(entry.reference);
          boundaries[entry.reference] = {
            polygon: entry.polygon || null,
            has_boundary: entry.has_boundary || false,
            name: entry.park_name || '',
          };
        }
      }
    } catch (e) {
      console.warn('PotaBoundaryCache batch lookup failed:', e.message);
    }

    // 2. For references NOT in PotaBoundaryCache, check the program-specific entity
    //    (PotaPoint.boundary / WwffPoint.boundary / LlotaRef.polygon) as a fallback.
    const missingFromCache = refs.filter(r => !found.has(r));
    if (missingFromCache.length > 0) {
      try {
        let entityName: string;
        let codeField = 'code';
        let boundaryField = 'boundary';
        if (prog === 'wwff') {
          entityName = 'WwffPoint';
        } else if (prog === 'llota') {
          entityName = 'LlotaRef';
          boundaryField = 'polygon';
        } else {
          entityName = 'PotaPoint';
        }

        const entities = await base44.asServiceRole.entities[entityName].filter(
          { [codeField]: { $in: missingFromCache } },
          undefined, MAX_REFS_PER_CALL, 0,
        );
        if (entities && entities.length > 0) {
          for (const ent of entities) {
            const code = ent[codeField];
            if (!code || found.has(code)) continue;
            const poly = ent[boundaryField];
            if (poly && Array.isArray(poly) && poly.length > 2) {
              found.add(code);
              boundaries[code] = {
                polygon: poly,
                has_boundary: true,
                name: ent.name || '',
              };
            }
          }
        }
      } catch (e) {
        console.warn(`Entity fallback lookup failed for ${prog}:`, e.message);
      }
    }

    const missing = refs.filter(r => !found.has(r));

    return Response.json({
      success: true,
      program: prog,
      boundaries,
      found: found.size,
      missing,
    });
  } catch (error: any) {
    return Response.json(
      { error: error.message || 'Unknown error' },
      { status: 500 },
    );
  }
}