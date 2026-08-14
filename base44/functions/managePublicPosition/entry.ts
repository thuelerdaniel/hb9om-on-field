import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Manage public GPS positions: set/update/remove own position, list all active positions.
// RLS on the entity ensures users can only write their own records; read is public.

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => (typeof req.body === 'object' ? req.body : {}));

    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) {
      return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const action = body?.action;

    // --- Set / update my public position ---
    if (action === 'set') {
      const { lat, lng, device_type, label, comment, aprs_symbol } = body;
      if (lat == null || lng == null) {
        return Response.json({ error: 'Koordinaten fehlen' }, { status: 400 });
      }
      const callsign = body.callsign || user.full_name || user.email || 'Unknown';

      // Check if user already has a public position record
      const existing = await base44.asServiceRole.entities.PublicPosition.filter({ created_by_id: user.id });
      const now = new Date().toISOString();

      if (existing && existing.length > 0) {
        // Update existing record
        const rec = existing[0];
        const updated = await base44.asServiceRole.entities.PublicPosition.update(rec.id, {
          lat, lng,
          device_type: device_type || rec.device_type || 'mobil',
          label: label ?? rec.label,
          comment: comment ?? rec.comment,
          aprs_symbol: aprs_symbol || rec.aprs_symbol || 'mobile',
          callsign,
          last_updated: now,
          is_active: true,
        });
        return Response.json({ success: true, id: rec.id, position: updated });
      }

      // Create new record
      const created = await base44.entities.PublicPosition.create({
        callsign,
        lat, lng,
        device_type: device_type || 'mobil',
        label: label || null,
        comment: comment || null,
        aprs_symbol: aprs_symbol || 'mobile',
        last_updated: now,
        is_active: true,
      });
      return Response.json({ success: true, id: created.id, position: created });
    }

    // --- Remove / hide my public position ---
    if (action === 'remove') {
      const existing = await base44.asServiceRole.entities.PublicPosition.filter({ created_by_id: user.id });
      if (!existing || existing.length === 0) {
        return Response.json({ success: true, removed: false });
      }
      for (const rec of existing) {
        await base44.asServiceRole.entities.PublicPosition.update(rec.id, { is_active: false });
      }
      return Response.json({ success: true, removed: existing.length });
    }

    // --- Delete my public position permanently ---
    if (action === 'delete') {
      const existing = await base44.asServiceRole.entities.PublicPosition.filter({ created_by_id: user.id });
      if (!existing || existing.length === 0) {
        return Response.json({ success: true, deleted: 0 });
      }
      for (const rec of existing) {
        await base44.asServiceRole.entities.PublicPosition.delete(rec.id);
      }
      return Response.json({ success: true, deleted: existing.length });
    }

    // --- List all active public positions ---
    if (action === 'list') {
      const positions = await base44.asServiceRole.entities.PublicPosition.filter(
        { is_active: true },
        '-last_updated',
        500
      );
      return Response.json({
        success: true,
        positions: positions.map(p => ({
          id: p.id,
          callsign: p.callsign,
          lat: p.lat,
          lng: p.lng,
          device_type: p.device_type,
          label: p.label,
          comment: p.comment,
          aprs_symbol: p.aprs_symbol,
          last_updated: p.last_updated,
          is_own: p.created_by_id === user.id,
        })),
        count: positions.length,
      });
    }

    // --- Get my public position status ---
    if (action === 'status') {
      const existing = await base44.asServiceRole.entities.PublicPosition.filter({ created_by_id: user.id });
      if (!existing || existing.length === 0) {
        return Response.json({ success: true, is_public: false });
      }
      const rec = existing[0];
      return Response.json({
        success: true,
        is_public: rec.is_active === true,
        position: { lat: rec.lat, lng: rec.lng, device_type: rec.device_type, label: rec.label, comment: rec.comment, aprs_symbol: rec.aprs_symbol },
        last_updated: rec.last_updated,
      });
    }

    return Response.json({ error: 'Unbekannte Aktion: ' + action }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}