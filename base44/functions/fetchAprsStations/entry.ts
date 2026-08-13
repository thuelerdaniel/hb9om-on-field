import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// APRS Station Sync — fetches fixed APRS stations and upserts into AprsStation entity.
// Uses aprs.fi API (HTTP) since Deno.connect (TCP to APRS-IS) is blocked by platform.
// Queries known callsigns (existing AprsStation + repeaters) in batches of 20 (API limit).
// Filters by fixed-station symbol whitelist (digipeaters, igates, repeaters, wx, etc.).

const APRS_API_BASE = 'https://api.aprs.fi/api/get';

// Fixed station symbols — no mobile objects (cars, bikes, walkers, boats, aircraft)
const FIXED_SYMBOLS = new Set([
  '/#', '/I', '/r', '/_', '/\\', '/[', '/R', '/p', '/j', '/o', '/n', '/t', '/s',
  '\\#', '\\I', '\\r', '\\_', '\\n', '\\j', '\\o', '\\a', '\\s', '\\[', '\\S', '\\p',
]);

function classifyStation(symbol: string, comment: string): string {
  const c = (comment || '').toLowerCase();
  if (symbol === '/_' || symbol === '\\_') return 'wx_station';
  if (symbol === '/#' || symbol === '\\#' || symbol === '/\\') return 'digipeater';
  if (symbol === '/I' || symbol === '\\I') return 'igate';
  if (symbol === '/r' || symbol === '\\r' || symbol === '/R') return 'repeater';
  if (symbol === '/[' || symbol === '\\[') return 'rx_igate';
  if (c.includes('igate')) return 'rx_igate';
  if (c.includes('digi')) return 'digipeater';
  if (c.includes('wx') || c.includes('weather')) return 'wx_station';
  return 'other';
}

async function queryAprsFiBatch(callsigns: string[], apiKey: string): Promise<any[]> {
  const names = callsigns.filter(Boolean).join(',');
  if (!names) return [];
  const url = `${APRS_API_BASE}?name=${encodeURIComponent(names)}&what=loc&apikey=${apiKey}&format=json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      if (data.code === 'ratelimit') {
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (data.result !== 'ok' || !data.entries) return [];
      return data.entries;
    } catch {
      return [];
    }
  }
  return [];
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const apiKey = process.env.APRS_FI_API_KEY;
    if (!apiKey) {
      return Response.json({ status: 'failed', error: 'APRS_FI_API_KEY secret not set' }, { status: 500 });
    }

    const startTime = Date.now();

    // 1. Gather callsigns to query: existing AprsStation only (keep it fast)
    const existingStations = await base44.asServiceRole.entities.AprsStation.list('id', 5000);

    const allCallsigns = new Set<string>();
    for (const s of existingStations) {
      if (s.callsign) allCallsigns.add(s.callsign.toUpperCase());
    }

    // 2. Query aprs.fi in batches of 20 (API hard limit)
    const callsignList = [...allCallsigns].slice(0, 200);
    const BATCH_SIZE = 20;
    const BATCH_DELAY = 200;

    const freshData = new Map<string, any>(); // callsign -> {lat, lng, symbol, comment}
    for (let i = 0; i < callsignList.length; i += BATCH_SIZE) {
      const batch = callsignList.slice(i, i + BATCH_SIZE);
      const entries = await queryAprsFiBatch(batch, apiKey);
      for (const entry of entries) {
        if (!entry.lat || !entry.lng) continue;
        const symbol = entry.symbol || '';
        if (!FIXED_SYMBOLS.has(symbol)) continue;
        freshData.set(entry.name.toUpperCase(), {
          callsign: entry.name,
          lat: parseFloat(entry.lat),
          lng: parseFloat(entry.lng),
          symbol,
          station_type: classifyStation(symbol, entry.comment),
          comment: (entry.comment || '').substring(0, 1000),
          is_swiss: entry.name.toUpperCase().startsWith('HB9'),
        });
      }
      if (i + BATCH_SIZE < callsignList.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    // 3. Upsert: update existing records, create new ones
    const existingMap = new Map<string, any>();
    for (const s of existingStations) {
      if (s.callsign) existingMap.set(s.callsign.toUpperCase(), s);
    }

    const toUpdate: any[] = [];
    const toCreate: any[] = [];

    for (const [cs, data] of freshData) {
      if (existingMap.has(cs)) {
        toUpdate.push({ id: existingMap.get(cs).id, ...data });
      } else {
        toCreate.push(data);
      }
    }

    // Bulk update existing (up to 500 per call)
    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 500) {
      const batch = toUpdate.slice(i, i + 500);
      try {
        await base44.asServiceRole.entities.AprsStation.bulkUpdate(batch);
        updated += batch.length;
      } catch {}
    }

    // Bulk create new
    let created = 0;
    for (let i = 0; i < toCreate.length; i += 500) {
      const batch = toCreate.slice(i, i + 500);
      try {
        await base44.asServiceRole.entities.AprsStation.bulkCreate(batch);
        created += batch.length;
      } catch {}
    }

    const totalCount = updated + created;

    // 4. Write SyncLog
    try {
      await base44.asServiceRole.entities.SyncLog.create({
        timestamp: new Date().toISOString(),
        overall_status: totalCount > 0 ? 'success' : 'failed',
        total_duration_ms: Date.now() - startTime,
        results: [{
          source: 'aprs',
          count: totalCount,
          updated,
          created,
          status: totalCount > 0 ? 'success' : 'failed',
        }],
        trigger: body.scheduled ? 'scheduled' : 'manual',
      });
    } catch {}

    return Response.json({
      status: totalCount > 0 ? 'success' : 'failed',
      count: totalCount,
      updated,
      created,
      total_queried: callsignList.length,
      fresh_data_found: freshData.size,
      duration_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    return Response.json({
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}