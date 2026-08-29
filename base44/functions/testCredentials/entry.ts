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
      const pUser = (user as any).qrz_username || '';
      const pPass = (user as any).qrz_password || '';
      const cUser = process.env.QRZ_USERNAME || '';
      const cPass = process.env.QRZ_PASSWORD || '';
      const eUser = cUser;
      const ePass = cPass;

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
      const pKey = (user as any).qrz_api_key || '';
      const cKey = process.env.QRZ_API_KEY || '';
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

    // === RepeaterBook API-Token Test ===
    // RepeaterBook hat seit März 2026 Cloudflare-Anti-Bot-Schutz — Login per Username/Passwort
    // funktioniert nicht mehr. Stattdessen wird ein API-Token (rbuapp_...) verwendet.
    // Token-Header: X-RB-App-Token, User-Agent muss App-Name/Version enthalten.
    if (service === 'repeaterbook') {
      const clubConfig = await getClubConfig();
      const pToken = (user as any).repeaterbook_api_token || '';
      const cToken = clubConfig.repeaterbook_api_token || '';
      const eToken = process.env.REPEATERBOOK_API_TOKEN || '';
      let token = '', sourceLabel = '';
      if (scope === 'personal') { token = pToken; sourceLabel = 'persönlich'; }
      else if (scope === 'club') { token = cToken; sourceLabel = 'Club'; }
      else { if (pToken) { token = pToken; sourceLabel = 'persönlich'; } else if (cToken) { token = cToken; sourceLabel = 'Club'; } else { token = eToken; sourceLabel = 'Code-Secret'; } }

      if (!token) {
        return Response.json({ success: false, message: `Kein RepeaterBook API-Token (${sourceLabel}) hinterlegt`, source: sourceLabel });
      }
      try {
        // Test: API-Call mit Token-Header — exportROW.php mit country=Switzerland
        const testUrl = 'https://www.repeaterbook.com/api/exportROW.php?country=Switzerland';
        const resp = await fetch(testUrl, {
          headers: {
            'X-RB-App-Token': token,
            'User-Agent': 'HB9OM-OnField/1.0 (+https://hb9om.online; tech@hb9om.ch)',
            'Accept': 'application/json',
          },
        });
        if (resp.status === 401 || resp.status === 403) {
          return Response.json({ success: false, message: `RepeaterBook API-Token ungültig (${sourceLabel}) — Token prüfen oder App-Freischaltung`, source: sourceLabel, sourceResponse: { status: resp.status } });
        }
        if (resp.status === 429) {
          return Response.json({ success: false, message: `RepeaterBook Rate-Limit erreicht (${sourceLabel}) — später erneut versuchen`, source: sourceLabel, sourceResponse: { status: 429 } });
        }
        const text = await resp.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch {}
        // Token gültig wenn API JSON mit Repeatern oder leeres Array zurückgibt
        if (resp.ok && (Array.isArray(data) || (data && data.results !== undefined))) {
          const count = Array.isArray(data) ? data.length : (data?.results?.length || 0);
          return Response.json({ success: true, message: `RepeaterBook API-Token gültig (${sourceLabel}): ${count} Relais für Schweiz`, source: sourceLabel, sourceResponse: { count } });
        }
        return Response.json({ success: false, message: `RepeaterBook API-Token ungültig (${sourceLabel}): ${text.slice(0, 200)}`, source: sourceLabel, sourceResponse: { status: resp.status, snippet: text.slice(0, 200) } });
      } catch (e: any) {
        return Response.json({ success: false, message: `RepeaterBook API-Token Test fehlgeschlagen (${sourceLabel}): ${e.message}`, source: sourceLabel });
      }
    }

    // === BrandMeister API-Key Test ===
    // BrandMeister nutzt API-Keys statt Login-Formular. Key im Dashboard unter
    // Profile → API generieren. Repeater-Liste ist öffentlich, persönliche Daten brauchen Key.
    if (service === 'brandmeister') {
      const clubConfig = await getClubConfig();
      const pKey = (user as any).brandmeister_api_key || '';
      const cKey = clubConfig.brandmeister_api_key || '';
      const eKey = process.env.BRANDMEISTER_API_KEY || '';
      let apiKey = '', sourceLabel = '';
      if (scope === 'personal') { apiKey = pKey; sourceLabel = 'persönlich'; }
      else if (scope === 'club') { apiKey = cKey; sourceLabel = 'Club'; }
      else { if (pKey) { apiKey = pKey; sourceLabel = 'persönlich'; } else if (cKey) { apiKey = cKey; sourceLabel = 'Club'; } else { apiKey = eKey; sourceLabel = 'Code-Secret'; } }

      if (!apiKey) {
        // Repeater-Liste ist öffentlich — ohne Key verfügbar
        return Response.json({ success: false, message: 'Kein BrandMeister API-Key hinterlegt — Repeater-Liste öffentlich verfügbar, persönliche Daten benötigen Key', source: 'keine' });
      }
      try {
        // Test: /v2/user/ mit Bearer-Key
        const resp = await fetch('https://api.brandmeister.network/v2.0/user/', {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
        });
        if (resp.status === 401 || resp.status === 403) {
          return Response.json({ success: false, message: `BrandMeister API-Key ungültig (${sourceLabel}) — Key prüfen oder neu generieren`, source: sourceLabel, sourceResponse: { status: resp.status } });
        }
        if (resp.status === 429) {
          return Response.json({ success: false, message: `BrandMeister Rate-Limit erreicht (${sourceLabel}) — später erneut versuchen`, source: sourceLabel, sourceResponse: { status: 429 } });
        }
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data && !data.error) {
          return Response.json({ success: true, message: `BrandMeister API-Key gültig (${sourceLabel}): ${data.callsign || 'verbunden'}`, source: sourceLabel, sourceResponse: data });
        }
        return Response.json({ success: false, message: `BrandMeister API-Key ungültig (${sourceLabel}): ${data.error || data.message || resp.statusText}`, source: sourceLabel, sourceResponse: data });
      } catch (e: any) {
        return Response.json({ success: false, message: `BrandMeister API-Key Test fehlgeschlagen (${sourceLabel}): ${e.message}`, source: sourceLabel });
      }
    }

    // === Club Credential Tests ===
    if (service === 'club_qrz') {
      const qrzUser = process.env.QRZ_USERNAME || '';
      const qrzPass = process.env.QRZ_PASSWORD || '';
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
      const apiKey = process.env.QRZ_API_KEY || '';
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

    // === Club RepeaterBook API-Token Test ===
    if (service === 'club_repeaterbook') {
      const clubConfig = await getClubConfig();
      const token = clubConfig.repeaterbook_api_token || '';
      if (!token) return Response.json({ success: false, message: 'Kein Club RepeaterBook API-Token hinterlegt', source: 'Club' });
      try {
        const testUrl = 'https://www.repeaterbook.com/api/exportROW.php?country=Switzerland';
        const resp = await fetch(testUrl, {
          headers: {
            'X-RB-App-Token': token,
            'User-Agent': 'HB9OM-OnField/1.0 (+https://hb9om.online; tech@hb9om.ch)',
            'Accept': 'application/json',
          },
        });
        if (resp.status === 401 || resp.status === 403) {
          return Response.json({ success: false, message: `Club RepeaterBook API-Token ungültig — Token prüfen oder App-Freischaltung`, source: 'Club', sourceResponse: { status: resp.status } });
        }
        const text = await resp.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch {}
        if (resp.ok && (Array.isArray(data) || (data && data.results !== undefined))) {
          const count = Array.isArray(data) ? data.length : (data?.results?.length || 0);
          return Response.json({ success: true, message: `Club RepeaterBook API-Token gültig: ${count} Relais für Schweiz`, source: 'Club', sourceResponse: { count } });
        }
        return Response.json({ success: false, message: `Club RepeaterBook API-Token ungültig: ${text.slice(0, 200)}`, source: 'Club', sourceResponse: { status: resp.status, snippet: text.slice(0, 200) } });
      } catch (e: any) {
        return Response.json({ success: false, message: `Club RepeaterBook API-Token Test fehlgeschlagen: ${e.message}`, source: 'Club' });
      }
    }

    return Response.json({ error: `Unbekannter Service: ${service}` }, { status: 400 });
  } catch (error: any) {
    return Response.json({ success: false, message: 'Test fehlgeschlagen: ' + (error.message || 'unbekannter Fehler'), error: error.message }, { status: 500 });
  }
}