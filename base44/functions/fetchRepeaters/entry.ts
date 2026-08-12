import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { fetchRepeaterData, fetchPrivateNodeData } from '../../shared/repeaterScraper.ts';

export default async function(req) {
  const startTime = Date.now();
  let currentStep = 'init';
  let base44: any = null;
  try {
    base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Scheduled automation runs have no user context — allow if scheduled flag is set.
    // Manual (UI) runs require an authenticated admin user.
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized — nicht angemeldet' }, { status: 401 });
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden — nur Administratoren dürfen Relais-Daten aktualisieren' }, { status: 403 });
      }
    }

    // --- Step 1: Fetch repeater data from external sources ---
    currentStep = 'fetch_external_data';
    let repeaters: any[] = [];
    try {
      repeaters = await fetchRepeaterData();
    } catch (fetchErr: any) {
      // Log detailed error for admins
      const errMsg = `Relais-Daten konnten nicht abgerufen werden: ${fetchErr.message || fetchErr}`;
      try {
        await base44.asServiceRole.entities.SyncLog.create({
          timestamp: new Date().toISOString(),
          overall_status: 'failed',
          total_duration_ms: Date.now() - startTime,
          trigger: body.scheduled === true ? 'scheduled' : 'manual',
          results: [{ type: 'repeater', status: 'failed', error: errMsg, detail: fetchErr.stack || '' }],
          description: `fetchRepeaterData fehlgeschlagen: ${errMsg}`,
        });
      } catch {}
      return Response.json({
        status: 'failed',
        error: errMsg,
        step: currentStep,
        detail: fetchErr.stack || '',
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }

    const withCoords = repeaters.filter(r => r.lat !== null && r.lng !== null);

    // --- Step 2: Delete existing repeaters ---
    currentStep = 'delete_existing';
    try {
      for (let attempt = 0; attempt < 50; attempt++) {
        const existing = await base44.asServiceRole.entities.Repeater.list("-created_date", 500);
        if (!existing || existing.length === 0) break;
        await base44.asServiceRole.entities.Repeater.deleteMany({ id: { $in: existing.map(r => r.id) } });
      }
    } catch (delErr: any) {
      const errMsg = `Bestehende Relais konnten nicht gelöscht werden: ${delErr.message || delErr}`;
      return Response.json({
        status: 'failed',
        error: errMsg,
        step: currentStep,
        detail: delErr.stack || '',
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }

    // --- Step 3: Create new repeater records ---
    currentStep = 'create_records';
    const records = repeaters.map(r => ({
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
      has_emergency_power: r.has_emergency_power || false,
      power_source: r.power_source || 'unknown',
      source_id: r.sourceId,
      linked_callsigns: r.linked_callsigns || [],
      locator: r.locator || '',
      coords_from_locator: r.coords_from_locator || false,
    }));

    let created = 0;
    try {
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        await base44.asServiceRole.entities.Repeater.bulkCreate(batch);
        created += batch.length;
      }
    } catch (createErr: any) {
      const errMsg = `Relais konnten nicht gespeichert werden (Batch ${Math.floor(created / 100)}): ${createErr.message || createErr}`;
      return Response.json({
        status: 'failed',
        error: errMsg,
        step: currentStep,
        records_created_so_far: created,
        detail: createErr.stack || '',
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }

    // Private nodes fetch disabled in main fetch to avoid timeout.
    let privateNodesSaved = 0;

    // Country breakdown for response
    const countryBreakdown = {};
    for (const r of withCoords) {
      const cc = r.country_code || '?';
      countryBreakdown[cc] = (countryBreakdown[cc] || 0) + 1;
    }

    const withPower = withCoords.filter(r => r.has_emergency_power).length;

    return Response.json({
      status: 'success',
      total_listed: repeaters.length,
      with_coordinates: withCoords.length,
      without_coordinates: repeaters.length - withCoords.length,
      saved: created,
      with_emergency_power: withPower,
      private_nodes_saved: privateNodesSaved,
      countries: Object.keys(countryBreakdown).length,
      country_breakdown: countryBreakdown,
      duration_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    // Top-level catch — log to SyncLog for admin debugging
    const errMsg = `Schwerwiegender Fehler beim Relais-Update (Schritt: ${currentStep}): ${error.message || error}`;
    if (base44) {
      try {
        await base44.asServiceRole.entities.SyncLog.create({
          timestamp: new Date().toISOString(),
          overall_status: 'failed',
          total_duration_ms: Date.now() - startTime,
          trigger: 'manual',
          results: [{ type: 'repeater', status: 'failed', error: errMsg, detail: error.stack || '' }],
          description: errMsg,
        });
      } catch {}
    }
    return Response.json({
      status: 'failed',
      error: errMsg,
      step: currentStep,
      detail: error.stack || '',
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}