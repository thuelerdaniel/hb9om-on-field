import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { XMLParser } from 'npm:fast-xml-parser@4.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { callsign, qrz_username, qrz_password } = await req.json();
    if (!callsign || callsign.length < 3) {
      return Response.json({ error: 'Invalid callsign' }, { status: 400 });
    }

    const xmlParser = new XMLParser({ ignoreAttributes: false });
    const agent = 'hb9om-onfield';

    // Build credential list: user-provided first, then app-level env vars as fallback
    const envUser = Deno.env.get("QRZ_USERNAME");
    const envPass = Deno.env.get("QRZ_PASSWORD");
    const credentialSets = [];
    if (qrz_username && qrz_password) {
      credentialSets.push({ user: qrz_username, pass: qrz_password, label: 'user' });
    }
    if (envUser && envPass) {
      credentialSets.push({ user: envUser, pass: envPass, label: 'app' });
    }

    if (credentialSets.length === 0) {
      return Response.json({ error: 'QRZ.com Anmeldedaten nicht konfiguriert – in Einstellungen erfassen oder QRZ-Abfrage deaktivieren' }, { status: 200 });
    }

    // Step 1: Get session key — try each credential set until one works
    let sessionKey = null;
    let lastError = 'Login fehlgeschlagen';
    for (const creds of credentialSets) {
      const loginUrl = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(creds.user)};password=${encodeURIComponent(creds.pass)};agent=${agent}`;
      const loginResp = await fetch(loginUrl);
      const loginXml = await loginResp.text();
      const loginData = xmlParser.parse(loginXml);
      const session = loginData?.QRZDatabase?.Session;
      if (session?.Key) {
        sessionKey = session.Key;
        break;
      }
      lastError = session?.Message || 'Login fehlgeschlagen';
    }

    if (!sessionKey) {
      return Response.json({ error: `QRZ.com: ${lastError}` }, { status: 200 });
    }

    // Step 2: Look up callsign
    const lookupUrl = `https://xmldata.qrz.com/xml/current/?s=${sessionKey};callsign=${encodeURIComponent(callsign)}`;
    const lookupResp = await fetch(lookupUrl);
    const lookupXml = await lookupResp.text();
    const lookupData = xmlParser.parse(lookupXml);

    const lookupSession = lookupData?.QRZDatabase?.Session;
    const callsignData = lookupData?.QRZDatabase?.Callsign;

    if (!callsignData) {
      const msg = lookupSession?.Message || 'Keine Daten gefunden';
      return Response.json({ error: `QRZ.com: ${msg}` }, { status: 200 });
    }

    return Response.json({
      callsign: callsignData.call,
      name: [callsignData.fname, callsignData.name].filter(Boolean).join(' '),
      address: [callsignData.addr1, callsignData.addr2, callsignData.zip, callsignData.state].filter(Boolean).join(', '),
      country: callsignData.country || callsignData.ccodes,
      grid: callsignData.grid || '',
      email: callsignData.email || '',
      lat: callsignData.lat ? parseFloat(callsignData.lat) : null,
      lng: callsignData.lon ? parseFloat(callsignData.lon) : null,
      iqrcode: callsignData.iqrcode || null,
      url: callsignData.url || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});