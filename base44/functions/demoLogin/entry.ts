import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEMO_EMAIL = 'demo@hb9om.ch';
const DEMO_PASSWORD = 'demo1234';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find demo user
    const users = await base44.asServiceRole.entities.User.list("-created_date", 500);
    let demoUser = users.find(u => u.email === DEMO_EMAIL);

    // Register demo user if it doesn't exist
    if (!demoUser) {
      try {
        await base44.auth.register({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      } catch (e) {
        // ignore — user may have been created race-conditionally
      }
      // Re-fetch
      const users2 = await base44.asServiceRole.entities.User.list("-created_date", 500);
      demoUser = users2.find(u => u.email === DEMO_EMAIL);
    }

    if (!demoUser) {
      return Response.json({ error: 'Demo-Benutzer konnte nicht erstellt werden' }, { status: 500 });
    }

    // Ensure demo user is verified — loginViaEmailPassword fails for unverified users
    if (!demoUser.is_verified) {
      await base44.asServiceRole.entities.User.update(demoUser.id, { is_verified: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});