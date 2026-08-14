import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Manages global and personal API keys for the app.
// Global keys (QRZ, APRS.fi, BrandMeister) are shared across admins and the demo user.
// Personal keys are stored on the User entity and override global keys when use_global_keys=false.
//
// Actions:
//   getGlobal — returns all global API keys (admin only)
//   setGlobal — sets a global API key (admin only)
//   deleteGlobal — deletes a global API key (admin only, with warning)
//   getPersonal — returns personal API keys for the current user
//   setPersonal — sets a personal API key on the current user
//   deletePersonal — deletes a personal API key from the current user
//   getClubCallsign — returns the club callsign configuration (admin only)
//   setClubCallsign — sets the club callsign configuration (admin only)
//   verifyAdminEmail — sends a verification email to a separate admin email address
//   confirmAdminEmail — confirms a separate admin email with a code

const GLOBAL_KEY_PREFIX = 'global_api_key_';
const CLUB_CALLSIGN_KEY = 'club_callsign_config';

const VALID_GLOBAL_KEYS = ['qrz_username', 'qrz_password', 'aprs_fi', 'brandmeister'];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    const action = body.action;

    // --- Global key management (admin only) ---
    if (action === 'getGlobal' || action === 'setGlobal' || action === 'deleteGlobal' || action === 'getClubCallsign' || action === 'setClubCallsign') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    if (action === 'getGlobal') {
      const keys: Record<string, string> = {};
      for (const keyName of VALID_GLOBAL_KEYS) {
        try {
          const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: GLOBAL_KEY_PREFIX + keyName });
          if (settings && settings.length > 0) {
            // Mask sensitive values — return whether they're set, not the actual value
            keys[keyName] = settings[0].value ? '***' : '';
          } else {
            keys[keyName] = '';
          }
        } catch {}
      }
      return Response.json({ status: 'success', keys });
    }

    if (action === 'setGlobal') {
      const keyName = body.keyName;
      const value = body.value;
      if (!VALID_GLOBAL_KEYS.includes(keyName)) {
        return Response.json({ error: `Ungültiger Key-Typ: ${keyName}` }, { status: 400 });
      }
      try {
        const existing = await base44.asServiceRole.entities.AppSetting.filter({ key: GLOBAL_KEY_PREFIX + keyName });
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.AppSetting.update(existing[0].id, { value, enabled: true });
        } else {
          await base44.asServiceRole.entities.AppSetting.create({ key: GLOBAL_KEY_PREFIX + keyName, value, enabled: true });
        }
      } catch (e: any) {
        return Response.json({ error: `Fehler beim Speichern: ${e.message}` }, { status: 500 });
      }
      return Response.json({ status: 'success', message: `Globaler Key '${keyName}' gespeichert` });
    }

    if (action === 'deleteGlobal') {
      const keyName = body.keyName;
      if (!VALID_GLOBAL_KEYS.includes(keyName)) {
        return Response.json({ error: `Ungültiger Key-Typ: ${keyName}` }, { status: 400 });
      }
      try {
        const existing = await base44.asServiceRole.entities.AppSetting.filter({ key: GLOBAL_KEY_PREFIX + keyName });
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.AppSetting.delete(existing[0].id);
        }
      } catch (e: any) {
        return Response.json({ error: `Fehler beim Löschen: ${e.message}` }, { status: 500 });
      }
      return Response.json({ status: 'success', message: `Globaler Key '${keyName}' gelöscht` });
    }

    // --- Club callsign management (admin only) ---
    if (action === 'getClubCallsign') {
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: CLUB_CALLSIGN_KEY });
        if (settings && settings.length > 0) {
          const config = JSON.parse(settings[0].value || '{}');
          // Mask sensitive values
          const masked = { ...config };
          if (masked.qrz_password) masked.qrz_password = '***';
          if (masked.qrz_api_key) masked.qrz_api_key = '***';
          if (masked.aprs_fi_api_key) masked.aprs_fi_api_key = '***';
          if (masked.brandmeister_api_key) masked.brandmeister_api_key = '***';
          return Response.json({ status: 'success', config: masked });
        }
      } catch {}
      return Response.json({ status: 'success', config: {} });
    }

    if (action === 'setClubCallsign') {
      const config = body.config || {};
      try {
        const existing = await base44.asServiceRole.entities.AppSetting.filter({ key: CLUB_CALLSIGN_KEY });
        // If password/api_key fields are masked ('***'), preserve existing values
        let finalConfig = { ...config };
        if (existing && existing.length > 0) {
          const oldConfig = JSON.parse(existing[0].value || '{}');
          if (finalConfig.qrz_password === '***') finalConfig.qrz_password = oldConfig.qrz_password || '';
          if (finalConfig.qrz_api_key === '***') finalConfig.qrz_api_key = oldConfig.qrz_api_key || '';
          if (finalConfig.aprs_fi_api_key === '***') finalConfig.aprs_fi_api_key = oldConfig.aprs_fi_api_key || '';
          if (finalConfig.brandmeister_api_key === '***') finalConfig.brandmeister_api_key = oldConfig.brandmeister_api_key || '';
          await base44.asServiceRole.entities.AppSetting.update(existing[0].id, { value: JSON.stringify(finalConfig), enabled: true });
        } else {
          await base44.asServiceRole.entities.AppSetting.create({ key: CLUB_CALLSIGN_KEY, value: JSON.stringify(finalConfig), enabled: true });
        }
      } catch (e: any) {
        return Response.json({ error: `Fehler beim Speichern: ${e.message}` }, { status: 500 });
      }
      return Response.json({ status: 'success', message: 'Club-Rufzeichen-Konfiguration gespeichert' });
    }

    // --- Personal key management (any authenticated user) ---
    if (action === 'getPersonal') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      return Response.json({
        status: 'success',
        keys: {
          qrz_username: user.qrz_username || '',
          qrz_password: user.qrz_password ? '***' : '',
          aprs_fi_api_key: user.aprs_fi_api_key ? '***' : '',
          brandmeister_api_key: user.brandmeister_api_key ? '***' : '',
          use_global_keys: user.use_global_keys !== false,
        }
      });
    }

    if (action === 'setPersonal') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const updateData: any = {};
      if (body.qrz_username !== undefined) updateData.qrz_username = body.qrz_username;
      if (body.qrz_password !== undefined && body.qrz_password !== '***') updateData.qrz_password = body.qrz_password;
      if (body.aprs_fi_api_key !== undefined && body.aprs_fi_api_key !== '***') updateData.aprs_fi_api_key = body.aprs_fi_api_key;
      if (body.brandmeister_api_key !== undefined && body.brandmeister_api_key !== '***') updateData.brandmeister_api_key = body.brandmeister_api_key;
      if (body.use_global_keys !== undefined) updateData.use_global_keys = body.use_global_keys;
      try {
        await base44.auth.updateMe(updateData);
      } catch (e: any) {
        return Response.json({ error: `Fehler beim Speichern: ${e.message}` }, { status: 500 });
      }
      return Response.json({ status: 'success', message: 'Persönliche Keys gespeichert' });
    }

    if (action === 'deletePersonal') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const fieldName = body.fieldName;
      const validFields = ['qrz_username', 'qrz_password', 'aprs_fi_api_key', 'brandmeister_api_key'];
      if (!validFields.includes(fieldName)) {
        return Response.json({ error: `Ungültiges Feld: ${fieldName}` }, { status: 400 });
      }
      try {
        await base44.auth.updateMe({ [fieldName]: '' });
      } catch (e: any) {
        return Response.json({ error: `Fehler beim Löschen: ${e.message}` }, { status: 500 });
      }
      return Response.json({ status: 'success', message: `Persönlicher Key '${fieldName}' gelöscht` });
    }

    // --- Admin email verification ---
    if (action === 'verifyAdminEmail') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
      const email = body.email;
      if (!email || !email.includes('@')) {
        return Response.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
      }
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      // Store code in AppSetting (temporary)
      try {
        const existing = await base44.asServiceRole.entities.AppSetting.filter({ key: `admin_email_verify_${user.id}` });
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.AppSetting.update(existing[0].id, { value: JSON.stringify({ email, code, created: new Date().toISOString() }), enabled: true });
        } else {
          await base44.asServiceRole.entities.AppSetting.create({ key: `admin_email_verify_${user.id}`, value: JSON.stringify({ email, code, created: new Date().toISOString() }), enabled: true });
        }
      } catch (e: any) {
        return Response.json({ error: `Fehler beim Speichern des Codes: ${e.message}` }, { status: 500 });
      }
      // Send verification email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `[HB9OM] Verifikations-Code für täglichen Report`,
          body: `Ihr Verifikations-Code lautet: ${code}\n\nGeben Sie diesen Code in der App ein, um die E-Mail-Adresse zu bestätigen.\n\nDer Code ist 10 Minuten gültig.`,
        });
      } catch (e: any) {
        return Response.json({ error: `E-Mail konnte nicht gesendet werden: ${e.message}` }, { status: 500 });
      }
      return Response.json({ status: 'success', message: 'Verifikations-Code gesendet' });
    }

    if (action === 'confirmAdminEmail') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
      const code = body.code;
      if (!code) return Response.json({ error: 'Code fehlt' }, { status: 400 });
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: `admin_email_verify_${user.id}` });
        if (!settings || settings.length === 0) {
          return Response.json({ error: 'Kein Verifikations-Code gefunden — bitte neu anfordern' }, { status: 400 });
        }
        const data = JSON.parse(settings[0].value || '{}');
        // Check code age (10 min)
        const ageMs = Date.now() - new Date(data.created).getTime();
        if (ageMs > 10 * 60 * 1000) {
          await base44.asServiceRole.entities.AppSetting.delete(settings[0].id);
          return Response.json({ error: 'Code abgelaufen — bitte neu anfordern' }, { status: 400 });
        }
        if (data.code !== code) {
          return Response.json({ error: 'Falscher Code' }, { status: 400 });
        }
        // Confirm email on user
        await base44.auth.updateMe({
          admin_email_override: data.email,
          admin_email_verified: true,
        });
        // Clean up verification record
        await base44.asServiceRole.entities.AppSetting.delete(settings[0].id);
      } catch (e: any) {
        return Response.json({ error: `Fehler: ${e.message}` }, { status: 500 });
      }
      return Response.json({ status: 'success', message: 'E-Mail-Adresse verifiziert' });
    }

    if (action === 'sendTestReport') {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
      // Trigger the daily admin report for just this admin
      try {
        const reportRes = await base44.functions.invoke('sendDailyAdminReport', { targetUserId: user.id, scheduled: true });
        return Response.json({ status: 'success', message: 'Test-Report gesendet', result: reportRes });
      } catch (e: any) {
        return Response.json({ error: `Fehler: ${e.message}` }, { status: 500 });
      }
    }

    return Response.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (error: any) {
    return Response.json({
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}