import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const newUser = body.data || {};
    const event = body.event || {};

    // Only process user creation events
    if (event.type && event.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not a create event' });
    }

    const userEmail = newUser.email || 'unbekannt';
    const userName = newUser.full_name || 'nicht angegeben';
    const timestamp = new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' });

    // Get all admin users via service role
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === 'admin');

    if (admins.length === 0) {
      return Response.json({ success: true, notified: 0, reason: 'no admins found' });
    }

    let sent = 0;
    for (const admin of admins) {
      if (admin.email) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: "Neue Benutzerregistrierung - HB9OM On Field",
            body: `Hallo,\n\nein neuer Benutzer hat sich auf HB9OM On Field registriert:\n\nE-Mail: ${userEmail}\nName: ${userName}\nDatum: ${timestamp}\n\nDie Benutzerdetails koennen in der App unter Einstellungen > Benutzerverwaltung eingesehen werden.\n\n73,\nHB9OM On Field`
          });
          sent++;
        } catch (e) {
          // Continue with other admins
        }
      }
    }

    return Response.json({ success: true, notified: sent, totalAdmins: admins.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});