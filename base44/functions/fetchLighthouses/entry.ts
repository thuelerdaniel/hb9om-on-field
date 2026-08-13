import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { fetchLighthouseData, LIGHTHOUSE_REGIONS } from '../../shared/referenceFetchers.ts';

// Worldwide lighthouse data — fetched from OpenStreetMap (Overpass API).
// Uses 15 regional batches (instead of 2 huge bboxes) to avoid Overpass timeouts.
// Each region can be fetched individually via the `region` parameter.
// Logic lives in base44/shared/referenceFetchers.ts (shared with refreshAllData).
//
// When region is specified: fetches only that region, MERGES with existing
// ReferenceData (removes old entries from that region, adds new ones).
// When region is omitted or 'all': fetches ALL regions and REPLACES all data.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const region = body.region || 'all';

    // Validate region parameter
    if (region !== 'all' && !LIGHTHOUSE_REGIONS.some(r => r.id === region)) {
      return Response.json({ error: `Unknown region: ${region}. Valid: all, ${LIGHTHOUSE_REGIONS.map(r => r.id).join(', ')}` }, { status: 400 });
    }

    const newLighthouses = await fetchLighthouseData(region);
    const now = new Date().toISOString();

    // Fetch existing ReferenceData
    const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'lighthouse' });

    let finalLighthouses: any[];
    let source: string;

    if (region === 'all') {
      // Full worldwide fetch — replace all data
      finalLighthouses = newLighthouses;
      source = 'OSM Overpass (worldwide, 15 regions) + ARLHS WLOL (Swiss verified)';
    } else {
      // Single region — merge with existing data
      const regionLabel = LIGHTHOUSE_REGIONS.find(r => r.id === region)?.label || region;
      source = `OSM Overpass (${regionLabel}) + ARLHS WLOL (Swiss verified)`;

      if (existing && existing.length > 0) {
        // Remove old entries from this region, keep entries from other regions
        const otherRegions = (existing[0].references || []).filter((l: any) => l.region !== region);
        // Deduplicate by lat/lng proximity
        const seen = new Set<string>();
        const deduped = [];
        for (const l of [...otherRegions, ...newLighthouses]) {
          if (l.lat == null || l.lng == null) { deduped.push(l); continue; }
          const key = `${l.lat.toFixed(3)},${l.lng.toFixed(3)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(l);
        }
        finalLighthouses = deduped;
      } else {
        finalLighthouses = newLighthouses;
      }
    }

    // Upsert into ReferenceData
    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
        references: finalLighthouses,
        total_count: finalLighthouses.length,
        source,
        last_updated: now
      });
    } else {
      await base44.asServiceRole.entities.ReferenceData.create({
        type: 'lighthouse',
        references: finalLighthouses,
        total_count: finalLighthouses.length,
        source,
        last_updated: now
      });
    }

    return Response.json({
      saved: true,
      count: finalLighthouses.length,
      new_in_region: newLighthouses.length,
      region: region,
      source,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});