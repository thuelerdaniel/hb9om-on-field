import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEMO_EMAIL = 'demo@hb9om.ch';
const DEMO_PASSWORD = 'demo1234';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Check if demo user exists and is verified
    const users = await base44.asServiceRole.entities.User.list("-created_date", 500);
    const demoUser = users.find(u => u.email === DEMO_EMAIL);

    if (!demoUser) {
      return Response.json({ 
        error: 'Demo-Benutzer noch nicht eingerichtet. Ein Admin muss dies einmalig in den Einstellungen vornehmen.' 
      }, { status: 400 });
    }

    if (!demoUser.is_verified) {
      return Response.json({ 
        error: 'Demo-Benutzer noch nicht verifiziert. Ein Admin muss dies einmalig in den Einstellungen vornehmen.' 
      }, { status: 400 });
    }

    // Login as demo user — works because the account is already verified
    const { access_token } = await base44.auth.loginViaEmailPassword(DEMO_EMAIL, DEMO_PASSWORD);

    // Notify admins about demo login (if enabled)
    try {
      const admins = users.filter(u => u.role === 'admin');

      // Check which admins opted in to demo-login notifications
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: "notify_demo_login" });
      const settingsByUser = {};
      for (const s of settings) {
        settingsByUser[s.created_by_id] = s.enabled !== false;
      }

      // Get client IP for context
      const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unbekannt';
      const timestamp = new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' });

      for (const admin of admins) {
        if (!admin.email) continue;
        // Skip admins who disabled demo-login notifications (default: enabled)
        if (settingsByUser[admin.id] === false) continue;
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: "Demo-Login - HB9OM On Field",
            body: `Hallo,\n\njemand hat sich als Demo-Benutzer auf HB9OM On Field angemeldet.\n\nDatum: ${timestamp}\nIP: ${clientIp}\n\nDies ist eine automatische Benachrichtigung. Sie kann in den Einstellungen > Admin-Bereich > E-Mail-Benachrichtigungen deaktiviert werden.\n\n73,\nHB9OM On Field`
          });
        } catch (e) {
          // Continue with other admins
        }
      }
    } catch (e) {
      // Notification failure should not block login
    }

    return Response.json({ success: true, access_token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});