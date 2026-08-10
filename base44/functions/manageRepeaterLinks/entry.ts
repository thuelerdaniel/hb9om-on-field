import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'listAll';

    // listAll / approve / reject / update / delete — admin only
    if (['listAll', 'approve', 'reject', 'update', 'delete', 'listApproved'].includes(action)) {
      const isAdmin = user.role === 'admin';
      if (['listAll', 'approve', 'reject', 'update', 'delete'].includes(action) && !isAdmin) {
        return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
      }

      if (action === 'listAll') {
        const links = await base44.asServiceRole.entities.RepeaterLink.list('-created_date', 500);
        return Response.json({ links });
      }

      if (action === 'listApproved') {
        const links = await base44.asServiceRole.entities.RepeaterLink.filter({ status: 'approved' });
        return Response.json({ links });
      }

      if (action === 'approve') {
        const { id, adminComment } = body;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const updated = await base44.asServiceRole.entities.RepeaterLink.update(id, {
          status: 'approved',
          reviewed_by_name: user.full_name || user.email,
          admin_comment: adminComment || ''
        });
        return Response.json({ link: updated });
      }

      if (action === 'reject') {
        const { id, adminComment } = body;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        const updated = await base44.asServiceRole.entities.RepeaterLink.update(id, {
          status: 'rejected',
          reviewed_by_name: user.full_name || user.email,
          admin_comment: adminComment || ''
        });
        return Response.json({ link: updated });
      }

      if (action === 'update') {
        const { id, ...fields } = body;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        delete fields.action;
        const updated = await base44.asServiceRole.entities.RepeaterLink.update(id, fields);
        return Response.json({ link: updated });
      }

      if (action === 'delete') {
        const { id } = body;
        if (!id) return Response.json({ error: 'id required' }, { status: 400 });
        await base44.asServiceRole.entities.RepeaterLink.delete(id);
        return Response.json({ success: true });
      }
    }

    // suggest — any logged-in user can create a link suggestion
    if (action === 'suggest') {
      const { from_callsign, from_frequency, from_lat, from_lng,
              to_callsign, to_frequency, to_lat, to_lng,
              link_type, color, line_style, description, network } = body;
      if (!from_callsign || !to_callsign) {
        return Response.json({ error: 'from_callsign and to_callsign required' }, { status: 400 });
      }
      const created = await base44.entities.RepeaterLink.create({
        from_callsign, from_frequency, from_lat, from_lng,
        to_callsign, to_frequency, to_lat, to_lng,
        link_type: link_type || 'permanent',
        color: color || '#3b82f6',
        line_style: line_style || 'dashed',
        description: description || '',
        network: network || '',
        status: 'pending',
        submitted_by_name: user.full_name || user.email,
      });
      return Response.json({ link: created });
    }

    // listOwn — user sees their own suggestions
    if (action === 'listOwn') {
      const links = await base44.entities.RepeaterLink.list('-created_date', 100);
      return Response.json({ links });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}