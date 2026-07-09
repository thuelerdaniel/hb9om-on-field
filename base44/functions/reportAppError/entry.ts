import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try { body = await req.json(); } catch { body = {}; }

    const { errorType, message, stack, url, userAgent, timestamp } = body;

    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    // Check which admins opted in to app-error notifications
    const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: "notify_app_errors" });
    const settingsByUser = {};
    for (const s of settings) {
      settingsByUser[s.created_by_id] = s.enabled !== false;
    }

    const ts = timestamp || new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' });
    const userInfo = `Benutzer: ${user.email || 'unbekannt'}${user.full_name ? ' (' + user.full_name + ')' : ''}`;

    let sent = 0;
    for (const admin of admins) {
      if (!admin.email) continue;
      if (settingsByUser[admin.id] === false) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject: `App-Fehler - HB9OM On Field - ${errorType || 'Error'}`,
          body: `Hallo,\n\nein Fehler ist in der HB9OM On Field App aufgetreten:\n\nFehlertyp: ${errorType || 'unbekannt'}\nNachricht: ${message || 'keine'}\nZeitpunkt: ${ts}\n${userInfo}\nSeite: ${url || 'unbekannt'}\nBrowser: ${userAgent || 'unbekannt'}\n\nStack Trace:\n${stack || 'nicht verfuegbar'}\n\n73,\nHB9OM On Field`
        });
        sent++;
      } catch (e) {}
    }

    return Response.json({ success: true, notified: sent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});