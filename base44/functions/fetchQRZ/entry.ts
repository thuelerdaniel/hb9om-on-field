import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { XMLParser } from 'npm:fast-xml-parser@4.5.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { callsign } = await req.json();
    if (!callsign || callsign.length < 3) {
      return Response.json({ error: 'Invalid callsign' }, { status: 400 });
    }

    const username = Deno.env.get('QRZ_USERNAME');
    const password = Deno.env.get('QRZ_PASSWORD');
    if (!username || !password) {
      return Response.json({ error: 'QRZ.com Anmeldedaten nicht konfiguriert' }, { status: 500 });
    }

    const xmlParser = new XMLParser({ ignoreAttributes: false });
    const agent = 'hb9om-onfield';

    // Step 1: Get session key
    const loginUrl = `https://xmldata.qrz.com/xml/current/?username=${encodeURIComponent(username)};password=${encodeURIComponent(password)};agent=${agent}`;
    const loginResp = await fetch(loginUrl);
    const loginXml = await loginResp.text();
    const loginData = xmlParser.parse(loginXml);

    const session = loginData?.QRZDatabase?.Session;
    const sessionKey = session?.Key;
    if (!sessionKey) {
      const msg = session?.Message || 'Login fehlgeschlagen';
      return Response.json({ error: `QRZ.com: ${msg}` }, { status: 502 });
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