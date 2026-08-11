import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchReferenceSource, SOURCE_LABELS } from '../../shared/referenceFetchers.ts';
import { upsertPoints } from '../../shared/pointUpsert.ts';

// Types that use individual point entities instead of ReferenceData.references
const POINT_ENTITY_MAP = {
  sota: { entity: 'SotaPoint', source: 'sotadata.org.uk CSV' },
  pota: { entity: 'PotaPoint', source: 'api.pota.app' },
  hbff: { entity: 'WwffPoint', source: 'wwff.co CSV (worldwide)' },
};

// Individual data source refresher — allows admins to reload a single source
// (sota, pota, hbff, wwbota, castle, lighthouse, iota, repeater) on demand.
// Returns detailed results for the admin log.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const source = body.source;
    if (!source || !SOURCE_LABELS[source]) {
      return Response.json({ error: 'Invalid source. Valid sources: ' + Object.keys(SOURCE_LABELS).join(', ') }, { status: 400 });
    }

    const startTime = Date.now();

    // Fetch admin overrides for this source
    const allOverrides = await base44.asServiceRole.entities.ReferenceOverride.list("-created_date", 500);
    const overridesByType = new Map();
    for (const ov of (allOverrides || [])) {
      if (!overridesByType.has(ov.reference_type)) overridesByType.set(ov.reference_type, new Map());
      overridesByType.get(ov.reference_type).set(ov.original_code, ov);
    }

    // Fetch the data
    let items: any[];
    try {
      items = await fetchReferenceSource(source, overridesByType);
    } catch (e: any) {
      return Response.json({
        source,
        label: SOURCE_LABELS[source],
        status: 'failed',
        error: e.message,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }

    // Apply admin overrides for non-castle, non-repeater types
    if (source !== 'castle' && source !== 'repeater' && overridesByType.has(source)) {
      const typeOverrides = overridesByType.get(source);
      for (const item of items) {
        const code = item.code || item.reference;
        if (code && typeOverrides.has(code)) {
          const ov = typeOverrides.get(code);
          if (ov.manual_lat != null) { item.lat = ov.manual_lat; item.lng = ov.manual_lng; }
          if (ov.adjusted_name) item.name = ov.adjusted_name;
          if (ov.web_reference) item.link = ov.web_reference;
        }
      }
    }

    const now = new Date().toISOString();
    let savedCount = 0;

    if (source === 'repeater') {
      // Save repeaters to Repeater entity
      const repRecords = items.map((r: any) => ({
        callsign: r.callsign, frequency: r.frequency, offset_mhz: r.offset_mhz || 0,
        tone: r.tone || '', modes: r.modes, primary_mode: r.primary_mode,
        location_name: r.location_name, country: r.country || '', country_code: r.country_code || '',
        lat: r.lat, lng: r.lng, band: r.band, status: r.status,
        web_url: r.web_url || '', echolink_node: r.echolink_node || '',
        fm_funknetz: false, source_id: r.sourceId, linked_callsigns: r.linked_callsigns || [],
      }));

      // Delete all existing repeaters in one call (full refresh)
      try {
        await base44.asServiceRole.entities.Repeater.deleteMany({});
      } catch {}

      // Bulk insert in batches of 100
      for (let i = 0; i < repRecords.length; i += 100) {
        await base44.asServiceRole.entities.Repeater.bulkCreate(repRecords.slice(i, i + 100));
      }
      savedCount = repRecords.length;
    } else if (POINT_ENTITY_MAP[source]) {
      // Save sota/pota/hbff as individual point records (avoids 16MB document limit)
      const ptConfig = POINT_ENTITY_MAP[source];
      const upsertResult = await upsertPoints(base44, ptConfig.entity, source, items, ptConfig.source);
      savedCount = upsertResult.created;
    } else {
      // Save to ReferenceData entity (wwbota, lighthouse, castle, iota)
      const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: source });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
          references: items, total_count: items.length, source, last_updated: now
        });
      } else {
        await base44.asServiceRole.entities.ReferenceData.create({
          type: source, references: items, total_count: items.length, source, last_updated: now
        });
      }
      savedCount = items.length;
    }

    const duration_ms = Date.now() - startTime;
    const withCoords = items.filter((i: any) => i.lat != null && i.lng != null).length;

    const result = {
      source,
      label: SOURCE_LABELS[source],
      status: 'success' as const,
      count: items.length,
      withCoords,
      withoutCoords: items.length - withCoords,
      duration_ms,
      timestamp: now,
    };

    // Log to SyncLog
    try {
      await base44.entities.SyncLog.create({
        timestamp: now,
        overall_status: 'success',
        total_duration_ms: duration_ms,
        results: [result],
        trigger: 'manual',
      });
    } catch {}

    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}