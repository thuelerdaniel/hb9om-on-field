import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // Admin-only actions
    if (action === 'listAll') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const requests = await base44.asServiceRole.entities.ReferenceChangeRequest.list('-created_date', 500);
      return Response.json({ requests: requests || [] });
    }

    if (action === 'approve') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { requestId, adminComment } = body;
      const cr = await base44.asServiceRole.entities.ReferenceChangeRequest.get(requestId);
      if (!cr) return Response.json({ error: 'Antrag nicht gefunden' }, { status: 404 });
      if (cr.status !== 'pending') return Response.json({ error: 'Antrag ist nicht mehr offen' }, { status: 400 });

      // Create or update ReferenceOverride so the change shows on the map immediately
      const existing = await base44.asServiceRole.entities.ReferenceOverride.filter({
        reference_type: cr.reference_type,
        original_code: cr.original_code
      });
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.ReferenceOverride.update(existing[0].id, {
          manual_lat: cr.proposed_lat,
          manual_lng: cr.proposed_lng,
          original_name: cr.original_name
        });
      } else {
        await base44.asServiceRole.entities.ReferenceOverride.create({
          reference_type: cr.reference_type,
          original_code: cr.original_code,
          original_name: cr.original_name,
          manual_lat: cr.proposed_lat,
          manual_lng: cr.proposed_lng
        });
      }

      // Mark request as approved
      await base44.asServiceRole.entities.ReferenceChangeRequest.update(requestId, {
        status: 'approved',
        admin_comment: adminComment || '',
        reviewed_by_name: user.full_name || user.email || 'Admin'
      });

      return Response.json({ success: true, message: 'Antrag genehmigt und Position aktualisiert' });
    }

    if (action === 'reject') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { requestId, adminComment } = body;
      const cr = await base44.asServiceRole.entities.ReferenceChangeRequest.get(requestId);
      if (!cr) return Response.json({ error: 'Antrag nicht gefunden' }, { status: 404 });
      if (cr.status !== 'pending') return Response.json({ error: 'Antrag ist nicht mehr offen' }, { status: 400 });

      await base44.asServiceRole.entities.ReferenceChangeRequest.update(requestId, {
        status: 'rejected',
        admin_comment: adminComment || '',
        reviewed_by_name: user.full_name || user.email || 'Admin'
      });

      return Response.json({ success: true, message: 'Antrag abgelehnt' });
    }

    return Response.json({ error: 'Unbekannte Aktion: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});