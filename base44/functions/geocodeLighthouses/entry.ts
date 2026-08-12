import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Geocode lighthouses that have no coordinates (needs_georef=true) in ReferenceData.
// Uses OpenStreetMap Nominatim API with lighthouse name + country as query.
// Updates the ReferenceData record with derived coordinates.
// Rate-limited (1 req/sec per Nominatim usage policy) — processes max 50 per call.

async function geocodeNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)' },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const maxToGeocode = body.max || 50;
    const force = body.force === true;

    // Load lighthouse ReferenceData
    const records = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'lighthouse' });
    if (!records || records.length === 0) {
      return Response.json({ error: 'Keine Leuchtturm-Daten im Cache' }, { status: 404 });
    }

    const record = records[0];
    const refs: any[] = record.references || [];
    const withoutCoords = refs.filter(r => r.lat == null || r.lng == null);
    const withCoords = refs.filter(r => r.lat != null && r.lng != null);

    if (withoutCoords.length === 0) {
      return Response.json({
        success: true,
        message: 'Alle Leuchttürme haben bereits Koordinaten',
        total: refs.length,
        withCoords: withCoords.length,
        geocoded: 0,
      });
    }

    // Geocode lighthouses without coordinates (max per call to respect Nominatim rate limit)
    const toGeocode = withoutCoords.slice(0, maxToGeocode);
    let geocodedCount = 0;
    const updatedRefs = [...refs]; // copy

    for (let i = 0; i < toGeocode.length; i++) {
      const lh = toGeocode[i];
      const query = lh.country
        ? `${lh.name} lighthouse, ${lh.country}`
        : `${lh.name} lighthouse`;
      const coords = await geocodeNominatim(query);
      if (coords) {
        // Find index in updatedRefs
        const idx = updatedRefs.findIndex(r =>
          r.code === lh.code || (r.name === lh.name && r.lat == null)
        );
        if (idx >= 0) {
          updatedRefs[idx] = {
            ...updatedRefs[idx],
            lat: coords.lat,
            lng: coords.lng,
            needs_georef: false,
            geocoded: true,
          };
          geocodedCount++;
        }
      }
      // Nominatim rate limit: 1 request per second
      if (i < toGeocode.length - 1) {
        await new Promise(r => setTimeout(r, 1100));
      }
    }

    // Update ReferenceData with geocoded coordinates
    const newWithCoords = updatedRefs.filter(r => r.lat != null && r.lng != null).length;
    await base44.asServiceRole.entities.ReferenceData.update(record.id, {
      references: updatedRefs,
      total_count: updatedRefs.length,
      last_updated: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      total: updatedRefs.length,
      withCoords: newWithCoords,
      withoutCoords: updatedRefs.length - newWithCoords,
      geocoded: geocodedCount,
      attempted: toGeocode.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});