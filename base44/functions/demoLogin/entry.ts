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
      console.log("Demo user not found");
      return Response.json({ 
        error: 'Demo-Benutzer noch nicht eingerichtet. Ein Admin muss dies einmalig in den Einstellungen vornehmen.' 
      }, { status: 400 });
    }

    if (!demoUser.is_verified) {
      console.log("Demo user not verified");
      return Response.json({ 
        error: 'Demo-Benutzer noch nicht verifiziert. Ein Admin muss dies einmalig in den Einstellungen vornehmen.' 
      }, { status: 400 });
    }

    // Login as demo user — works because the account is already verified
    const { access_token } = await base44.auth.loginViaEmailPassword(DEMO_EMAIL, DEMO_PASSWORD);

    // Notify admins about demo login
    let sent = 0;
    let skipped = 0;
    let errors = [];
    try {
      const admins = users.filter(u => u.role === 'admin');
      console.log(`Found ${admins.length} admin(s):`, admins.map(a => ({ id: a.id, email: a.email })));

      if (admins.length === 0) {
        console.log("No admins found - skipping notifications");
      } else {
        // Check which admins opted in to demo-login notifications (default: enabled)
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: "notify_demo_login" });
        const settingsByUser = {};
        for (const s of settings) {
          settingsByUser[s.created_by_id] = s.enabled !== false;
        }
        console.log("Demo login settings by user:", settingsByUser);

        // Get client IP for context
        const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unbekannt';
        const timestamp = new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' });

        for (const admin of admins) {
          if (!admin.email) {
            console.log(`Admin ${admin.id} has no email - skipping`);
            skipped++;
            continue;
          }
          // Skip admins who explicitly disabled demo-login notifications (default: enabled)
          if (settingsByUser[admin.id] === false) {
            console.log(`Admin ${admin.email} disabled demo-login notifications - skipping`);
            skipped++;
            continue;
          }
          try {
            console.log(`Sending demo-login email to ${admin.email}...`);
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: admin.email,
              subject: "Demo-Login - HB9OM On Field",
              body: `Hallo,\n\njemand hat sich als Demo-Benutzer auf HB9OM On Field angemeldet.\n\nDatum: ${timestamp}\nIP: ${clientIp}\n\nDies ist eine automatische Benachrichtigung. Sie kann in den Einstellungen > Admin-Bereich > E-Mail-Benachrichtigungen deaktiviert werden.\n\n73,\nHB9OM On Field`
            });
            sent++;
            console.log(`Email sent to ${admin.email}`);
          } catch (e) {
            console.error(`Failed to send email to ${admin.email}:`, e.message || e);
            errors.push({ admin: admin.email, error: e.message || String(e) });
          }
        }
      }
    } catch (e) {
      console.error("Notification block error:", e.message || e);
      errors.push({ block: e.message || String(e) });
    }

    return Response.json({ success: true, access_token, notified: sent, skipped, errors });
  } catch (error) {
    console.error("demoLogin fatal error:", error.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});