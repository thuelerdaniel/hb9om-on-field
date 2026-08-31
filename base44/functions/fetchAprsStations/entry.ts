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
const DISCOVERY_BATCH = 200; // Reduced from 600 to avoid timeout
const API_BATCH_SIZE = 20;  // aprs.fi API hard limit: 20 names per request
const BATCH_DELAY_MS = 200;

// Fixed station symbols — whitelist of definitively non-mobile symbols.
// Primary table (/) and alternate table (\). Only these are saved to AprsStation.
const FIXED_SYMBOLS = new Set([
  // Primary table
  '/#', '/I', '/r', '/_', '/\\', '/[', '/R', '/p', '/j', '/o', '/n', '/t', '/s', '/b', '/v', '/y',
  // Alternate table
  '\\#', '\\I', '\\r', '\\_', '\\n', '\\j', '\\o', '\\a', '\\s', '\\[', '\\S', '\\p', '\\v', '\\L', '\\H', '\\D', '\\M', '\\Z',
]);

// Derive APRS symbol from callsign suffix when the packet has no symbol.
// /B = Beacon/Digipeater → /#, /D = Digipeater → /#, /I = I-Gate → /I
function deriveSymbolFromCallsign(name: string): string {
  if (!name) return '';
  const upper = name.toUpperCase();
  if (upper.endsWith('/B')) return '/#';
  if (upper.endsWith('/D')) return '/#';
  if (upper.endsWith('/I')) return '/I';
  return '';
}

// Symbol → human-readable description
const SYMBOL_DESCRIPTIONS: Record<string, string> = {
  '/#': 'Digipeater', '/I': 'I-Gate', '/r': 'Repeater (Voice)', '/_': 'Wetterstation',
  '/\\': 'Hausstation', '/[': 'RX IGate', '/R': 'RX IGate', '/p': 'APRS Node',
  '/j': 'Repeater (D-Star)', '/o': 'Repeater (EchoLink)', '/n': 'Repeater (Digital)',
  '/t': 'Repeater (Tactical)', '/s': 'Repeater (D-Star)', '/b': 'Blitzer', '/v': 'WX Lightning', '/y': 'Suntracker',
  '\\#': 'Digipeater', '\\I': 'I-Gate', '\\r': 'Repeater', '\\_': 'Wetterstation',
  '\\n': 'Node', '\\j': 'Repeater', '\\o': 'Repeater', '\\a': 'Repeater', '\\s': 'DStar Repeater',
  '\\[': 'RX IGate', '\\S': 'Satellite Gateway', '\\p': 'Packet Node', '\\v': 'Digipeater',
  '\\L': 'Lighthouse', '\\H': 'Hospital', '\\D': 'DxCluster', '\\M': 'Milestone', '\\Z': 'SSTV',
};

function classifyStation(symbol: string, comment: string): string {
  const c = (comment || '').toLowerCase();
  if (symbol === '/_' || symbol === '\\_') return 'wx_station';
  if (symbol === '/#' || symbol === '\\#' || symbol === '/\\' || symbol === '\\v') return 'digipeater';
  if (symbol === '/I' || symbol === '\\I') return 'igate';
  if (symbol === '/r' || symbol === '\\r' || symbol === '/R' || symbol === '/o' || symbol === '\\o' ||
      symbol === '/j' || symbol === '\\j' || symbol === '/n' || symbol === '/t' || symbol === '/s' || symbol === '\\s' ||
      symbol === '/p' || symbol === '\\p' || symbol === '\\a') return 'repeater';
  if (symbol === '/[' || symbol === '\\[' || symbol === '/R') return 'rx_igate';
  if (symbol === '/y') return 'suntracker';
  if (symbol === '/\\') return 'home';
  if (c.includes('igate')) return 'igate';
  if (c.includes('digi')) return 'digipeater';
  if (c.includes('wx') || c.includes('weather')) return 'wx_station';
  return 'other';
}

// Haversine distance in km between two coordinates
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

// Firehose fetch: queries aprs.fi for ALL recent APRS packets (what=apr).
// This discovers stations that are NOT in the seed list — the seed list only
// covers known Swiss/regional callsigns, but many digipeaters/I-gates worldwide
// are missed. The firehose captures whatever is currently transmitting.
// Filters for stationary symbols only (FIXED_SYMBOLS whitelist).
async function queryAprsFiFirehose(apiKey: string): Promise<any[]> {
  const url = `${APRS_API_BASE}?what=apr&format=json&apikey=${apiKey}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(60000),
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

    // Fix 11: Get existing AprsStation records (paginated — no 5000-record limit).
    // Previous code used list('id', 5000) which only loaded the first 5000 records,
    // causing upsert to create duplicates for records beyond 5000.
    const existingStations: any[] = [];
    try {
      const LIMIT = 5000;
      const MAX_PAGES = 40; // 40 * 5000 = 200k records max
      for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await base44.asServiceRole.entities.AprsStation.list('id', LIMIT, page * LIMIT);
        if (!Array.isArray(batch) || batch.length === 0) break;
        existingStations.push(...batch);
        if (batch.length < LIMIT) break;
      }
    } catch {}
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
        // Skip null-island positions (invalid GPS)
        if (parseFloat(entry.lat) === 0 && parseFloat(entry.lng) === 0) continue;
        // Ensure symbol is full 2-char APRS code
        let symbol = entry.symbol || '';
        if (symbol && symbol.length === 1) symbol = '/' + symbol;
        if (!symbol) {
          // Derive from entry type or comment
          const c = (entry.comment || '').toLowerCase();
          if (entry.type === 'w' || c.includes('weather')) symbol = '/_';
          else if (c.includes('igate')) symbol = '/I';
          else if (c.includes('digi')) symbol = '/#';
          else if (entry.type === 'd') symbol = '/#';
          else symbol = deriveSymbolFromCallsign(entry.name);
          if (!symbol) continue; // Skip entries with no recognizable symbol
        }
        if (!FIXED_SYMBOLS.has(symbol)) continue;
        freshData.set(entry.name.toUpperCase(), {
          callsign: entry.name,
          lat: parseFloat(entry.lat),
          lng: parseFloat(entry.lng),
          symbol,
          symbol_description: SYMBOL_DESCRIPTIONS[symbol] || 'Unbekannt',
          station_type: classifyStation(symbol, entry.comment),
          comment: (entry.comment || '').substring(0, 1000),
          last_heard: entry.lasttime ? new Date(entry.lasttime * 1000).toISOString() : (entry.time ? new Date(entry.time * 1000).toISOString() : new Date().toISOString()),
          source_callsign: entry.srccall && entry.srccall !== entry.name ? entry.srccall : '',
          is_swiss: entry.name.toUpperCase().startsWith('HB9') || entry.name.toUpperCase().startsWith('HB9'),
        });
      }
      if (i + API_BATCH_SIZE < callsignsToQuery.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    // 6. Upsert: update existing records, create new ones
    // Position stability check: if an existing station moved >1km, skip update (possibly mobile)
    const toUpdate: any[] = [];
    const toCreate: any[] = [];
    let skippedMobile = 0;
    for (const [cs, data] of freshData) {
      if (existingMap.has(cs)) {
        const existing = existingMap.get(cs);
        if (existing.lat != null && existing.lng != null) {
          const distKm = haversineKm(existing.lat, existing.lng, data.lat, data.lng);
          if (distKm > 1) {
            // Position changed significantly — possibly mobile, skip update
            skippedMobile++;
            continue;
          }
        }
        toUpdate.push({ id: existing.id, ...data });
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

    // 6b. Firehose fetch: query aprs.fi for ALL recent APRS packets.
    // This discovers stations NOT in the seed list — digipeaters, I-gates, weather stations
    // that are currently transmitting but weren't in our curated callsign list.
    let firehoseCreated = 0;
    let firehoseUpdated = 0;
    let firehoseSkipped = 0;
    try {
      const firehoseEntries = await queryAprsFiFirehose(apiKey);
      const firehoseData = new Map<string, any>();
      for (const entry of firehoseEntries) {
        if (!entry.name) continue;
        if (!entry.lat || !entry.lng) continue;
        if (parseFloat(entry.lat) === 0 && parseFloat(entry.lng) === 0) continue;
        // Extract symbol: aprs.fi returns entry.symbol as 2-char code (e.g. "/#")
        let symbol = entry.symbol || '';
        if (symbol && symbol.length === 1) symbol = '/' + symbol;
        if (!symbol) {
          // Derive from entry type or comment
          const c = (entry.comment || '').toLowerCase();
          if (entry.type === 'w' || c.includes('weather')) symbol = '/_';
          else if (c.includes('igate')) symbol = '/I';
          else if (c.includes('digi')) symbol = '/#';
          else if (entry.type === 'd') symbol = '/#';
          else symbol = deriveSymbolFromCallsign(entry.name);
          if (!symbol) { firehoseSkipped++; continue; } // Skip entries with no recognizable symbol
        }
        if (!FIXED_SYMBOLS.has(symbol)) { firehoseSkipped++; continue; } // Skip mobile/non-stationary
        firehoseData.set(entry.name.toUpperCase(), {
          callsign: entry.name,
          lat: parseFloat(entry.lat),
          lng: parseFloat(entry.lng),
          symbol,
          symbol_description: SYMBOL_DESCRIPTIONS[symbol] || 'Unbekannt',
          station_type: classifyStation(symbol, entry.comment),
          comment: (entry.comment || '').substring(0, 1000),
          last_heard: entry.lasttime ? new Date(entry.lasttime * 1000).toISOString() : (entry.time ? new Date(entry.time * 1000).toISOString() : new Date().toISOString()),
          source_callsign: entry.srccall && entry.srccall !== entry.name ? entry.srccall : '',
          is_swiss: entry.name.toUpperCase().startsWith('HB9') || entry.name.toUpperCase().startsWith('HB0'),
        });
      }

      // Upsert firehose data — update existing, create new
      const fhToUpdate: any[] = [];
      const fhToCreate: any[] = [];
      for (const [cs, data] of firehoseData) {
        if (existingMap.has(cs)) {
          const existing = existingMap.get(cs);
          if (existing.lat != null && existing.lng != null) {
            const distKm = haversineKm(existing.lat, existing.lng, data.lat, data.lng);
            if (distKm > 1) continue; // Skip — possibly mobile
          }
          // Only update if symbol is missing (don't overwrite good data)
          if (existing.symbol) continue;
          fhToUpdate.push({ id: existing.id, ...data });
        } else {
          fhToCreate.push(data);
        }
      }
      for (let i = 0; i < fhToUpdate.length; i += 500) {
        const batch = fhToUpdate.slice(i, i + 500);
        try {
          await base44.asServiceRole.entities.AprsStation.bulkUpdate(batch);
          firehoseUpdated += batch.length;
        } catch {}
      }
      for (let i = 0; i < fhToCreate.length; i += 500) {
        const batch = fhToCreate.slice(i, i + 500);
        try {
          await base44.asServiceRole.entities.AprsStation.bulkCreate(batch);
          firehoseCreated += batch.length;
        } catch {}
      }
    } catch {}

    const totalCount = updated + created + firehoseUpdated + firehoseCreated;

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
      firehose_updated: firehoseUpdated,
      firehose_created: firehoseCreated,
      firehose_skipped: firehoseSkipped,
      skipped_mobile: skippedMobile,
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