import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Worldwide lighthouse data — fetched from OpenStreetMap (Overpass API).
// Queries man_made=lighthouse globally, returns entries with coordinates.
// Also merges the curated ARLHS WLOL Swiss lighthouses (6 verified entries).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch lighthouses worldwide from OSM Overpass API
    // Split into continental batches to avoid timeout
    const BBOXES = [
      [35, -12, 72, 40],     // Europe
      [-45, -180, 80, -30],  // Americas
      [-50, 40, 40, 100],    // Africa + Middle East
      [40, 40, 80, 180],     // Asia
      [-50, 100, 0, 180],    // Oceania
    ];

    const allLighthouses: any[] = [];
    const seen = new Set<string>();

    for (const [south, west, north, east] of BBOXES) {
      try {
        const query = `[out:json][timeout:60];(
          node["man_made"="lighthouse"](${south},${west},${north},${east});
          way["man_made"="lighthouse"](${south},${west},${north},${east});
        );out center 5000;`;
        const resp = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HB9OM-OnField/1.0' },
          body: 'data=' + encodeURIComponent(query)
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        for (const e of (data.elements || [])) {
          const lat = e.lat || e.center?.lat;
          const lng = e.lon || e.center?.lon;
          if (isNaN(lat) || isNaN(lng)) continue;
          const name = e.tags?.name || e.tags?.['seamark:name'] || `Lighthouse ${lat.toFixed(4)},${lng.toFixed(4)}`;
          // Deduplicate by coordinates (within ~100m)
          const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          allLighthouses.push({
            code: e.tags?.['seamark:light:reference'] || `OSM-LH-${allLighthouses.length + 1}`,
            name,
            lat,
            lng,
            country: e.tags?.['addr:country'] || '',
            link: 'https://www.openstreetmap.org/',
          });
        }
      } catch {}
      // Rate limit between batches
      await new Promise(r => setTimeout(r, 1500));
    }

    // Also add curated Swiss ARLHS WLOL lighthouses (verified coordinates)
    const swissLighthouses = [
      { code: 'SWI-001', name: 'Phare des Pâquis (Genf)', lat: 46.2100, lng: 6.1570, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI1.html' },
      { code: 'SWI-002', name: 'Genève Jetée du Sud (Genf)', lat: 46.2080, lng: 6.1560, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI2.html' },
      { code: 'SWI-003', name: 'Morges Jetée du Sud', lat: 46.5061, lng: 6.4990, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI3.html' },
      { code: 'SWI-004', name: 'Morges Jetée du Nord', lat: 46.5065, lng: 6.4991, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI4.html' },
      { code: 'SWI-005', name: 'Romanshorn Leuchtturm', lat: 47.5668, lng: 9.3922, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI5.html' },
      { code: 'SWI-006', name: 'Rorschach Hafen Leuchtturm', lat: 47.4794, lng: 9.4946, country: 'CH', link: 'https://wlol.arlhs.com/lighthouse/SWI6.html' },
    ];

    // Merge: add Swiss lighthouses if not already present
    for (const sl of swissLighthouses) {
      const key = `${sl.lat.toFixed(3)},${sl.lng.toFixed(3)}`;
      if (!seen.has(key)) {
        allLighthouses.push(sl);
      }
    }

    // Upsert into ReferenceData
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'lighthouse' });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
        references: allLighthouses,
        total_count: allLighthouses.length,
        source: 'OSM Overpass (worldwide) + ARLHS WLOL (Swiss verified)',
        last_updated: now
      });
    } else {
      await base44.asServiceRole.entities.ReferenceData.create({
        type: 'lighthouse',
        references: allLighthouses,
        total_count: allLighthouses.length,
        source: 'OSM Overpass (worldwide) + ARLHS WLOL (Swiss verified)',
        last_updated: now
      });
    }

    return Response.json({
      saved: true,
      count: allLighthouses.length,
      source: 'OSM Overpass (worldwide) + ARLHS WLOL (Swiss verified)',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});