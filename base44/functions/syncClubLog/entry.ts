import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isSyncPaused } from '../../shared/syncPause.ts';

// syncClubLog — v0.9003
// Uploads PRIVATE QSOs (is_clubstation: false) to ClubLog (clublog.org).
// Uses service-role to load QSOs (bypasses RLS for multi-user access).
// ClubLog API: POST https://clublog.org/cfm.php with call=HB3YNF, api=USER_CLUBLOG_KEY, adif=ADIF_DATA
// After upload: sets clublog_synced=true and clublog_sync_date.
// NEVER uploads club QSOs — only private QSOs (is_clubstation: false).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    // v0.9018 BUGFIX 1: Check sync_paused flag — skip if paused
    if (await isSyncPaused(base44)) {
      return Response.json({ success: true, uploaded: 0, message: 'Sync ist pausiert — ClubLog-Upload übersprungen', paused: true });
    }

    // 1. Read ClubLog API key — per-user from UserHuntingSettings, fallback to AppSetting
    let clublogApiKey = '';
    const userSettings = await base44.entities.UserHuntingSettings.filter({ user_id: user.id });
    if (userSettings && userSettings.length > 0) {
      clublogApiKey = (userSettings[0] as any).clublog_api_key || '';
    }
    if (!clublogApiKey) {
      const appSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'clublog_api_key' });
      if (appSettings && appSettings.length > 0) {
        clublogApiKey = appSettings[0].value || '';
      }
    }
    if (!clublogApiKey) {
      return Response.json({ error: 'Kein ClubLog API-Key konfiguriert (UserHuntingSettings.clublog_api_key oder AppSetting clublog_api_key)' }, { status: 400 });
    }

    // 2. Private callsign — fixed HB3YNF per spec
    const privateCallsign = 'HB3YNF';

    // 3. Load private QSOs via service-role — ONLY is_clubstation: false, not yet synced
    const sr = base44.asServiceRole;
    const privateQsos = await sr.entities.Log.filter(
      { is_clubstation: false, clublog_synced: { $ne: true }, status: 'active' },
      '-qso_date', 500
    );

    if (!privateQsos || privateQsos.length === 0) {
      return Response.json({ success: true, uploaded: 0, message: 'Keine neuen QSOs für ClubLog' });
    }

    // 4. Convert QSOs to ADIF string
    let adifString = '';
    for (const qso of privateQsos) {
      const fullCall = (qso.callsign || '') + (qso.callsign_suffix || '');
      if (fullCall) adifString += `<CALL:${fullCall.length}>${fullCall}`;
      if (qso.band) adifString += `<BAND:${qso.band.length}>${qso.band}`;
      if (qso.mode) adifString += `<MODE:${qso.mode.length}>${qso.mode}`;
      if (qso.frequency) { const f = String(qso.frequency); adifString += `<FREQ:${f.length}>${f}`; }
      if (qso.qso_date) { const d = qso.qso_date.replace(/-/g, ''); adifString += `<QSO_DATE:8>${d}`; }
      if (qso.time_start) { const t = qso.time_start.replace(/:/g, '').substring(0, 6); adifString += `<TIME_ON:6>${t}`; }
      if (qso.rst_sent) adifString += `<RST_SENT:${qso.rst_sent.length}>${qso.rst_sent}`;
      if (qso.rst_received) adifString += `<RST_RCVD:${qso.rst_received.length}>${qso.rst_received}`;
      if (qso.operator_name) adifString += `<NAME:${qso.operator_name.length}>${qso.operator_name}`;
      if (qso.operator_grid) adifString += `<GRIDSQUARE:${qso.operator_grid.length}>${qso.operator_grid}`;
      if (qso.operator_country) adifString += `<COUNTRY:${qso.operator_country.length}>${qso.operator_country}`;
      if (qso.notes) adifString += `<COMMENT:${qso.notes.length}>${qso.notes}`;
      if (qso.my_grid) adifString += `<MY_GRIDSQUARE:${qso.my_grid.length}>${qso.my_grid}`;
      adifString += '<EOR>';
    }

    // 5. Upload to ClubLog
    const params = new URLSearchParams();
    params.append('call', privateCallsign);
    params.append('api', clublogApiKey);
    params.append('adif', adifString);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch('https://clublog.org/cfm.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const resultText = await response.text();

    if (response.ok && !resultText.toLowerCase().includes('error')) {
      // 6. Mark QSOs as synced via service-role
      const now = new Date().toISOString();
      let syncedCount = 0;
      for (const qso of privateQsos) {
        try {
          await sr.entities.Log.update(qso.id, {
            clublog_synced: true,
            clublog_sync_date: now,
          });
          syncedCount++;
        } catch {}
      }

      return Response.json({
        success: true,
        uploaded: syncedCount,
        message: `${syncedCount} QSOs an ClubLog (${privateCallsign}) gesendet`,
      });
    } else {
      return Response.json({
        success: false,
        error: `ClubLog: ${resultText.substring(0, 200)}`,
      });
    }
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}