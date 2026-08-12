import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  parseRepeaterList, parseRepeaterDetail, parseUkRepeaterList,
  getBand, maidenheadToLatLng,
  COUNTRIES, UK_BANDS,
  LIST_BASE, NA_LIST_BASE, LIST_PARAMS,
} from '../../shared/repeaterScraper.ts';

const FETCH_TIMEOUT_MS = 5000;
const BATCH_SIZE = 10;        // Countries per batch — keeps memory low
const DETAIL_BATCH = 6;       // Priority 1 countries get detail pages
const DETAIL_PER_COUNTRY = 50; // Limited detail fetches for coordinates

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

function buildRecord(r: any) {
  // Apply Maidenhead locator → coords for repeaters without coordinates
  if ((r.lat === null || r.lng === null) && r.locator) {
    const coords = maidenheadToLatLng(r.locator);
    if (coords) {
      r.lat = coords[0];
      r.lng = coords[1];
      r.coords_from_locator = true;
    }
  }
  return {
    callsign: r.callsign,
    frequency: r.frequency,
    offset_mhz: r.offset_mhz || 0,
    tone: r.tone || '',
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
    locator: r.locator || '',
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

    const countryBreakdown: Record<string, number> = {};
    let totalSaved = 0;
    let withCoords = 0;

    // --- Step 1: Delete existing repeaters ---
    currentStep = 'delete_existing';
    try {
      for (let attempt = 0; attempt < 50; attempt++) {
        const existing = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);
        if (!existing || existing.length === 0) break;
        await base44.asServiceRole.entities.Repeater.deleteMany({ id: { $in: existing.map(r => r.id) } });
      }
    } catch (delErr: any) {
      return Response.json({
        status: 'failed',
        error: `Bestehende Relais konnten nicht gelöscht werden: ${delErr.message || delErr}`,
        step: currentStep,
        duration_ms: Date.now() - startTime,
      }, { status: 500 });
    }

    // --- Step 2: Fetch UK repeaters (ukrepeater.net) and save immediately ---
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
      const ukRecords = ukRepeaters.map(buildRecord);
      for (let i = 0; i < ukRecords.length; i += 500) {
        const batch = ukRecords.slice(i, i + 500);
        await base44.asServiceRole.entities.Repeater.bulkCreate(batch);
        totalSaved += batch.length;
      }
      for (const r of ukRepeaters) {
        if (r.lat && r.lng) withCoords++;
        const cc = r.country_code || '?';
        countryBreakdown[cc] = (countryBreakdown[cc] || 0) + 1;
      }
    } catch {}

    // --- Step 3: Fetch RepeaterBook list pages in batches and save immediately ---
    currentStep = 'repeaterbook_list';
    const priority1Countries = COUNTRIES.filter(c => c.priority === 1);
    const priority1Codes = new Set(priority1Countries.map(c => c.code));

    for (let i = 0; i < COUNTRIES.length; i += BATCH_SIZE) {
      const chunk = COUNTRIES.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(chunk.map(async (country: any) => {
        try {
          const isNA = country.region_type === 'north_america';
          const stateId = country.state_id || country.code;
          const cc = country.country_code || country.code;
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
        // Fetch detail pages (concurrent)
        await Promise.all(toFetch.map(async (rep: any) => {
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
            if (detail.has_emergency_power) {
              rep.has_emergency_power = detail.has_emergency_power;
              rep.power_source = detail.power_source;
            }
          } catch {}
        }));
      }

      // Build records and save
      const records = batchRepeaters.map(buildRecord);
      for (let j = 0; j < records.length; j += 500) {
        const batch = records.slice(j, j + 500);
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
    }

    // --- Step 4: Build repeater links from network_links field ---
    currentStep = 'repeater_links';
    try {
      // Fetch all repeaters with coordinates to build callsign lookup
      const allReps = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);
      const byCallsign = new Map<string, any[]>();
      for (const rep of allReps) {
        if (rep.lat == null || rep.lng == null) continue;
        if (!byCallsign.has(rep.callsign)) byCallsign.set(rep.callsign, []);
        byCallsign.get(rep.callsign)!.push(rep);
      }
      // Build links for repeaters that have network_links in source_id (from detail pages)
      // We skip this step for now — it requires the network_links field which is not stored
      // in the entity. Links are built by the scanRepeaterLinks function separately.
    } catch {}

    return Response.json({
      status: 'success',
      total_saved: totalSaved,
      with_coordinates: withCoords,
      countries: Object.keys(countryBreakdown).length,
      country_breakdown: countryBreakdown,
      duration_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    const errMsg = `Schwerwiegender Fehler beim Relais-Update (Schritt: ${currentStep}): ${error.message || error}`;
    if (base44) {
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