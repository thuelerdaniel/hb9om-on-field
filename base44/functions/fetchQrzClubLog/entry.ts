import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { dedupKey } from '../../shared/logDedup.ts';
import { isSyncPaused } from '../../shared/syncPause.ts';

// fetchQrzClubLog — v0.9003 Problem 2
// Downloads QSOs from the QRZ.com Club Logbook (station_callsign: HB9OM),
// parses ADIF in the backend, and saves to Log entity with:
//   is_clubstation: true, club_callsign: HB9OM, wavelog_imported: true
// Admin-only — the club logbook is communal.
//
// API key source: AppSetting club_callsign_config.qrz_logbook_api_key → QRZ_API_KEY secret fallback.
// QRZ Logbook API: https://logbook.qrz.com/api (ACTION=FETCH)

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if ((user as any).role !== 'admin') {
      return Response.json({ error: 'Club-Log-Sync nur für Admins' }, { status: 403 });
    }

    // v0.9018 BUGFIX 1: Check sync_paused flag — skip if paused
    if (await isSyncPaused(base44)) {
      return Response.json({ status: 'success', imported: 0, message: 'Sync ist pausiert — Club-Log-Sync übersprungen', paused: true });
    }

    // 1. Read API key from AppSetting, fall back to QRZ_API_KEY secret
    let apiKey = '';
    try {
      const clubConfig = await base44.asServiceRole.entities.AppSetting.filter({ key: 'club_callsign_config' });
      if (clubConfig && clubConfig.length > 0) {
        const config = JSON.parse(clubConfig[0].value || '{}');
        apiKey = config.qrz_logbook_api_key || '';
      }
    } catch {}
    if (!apiKey) {
      apiKey = Deno.env.get('QRZ_API_KEY') || '';
    }
    if (!apiKey) {
      return Response.json({ error: 'Kein Club QRZ API-Key konfiguriert (AppSetting club_callsign_config.qrz_logbook_api_key oder QRZ_API_KEY Secret)' }, { status: 200 });
    }

    // 2. Fetch QSOs from QRZ Logbook API
    const params = new URLSearchParams();
    params.append('KEY', apiKey);
    params.append('ACTION', 'FETCH');
    // BUG 5: Explicitly request HB9OM (club call) QSOs — prevents fetching personal HB3YNF QSOs
    params.append('STATION_CALLSIGN', 'HB9OM');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch('https://logbook.qrz.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const resultText = await response.text();

    if (!resultText.includes('RESULT=OK') && !resultText.includes('RESULT=ok')) {
      const reasonMatch = resultText.match(/REASON=([^\s&]+)/i);
      return Response.json({ status: 'error', error: `QRZ.com: ${reasonMatch ? reasonMatch[1] : resultText.substring(0, 200)}` });
    }

    // 3. Extract ADIF data
    const countMatch = resultText.match(/COUNT=(\d+)/i);
    const count = countMatch ? parseInt(countMatch[1]) : 0;
    const adifIdx = resultText.search(/ADIF=/i);
    let adifData = '';
    if (adifIdx >= 0) {
      const afterAdif = resultText.slice(adifIdx + 5);
      try { adifData = decodeURIComponent(afterAdif).trim(); }
      catch {
        adifData = afterAdif
          .replace(/%0A/g, '\n').replace(/%0D/g, '\r').replace(/%20/g, ' ')
          .replace(/%26/g, '&').replace(/%3C/g, '<').replace(/%3E/g, '>')
          .replace(/%3D/g, '=').replace(/%22/g, '"').trim();
      }
      adifData = adifData
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    }

    if (!adifData || count === 0) {
      return Response.json({ status: 'success', imported: 0, message: 'Keine QSOs im Club-Logbuch gefunden' });
    }

    // 4. Parse ADIF records
    const eohIndex = adifData.toUpperCase().indexOf('<EOH>');
    let adifBody = adifData;
    if (eohIndex >= 0) adifBody = adifData.substring(eohIndex + 5);
    const records = adifBody.split(/<EOR>/i).filter(r => r.trim().length > 0);

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

    function fmtDate(d: string): string {
      if (!d || d.length !== 8) return d || '';
      return d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
    }

    function fmtTime(t: string): string {
      if (!t) return '';
      const p = t.padStart(6, '0');
      return p.substring(0, 2) + ':' + p.substring(2, 4) + ':' + p.substring(4, 6);
    }

    const CLUB_CALLSIGN = 'HB9OM';
    const qsos: any[] = [];
    for (const record of records) {
      try {
        const f = parseAdifRecord(record);
        if (!f.CALL) continue;
        const freq = parseFloat(f.FREQ || '0');
        qsos.push({
          callsign: f.CALL,
          frequency: freq || undefined,
          band: f.BAND || undefined,
          mode: f.MODE || undefined,
          qso_date: fmtDate(f.QSO_DATE || ''),
          time_start: fmtTime(f.TIME_ON || ''),
          time_end: fmtTime(f.TIME_OFF || '') || undefined,
          rst_sent: f.RST_SENT || undefined,
          rst_received: f.RST_RCVD || undefined,
          power: parseFloat(f.TX_PWR || '0') || undefined,
          operator_name: f.NAME || undefined,
          operator_country: f.COUNTRY || undefined,
          operator_grid: f.GRIDSQUARE || undefined,
          operator_address: f.QTH || undefined,
          notes: f.COMMENT || undefined,
          is_clubstation: true,
          // v0.9018: ALWAYS use HB9OM as club_callsign — QRZ ADIF may contain HB3YNF (personal call)
          club_callsign: CLUB_CALLSIGN,
          club_operator_callsign: f.OPERATOR || undefined,
          my_grid: f.MY_GRIDSQUARE || undefined,
          wavelog_imported: true,
          wavelog_import_date: new Date().toISOString(),
          status: 'active',
        });
      } catch {}
    }

    // 5. Dedup against existing club QSOs — paginated, NORMALIZED keys (v0.9004)
    // Normalization: strips /P/M/PM/MM suffixes + truncates time to HH:MM
    // so "HB9CCS/P 00:07:50" matches "HB9CCS 07:50"
    const existingKeys = new Set<string>();
    try {
      const DEDUP_LIMIT = 5000;
      const MAX_PAGES = 20;
      for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await base44.asServiceRole.entities.Log.filter(
          { is_clubstation: true },
          '-created_date', DEDUP_LIMIT, page * DEDUP_LIMIT
        );
        if (!Array.isArray(batch) || batch.length === 0) break;
        for (const l of batch) {
          existingKeys.add(dedupKey(l.callsign, l.qso_date, l.time_start, l.frequency, l.club_callsign));
        }
        if (batch.length < DEDUP_LIMIT) break;
      }
    } catch {}

    const newQsos = qsos.filter(q => {
      const key = dedupKey(q.callsign, q.qso_date, q.time_start, q.frequency, q.club_callsign);
      return !existingKeys.has(key);
    });
    const duplicateCount = qsos.length - newQsos.length;

    // 6. Bulk create in batches of 500
    let importedCount = 0;
    let errorCount = 0;
    const BATCH_SIZE = 500;
    for (let i = 0; i < newQsos.length; i += BATCH_SIZE) {
      const batch = newQsos.slice(i, i + BATCH_SIZE);
      try {
        await base44.asServiceRole.entities.Log.bulkCreate(batch);
        importedCount += batch.length;
      } catch {
        for (const qso of batch) {
          try { await base44.asServiceRole.entities.Log.create(qso); importedCount++; }
          catch { errorCount++; }
        }
      }
    }

    return Response.json({
      status: 'success',
      success: true,
      count,
      imported: importedCount,
      duplicates: duplicateCount,
      duplicates_skipped: duplicateCount,
      errors: errorCount,
      total: qsos.length,
      message: `Club-Log-Sync: ${importedCount} QSOs importiert, ${duplicateCount} Duplikate übersprungen, ${errorCount} Fehler`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}