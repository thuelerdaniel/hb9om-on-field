import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// manageSyncPause — v0.9018 BUGFIX 1
// Toggles the global sync_paused flag in AppSetting.
// When true: all log sync functions skip execution (wavelogApi permanent_sync,
// fetchQrzClubLog, syncClubLog). Admin-only.
//
// Actions:
//   action='get'  → returns { paused: boolean }
//   action='set'  → sets paused state, returns { success: true, paused: boolean }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if ((user as any).role !== 'admin') {
      return Response.json({ error: 'Nur Admins dürfen den Sync-Status ändern' }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const action = body.action || 'get';

    if (action === 'get') {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'sync_paused' });
      const paused = !!(settings && settings.length > 0 && settings[0].value === 'true');
      return Response.json({ paused });
    }

    if (action === 'set') {
      const paused = body.paused === true;
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'sync_paused' });
      if (settings && settings.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(settings[0].id, {
          value: String(paused),
          description: 'Log-Sync Pause Flag (v0.9018 BUGFIX 1)',
        });
      } else {
        await base44.asServiceRole.entities.AppSetting.create({
          key: 'sync_paused',
          value: String(paused),
          description: 'Log-Sync Pause Flag (v0.9018 BUGFIX 1)',
          enabled: true,
        });
      }
      console.log(`[manageSyncPause] Sync paused = ${paused} (by ${user.email})`);
      return Response.json({ success: true, paused });
    }

    return Response.json({ error: 'Unbekannte Action. Verwende get oder set.' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}