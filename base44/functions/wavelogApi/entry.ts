import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Wavelog API Proxy — v0.9022
// Vermeidet Mixed-Content Blocking (App ist HTTPS, Wavelog-Server ist HTTP).
// Alle Wavelog API-Calls werden ueber dieses Backend-Function geleitet.
//
// Endpoints:
//   action=test    → /index.php/api/version    (Verbindung testen)
//   action=stations → /index.php/api/station_info (Stationen abrufen)
//   action=upload  → /index.php/api/qso       (QSO senden)
//   action=import  → /index.php/api/get_contacts_adif (QSOs importieren)
//
// LAN/WAN Fallback: versucht LAN (3s Timeout), dann WAN.
// API Key wird im JSON-Body gesendet (nicht im Header).

interface WavelogConfig {
  lan_url?: string;
  wan_url?: string;
  api_key: string;
  station_id?: string;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}

    const action = body.action || 'test';
    const config: WavelogConfig = {
      lan_url: body.lan_url || '',
      wan_url: body.wan_url || '',
      api_key: body.api_key || '',
      station_id: body.station_id || '',
    };

    if (!config.api_key) {
      return Response.json({ error: 'Kein API-Key angegeben' }, { status: 400 });
    }

    // LAN/WAN Fallback: versuche LAN zuerst (3s), dann WAN
    const tryFetch = async (baseUrl: string, endpoint: string, payload: object, timeoutMs: number = 10000) => {
      const url = `${baseUrl.replace(/\/+$/, '')}/index.php/api/${endpoint}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const text = await resp.text();
        let json: any;
        try { json = JSON.parse(text); } catch { json = { raw: text }; }
        return { ok: resp.ok, status: resp.status, data: json, url: baseUrl };
      } catch (e) {
        clearTimeout(timeout);
        return { ok: false, status: 0, data: null, url: baseUrl, error: e.message };
      }
    };

    const resolveBaseUrl = async (): Promise<string | null> => {
      // 1. LAN versuchen (3s Timeout)
      if (config.lan_url) {
        const r = await tryFetch(config.lan_url, 'version', { key: config.api_key }, 3000);
        if (r.ok) return config.lan_url;
      }
      // 2. WAN Fallback
      if (config.wan_url) {
        const r = await tryFetch(config.wan_url, 'version', { key: config.api_key }, 5000);
        if (r.ok) return config.wan_url;
      }
      return null;
    };

    switch (action) {
      case 'test': {
        const baseUrl = await resolveBaseUrl();
        if (!baseUrl) {
          return Response.json({ connected: false, error: 'Weder LAN noch WAN erreichbar' });
        }
        const r = await tryFetch(baseUrl, 'version', { key: config.api_key }, 5000);
        return Response.json({
          connected: r.ok,
          version: r.data?.version || r.data?.raw || 'unbekannt',
          baseUrl,
        });
      }

      case 'stations': {
        const baseUrl = await resolveBaseUrl();
        if (!baseUrl) return Response.json({ error: 'Server nicht erreichbar' }, { status: 502 });
        const r = await tryFetch(baseUrl, 'station_info', { key: config.api_key }, 8000);
        return Response.json({ stations: r.data || [], baseUrl });
      }

      case 'upload': {
        if (!body.adif_string) return Response.json({ error: 'Kein ADIF-String' }, { status: 400 });
        if (!config.station_id) return Response.json({ error: 'Keine Station-ID' }, { status: 400 });
        const baseUrl = await resolveBaseUrl();
        if (!baseUrl) return Response.json({ error: 'Server nicht erreichbar' }, { status: 502 });
        const r = await tryFetch(baseUrl, 'qso', {
          key: config.api_key,
          station_profile_id: config.station_id,
          type: 'adif',
          string: body.adif_string,
        }, 10000);
        return Response.json({ result: r.data, ok: r.ok });
      }

      case 'import': {
        if (!config.station_id) return Response.json({ error: 'Keine Station-ID' }, { status: 400 });
        const baseUrl = await resolveBaseUrl();
        if (!baseUrl) return Response.json({ error: 'Server nicht erreichbar' }, { status: 502 });
        const fetchfromid = body.fetchfromid || 0;
        const r = await tryFetch(baseUrl, 'get_contacts_adif', {
          key: config.api_key,
          station_id: config.station_id,
          fetchfromid,
        }, 15000);
        return Response.json({ result: r.data, ok: r.ok });
      }

      default:
        return Response.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}