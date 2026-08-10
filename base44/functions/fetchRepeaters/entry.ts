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

    // Delete all existing repeaters (loop — deleteMany may have a per-call limit)
    for (let attempt = 0; attempt < 50; attempt++) {
      const existing = await base44.asServiceRole.entities.Repeater.list("-created_date", 500);
      if (!existing || existing.length === 0) break;
      await base44.asServiceRole.entities.Repeater.deleteMany({ id: { $in: existing.map(r => r.id) } });
    }

    // Create new repeater records (only those with coordinates — needed for map display)
    const records = withCoords.map(r => ({
      callsign: r.callsign,
      frequency: r.frequency,
      offset_mhz: r.offset_mhz || 0,
      tone: r.tone || '',
      modes: r.modes,
      primary_mode: r.primary_mode,
      location_name: r.location_name,
      country: r.country || '',
      country_code: r.country_code || '',
      lat: r.lat,
      lng: r.lng,
      band: r.band,
      status: r.status,
      web_url: r.web_url || '',
      echolink_node: r.echolink_node || '',
      fm_funknetz: r.fm_funknetz || false,
      source_id: r.sourceId,
      linked_callsigns: r.linked_callsigns || [],
    }));

    // BulkCreate in batches of 100
    let created = 0;
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      await base44.asServiceRole.entities.Repeater.bulkCreate(batch);
      created += batch.length;
    }

    // Country breakdown for response
    const countryBreakdown: Record<string, number> = {};
    for (const r of withCoords) {
      const cc = r.country_code || '?';
      countryBreakdown[cc] = (countryBreakdown[cc] || 0) + 1;
    }

    return Response.json({
      status: 'success',
      total_listed: repeaters.length,
      with_coordinates: withCoords.length,
      without_coordinates: repeaters.length - withCoords.length,
      saved: created,
      countries: Object.keys(countryBreakdown).length,
      country_breakdown: countryBreakdown,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});