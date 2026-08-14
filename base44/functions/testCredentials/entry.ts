import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { XMLParser } from 'npm:fast-xml-parser@4.5.2';

// Central credential test function — validates API credentials for all services.
// Returns success/failure with the source response so users see what the API returned.
//
// Services:
//   qrz          — QRZ.com login test (username + password) + callsign lookup
//   qrz_apikey    — QRZ.com API key test (for logbook upload)
//   aprs          — APRS.fi API key test
//   repeaterbook  — RepeaterBook login test (username + password)
//   brandmeister  — BrandMeister login test (username + password or API key)
//   club_qrz      — Club QRZ.com login test
//   club_qrz_apikey — Club QRZ API key test
//   club_aprs     — Club APRS.fi API key test
//   club_bm       — Club BrandMeister API key test
//
// Parameters: { service, callsign?, scope? }
// scope: 'personal' | 'club' | 'auto' — which credentials to test (default: user.credential_source or 'auto')

const CLUB_CALLSIGN_KEY = 'club_callsign_config';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const { service, callsign } = body;
    const scope = body.scope || (user as any).credential_source || 'auto';
    const xmlParser = new XMLParser({ ignoreAttributes: false });

    async function getClubConfig(): Promise<any> {
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: CLUB_CALLSIGN_KEY });
        if (settings?.length > 0) return JSON.parse(settings[0].value || '{}');
      } catch {}
      return {};
    }

    // === QRZ Login Test ===
    if (service === 'qrz') {
      const clubConfig = await getClubConfig();
      const pUser = (user as any).qrz_username || '';
      const pPass = (user as any).qrz_password || '';
      const cUser = clubConfig.qrz_username || '';
      const cPass = clubConfig.qrz_password || '';
      const eUser = process.env.QRZ_USERNAME || '';
      const ePass = process.env.QRZ_PASSWORD || '';

      let qrzUser = '', qrzPass = '', sourceLabel = '';
      if (scope === 'personal') { qrzUser = pUser; qrzPass = pPass; sourceLabel = 'persönlich'; }
      else if (scope === 'club') { qrzUser = cUser; qrzPass = cPass; sourceLabel = 'Club'; }
      else {
        if (pUser && pPass) { qrzUser = pUser; qrzPass = pPass; sourceLabel = 'persönlich'; }
        else if (cUser && cPass) { qrzUser = cUser; qrzPass = cPass; sourceLabel = 'Club'; }
        else { qrzUser = eUser; qrzPass = ePass; sourceLabel = 'Code-Secret'; }
      }

      if (!qrzUser || !qrzPass) {
        return Response.json({ success: false, message: `Keine QRZ.com-Anmeldedaten (${sourceLabel}) hinterlegt`, source: sourceLabel });
      }

      const testCall = callsign || 'HB9OM';
      const agent = 'hb9om-onfield';
      const loginUrl = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(qrzUser)};password=${encodeURIComponent(qrzPass)};agent=${agent}`;
      const loginResp = await fetch(loginUrl);
      const loginXml = await loginResp.text();
      const loginData = xmlParser.parse(loginXml);
      const session = loginData?.QRZDatabase?.Session;

      if (!session?.Key) {
        return Response.json({
          success: false,
          message: `QRZ.com Login fehlgeschlagen (${sourceLabel}): ${session?.Message || 'unbekannt'}`,
          source: sourceLabel,
          sourceResponse: session || loginData,
        });
      }

      const lookupUrl = `https://xmldata.qrz.com/xml/current/?s=${session.Key};callsign=${encodeURIComponent(testCall)}`;
      const lookupResp = await fetch(lookupUrl);
      const lookupXml = await lookupResp.text();
      const lookupData = xmlParser.parse(lookupXml);
      const csData = lookupData?.QRZDatabase?.Callsign;

      if (csData) {
        return Response.json({
          success: true,
          message: `QRZ.com Login erfolgreich (${sourceLabel}): ${csData.call} – ${[csData.fname, csData.name].filter(Boolean).join(' ')}`,
          source: sourceLabel,
          sourceResponse: { callsign: csData.call, name: [csData.fname, csData.name].filter(Boolean).join(' '), country: csData.country || csData.ccodes, grid: csData.grid || '' },
        });
      }
      return Response.json({
        success: true,
        message: `QRZ.com Login erfolgreich (${sourceLabel}), Rufzeichen '${testCall}' nicht gefunden`,
        source: sourceLabel,
        sourceResponse: lookupData?.QRZDatabase?.Session || lookupData,
      });
    }

    // === QRZ API Key Test (logbook upload) ===
    if (service === 'qrz_apikey') {
      const clubConfig = await getClubConfig();
      const pKey = (user as any).qrz_api_key || '';
      const cKey = clubConfig.qrz_api_key || '';
      let apiKey = '', sourceLabel = '';
      if (scope === 'personal') { apiKey = pKey; sourceLabel = 'persönlich'; }
      else if (scope === 'club') { apiKey = cKey; sourceLabel = 'Club'; }
      else { if (pKey) { apiKey = pKey; sourceLabel = 'persönlich'; } else if (cKey) { apiKey = cKey; sourceLabel = 'Club'; } }

      if (!apiKey) {
        return Response.json({ success: false, message: `Kein QRZ API-Key (${sourceLabel}) hinterlegt`, source: sourceLabel });
      }
      try {
        const testUrl = `https://logbook.qrz.com/api?KEY=${encodeURIComponent(apiKey)}&ACTION=STATUS`;
        const resp = await fetch(testUrl);
        const text = await resp.text();
        const ok = !text.toLowerCase().includes('invalid') && !text.toLowerCase().includes('error');
        return Response.json({
          success: ok,
          message: ok ? `QRZ API-Key gültig (${sourceLabel})` : `QRZ API-Key ungültig (${sourceLabel}): ${text}`,
          source: sourceLabel,
          sourceResponse: text,
        });
      } catch (e: any) {
        return Response.json({ success: false, message: `QRZ API-Key Test fehlgeschlagen (${sourceLabel}): ${e.message}`, source: sourceLabel });
      }
    }

    // === APRS.fi API Key Test ===
    if (service === 'aprs') {
      const clubConfig = await getClubConfig();
      const pKey = (user as any).aprs_fi_api_key || '';
      const cKey = clubConfig.aprs_fi_api_key || '';
      const eKey = process.env.APRS_FI_API_KEY || '';
      let apiKey = '', sourceLabel = '';
      if (scope === 'personal') { apiKey = pKey; sourceLabel = 'persönlich'; }
      else if (scope === 'club') { apiKey = cKey; sourceLabel = 'Club'; }
      else { if (pKey) { apiKey = pKey; sourceLabel = 'persönlich'; } else if (cKey) { apiKey = cKey; sourceLabel = 'Club'; } else { apiKey = eKey; sourceLabel = 'Code-Secret'; } }

      if (!apiKey) {
        return Response.json({ success: false, message: `Kein APRS.fi API-Key (${sourceLabel}) hinterlegt`, source: sourceLabel });
      }
      const testUrl = `https://api.aprs.fi/api/get?name=HB9OM&what=loc&apikey=${encodeURIComponent(apiKey)}&format=json`;
      const resp = await fetch(testUrl, { headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' } });
      const data = await resp.json();
      if (data.result === 'ok') {
        return Response.json({ success: true, message: `APRS.fi API-Key gültig (${sourceLabel}): ${data.found || 0} Station(en)`, source: sourceLabel, sourceResponse: data });
      }
      if (data.code === 'ratelimit') {
        return Response.json({ success: true, message: `APRS.fi API-Key gültig (${sourceLabel}), Rate-Limit erreicht`, source: sourceLabel, sourceResponse: data });
      }
      return Response.json({ success: false, message: `APRS.fi API-Key ungültig (${sourceLabel}): ${data.description || data.code || 'unbekannt'}`, source: sourceLabel, sourceResponse: data });
    }

    // === RepeaterBook Login Test ===
    if (service === 'repeaterbook') {
      const rbUser = (user as any).repeaterbook_username || '';
      const rbPass = (user as any).repeaterbook_password || '';
      if (!rbUser || !rbPass) {
        return Response.json({ success: false, message: 'Keine RepeaterBook-Anmeldedaten hinterlegt', source: 'persönlich' });
      }
      try {
        const loginUrl = 'https://www.repeaterbook.com/repeater/login.php';
        const formData = new URLSearchParams();
        formData.append('username', rbUser);
        formData.append('password', rbPass);
        formData.append('login', 'Login');
        const resp = await fetch(loginUrl, {
          method: 'POST',
          body: formData,
          headers: { 'User-Agent': 'HB9OM-OnField/1.0' },
          redirect: 'manual' as any,
        });
        const text = await resp.text();
        const ok = text.includes('logout') || text.includes('Logout') || resp.status === 302 || resp.status === 301;
        return Response.json({
          success: ok,
          message: ok ? 'RepeaterBook-Login erfolgreich' : 'RepeaterBook-Login fehlgeschlagen – Benutzername/Passwort prüfen',
          source: 'persönlich',
          sourceResponse: { status: resp.status, snippet: text.slice(0, 200) },
        });
      } catch (e: any) {
        return Response.json({ success: false, message: `RepeaterBook-Login Test fehlgeschlagen: ${e.message}`, source: 'persönlich' });
      }
    }

    // === BrandMeister Login Test ===
    if (service === 'brandmeister') {
      const clubConfig = await getClubConfig();
      const bmUser = (user as any).bm_username || '';
      const bmPass = (user as any).bm_password || '';
      const cBmKey = clubConfig.brandmeister_api_key || '';

      if (bmUser && bmPass) {
        try {
          const resp = await fetch('https://api.brandmeister.network/v2.0/user/', {
            headers: { 'Authorization': `Basic ${btoa(`${bmUser}:${bmPass}`)}`, 'Accept': 'application/json' },
          });
          const data = await resp.json().catch(() => ({}));
          if (resp.ok && data && !data.error) {
            return Response.json({ success: true, message: `BrandMeister-Login erfolgreich: ${data.callsign || bmUser}`, source: 'persönlich', sourceResponse: data });
          }
          return Response.json({ success: false, message: `BrandMeister-Login fehlgeschlagen: ${data.error || data.message || resp.statusText}`, source: 'persönlich', sourceResponse: data });
        } catch (e: any) {
          return Response.json({ success: false, message: `BrandMeister-Login Test fehlgeschlagen: ${e.message}`, source: 'persönlich' });
        }
      }
      if (cBmKey) {
        try {
          const resp = await fetch(`https://api.brandmeister.network/v2.0/repeater/?apikey=${encodeURIComponent(cBmKey)}`, { headers: { Accept: 'application/json' } });
          const data = await resp.json().catch(() => ({}));
          if (resp.ok) return Response.json({ success: true, message: 'BrandMeister Club API-Key gültig', source: 'Club', sourceResponse: data });
          return Response.json({ success: false, message: `BrandMeister Club API-Key ungültig: ${data.error || resp.statusText}`, source: 'Club', sourceResponse: data });
        } catch (e: any) {
          return Response.json({ success: false, message: `BrandMeister Club API-Key Test fehlgeschlagen: ${e.message}`, source: 'Club' });
        }
      }
      return Response.json({ success: false, message: 'Keine BrandMeister-Anmeldedaten hinterlegt', source: 'keine' });
    }

    // === Club Credential Tests ===
    if (service === 'club_qrz') {
      const clubConfig = await getClubConfig();
      const qrzUser = clubConfig.qrz_username || '';
      const qrzPass = clubConfig.qrz_password || '';
      if (!qrzUser || !qrzPass) return Response.json({ success: false, message: 'Keine Club QRZ-Anmeldedaten hinterlegt', source: 'Club' });
      const loginUrl = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(qrzUser)};password=${encodeURIComponent(qrzPass)};agent=hb9om-onfield`;
      const loginResp = await fetch(loginUrl);
      const loginData = xmlParser.parse(await loginResp.text());
      const session = loginData?.QRZDatabase?.Session;
      if (session?.Key) {
        return Response.json({ success: true, message: 'Club QRZ-Login erfolgreich', source: 'Club', sourceResponse: { message: session.Message } });
      }
      return Response.json({ success: false, message: `Club QRZ-Login fehlgeschlagen: ${session?.Message || 'unbekannt'}`, source: 'Club', sourceResponse: session || loginData });
    }

    if (service === 'club_qrz_apikey') {
      const clubConfig = await getClubConfig();
      const apiKey = clubConfig.qrz_api_key || '';
      if (!apiKey) return Response.json({ success: false, message: 'Kein Club QRZ API-Key hinterlegt', source: 'Club' });
      try {
        const resp = await fetch(`https://logbook.qrz.com/api?KEY=${encodeURIComponent(apiKey)}&ACTION=STATUS`);
        const text = await resp.text();
        const ok = !text.toLowerCase().includes('invalid') && !text.toLowerCase().includes('error');
        return Response.json({ success: ok, message: ok ? 'Club QRZ API-Key gültig' : `Club QRZ API-Key ungültig: ${text}`, source: 'Club', sourceResponse: text });
      } catch (e: any) {
        return Response.json({ success: false, message: `Club QRZ API-Key Test fehlgeschlagen: ${e.message}`, source: 'Club' });
      }
    }

    if (service === 'club_aprs') {
      const clubConfig = await getClubConfig();
      const apiKey = clubConfig.aprs_fi_api_key || '';
      if (!apiKey) return Response.json({ success: false, message: 'Kein Club APRS.fi API-Key hinterlegt', source: 'Club' });
      const resp = await fetch(`https://api.aprs.fi/api/get?name=HB9OM&what=loc&apikey=${encodeURIComponent(apiKey)}&format=json`, { headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' } });
      const data = await resp.json();
      if (data.result === 'ok' || data.code === 'ratelimit') {
        return Response.json({ success: true, message: `Club APRS.fi API-Key gültig: ${data.found || 0} Station(en)`, source: 'Club', sourceResponse: data });
      }
      return Response.json({ success: false, message: `Club APRS.fi API-Key ungültig: ${data.description || data.code || 'unbekannt'}`, source: 'Club', sourceResponse: data });
    }

    if (service === 'club_bm') {
      const clubConfig = await getClubConfig();
      const apiKey = clubConfig.brandmeister_api_key || '';
      if (!apiKey) return Response.json({ success: false, message: 'Kein Club BrandMeister API-Key hinterlegt', source: 'Club' });
      try {
        const resp = await fetch(`https://api.brandmeister.network/v2.0/repeater/?apikey=${encodeURIComponent(apiKey)}`, { headers: { Accept: 'application/json' } });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok) return Response.json({ success: true, message: 'Club BrandMeister API-Key gültig', source: 'Club', sourceResponse: data });
        return Response.json({ success: false, message: `Club BrandMeister API-Key ungültig: ${data.error || resp.statusText}`, source: 'Club', sourceResponse: data });
      } catch (e: any) {
        return Response.json({ success: false, message: `Club BrandMeister API-Key Test fehlgeschlagen: ${e.message}`, source: 'Club' });
      }
    }

    return Response.json({ error: `Unbekannter Service: ${service}` }, { status: 400 });
  } catch (error: any) {
    return Response.json({ success: false, message: 'Test fehlgeschlagen: ' + (error.message || 'unbekannter Fehler'), error: error.message }, { status: 500 });
  }
}