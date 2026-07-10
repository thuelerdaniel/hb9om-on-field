import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // Admin-only: list all feature requests
    if (action === 'listAll') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const requests = await base44.asServiceRole.entities.FeatureRequest.list('-created_date', 500);
      return Response.json({ requests: requests || [] });
    }

    // Admin-only: respond to a feature request (update status + comment)
    if (action === 'respond') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { requestId, status, adminComment } = body;
      const fr = await base44.asServiceRole.entities.FeatureRequest.get(requestId);
      if (!fr) return Response.json({ error: 'Vorschlag nicht gefunden' }, { status: 404 });

      await base44.asServiceRole.entities.FeatureRequest.update(requestId, {
        status: status || fr.status,
        admin_comment: adminComment !== undefined ? adminComment : fr.admin_comment,
        reviewed_by_name: user.full_name || user.email || 'Admin'
      });

      return Response.json({ success: true, message: 'Vorschlag aktualisiert' });
    }

    // Any user: withdraw own request
    if (action === 'withdraw') {
      const { requestId } = body;
      const fr = await base44.entities.FeatureRequest.get(requestId);
      if (!fr) return Response.json({ error: 'Vorschlag nicht gefunden' }, { status: 404 });
      if (fr.created_by_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

      await base44.entities.FeatureRequest.update(requestId, { status: 'withdrawn' });
      return Response.json({ success: true, message: 'Vorschlag zurückgezogen' });
    }

    // Admin-only: count pending (for badge)
    if (action === 'countPending') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const requests = await base44.asServiceRole.entities.FeatureRequest.filter({ status: 'pending' });
      return Response.json({ count: requests ? requests.length : 0 });
    }

    // Admin or owner: delete a withdrawn request
    if (action === 'delete') {
      const { requestId } = body;
      const fr = await base44.asServiceRole.entities.FeatureRequest.get(requestId);
      if (!fr) return Response.json({ error: 'Vorschlag nicht gefunden' }, { status: 404 });
      if (fr.status !== 'withdrawn') return Response.json({ error: 'Nur zurückgezogene Vorschläge können gelöscht werden' }, { status: 400 });

      const isOwner = fr.created_by_id === user.id;
      if (!isOwner && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

      await base44.asServiceRole.entities.FeatureRequest.delete(requestId);
      return Response.json({ success: true, message: 'Vorschlag gelöscht' });
    }

    // Admin-only: bulk cleanup of old resolved/withdrawn feature requests
    if (action === 'cleanup') {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { olderThanDays } = body;
      const days = parseInt(olderThanDays) || 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const all = await base44.asServiceRole.entities.FeatureRequest.list('-created_date', 500);
      const toDelete = (all || []).filter(r =>
        ['implemented', 'rejected', 'withdrawn'].includes(r.status) &&
        new Date(r.created_date) < cutoff
      );

      for (const r of toDelete) {
        await base44.asServiceRole.entities.FeatureRequest.delete(r.id);
      }

      return Response.json({
        success: true,
        message: `${toDelete.length} Vorschläge gelöscht (älter als ${days} Tage)`,
        deletedCount: toDelete.length
      });
    }

    return Response.json({ error: 'Unbekannte Aktion: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});