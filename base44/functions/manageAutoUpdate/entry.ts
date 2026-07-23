import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Manages the single, global "auto_update" flag shared by ALL admins.
// The AppSetting entity is RLS-scoped per user, which would create one record per admin.
// This function uses the service role to keep exactly ONE canonical record, so every admin
// sees and toggles the same value regardless of who set it.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch {}
    const action = body.action || 'get';

    if (action === 'get') {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'auto_update' });
      const enabled = settings.length === 0 ? true : settings[0].enabled !== false;
      return Response.json({ enabled, record_count: settings.length });
    }

    if (action === 'set') {
      const enabled = body.enabled !== false; // default true unless explicitly false
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'auto_update' });
      let recordId;
      if (settings.length === 0) {
        const created = await base44.asServiceRole.entities.AppSetting.create({
          key: 'auto_update', enabled, value: String(enabled)
        });
        recordId = created.id;
      } else {
        recordId = settings[0].id;
        await base44.asServiceRole.entities.AppSetting.update(recordId, {
          enabled, value: String(enabled)
        });
        // Consolidate: delete any duplicate records so exactly one remains
        for (let i = 1; i < settings.length; i++) {
          try { await base44.asServiceRole.entities.AppSetting.delete(settings[i].id); } catch {}
        }
      }
      return Response.json({ enabled, recordId, consolidated: settings.length > 1, remaining: settings.length > 1 ? 1 : settings.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});