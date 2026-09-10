import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  parseRepeaterList, parseRepeaterDetail, parseUkRepeaterList,
  getBand, maidenheadToLatLng,
  COUNTRIES, UK_BANDS,
  LIST_BASE, NA_LIST_BASE, LIST_PARAMS,
  REPEATER_REGIONS, getCountriesForRegion, getCountryCodesForRegion,
} from '../../shared/repeaterScraper.ts';
import { loadProtectionSet, filterProtected } from '../../shared/syncProtection.ts';

const FETCH_TIMEOUT_MS = 5000;
const BATCH_SIZE = 10;        // Countries per batch — keeps memory low
const DETAIL_BATCH = 6;       // Priority 1 countries get detail pages
const DETAIL_PER_COUNTRY = 50; // v0.9045: 50 per country — batched concurrency (20 at a time) prevents rate-limiting, so 50 now succeeds (before: 50 fired all at once = most rate-limited)

// Fix 8: US RepeaterBook JSON API — state-by-state fetching.
// The HTML scraping times out for USA (~20K+ repeaters). The JSON API is faster.
// API: https://www.repeaterbook.com/api/export.php?country=United States&state_id=XX
// Falls back to Hearham API if RepeaterBook API fails.
const RB_API_BASE = 'https://www.repeaterbook.com/api/export.php';
const RB_API_TIMEOUT_MS = 15000;
const RB_API_DELAY_MS = 200;

async function fetchUsStateRepeatersApi(stateId: string, stateName: string): Promise<any[]> {
  const apiToken = process.env.REPEATERBOOK_API_TOKEN || '';
  const params = new URLSearchParams({
    country: 'United States',
    state_id: stateId,
  });
  const headers: any = {
    'User-Agent': 'HB9OM-OnField/1.0 (hb9om@gmail.com)',
    'Accept': 'application/json',
  };
  if (apiToken) headers['X-RB-App-Token'] = apiToken;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RB_API_TIMEOUT_MS);
    const resp = await fetch(`${RB_API_BASE}?${params}`, { headers, signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return [];
    const data = await resp.json();
    // Response format: { count: N, results: [...] } or array
    const results = Array.isArray(data) ? data : (data.results || data.data || []);
    if (!Array.isArray(results)) return [];

    const repeaters: any[] = [];
    for (const r of results) {
      const callsign = r.Callsign || r.callsign || r.call || '';
      const frequency = parseFloat(r.Frequency || r.frequency || r.freq || 0);
      if (!callsign || !frequency) continue;
      const inputFreq = parseFloat(r.InputFreq || r.input_freq || r.offset || 0);
      const offset = inputFreq ? inputFreq - frequency : 0;
      const lat = parseFloat(r.Latitude || r.latitude || r.lat || 0);
      const lng = parseFloat(r.Longitude || r.longitude || r.lng || r.lon || 0);
      const mode = r.Mode || r.mode || r.Modulation || '';
      const modes = mode ? mode.split(/[,/]/).map((m: string) => m.trim()).filter(Boolean) : ['FM'];
      repeaters.push({
        callsign,
        frequency,
        offset_mhz: offset,
        tone: r.PL || r.Tone || r.CTCSS || r.tone || '',
        dcs: r.Dcs || r.DCS || r.dcs || '',
        modes: modes.length > 0 ? modes : ['FM'],
        primary_mode: modes[0] || 'FM',
        location_name: r.Location || r.location || r.QTH || r.city || '',
        country: 'United States',
        country_code: 'US',
        lat: (!isNaN(lat) && lat !== 0) ? lat : null,
        lng: (!isNaN(lng) && lng !== 0) ? lng : null,
        band: getBand(frequency),
        status: r.Use === 'Open' || r.use === 'Open' ? 'on-air' : 'unknown',
        web_url: r.WebSite || r.web_url || '',
        echolink_node: r.EchoLink || r.echolink || '',
        source_id: r.ID || r.id || '',
        locator: r.Locator || r.locator || '',
      });
    }
    return repeaters;
  } catch {
    return [];
  }
}

// PUNKT 8: US-Repeater nach Bundesstaat — Chunked Sync mit Zeitbudget
// US hat 50+ Staaten, jeder mit eigener RepeaterBook-Seite (200-1000+ Relais).
// Alle auf einmal überschreitet das Platform-Timeout.
// Lösung: 3 Staaten pro Aufruf, 90s Zeitbudget, Fortschritt in AppSetting.
const NA_TIME_BUDGET_MS = 90000; // 90s pro Aufruf
const NA_STATES_PER_CALL = 3;   // 3 Staaten pro Aufruf (wie effectiveBatchSize)

async function fetchWithTimeout(url: string, opts?: any): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// v0.9046: Validate tone — only preserve valid CTCSS/DCS from existing records
function isValidTone(tone: string): boolean {
  if (!tone) return false;
  if (/^\d{2,3}\.\d$/.test(tone)) return true;  // CTCSS: 88.5, 67.0, 123.5
  if (/^D\d{3}[NI]?$/i.test(tone)) return true;  // DCS: D023, D023N
  return false;
}

function buildRecord(r: any, existingBySourceId?: Map<string, any>, existingByCallsign?: Map<string, any>) {
  // Apply Maidenhead locator → coords for repeaters without coordinates
  if ((r.lat === null || r.lng === null) && r.locator) {
    const coords = maidenheadToLatLng(r.locator);
    if (coords) {
      r.lat = coords[0];
      r.lng = coords[1];
      r.coords_from_locator = true;
    }
  }
  // v0.9046: Preserve existing lat/lng — try source_id key first
  if ((r.lat === null || r.lng === null) && existingBySourceId) {
    const key = r.sourceId || `${r.callsign}_${r.frequency}`;
    const existing = existingBySourceId.get(key);
    if (existing && existing.lat != null && existing.lng != null) {
      r.lat = existing.lat;
      r.lng = existing.lng;
    }
  }
  // v0.9046: Callsign-based fallback — same callsign on different band = same site
  if ((r.lat === null || r.lng === null) && existingByCallsign) {
    const existing = existingByCallsign.get(r.callsign);
    if (existing && existing.lat != null && existing.lng != null) {
      r.lat = existing.lat;
      r.lng = existing.lng;
    }
  }
  // Validate coordinates — null out invalid ones (0,0 = Null Island, NaN, out of range)
  if (r.lat != null && r.lng != null) {
    if (isNaN(r.lat) || isNaN(r.lng) || (r.lat === 0 && r.lng === 0) ||
        r.lat < -90 || r.lat > 90 || r.lng < -180 || r.lng > 180) {
      r.lat = null;
      r.lng = null;
    }
  }
  // v0.9046: Preserve DCS/tone/locator from existing records — source_id first, then callsign
  let dcs = r.dcs || '';
  let tone = r.tone || '';
  let locator = r.locator || '';
  if (existingBySourceId) {
    const key = r.sourceId || `${r.callsign}_${r.frequency}`;
    const existing = existingBySourceId.get(key);
    if (existing) {
      if (!dcs && existing.dcs) dcs = existing.dcs;
      // v0.9046: Only preserve valid CTCSS/DCS tones (not "CC 1 NAC 923 RAN 1" garbage)
      if (!tone && existing.tone && isValidTone(existing.tone)) tone = existing.tone;
      if (!locator && existing.locator) locator = existing.locator;
    }
  }
  if (existingByCallsign && (!tone || !dcs || !locator)) {
    const existing = existingByCallsign.get(r.callsign);
    if (existing) {
      if (!tone && existing.tone && isValidTone(existing.tone)) tone = existing.tone;
      if (!dcs && existing.dcs) dcs = existing.dcs;
      if (!locator && existing.locator) locator = existing.locator;
    }
  }
  return {
    callsign: r.callsign,
    frequency: r.frequency,
    offset_mhz: r.offset_mhz || 0,
    tone,
    dcs,
    modes: r.modes || ['FM'],
    primary_mode: r.primary_mode || 'FM',
    location_name: r.location_name || '',
    country: r.country || '',
    country_code: r.country_code || '',
    lat: r.lat,
    lng: r.lng,
    band: r.band || getBand(r.frequency),
    status: r.status || 'unknown',
    web_url: r.web_url || '',
    echolink_node: r.echolink_node || '',
    fm_funknetz: r.fm_funknetz || false,
    has_emergency_power: r.has_emergency_power || false,
    power_source: r.power_source || 'unknown',
    source_id: r.sourceId || '',
    linked_callsigns: r.linked_callsigns || [],
    locator,
    coords_from_locator: r.coords_from_locator || false,
  };
}

export default async function(req) {
  const startTime = Date.now();
  let currentStep = 'init';
  let base44: any = null;
  try {
    base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized — nicht angemeldet' }, { status: 401 });
      if (user.role !== 'admin') {
        return Response.json({ error: 'Forbidden — nur Administratoren dürfen Relais-Daten aktualisieren' }, { status: 403 });
      }
    }

    const region = body.region || 'all';

    // Validate region parameter
    if (region !== 'all' && !REPEATER_REGIONS.some(r => r.id === region)) {
      return Response.json({
        error: `Unknown region: ${region}. Valid: all, ${REPEATER_REGIONS.map(r => r.id).join(', ')}`,
      }, { status: 400 });
    }

    const regionCountries = getCountriesForRegion(region);
    const regionCountryCodes = getCountryCodesForRegion(region);

    const countryBreakdown: Record<string, number> = {};
    let totalSaved = 0;
    let withCoords = 0;
    let deletedCount = 0;
    let jsonProtected = 0;
    // PUNKT 8: NA-Chunking-Variablen (außerhalb des if-Blocks für Response-Zugriff)
    let isNARegion = region === 'na_us' || region === 'na_ca';
    let naHasMore = false;
    let naStatesProcessed = 0;

    // --- Step 0: v0.9046 — Save existing coords/tone/dcs BEFORE delete ---
    // Two maps: by source_id (exact match) and by callsign (cross-band fallback)
    const existingBySourceId = new Map<string, any>();
    const existingByCallsign = new Map<string, any>();
    try {
      const filter = region === 'all' ? {} : { country_code: { $in: regionCountryCodes } };
      for (let attempt = 0; attempt < 50; attempt++) {
        const existing = await base44.asServiceRole.entities.Repeater.filter(filter, "-created_date", 5000, attempt * 5000);
        if (!existing || existing.length === 0) break;
        for (const r of existing) {
          // v0.9046: DON'T skip json-import — their coords are valuable fallback for same callsign
          const sourceKey = r.source_id || `${r.callsign}_${r.frequency}`;
          existingBySourceId.set(sourceKey, { lat: r.lat, lng: r.lng, dcs: r.dcs || '', tone: r.tone || '', locator: r.locator || '' });
          // v0.9046: Callsign-based map — first record with coords wins (same site, different band)
          if (r.lat != null && r.lng != null && !existingByCallsign.has(r.callsign)) {
            existingByCallsign.set(r.callsign, { lat: r.lat, lng: r.lng, dcs: r.dcs || '', tone: r.tone || '', locator: r.locator || '' });
          }
        }
        if (existing.length < 5000) break;
      }
    } catch {}

    // --- Step 1: Delete existing repeaters for this region ---
    currentStep = 'delete_existing';
    if (region === 'all') {
      // Full refresh: delete ALL repeaters
      try {
        for (let attempt = 0; attempt < 50; attempt++) {
          const existing = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);
          if (!existing || existing.length === 0) break;
          const toDeleteIds = existing.filter(r => r.source_id !== "json-import").map(r => r.id);
          jsonProtected += existing.length - toDeleteIds.length;
          if (toDeleteIds.length > 0) {
            await base44.asServiceRole.entities.Repeater.deleteMany({ id: { $in: toDeleteIds } });
          }
          deletedCount += toDeleteIds.length;
        }
      } catch (delErr: any) {
        return Response.json({
          status: 'failed',
          error: `Bestehende Relais konnten nicht gelöscht werden: ${delErr.message || delErr}`,
          step: currentStep,
          duration_ms: Date.now() - startTime,
        }, { status: 500 });
      }
    } else {
      // Region update: delete only repeaters from this region's countries
      try {
        for (let attempt = 0; attempt < 50; attempt++) {
          const existing = await base44.asServiceRole.entities.Repeater.filter(
            { country_code: { $in: regionCountryCodes } },
            "id", 5000, attempt * 5000
          );
          if (!existing || existing.length === 0) break;
          const toDeleteIds = existing.filter(r => r.source_id !== "json-import").map(r => r.id);
          jsonProtected += existing.length - toDeleteIds.length;
          if (toDeleteIds.length > 0) {
            await base44.asServiceRole.entities.Repeater.deleteMany({ id: { $in: toDeleteIds } });
          }
          deletedCount += toDeleteIds.length;
          if (existing.length < 5000) break;
        }
      } catch (delErr: any) {
        return Response.json({
          status: 'failed',
          error: `Bestehende Relais für Region ${region} konnten nicht gelöscht werden: ${delErr.message || delErr}`,
          step: currentStep,
          duration_ms: Date.now() - startTime,
        }, { status: 500 });
      }
    }

    // --- Load JSON-import protection set ---
    let protectionSet = new Set<string>();
    try { protectionSet = await loadProtectionSet(base44); } catch {}

    // --- Step 2: Fetch UK repeaters (only for 'all' or 'uk' region) ---
    if (region === 'all' || region === 'uk') {
      currentStep = 'uk_repeaters';
      try {
        const ukResults = await Promise.all(UK_BANDS.map(async (bandInfo: any) => {
          try {
            const resp = await fetchWithTimeout(bandInfo.url, {
              headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
            });
            if (!resp || !resp.ok) return [];
            const html = await resp.text();
            return parseUkRepeaterList(html);
          } catch { return []; }
        }));
        let ukRepeaters: any[] = [];
        for (const reps of ukResults) ukRepeaters.push(...reps);
        // Deduplicate by callsign+frequency
        const seen = new Set<string>();
        ukRepeaters = ukRepeaters.filter(r => {
          const key = r.callsign + '_' + r.frequency;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        // Save UK repeaters
        const ukRecords = ukRepeaters.map(r => buildRecord(r, existingBySourceId, existingByCallsign));
        const { toCreate: ukToCreate, protectedCount: ukProt } = filterProtected(ukRecords, protectionSet);
        jsonProtected += ukProt;
        for (let i = 0; i < ukToCreate.length; i += 500) {
          const batch = ukToCreate.slice(i, i + 500);
          await base44.asServiceRole.entities.Repeater.bulkCreate(batch);
          totalSaved += batch.length;
        }
        for (const r of ukRepeaters) {
          if (r.lat && r.lng) withCoords++;
          const cc = r.country_code || '?';
          countryBreakdown[cc] = (countryBreakdown[cc] || 0) + 1;
        }
      } catch {}
    }

    // --- Step 3: Fetch RepeaterBook list pages (skip for UK-only region) ---
    if (region !== 'uk') {
      currentStep = 'repeaterbook_list';
      const countriesToFetch = region === 'all' ? COUNTRIES : regionCountries;
      const priority1Countries = countriesToFetch.filter(c => c.priority === 1);
      const priority1Codes = new Set(priority1Countries.map(c => c.code));

      // US states have large list pages (200-1000+ repeaters each) — use smaller batches
      // to avoid exceeding the platform worker memory limit (128MB).
      const effectiveBatchSize = isNARegion ? 3 : BATCH_SIZE;

      // PUNKT 8: Für NA-Regionen (US/CA) — Chunked Sync mit Zeitbudget
      // Lese gespeicherten State-Offset aus AppSetting
      let naStateOffset = 0;
      if (isNARegion) {
        const offsetKey = `na_repeater_offset_${region}`;
        try {
          const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: offsetKey });
          if (settings.length > 0 && settings[0].value) {
            naStateOffset = parseInt(settings[0].value) || 0;
          }
        } catch {}
        // Wenn Offset=0, ist dies der erste Aufruf — lösche bestehende Region-Relais
        if (naStateOffset === 0) {
          try {
            for (let attempt = 0; attempt < 50; attempt++) {
              const existing = await base44.asServiceRole.entities.Repeater.filter(
                { country_code: { $in: regionCountryCodes } },
                "id", 5000, attempt * 5000
              );
              if (!existing || existing.length === 0) break;
              const toDeleteIds = existing.filter(r => r.source_id !== "json-import").map(r => r.id);
              jsonProtected += existing.length - toDeleteIds.length;
              if (toDeleteIds.length > 0) {
                await base44.asServiceRole.entities.Repeater.deleteMany({ id: { $in: toDeleteIds } });
              }
              deletedCount += toDeleteIds.length;
              if (existing.length < 5000) break;
            }
          } catch {}
        }
      }

      const naStartTime = Date.now();

      for (let i = (isNARegion ? naStateOffset : 0); i < countriesToFetch.length; i += effectiveBatchSize) {
        // PUNKT 8: Bei NA-Regionen — prüfe Zeitbudget und Staaten-Limit
        if (isNARegion) {
          if (naStatesProcessed >= NA_STATES_PER_CALL) {
            naHasMore = true;
            break;
          }
          if (Date.now() - naStartTime > NA_TIME_BUDGET_MS) {
            naHasMore = true;
            break;
          }
        }
        const chunk = countriesToFetch.slice(i, i + effectiveBatchSize);
        const results = await Promise.all(chunk.map(async (country: any) => {
          try {
            const isNA = country.region_type === 'north_america';
            const stateId = country.state_id || country.code;
            const cc = country.country_code || country.code;

            // Fix 8: US states — use RepeaterBook JSON API (faster than HTML scraping)
            if (cc === 'US' && stateId) {
              const apiRepeaters = await fetchUsStateRepeatersApi(String(stateId).padStart(2, '0'), country.name);
              if (apiRepeaters.length > 0) return apiRepeaters;
              // Fall through to HTML scraping if API returns 0
            }

            const url = isNA
              ? `${NA_LIST_BASE}?state_id=${stateId}&country_code=${cc}&${LIST_PARAMS}`
              : `${LIST_BASE}?state_id=${country.code}&${LIST_PARAMS}`;
            const resp = await fetchWithTimeout(url, {
              headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
            });
            if (!resp || !resp.ok) return [];
            const html = await resp.text();
            return parseRepeaterList(html, cc, country.name, {
              hasCountyColumn: isNA,
              stateId,
              regionType: isNA ? 'north_america' : 'world',
              entryCode: country.code,
            });
          } catch { return []; }
        }));

        // Collect and save repeaters from this batch
        let batchRepeaters: any[] = [];
        for (const reps of results) batchRepeaters.push(...reps);
        if (batchRepeaters.length === 0) continue;

        // v0.9046: Deduplicate by callsign+frequency — RepeaterBook has duplicate entries
        // Keep the one with coords, or valid CTCSS tone, or on-air status
        const byDedupKey = new Map<string, any>();
        for (const rep of batchRepeaters) {
          const dkey = `${rep.callsign}_${rep.frequency}`;
          if (!byDedupKey.has(dkey)) {
            byDedupKey.set(dkey, rep);
          } else {
            const prev = byDedupKey.get(dkey);
            const repHasCoords = rep.lat != null && rep.lng != null;
            const prevHasCoords = prev.lat != null && prev.lng != null;
            const repHasTone = !!(rep.tone && /^\d{2,3}\.\d$/.test(rep.tone));
            const prevHasTone = !!(prev.tone && /^\d{2,3}\.\d$/.test(prev.tone));
            if ((repHasCoords && !prevHasCoords) || (repHasTone && !prevHasTone && !prevHasCoords)) {
              byDedupKey.set(dkey, rep);
            }
          }
        }
        batchRepeaters = Array.from(byDedupKey.values());

        // For Priority 1 countries, fetch a few detail pages for coordinates
        const toDetail = batchRepeaters.filter(r => priority1Codes.has(r._entryCode || r.country_code));
        if (toDetail.length > 0) {
          const byCountry = new Map<string, any[]>();
          for (const rep of toDetail) {
            const ec = rep._entryCode || rep.country_code;
            if (!byCountry.has(ec)) byCountry.set(ec, []);
            byCountry.get(ec)!.push(rep);
          }
          const toFetch: any[] = [];
          for (const [ec, reps] of byCountry) {
            reps.sort((a, b) => {
              if (a.status === 'on-air' && b.status !== 'on-air') return -1;
              if (a.status !== 'on-air' && b.status === 'on-air') return 1;
              return 0;
            });
            toFetch.push(...reps.slice(0, DETAIL_PER_COUNTRY));
          }
          // v0.9045: Fetch detail pages in BATCHED concurrency (10 at a time) — prevents RepeaterBook rate-limiting (429)
          const DETAIL_CONCURRENCY = 20;
          for (let d = 0; d < toFetch.length; d += DETAIL_CONCURRENCY) {
            const detailChunk = toFetch.slice(d, d + DETAIL_CONCURRENCY);
            await Promise.all(detailChunk.map(async (rep: any) => {
            try {
              const resp = await fetchWithTimeout(rep.detailUrl, {
                headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'text/html' },
              });
              if (!resp || !resp.ok) return;
              const html = await resp.text();
              const detail = parseRepeaterDetail(html);
              if (detail.lat !== null) rep.lat = detail.lat;
              if (detail.lng !== null) rep.lng = detail.lng;
              if (detail.web_url) rep.web_url = detail.web_url;
              if (detail.echolink_node) rep.echolink_node = detail.echolink_node;
              if (detail.network_links) rep.network_links = detail.network_links;
              if (detail.locator) rep.locator = detail.locator;
              if (detail.tone) rep.tone = detail.tone;
              if (detail.dcs) rep.dcs = detail.dcs;
              if (detail.has_emergency_power) {
                rep.has_emergency_power = detail.has_emergency_power;
                rep.power_source = detail.power_source;
              }
            } catch {}
            }));
          }
        }

        // Build records and save
        const records = batchRepeaters.map(r => buildRecord(r, existingBySourceId, existingByCallsign));
        const { toCreate: rbToCreate, protectedCount: rbProt } = filterProtected(records, protectionSet);
        jsonProtected += rbProt;
        for (let j = 0; j < rbToCreate.length; j += 500) {
          const batch = rbToCreate.slice(j, j + 500);
          await base44.asServiceRole.entities.Repeater.bulkCreate(batch);
          totalSaved += batch.length;
        }
        for (const r of batchRepeaters) {
          if (r.lat && r.lng) withCoords++;
          const cc = r.country_code || '?';
          countryBreakdown[cc] = (countryBreakdown[cc] || 0) + 1;
        }
        // Clear batch from memory
        batchRepeaters = [];
        if (isNARegion) naStatesProcessed += chunk.length;
      }

      // PUNKT 8: Speichere State-Offset für NA-Regionen (für nächsten Aufruf)
      if (isNARegion) {
        const offsetKey = `na_repeater_offset_${region}`;
        const newOffset = naHasMore ? (naStateOffset + naStatesProcessed) : 0;
        try {
          const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: offsetKey });
          if (settings.length > 0) {
            await base44.asServiceRole.entities.AppSetting.update(settings[0].id, { value: String(newOffset) });
          } else {
            await base44.asServiceRole.entities.AppSetting.create({ key: offsetKey, value: String(newOffset) });
          }
        } catch {}
      }
    }

    // --- Step 4: Store stable count metadata in ReferenceData ---
    currentStep = 'store_count';
    try {
      const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'repeater' });
      let totalCount = totalSaved;
      let withCoordsCount = withCoords;

      if (region !== 'all') {
        // Region update: merge with existing metadata
        const oldMeta = existing[0]?.references?.[0] || {};
        const oldTotal = existing[0]?.total_count || 0;
        const oldWithCoords = oldMeta.withCoords || 0;
        // Approximate: old_total - deleted + new
        totalCount = Math.max(0, oldTotal - deletedCount) + totalSaved;
        // Approximate withCoords: old_withCoords * (remaining/old_total) + new_withCoords
        const remaining = Math.max(0, oldTotal - deletedCount);
        const remainingRatio = oldTotal > 0 ? remaining / oldTotal : 1;
        withCoordsCount = Math.round(oldWithCoords * remainingRatio) + withCoords;
      }

      const countMeta = [{
        withCoords: withCoordsCount,
        withoutCoords: totalCount - withCoordsCount,
        countries: Object.keys(countryBreakdown).length,
      }];
      const sourceStr = region === 'all'
        ? 'RepeaterBook + ukrepeater.net'
        : `RepeaterBook (${REPEATER_REGIONS.find(r => r.id === region)?.label || region})`;

      if (existing.length > 0) {
        await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
          references: countMeta, total_count: totalCount,
          source: sourceStr, last_updated: new Date().toISOString()
        });
      } else {
        await base44.asServiceRole.entities.ReferenceData.create({
          type: 'repeater', references: countMeta, total_count: totalCount,
          source: sourceStr, last_updated: new Date().toISOString()
        });
      }
    } catch {}

    // BUG 1: Update DailyRefreshSchedule with success status
    try {
      const scheduleSource = `repeater_${region}`;
      const scheduleRecords = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({ source: scheduleSource });
      if (scheduleRecords && scheduleRecords.length > 0) {
        await base44.asServiceRole.entities.DailyRefreshSchedule.update(scheduleRecords[0].id, {
          last_status: 'success',
          last_count: totalSaved,
          last_run_time: new Date().toISOString(),
          last_duration_ms: Date.now() - startTime,
          last_error: '',
          last_error_detail: '',
        });
      }
    } catch {}

    return Response.json({
      status: 'success',
      region,
      total_saved: totalSaved,
      with_coordinates: withCoords,
      deleted: deletedCount,
      countries: Object.keys(countryBreakdown).length,
      country_breakdown: countryBreakdown,
      json_protected: jsonProtected,
      duration_ms: Date.now() - startTime,
      has_more: isNARegion ? naHasMore : false,
      na_states_processed: isNARegion ? naStatesProcessed : 0,
    });
  } catch (error: any) {
    const errMsg = `Schwerwiegender Fehler beim Relais-Update (Schritt: ${currentStep}): ${error.message || error}`;
    if (base44) {
      // BUG 1: Update DailyRefreshSchedule with error status
      try {
        const scheduleSource = `repeater_${body?.region || 'all'}`;
        const scheduleRecords = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({ source: scheduleSource });
        if (scheduleRecords && scheduleRecords.length > 0) {
          await base44.asServiceRole.entities.DailyRefreshSchedule.update(scheduleRecords[0].id, {
            last_status: 'failed',
            last_count: 0,
            last_run_time: new Date().toISOString(),
            last_duration_ms: Date.now() - startTime,
            last_error: errMsg.substring(0, 200),
            last_error_detail: error.stack || '',
          });
        }
      } catch {}
      try {
        await base44.asServiceRole.entities.SyncLog.create({
          timestamp: new Date().toISOString(),
          overall_status: 'failed',
          total_duration_ms: Date.now() - startTime,
          trigger: 'manual',
          results: [{ type: 'repeater', status: 'failed', error: errMsg, detail: error.stack || '' }],
          description: errMsg,
        });
      } catch {}
    }
    return Response.json({
      status: 'failed',
      error: errMsg,
      step: currentStep,
      detail: error.stack || '',
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}