import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// manageSyncPause — v0.9018 NACHFOLGE
// Per-user sync pause: each user with Wavelog config can pause THEIR OWN sync.
// Stored in UserHuntingSettings.sync_paused (boolean).
// Also supports the legacy global pause (admin-only) via action='global_set'/'global_get'.
//
// Actions:
//   action='get'        → returns { paused } for the calling user
//   action='set'        → sets paused state for the calling user, returns { success, paused }
//   action='global_get' → returns global paused state (any user)
//   action='global_set' → sets global paused state (admin-only)
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = body.action || 'get';

    // --- Per-user pause (the calling user controls their own sync) ---
    if (action === 'get') {
      const settings = await base44.entities.UserHuntingSettings.filter({ user_id: user.id });
      const paused = !!(settings && settings.length > 0 && settings[0].sync_paused === true);
      return Response.json({ paused });
    }

    if (action === 'set') {
      const paused = body.paused === true;
      const settings = await base44.entities.UserHuntingSettings.filter({ user_id: user.id });
      if (settings && settings.length > 0) {
        await base44.entities.UserHuntingSettings.update(settings[0].id, { sync_paused: paused });
      } else {
        await base44.entities.UserHuntingSettings.create({ user_id: user.id, sync_paused: paused });
      }
      console.log(`[manageSyncPause] User ${user.email} sync_paused = ${paused}`);
      return Response.json({ success: true, paused });
    }

    // --- Legacy global pause (admin-only emergency stop) ---
    if (action === 'global_get') {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'sync_paused' });
      const paused = !!(settings && settings.length > 0 && settings[0].value === 'true');
      return Response.json({ paused, global: true });
    }

    if (action === 'global_set') {
      if ((user as any).role !== 'admin') {
        return Response.json({ error: 'Globaler Sync-Stop nur für Admins' }, { status: 403 });
      }
      const paused = body.paused === true;
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'sync_paused' });
      if (settings && settings.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(settings[0].id, {
          value: String(paused),
          description: 'Global Log-Sync Pause Flag (admin)',
        });
      } else {
        await base44.asServiceRole.entities.AppSetting.create({
          key: 'sync_paused',
          value: String(paused),
          description: 'Global Log-Sync Pause Flag (admin)',
          enabled: true,
        });
      }
      console.log(`[manageSyncPause] GLOBAL sync_paused = ${paused} (by ${user.email})`);
      return Response.json({ success: true, paused, global: true });
    }

    return Response.json({ error: 'Unbekannte Action. Verwende get, set, global_get oder global_set.' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}