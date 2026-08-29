import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from '../../shared/internalAuth.ts';

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

    let body: any = {};
    try { body = await req.json(); } catch {}

    const isInternal = isInternalCall(body);
    const action = body.action || 'test';
    let user: any = null;
    // v0.9025: permanent_sync requires NO auth — it reads config from UserHuntingSettings via asServiceRole
    if (!isInternal && action !== 'permanent_sync') {
      user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const config: WavelogConfig = {
      lan_url: body.lan_url || '',
      wan_url: body.wan_url || '',
      api_key: body.api_key || '',
      station_id: body.station_id || '',
    };

    if (action !== 'permanent_sync' && action !== 'upload' && !config.api_key) {
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
        if (!baseUrl) return Response.json({ stations: [], baseUrl: null });
        const r = await tryFetch(baseUrl, 'station_info', { key: config.api_key }, 8000);
        // station_info kann fehlschlagen (Wavelog 3.1.0 Bug) — leeres Array als Fallback
        if (!r.ok || r.data?.status === 'failed' || !Array.isArray(r.data)) {
          return Response.json({ stations: [], baseUrl, stationInfoFailed: true });
        }
        return Response.json({ stations: r.data, baseUrl });
      }

      case 'upload': {
        // v0.9034 SECURITY: Read Wavelog config from UserHuntingSettings — NEVER from body
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const userSettings = await base44.entities.UserHuntingSettings.filter(
          { user_id: user.id, wavelog_enabled: true }
        );
        if (!userSettings || userSettings.length === 0) {
          return Response.json({ error: 'Wavelog nicht aktiviert für diesen Nutzer' }, { status: 403 });
        }
        const settings = userSettings[0];
        if (!settings.wavelog_api_key) {
          return Response.json({ error: 'Kein Wavelog API-Key konfiguriert' }, { status: 400 });
        }
        const wavelogUrl = (settings.wavelog_wan_url || settings.wavelog_lan_url || '').replace(/\/+$/, '');
        if (!wavelogUrl) {
          return Response.json({ error: 'Keine Wavelog-Server-URL konfiguriert' }, { status: 400 });
        }

        // ADIF-String from body (QSO data — not server config)
        const adifString = body.string || body.adifString || body.adif_data || body.adif || body.adif_string;
        if (!adifString) return Response.json({ error: 'Kein ADIF-String' }, { status: 400 });

        const r = await tryFetch(wavelogUrl, 'qso', {
          key: settings.wavelog_api_key,
          station_profile_id: settings.wavelog_station_id || '1',
          type: 'adif',
          string: adifString,
        }, 10000);
        if (r.ok && r.data?.status !== 'failed') {
          return Response.json({
            success: true,
            ok: true,
            result: r.data,
            status: r.data?.status,
            adif_count: r.data?.adif_count || 0,
            adif_errors: r.data?.adif_errors || 0,
            messages: r.data?.messages || [],
            message: `${r.data?.adif_count || 0} QSOs an Wavelog gesendet`,
          });
        }
        return Response.json({
          success: false,
          ok: false,
          result: r.data,
          error: r.data?.reason || r.data?.message || 'Upload fehlgeschlagen',
          status: r.status,
        }, { status: 400 });
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

        // v0.9032: ADIF parsing and import in backend (not frontend)
        const wavelogData = r.data;
        if (!r.ok || !wavelogData) {
          return Response.json({ success: false, error: 'Wavelog API Fehler', ok: r.ok });
        }
        if (!wavelogData.adif || wavelogData.exported_qsos === 0) {
          return Response.json({
            success: true, imported: 0, skipped: 0, errors: 0,
            message: 'Keine neuen QSOs bei Wavelog',
            lastfetchedid: wavelogData.lastfetchedid || fetchfromid,
          });
        }

        const adif = wavelogData.adif;
        const exported_qsos = wavelogData.exported_qsos || 0;
        const lastfetchedid = wavelogData.lastfetchedid || '0';

        // Remove ADIF header (everything before <EOH>) — case-insensitive
        const eohIndex = adif.toUpperCase().indexOf('<EOH>');
        let adifData = adif;
        if (eohIndex >= 0) adifData = adif.substring(eohIndex + 5);

        // Split into individual QSO records by <EOR> — case-insensitive
        const records = adifData.split(/<EOR>/i).filter(rec => rec.trim().length > 0);
        console.log(`[Wavelog] Parsing ${records.length} ADIF records (exported: ${exported_qsos})`);

        // ADIF field parser: <FIELDNAME:LENGTH>VALUE (optional :TYPE specifier)
        function parseAdifRecord(record: string): Record<string, string> {
          const fields: Record<string, string> = {};
          const regex = /<([A-Z_]+):(\d+)(?::[A-Z]+)?>([^<]*)/gi;
          let match;
          while ((match = regex.exec(record)) !== null) {
            const name = match[1].toUpperCase();
            const length = parseInt(match[2]);
            let value = match[3] || '';
            if (length > 0 && value.length > length) value = value.substring(0, length);
            value = value.replace(/[\r\n]+/g, '').trim();
            fields[name] = value;
          }
          return fields;
        }

        function formatDate(d: string): string {
          if (!d || d.length !== 8) return d || '';
          return d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
        }

        function formatTime(t: string): string {
          if (!t) return '';
          const p = t.padStart(6, '0');
          return p.substring(0, 2) + ':' + p.substring(2, 4) + ':' + p.substring(4, 6);
        }

        // Parse ALL records — NO early return, NO break
        const qsos: any[] = [];
        const parseErrors: string[] = [];

        for (let i = 0; i < records.length; i++) {
          try {
            const f = parseAdifRecord(records[i]);
            if (!f.CALL) { parseErrors.push(`Record ${i}: No CALL field`); continue; }
            const freq = parseFloat(f.FREQ || '0');
            const isClub = !!(f.STATION_CALLSIGN && f.OPERATOR && f.OPERATOR !== f.STATION_CALLSIGN);
            qsos.push({
              callsign: f.CALL,
              frequency: freq || undefined,
              band: f.BAND || undefined,
              mode: f.MODE || undefined,
              qso_date: formatDate(f.QSO_DATE || ''),
              time_start: formatTime(f.TIME_ON || ''),
              time_end: formatTime(f.TIME_OFF || '') || undefined,
              rst_sent: f.RST_SENT || undefined,
              rst_received: f.RST_RCVD || undefined,
              power: parseFloat(f.TX_PWR || '0') || undefined,
              operator_name: f.NAME || undefined,
              operator_email: f.EMAIL || undefined,
              operator_country: f.COUNTRY || undefined,
              operator_grid: f.GRIDSQUARE || undefined,
              operator_address: f.QTH || undefined,
              notes: f.COMMENT || undefined,
              wavelog_imported: true,
              wavelog_import_date: new Date().toISOString(),
              wavelog_synced: false,
              is_clubstation: isClub,
              club_callsign: f.STATION_CALLSIGN || undefined,
              club_operator_callsign: isClub ? f.OPERATOR : undefined,
              my_grid: f.MY_GRIDSQUARE || undefined,
              my_reference_name: f.MY_CITY || undefined,
              my_country_name: f.MY_COUNTRY || undefined,
              my_country_prefix: f.MY_STATE || undefined,
            });
          } catch (err: any) {
            parseErrors.push(`Record ${i}: ${err.message || 'parse error'}`);
          }
        }

        console.log(`[Wavelog] Parsed ${qsos.length} QSOs, ${parseErrors.length} parse errors`);

        // v0.9032: Batch import using bulkCreate (100 per batch) — NO dedup, import ALL
        let importedCount = 0;
        let errorCount = 0;
        const importErrors: string[] = [];
        const BATCH_SIZE = 100;

        for (let i = 0; i < qsos.length; i += BATCH_SIZE) {
          const batch = qsos.slice(i, i + BATCH_SIZE);
          try {
            await base44.entities.Log.bulkCreate(batch);
            importedCount += batch.length;
            console.log(`[Wavelog] Imported ${importedCount}/${qsos.length}`);
          } catch (err: any) {
            // Fallback: create individually
            for (const qso of batch) {
              try {
                await base44.entities.Log.create(qso);
                importedCount++;
              } catch (e2: any) {
                errorCount++;
                if (importErrors.length < 10) {
                  importErrors.push(`${qso.callsign} ${qso.qso_date}: ${e2.message || 'create error'}`);
                }
              }
            }
          }
        }

        // Update last_fetch_id in UserHuntingSettings
        try {
          const settings = await base44.entities.UserHuntingSettings.filter({ user_id: user.id });
          if (settings && settings.length > 0) {
            await base44.entities.UserHuntingSettings.update(settings[0].id, {
              wavelog_last_fetch_id: parseInt(lastfetchedid),
            });
          }
        } catch (e: any) {
          console.log('[Wavelog] Could not update last_fetch_id:', e.message);
        }

        return Response.json({
          success: true,
          imported: importedCount,
          errors: errorCount,
          total_parsed: qsos.length,
          total_from_wavelog: exported_qsos,
          lastfetchedid,
          parse_errors: parseErrors.slice(0, 5),
          import_errors: importErrors,
          message: `Imported ${importedCount} QSOs from Wavelog (${errorCount} errors)`,
        });
      }

      case 'permanent_sync': {
        // v0.9025: No auth check — reads config from UserHuntingSettings, safe operation
        const sr = base44.asServiceRole;
        const settings = await sr.entities.UserHuntingSettings.filter(
          { wavelog_enabled: true, wavelog_auto_sync: true },
          '-updated_date', 50
        );

        const results: any[] = [];

        for (const setting of settings) {
          if (!setting.wavelog_api_key) continue;
          const userId = setting.user_id || setting.created_by_id;
          const syncBaseUrl = (setting.wavelog_wan_url || setting.wavelog_lan_url || '').replace(/\/+$/, '');
          if (!syncBaseUrl) {
            results.push({ user_id: userId, error: 'Keine Server-URL', status: 'skipped' });
            continue;
          }

          const lastFetchId = setting.wavelog_last_fetch_id || 0;
          let importedCount = 0;
          let exportedCount = 0;

          // Step A: Import new QSOs from Wavelog (delta load)
          try {
            const importResp = await fetch(`${syncBaseUrl}/index.php/api/get_contacts_adif`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                key: setting.wavelog_api_key,
                station_id: setting.wavelog_station_id || '1',
                fetchfromid: lastFetchId,
              }),
            });
            const importData = await importResp.json();

            if (importData?.adif && importData.exported_qsos > 0) {
              const adif = importData.adif;
              const newLastFetchId = importData.lastfetchedid || lastFetchId;

              const eohIdx = adif.toUpperCase().indexOf('<EOH>');
              let adifData = adif;
              if (eohIdx >= 0) adifData = adif.substring(eohIdx + 5);
              const records = adifData.split(/<EOR>/i).filter(r => r.trim().length > 0);

              const qsos: any[] = [];
              for (const record of records) {
                const fields: Record<string, string> = {};
                const regex = /<([A-Z_]+):(\d+)(?::[A-Z]+)?>([^<]*)/gi;
                let m;
                while ((m = regex.exec(record)) !== null) {
                  const name = m[1].toUpperCase();
                  const len = parseInt(m[2]);
                  let val = m[3] || '';
                  if (len > 0 && val.length > len) val = val.substring(0, len);
                  val = val.replace(/[\r\n]+/g, '').trim();
                  fields[name] = val;
                }
                if (!fields.CALL) continue;

                const freq = parseFloat(fields.FREQ || '0');
                const d = fields.QSO_DATE || '';
                const qsoDate = d.length === 8 ? `${d.substring(0,4)}-${d.substring(4,6)}-${d.substring(6,8)}` : '';
                const t = (fields.TIME_ON || '').padStart(6, '0');
                const timeStart = t.length >= 6 ? `${t.substring(0,2)}:${t.substring(2,4)}:${t.substring(4,6)}` : '';
                const isClub = !!(fields.STATION_CALLSIGN && fields.OPERATOR && fields.OPERATOR !== fields.STATION_CALLSIGN);

                qsos.push({
                  callsign: fields.CALL,
                  frequency: freq || undefined,
                  band: fields.BAND || undefined,
                  mode: fields.MODE || undefined,
                  qso_date: qsoDate,
                  time_start: timeStart,
                  rst_sent: fields.RST_SENT || undefined,
                  rst_received: fields.RST_RCVD || undefined,
                  operator_name: fields.NAME || undefined,
                  operator_country: fields.COUNTRY || undefined,
                  operator_grid: fields.GRIDSQUARE || undefined,
                  notes: fields.COMMENT || undefined,
                  wavelog_imported: true,
                  wavelog_import_date: new Date().toISOString(),
                  wavelog_synced: true,
                  is_clubstation: isClub,
                  club_callsign: fields.STATION_CALLSIGN || undefined,
                  club_operator_callsign: isClub ? fields.OPERATOR : undefined,
                  my_grid: fields.MY_GRIDSQUARE || undefined,
                  created_by_id: userId,
                });
              }

              const BATCH = 100;
              for (let i = 0; i < qsos.length; i += BATCH) {
                const batch = qsos.slice(i, i + BATCH);
                try {
                  await sr.entities.Log.bulkCreate(batch);
                  importedCount += batch.length;
                } catch (e: any) {
                  console.log(`[Wavelog Sync] Import batch failed for ${userId}: ${e.message}`);
                }
              }

              try {
                await sr.entities.UserHuntingSettings.update(setting.id, {
                  wavelog_last_fetch_id: parseInt(newLastFetchId),
                });
              } catch (e: any) {
                console.log(`[Wavelog Sync] Could not update last_fetch_id: ${e.message}`);
              }
            }
          } catch (importErr: any) {
            console.log(`[Wavelog Sync] Import failed for ${userId}: ${importErr.message}`);
          }

          // Step B: Export unsynced QSOs to Wavelog
          try {
            const toExport = await sr.entities.Log.filter(
              { created_by_id: userId, wavelog_synced: false, wavelog_imported: false },
              '-created_date', 100
            );

            if (toExport.length > 0) {
              let adifString = '';
              for (const qso of toExport) {
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
                if (qso.notes) adifString += `<COMMENT:${qso.notes.length}>${qso.notes}`;
                if (qso.is_clubstation && qso.club_callsign) adifString += `<STATION_CALLSIGN:${qso.club_callsign.length}>${qso.club_callsign}`;
                if (qso.is_clubstation && qso.club_operator_callsign) adifString += `<OPERATOR:${qso.club_operator_callsign.length}>${qso.club_operator_callsign}`;
                adifString += '<EOR>';
              }

              const uploadResp = await fetch(`${syncBaseUrl}/index.php/api/qso`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                  key: setting.wavelog_api_key,
                  station_profile_id: setting.wavelog_station_id || '1',
                  type: 'adif',
                  string: adifString,
                }),
              });

              if (uploadResp.status === 201 || uploadResp.ok) {
                for (const qso of toExport) {
                  try {
                    await sr.entities.Log.update(qso.id, {
                      wavelog_synced: true,
                      wavelog_sync_date: new Date().toISOString(),
                    });
                    exportedCount++;
                  } catch (e: any) {}
                }
              }
            }
          } catch (exportErr: any) {
            console.log(`[Wavelog Sync] Export failed for ${userId}: ${exportErr.message}`);
          }

          results.push({ user_id: userId, imported: importedCount, exported: exportedCount, status: 'success' });
        }

        return Response.json({
          success: true,
          synced_users: results.length,
          results,
          message: `Sync abgeschlossen für ${results.length} Nutzer`,
        });
      }

      default:
        return Response.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}