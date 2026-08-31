import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Uploads ADIF data to QRZ.com logbook.
// Uses personal QRZ API key (if target=personal) or club API key from environment secret.
// QRZ Logbook API: https://logbook.qrz.com/api.php

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const { adif_data, target } = await req.json();
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