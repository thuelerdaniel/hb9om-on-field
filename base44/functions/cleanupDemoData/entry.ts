import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEMO_EMAIL = 'demo@hb9om.ch';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find demo user by email
    const users = await base44.asServiceRole.entities.User.list("-created_date", 500);
    const demoUser = users.find(u => u.email === DEMO_EMAIL);
    if (!demoUser) {
      return Response.json({ skipped: true, message: 'Demo user not found' });
    }

    // Delete all demo user's data (but keep the account itself)
    await base44.asServiceRole.entities.Log.deleteMany({ created_by_id: demoUser.id });
    await base44.asServiceRole.entities.QrzLookup.deleteMany({ created_by_id: demoUser.id });
    await base44.asServiceRole.entities.AppSetting.deleteMany({ created_by_id: demoUser.id });

    return Response.json({ success: true, message: 'Demo data cleaned up', demoUser: demoUser.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});