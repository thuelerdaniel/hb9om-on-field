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

    return Response.json({ success: true, access_token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});