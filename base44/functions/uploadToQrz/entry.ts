import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

const CLUB_CALLSIGN_KEY = 'club_callsign_config';

// Uploads ADIF data to QRZ.com logbook.
// Uses personal QRZ API key (if target=personal) or club API key (if target=club).
// QRZ Logbook API: https://logbook.qrz.com/api.php

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    const { adif_data, target } = await req.json();
    if (!adif_data) return Response.json({ error: 'Keine ADIF-Daten übermittelt' }, { status: 400 });

    // Get QRZ API key based on target
    let apiKey = '';

    if (target === 'personal') {
      // Use personal QRZ API key from user entity
      apiKey = (user as any).qrz_api_key || '';
    }

    if (!apiKey) {
      // Fall back to club config API key
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: CLUB_CALLSIGN_KEY });
        if (settings?.length > 0) {
          const config = JSON.parse(settings[0].value || '{}');
          apiKey = config.qrz_api_key || '';
        }
      } catch {}
    }

    if (!apiKey) {
      return Response.json({
        error: 'Kein QRZ API-Key konfiguriert. Bitte in den Einstellungen erfassen (Club-Rufzeichen → QRZ API-Key oder persönlicher API-Key).'
      }, { status: 200 });
    }

    // Upload to QRZ logbook API
    const params = new URLSearchParams();
    params.append('KEY', apiKey);
    params.append('ACTION', 'INSERT');
    params.append('DATA', adif_data);

    const response = await fetch('https://logbook.qrz.com/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const resultText = await response.text();

    // Parse result — QRZ returns plain text or XML
    if (resultText.includes('OK') || resultText.includes('result')) {
      const count = (adif_data.match(/<eor>/gi) || []).length;
      return Response.json({
        status: 'success',
        message: `${count} QSO${count !== 1 ? 's' : ''} erfolgreich zu QRZ.com hochgeladen`,
        raw: resultText.substring(0, 500),
      });
    } else {
      return Response.json({
        status: 'error',
        error: `QRZ.com Antwort: ${resultText.substring(0, 200)}`,
      });
    }
  } catch (error: any) {
    return Response.json({
      error: error.message || String(error),
    }, { status: 500 });
  }
}