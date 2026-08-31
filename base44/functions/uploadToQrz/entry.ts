import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Uploads ADIF data to QRZ.com logbook.
// Uses personal QRZ API key (if target=personal) or club API key from environment secret.
// QRZ Logbook API: https://logbook.qrz.com/api.php

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const body = await req.json();
    let { adif_data, target } = body;

    // v0.9003: Backend-Filter — when target=club, load QSOs from entity (is_clubstation: true only).
    // This ensures the backend controls what gets uploaded, not the frontend.
    // Private QSOs (is_clubstation: false) are NEVER uploaded to QRZ.
    if (target === 'club') {
      const clubQsos = await base44.asServiceRole.entities.Log.filter(
        { is_clubstation: true, club_callsign: 'HB9OM', status: 'active' },
        '-qso_date', 500
      );
      if (!clubQsos || clubQsos.length === 0) {
        return Response.json({ error: 'Keine Club-QSOs (is_clubstation: true, club_callsign: HB9OM) zum Hochladen' }, { status: 200 });
      }
      // Generate ADIF from club QSOs — backend controls content
      adif_data = '<adif_ver:5>3.1.4\n<programid:14>HB9OM On Field\n<eoh>\n\n';
      for (const qso of clubQsos) {
        const fullCall = (qso.callsign || '') + (qso.callsign_suffix || '');
        if (fullCall) adif_data += `<CALL:${fullCall.length}>${fullCall}`;
        if (qso.band) adif_data += `<BAND:${qso.band.length}>${qso.band}`;
        if (qso.mode) adif_data += `<MODE:${qso.mode.length}>${qso.mode}`;
        if (qso.frequency) { const f = String(qso.frequency); adif_data += `<FREQ:${f.length}>${f}`; }
        if (qso.qso_date) { const d = qso.qso_date.replace(/-/g, ''); adif_data += `<QSO_DATE:8>${d}`; }
        if (qso.time_start) { const t = qso.time_start.replace(/:/g, '').substring(0, 6); adif_data += `<TIME_ON:6>${t}`; }
        if (qso.rst_sent) adif_data += `<RST_SENT:${qso.rst_sent.length}>${qso.rst_sent}`;
        if (qso.rst_received) adif_data += `<RST_RCVD:${qso.rst_received.length}>${qso.rst_received}`;
        if (qso.operator_name) adif_data += `<NAME:${qso.operator_name.length}>${qso.operator_name}`;
        if (qso.operator_country) adif_data += `<COUNTRY:${qso.operator_country.length}>${qso.operator_country}`;
        if (qso.operator_grid) adif_data += `<GRIDSQUARE:${qso.operator_grid.length}>${qso.operator_grid}`;
        if (qso.notes) adif_data += `<COMMENT:${qso.notes.length}>${qso.notes}`;
        if (qso.my_grid) adif_data += `<MY_GRIDSQUARE:${qso.my_grid.length}>${qso.my_grid}`;
        adif_data += '<EOR>';
      }
    }

    if (!adif_data) return Response.json({ error: 'Keine ADIF-Daten übermittelt' }, { status: 400 });

    // PUNKT 4: Demo-Block — Demo-Account darf keine QSOs zu QRZ hochladen
    const DEMO_EMAIL = 'demo@hb9om.ch';
    if ((user as any).email === DEMO_EMAIL) {
      return Response.json({
        error: 'QRZ-Upload im Demo-Konto gesperrt. Bitte registriere dich für eigene Uploads.'
      }, { status: 403 });
    }

    // PUNKT 3: User isolation — strikte Trennung von Club- und Personal-Key.
    // Personal-Upload verwendet NUR den persönlichen Key (kein Fallback auf Club-Key).
    // Club-Upload verwendet NUR den Club-Key aus dem Secret (kein Zugriff auf Personal-Keys).
    let apiKey = '';

    if (target === 'personal') {
      // Personal: nur den persönlichen QRZ API-Key aus dem User-Entity
      apiKey = (user as any).qrz_api_key || '';
      if (!apiKey) {
        return Response.json({
          error: 'Kein persönlicher QRZ API-Key konfiguriert. Bitte in den Einstellungen erfassen (Mein Rufzeichen → QRZ API-Key).'
        }, { status: 200 });
      }
    } else {
      // v0.9003: Club — read API key from AppSetting (club_callsign_config.qrz_logbook_api_key),
      // fall back to QRZ_API_KEY environment secret.
      // Club-Upload ist für alle User erlaubt (Club-Log ist gemeinschaftlich)
      try {
        const clubConfig = await base44.asServiceRole.entities.AppSetting.filter({ key: 'club_callsign_config' });
        if (clubConfig && clubConfig.length > 0) {
          const config = JSON.parse(clubConfig[0].value || '{}');
          apiKey = config.qrz_logbook_api_key || '';
        }
      } catch {}
      if (!apiKey) apiKey = Deno.env.get('QRZ_API_KEY') || '';
      if (!apiKey) {
        return Response.json({
          error: 'Kein Club QRZ API-Key konfiguriert. Bitte an den Administrator wenden.'
        }, { status: 200 });
      }
    }

    // Upload to QRZ logbook API
    // API docs: https://www.qrz.com/docs/logbook/QRZLogbookAPI.html
    // Endpoint: https://logbook.qrz.com/api  (NOT api.php)
    // Params: KEY, ACTION=INSERT, ADIF=<adif data>
    // Response: RESULT=OK&LOGIDS=...&COUNT=...
    const params = new URLSearchParams();
    params.append('KEY', apiKey);
    params.append('ACTION', 'INSERT');
    params.append('ADIF', adif_data);

    const response = await fetch('https://logbook.qrz.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const resultText = await response.text();

    // Parse result — QRZ returns: RESULT=OK&LOGIDS=...&COUNT=...  or  RESULT=FAIL&REASON=...
    if (resultText.includes('RESULT=OK') || resultText.includes('RESULT=ok')) {
      const countMatch = resultText.match(/COUNT=(\d+)/i);
      const count = countMatch ? parseInt(countMatch[1]) : (adif_data.match(/<eor>/gi) || []).length;
      return Response.json({
        status: 'success',
        message: `${count} QSO${count !== 1 ? 's' : ''} erfolgreich zu QRZ.com hochgeladen`,
        raw: resultText.substring(0, 500),
      });
    } else {
      // Extract REASON from fail response if present
      const reasonMatch = resultText.match(/REASON=([^\s&]+)/i);
      const reason = reasonMatch ? reasonMatch[1] : resultText.substring(0, 200);
      return Response.json({
        status: 'error',
        error: `QRZ.com: ${reason}`,
      });
    }
  } catch (error: any) {
    return Response.json({
      error: error.message || String(error),
    }, { status: 500 });
  }
}