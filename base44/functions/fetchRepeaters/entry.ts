import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchRepeaterData } from '../../shared/repeaterScraper.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const startTime = Date.now();
    const repeaters = await fetchRepeaterData();
    const withCoords = repeaters.filter(r => r.lat !== null && r.lng !== null);

    // Delete existing repeaters and create new ones
    const existing = await base44.asServiceRole.entities.Repeater.list("-created_date", 500);
    if (existing && existing.length > 0) {
      // Delete in batches
      for (let i = 0; i < existing.length; i += 100) {
        const batch = existing.slice(i, i + 100);
        await Promise.all(batch.map(r => base44.asServiceRole.entities.Repeater.delete(r.id)));
      }
    }

    // Create new repeater records (only those with coordinates)
    const records = withCoords.map(r => ({
      callsign: r.callsign,
      frequency: r.frequency,
      offset_mhz: r.offset_mhz || 0,
      tone: r.tone || '',
      modes: r.modes,
      primary_mode: r.primary_mode,
      location_name: r.location_name,
      country: 'Switzerland',
      lat: r.lat,
      lng: r.lng,
      band: r.band,
      status: r.status,
      web_url: r.web_url || '',
      echolink_node: r.echolink_node || '',
      fm_netzwerk: r.fm_netzwerk || false,
      source_id: r.sourceId,
      linked_callsigns: r.linked_callsigns || [],
    }));

    // BulkCreate in batches of 100
    let created = 0;
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      const result = await base44.asServiceRole.entities.Repeater.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({
      status: 'success',
      total_listed: repeaters.length,
      with_coordinates: withCoords.length,
      without_coordinates: repeaters.length - withCoords.length,
      saved: created,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});