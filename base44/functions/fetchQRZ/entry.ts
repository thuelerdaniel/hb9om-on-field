import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { XMLParser } from 'npm:fast-xml-parser@4.5.2';

const DEMO_EMAIL = 'demo@hb9om.ch';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { callsign } = await req.json();
    if (!callsign || callsign.length < 3) {
      return Response.json({ error: 'Invalid callsign' }, { status: 400 });
    }

    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const xmlParser = new XMLParser({ ignoreAttributes: false });
    const agent = 'hb9om-onfield';

    // Determine credential source:
    // - Admins and demo user → use app-level env vars (club subscription)
    // - Regular users → use their personal QRZ credentials stored on user entity
    const isAdmin = user.role === 'admin';
    const isDemo = user.email === DEMO_EMAIL;

    let qrzUser = null;
    let qrzPass = null;
    let credentialLabel = 'user';

    if (isAdmin || isDemo) {
      qrzUser = Deno.env.get('QRZ_USERNAME');
      qrzPass = Deno.env.get('QRZ_PASSWORD');
      credentialLabel = 'club';
    } else {
      qrzUser = user.qrz_username || null;
      qrzPass = user.qrz_password || null;
      credentialLabel = 'personal';
    }

    if (!qrzUser || !qrzPass) {
      if (isAdmin || isDemo) {
        return Response.json({ error: 'QRZ.com Club-Anmeldedaten nicht konfiguriert. Bitte wenden Sie sich an den Administrator.' }, { status: 200 });
      }
      return Response.json({ error: 'Keine QRZ.com Anmeldedaten hinterlegt. Bitte in den Einstellungen Ihren QRZ-Benutzernamen und Ihr Passwort erfassen.' }, { status: 200 });
    }

    // Step 1: Get session key
    const loginUrl = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(qrzUser)};password=${encodeURIComponent(qrzPass)};agent=${agent}`;
    const loginResp = await fetch(loginUrl);
    const loginXml = await loginResp.text();
    const loginData = xmlParser.parse(loginXml);
    const session = loginData?.QRZDatabase?.Session;

    if (!session?.Key) {
      const errMsg = session?.Message || 'Login fehlgeschlagen';
      return Response.json({ error: `QRZ.com: ${errMsg}` }, { status: 200 });
    }

    const sessionKey = session.Key;

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
    return Response.json({ error: 'QRZ.com Abfrage fehlgeschlagen: ' + (error.message || 'unbekannter Fehler') }, { status: 200 });
  }
});