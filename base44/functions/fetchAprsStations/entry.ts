import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { generateAprsCallsignSeed } from '../../shared/aprsCallsignSeed.ts';

// APRS Station Sync — incremental discovery via aprs.fi API.
// Each scheduled run queries 50 callsigns from a generated seed list
// (offset-based, stored in AppSettings). New stations are saved to AprsStation;
// existing ones are updated. When the offset wraps around, the cycle restarts
// — keeping the database growing without a hard limit on total records.
//
// TCP (APRS-IS port 14580) is blocked by platform — HTTP via aprs.fi API only.

const APRS_API_BASE = 'https://api.aprs.fi/api/get';
const DISCOVERY_BATCH = 600; // 600 per run × 1 daily = 17,925 seed in ~30 days
const API_BATCH_SIZE = 20;  // aprs.fi API hard limit: 20 names per request
const BATCH_DELAY_MS = 200;

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

    // 1. Generate seed list (deterministic order — same every run)
    const seedList = generateAprsCallsignSeed();

    // 2. Read offset from AppSettings (tracks progress through seed list)
    let offset = 0;
    const offsetSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'aprs_seed_offset' });
    if (offsetSettings.length > 0) {
      offset = parseInt(offsetSettings[0].value || '0') || 0;
    }

    // 3. Take DISCOVERY_BATCH callsigns starting from offset (wrap around)
    const callsignsToQuery: string[] = [];
    for (let i = 0; i < DISCOVERY_BATCH && i < seedList.length; i++) {
      callsignsToQuery.push(seedList[(offset + i) % seedList.length]);
    }
    const newOffset = (offset + DISCOVERY_BATCH) % seedList.length;

    // 4. Get existing AprsStation records (for upsert)
    const existingStations = await base44.asServiceRole.entities.AprsStation.list('id', 5000);
    const existingMap = new Map<string, any>();
    for (const s of existingStations) {
      if (s.callsign) existingMap.set(s.callsign.toUpperCase(), s);
    }

    // 5. Query aprs.fi API in batches of 20
    const freshData = new Map<string, any>();
    for (let i = 0; i < callsignsToQuery.length; i += API_BATCH_SIZE) {
      const batch = callsignsToQuery.slice(i, i + API_BATCH_SIZE);
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
      if (i + API_BATCH_SIZE < callsignsToQuery.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // 6. Upsert: update existing records, create new ones
    const toUpdate: any[] = [];
    const toCreate: any[] = [];
    for (const [cs, data] of freshData) {
      if (existingMap.has(cs)) {
        toUpdate.push({ id: existingMap.get(cs).id, ...data });
      } else {
        toCreate.push(data);
      }
    }

    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 500) {
      const batch = toUpdate.slice(i, i + 500);
      try {
        await base44.asServiceRole.entities.AprsStation.bulkUpdate(batch);
        updated += batch.length;
      } catch {}
    }

    let created = 0;
    for (let i = 0; i < toCreate.length; i += 500) {
      const batch = toCreate.slice(i, i + 500);
      try {
        await base44.asServiceRole.entities.AprsStation.bulkCreate(batch);
        created += batch.length;
      } catch {}
    }

    const totalCount = updated + created;

    // 7. Persist new offset for next run
    try {
      if (offsetSettings.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(offsetSettings[0].id, { value: String(newOffset) });
      } else {
        await base44.asServiceRole.entities.AppSetting.create({ key: 'aprs_seed_offset', value: String(newOffset) });
      }
    } catch {}

    // 8. Write SyncLog
    try {
      await base44.asServiceRole.entities.SyncLog.create({
        timestamp: new Date().toISOString(),
        overall_status: 'success',
        total_duration_ms: Date.now() - startTime,
        results: [{
          source: 'aprs',
          count: totalCount,
          updated,
          created,
          status: 'success',
          seed_offset: newOffset,
          seed_list_size: seedList.length,
        }],
        trigger: body.scheduled ? 'scheduled' : 'manual',
      });
    } catch {}

    return Response.json({
      status: 'success',
      count: totalCount,
      updated,
      created,
      total_queried: callsignsToQuery.length,
      fresh_data_found: freshData.size,
      seed_list_size: seedList.length,
      seed_offset: newOffset,
      seed_progress_pct: Math.round((newOffset / seedList.length) * 100),
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