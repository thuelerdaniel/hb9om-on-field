import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEMO_EMAIL = 'demo@hb9om.ch';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fresh DB lookup for the actual role — JWT may be stale after a promotion
    let dbRole = currentUser.role;
    try {
      const freshUser = await base44.asServiceRole.entities.User.get(currentUser.id);
      if (freshUser?.role) dbRole = freshUser.role;
    } catch (e) {
      // fall back to me() role
    }

    const isAdmin = dbRole === 'admin';

    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      // empty body
    }

    const { action } = body;

    // checkStatus is lightweight — works for non-admins too
    if (action === 'checkStatus') {
      return Response.json({ isAdmin, role: dbRole });
    }

    // All other actions require admin
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden', message: 'Admin access required' }, { status: 403 });
    }

    if (action === 'list') {
      const users = await base44.asServiceRole.entities.User.list("-created_date", 200);
      return Response.json({ users: users || [] });
    }

    if (action === 'updateRole') {
      const { userId, role } = body;
      if (!userId || !role) {
        return Response.json({ error: 'Missing userId or role' }, { status: 400 });
      }
      if (userId === currentUser.id) {
        return Response.json({ error: 'Cannot change your own role' }, { status: 400 });
      }
      await base44.asServiceRole.entities.User.update(userId, { role });
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      const { userId } = body;
      if (!userId) {
        return Response.json({ error: 'Missing userId' }, { status: 400 });
      }
      if (userId === currentUser.id) {
        return Response.json({ error: 'Cannot delete yourself' }, { status: 400 });
      }
      await base44.asServiceRole.entities.User.delete(userId);
      return Response.json({ success: true });
    }

    if (action === 'setupDemoUser') {
      try {
        await base44.auth.register({ email: DEMO_EMAIL, password: 'demo1234' });
        return Response.json({ success: true, message: 'Demo-Benutzer registriert. OTP-Code wurde an demo@hb9om.ch gesendet – bitte unten eingeben.' });
      } catch (e) {
        const msg = e.message || '';
        if (msg.includes('already') || msg.includes('exists') || msg.includes('Exists')) {
          try {
            await base44.auth.resendOtp(DEMO_EMAIL);
            return Response.json({ success: true, message: 'OTP-Code erneut an demo@hb9om.ch gesendet – bitte unten eingeben.' });
          } catch (e2) {
            return Response.json({ error: 'Demo-Benutzer existiert bereits. Bitte OTP-Code eingeben.' }, { status: 500 });
          }
        }
        return Response.json({ error: msg || 'Registrierung fehlgeschlagen' }, { status: 500 });
      }
    }

    if (action === 'verifyDemoOtp') {
      const { otpCode } = body;
      if (!otpCode) {
        return Response.json({ error: 'OTP-Code fehlt' }, { status: 400 });
      }
      try {
        await base44.auth.verifyOtp({ email: DEMO_EMAIL, otpCode });
        return Response.json({ success: true, message: 'Demo-Benutzer verifiziert! Login mit demo@hb9om.ch / demo123 jetzt möglich.' });
      } catch (e) {
        return Response.json({ error: e.message || 'Verifizierung fehlgeschlagen' }, { status: 500 });
      }
    }

    if (action === 'updateField') {
      const { userId, field, value } = body;
      if (!userId || !field) {
        return Response.json({ error: 'Missing userId or field' }, { status: 400 });
      }
      // Whitelist of fields that admins can update on other users
      const allowedFields = ['donation_hidden', 'donation_confirmed', 'admin_email_enabled', 'admin_email_override', 'admin_email_verified'];
      if (!allowedFields.includes(field)) {
        return Response.json({ error: 'Field not allowed' }, { status: 400 });
      }
      // If donation_confirmed is set to true, automatically also set donation_hidden
      if (field === 'donation_confirmed' && value === true) {
        await base44.asServiceRole.entities.User.update(userId, { donation_confirmed: true, donation_hidden: true });
      } else {
        await base44.asServiceRole.entities.User.update(userId, { [field]: value });
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});