import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Sends the version changelog email to ALL registered users.
// Only works once per version: stores the sent version in AppSetting (key: "changelog_email_version").
// Admin-only — verifies user.role === 'admin' before proceeding.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Nur Administratoren dürfen diese Funktion auslösen' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch {}
    const version = body.version;
    const changelogText = body.changelog_text;
    const changelogTitle = body.changelog_title || 'Versions-Änderungen';

    if (!version || !changelogText) {
      return Response.json({ error: 'Version und Changelog-Text sind erforderlich' }, { status: 400 });
    }

    // Check if this version was already sent
    const existing = await base44.asServiceRole.entities.AppSetting.filter({ key: 'changelog_email_version' });
    if (existing.length > 0 && existing[0].value === version) {
      return Response.json({ already_sent: true, message: `Changelog für v${version} wurde bereits an alle Benutzer verschickt` });
    }

    // Fetch all users
    const users = await base44.asServiceRole.entities.User.list();
    const recipients = users.filter(u => u.email);
    if (recipients.length === 0) {
      return Response.json({ error: 'Keine Benutzer mit E-Mail-Adresse gefunden' }, { status: 400 });
    }

    const subject = `HB9OM On Field – Neuigkeiten in Version ${version}`;
    const emailBody = `Hallo,\n\nEs gibt eine neue Version von HB9OM On Field!\n\nVersion ${version} – ${changelogTitle}\n\nWas ist neu:\n${changelogText}\n\nDie App wird beim nächsten Start automatisch aktualisiert. Besuchen Sie hb9om.ch für mehr Informationen.\n\n73,\nClub HB9OM`;

    let sentCount = 0;
    let failedCount = 0;
    for (const recipient of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipient.email,
          subject: subject,
          body: emailBody,
        });
        sentCount++;
      } catch {
        failedCount++;
      }
    }

    // Store the sent version so it can't be sent again for the same version
    if (existing.length > 0) {
      await base44.asServiceRole.entities.AppSetting.update(existing[0].id, {
        value: version,
        enabled: true,
      });
    } else {
      await base44.asServiceRole.entities.AppSetting.create({
        key: 'changelog_email_version',
        value: version,
        enabled: true,
      });
    }

    return Response.json({
      success: true,
      version: version,
      sent: sentCount,
      failed: failedCount,
      total_recipients: recipients.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}