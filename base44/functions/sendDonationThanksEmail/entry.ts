import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Sendet eine Dankes-E-Mail an einen User nach einer Spende.
// Wird von adminManageUsers aufgerufen wenn donation_confirmed false → true wechselt.
// Parameter: user_id
// Duplikat-Schutz: wird nur beim ERSTEN Setzen von donation_confirmed aufgerufen.
// Falls keine gültige E-Mail: Fehler zurückgeben, aber donation_confirmed trotzdem gesetzt.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fresh DB lookup for the actual role
    let dbRole = currentUser.role;
    try {
      const freshUser = await base44.asServiceRole.entities.User.get(currentUser.id);
      if (freshUser?.role) dbRole = freshUser.role;
    } catch (e) {}

    if (dbRole !== 'admin') {
      return Response.json({ error: 'Forbidden', message: 'Admin access required' }, { status: 403 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch (e) {}

    const { user_id } = body;
    if (!user_id) {
      return Response.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Load target user
    const targetUser = await base44.asServiceRole.entities.User.get(user_id);
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Validate email — prefer donation_email, fall back to login email
    const email = targetUser.donation_email || targetUser.email;
    if (!email || !email.includes('@') || !email.includes('.')) {
      return Response.json({
        success: false,
        error: 'no_email',
        message: 'User hat keine gültige E-Mail hinterlegt'
      });
    }

    const fullName = targetUser.full_name || 'Funkamateur';
    const subject = 'Danke für deine Spende — HB9OM On Field';
    const emailBody = `Hallo ${fullName},

herzlichen Dank für deine Spende an HB9OM On Field!

Als Dankeschön wird das Spenden-Popup für dich dauerhaft deaktiviert. Die Spenden-Info findest du weiterhin im Splash-Screen und in der Hilfe.

73 und viel Spass im Feld,
Daniel HB9OM
HB9OM On Field`;

    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: subject,
        body: emailBody,
      });
      return Response.json({ success: true, email: email });
    } catch (e) {
      return Response.json({
        success: false,
        error: 'send_failed',
        message: 'Dankes-E-Mail an User konnte nicht gesendet werden',
        detail: e.message
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});