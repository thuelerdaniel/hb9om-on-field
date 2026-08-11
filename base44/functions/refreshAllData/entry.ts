import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchSotaSummits } from '../../shared/sotaFetcher.ts';
import { fetchPotaParks } from '../../shared/potaFetcher.ts';
import { fetchWwffData, fetchWwbotaData as fetchWwbotaDataShared } from '../../shared/referenceFetchers.ts';
import { fetchCastleDataComplete } from '../../shared/castleFetcher.ts';
import { fetchAprsData } from '../../shared/aprsFetcher.ts';
import { upsertPoints } from '../../shared/pointUpsert.ts';

// --- Data fetchers ---

async function fetchSotaData() {
  // Worldwide: fetch all SOTA associations globally.
  // Returns full summit data (code, name, lat, lng, alt, points) — stored as individual
  // SotaPoint records to avoid MongoDB's 16MB document limit.
  const result = await fetchSotaSummits('all');
  return result.summits.map(s => ({
    code: s.code, name: s.name, lat: s.lat, lng: s.lng,
    altitude_m: s.alt || 0, points: s.points || 0
  }));
}

async function fetchCastleDataSlim(castleOverrides) {
  // Worldwide WCA castles — strip to essential fields to stay under MongoDB's 16MB limit.
  const castles = await fetchCastleDataComplete(castleOverrides);
  return castles.map(c => ({
    code: c.code, name: c.name, lat: c.lat, lng: c.lng
  }));
}

async function fetchPotaData() {
  // Worldwide: fetch all POTA entities globally
  const result = await fetchPotaParks('all');
  return result.parks.map(p => ({
    code: p.reference, name: p.name, lat: p.lat, lng: p.lng,
    parkType: p.parkType || '', active: p.active !== false
  }));
}

// WWFF (worldwide) replaces Swiss-only HBFF — stored as individual WwffPoint records
async function fetchHbffData() {
  const refs = await fetchWwffData();
  return refs.map(r => ({
    code: r.code, name: r.name, lat: r.lat, lng: r.lng, link: r.link || ''
  }));
}

// WWBOTA worldwide — shared fetcher in referenceFetchers.ts (no HBBOTA filter)
const fetchWwbotaData = fetchWwbotaDataShared;

// Types that use individual point entities (SotaPoint, PotaPoint, WwffPoint)
// instead of a giant references array in ReferenceData.
const POINT_ENTITY_TYPES = {
  sota: { entity: 'SotaPoint', source: 'sotadata.org.uk CSV' },
  pota: { entity: 'PotaPoint', source: 'api.pota.app' },
  hbff: { entity: 'WwffPoint', source: 'wwff.co CSV (worldwide)' },
};

async function fetchLighthouseData() {
  const resp = await fetch('https://wllw.org/ILLW-flat.txt', { headers: { 'User-Agent': 'HB9OM-OnField/1.0' } });
  if (!resp.ok) throw new Error('ILLW fetch failed');
  const text = await resp.text();
  const swissCoords = {
    'CH0001': { lat: 46.5103, lng: 6.4950 }, 'CH0002': { lat: 46.5097, lng: 6.4960 },
    'CH0003': { lat: 47.4740, lng: 9.4980 }, 'CH0004': { lat: 47.5660, lng: 9.3780 },
    'CH0005': { lat: 46.2080, lng: 6.1540 }, 'CH0006': { lat: 46.2100, lng: 6.1560 },
  };
  const lighthouses = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const code = trimmed.substring(0, eqIdx).trim();
    const name = trimmed.substring(eqIdx + 1).trim();
    if (swissCoords[code]) {
      lighthouses.push({ code, name, lat: swissCoords[code].lat, lng: swissCoords[code].lng, link: 'https://wllw.org/index.php/en/' });
    }
  }
  return lighthouses;
}

// WCA castles worldwide — uses shared castleFetcher module (same as fetchCastles function).
// Parses ALL country tables from the WCA ODS, not just Swiss HB-HB0.
async function fetchCastleData(castleOverrides) {
  return fetchCastleDataComplete(castleOverrides);
}

// --- Legacy fetchCastleData implementation removed ---
// The complete castle-fetching logic (WCA ODS parsing, OSM/Wikidata matching,
// Swiss-specific geocoding, worldwide Nominatim) now lives in the shared module:
//   base44/shared/castleFetcher.ts
// This eliminates ~500 lines of duplicated code between refreshAllData and fetchCastles.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body = {};
    try { body = await req.json(); } catch {}

    // Scheduled runs pass { scheduled: true } from the automation. Manual UI runs send no flag.
    // Only scheduled runs respect the auto_update toggle; manual runs always proceed.
    // Each admin has their own AppSetting record (RLS), so check ALL records — not just settings[0].
    if (body.scheduled === true) {
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'auto_update' });
        const anyDisabled = (settings || []).some(s => s.enabled === false);
        if (anyDisabled) {
          return Response.json({ skipped: true, message: 'Automatische Aktualisierung deaktiviert' });
        }
      } catch {}
    }

    const startTime = Date.now();

    // Fetch admin overrides for reference data
    const allOverrides = await base44.asServiceRole.entities.ReferenceOverride.list("-created_date", 500);
    const overridesByType = new Map();
    for (const ov of (allOverrides || [])) {
      if (!overridesByType.has(ov.reference_type)) overridesByType.set(ov.reference_type, new Map());
      overridesByType.get(ov.reference_type).set(ov.original_code, ov);
    }

    const taskDefs = [
      { type: 'sota', fn: fetchSotaData },
      { type: 'pota', fn: fetchPotaData },
      { type: 'hbff', fn: fetchHbffData },
      { type: 'wwbota', fn: fetchWwbotaData },
      { type: 'lighthouse', fn: fetchLighthouseData },
      { type: 'castle', fn: () => fetchCastleDataSlim(overridesByType.get('castle') || new Map()) },
    ];

    // Run tasks SEQUENTIALLY (not in parallel) to avoid peak memory exhaustion.
    // The SOTA CSV alone is ~125k lines (~15MB text + ~15MB parsed array).
    // Running all 6 tasks concurrently caused worker OOM crashes ("user worker threw exception").
    const results = [];
    for (const t of taskDefs) {
      const taskStart = Date.now();
      try {
        const items = await t.fn();
        // Apply admin overrides for non-castle types
        if (t.type !== 'castle' && overridesByType.has(t.type)) {
          const typeOverrides = overridesByType.get(t.type);
          for (const item of items) {
            const code = item.code || item.reference;
            if (code && typeOverrides.has(code)) {
              const ov = typeOverrides.get(code);
              if (ov.manual_lat != null) { item.lat = ov.manual_lat; item.lng = ov.manual_lng; }
              if (ov.adjusted_name) item.name = ov.adjusted_name;
              if (ov.web_reference) item.link = ov.web_reference;
            }
          }
        }

        // Save: use individual point entities for sota/pota/hbff (avoids 16MB document limit),
        // or ReferenceData.references array for smaller types (wwbota, lighthouse, castle).
        if (POINT_ENTITY_TYPES[t.type]) {
          const ptConfig = POINT_ENTITY_TYPES[t.type];
          const upsertResult = await upsertPoints(base44, ptConfig.entity, t.type, items, ptConfig.source);
          const result: any = { type: t.type, status: 'success', count: upsertResult.created, duration_ms: Date.now() - taskStart };
          if (upsertResult.error) result.warning = upsertResult.error;
          results.push(result);
          continue;
        }

        const now = new Date().toISOString();
        const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: t.type });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
            references: items, total_count: items.length, source: t.type, last_updated: now
          });
        } else {
          await base44.asServiceRole.entities.ReferenceData.create({
            type: t.type, references: items, total_count: items.length, source: t.type, last_updated: now
          });
        }

        const result = { type: t.type, status: 'success', count: items.length, duration_ms: Date.now() - taskStart };
        if (t.type === 'castle') {
          const matched = items.filter(c => c.lat !== null).length;
          const bySource = {};
          for (const c of items) {
            const src = c.matchSource || 'unmatched';
            bySource[src] = (bySource[src] || 0) + 1;
          }
          result.castleStats = { matched, total: items.length, unmatched: items.length - matched, bySource };
        }
        results.push(result);
      } catch (e) {
        results.push({ type: t.type, status: 'failed', count: 0, error: e.message || String(e), duration_ms: Date.now() - taskStart });
      }
    }

    // Repeater scraping is handled by the separate fetchRepeaters function.
    // Including it here caused worker crashes (thousands of HTTP requests exhaust memory/time).
    // The daily automation should call fetchRepeaters separately if repeater refresh is needed.

    // APRS.fi fetch — update repeater coordinates and refresh APRS nodes worldwide.
    // Uses the shared aprsFetcher module (same logic as the admin-triggered fetchAprsFi function).
    let aprsResult = null;
    try {
      const aprsApiKey = process.env.APRS_FI_API_KEY;
      if (aprsApiKey) {
        aprsResult = await fetchAprsData(base44, aprsApiKey);
        results.push({
          type: 'aprs',
          status: 'success',
          count: aprsResult.private_nodes_saved,
          duration_ms: aprsResult.duration_ms,
          aprsStats: {
            repeaters_queried: aprsResult.repeaters_queried,
            repeaters_updated: aprsResult.repeaters_updated_with_coords,
            aprs_nodes_found: aprsResult.aprs_nodes_found,
            private_nodes_saved: aprsResult.private_nodes_saved,
            brandmeister_links: aprsResult.brandmeister_links,
            bbox_queries: aprsResult.bbox_queries,
            bbox_stations_found: aprsResult.bbox_stations_found,
          },
        });
      } else {
        results.push({ type: 'aprs', status: 'failed', count: 0, error: 'APRS_FI_API_KEY not set', duration_ms: 0 });
      }
    } catch (e) {
      results.push({ type: 'aprs', status: 'failed', count: 0, error: e.message || String(e), duration_ms: 0 });
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;
    const overallStatus = successCount === results.length ? 'success' : successCount > 0 ? 'partial' : 'failed';

    // SyncLog: scheduled runs use service role (no user context expected); manual runs use user context
    const isScheduled = body.scheduled === true;
    const syncLogClient = isScheduled ? base44.asServiceRole.entities.SyncLog : (user ? base44.entities.SyncLog : base44.asServiceRole.entities.SyncLog);
    await syncLogClient.create({
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      total_duration_ms: totalDuration,
      results: results,
      trigger: isScheduled ? 'scheduled' : 'manual'
    });

    // Send db-update notification emails to admins who opted in
    try {
      const users = await base44.asServiceRole.entities.User.list();
      const admins = users.filter(u => u.role === 'admin');
      const notifySettings = await base44.asServiceRole.entities.AppSetting.filter({ key: "notify_db_update" });
      const notifyByUser = {};
      for (const s of notifySettings) {
        notifyByUser[s.created_by_id] = s.enabled !== false;
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const summary = results.map(r => {
        if (r.type === 'aprs' && r.status === 'success' && r.aprsStats) {
          const s = r.aprsStats;
          return `aprs: ${r.status} (${r.count} Nodes gespeichert, ${s.repeaters_updated_with_coords} Relais-Koordinaten aktualisiert, ${s.brandmeister_links} BM-Links, ${s.bbox_stations_found} bbox-Stationen)`;
        }
        return `${r.type}: ${r.status} (${r.count})`;
      }).join('\n');

      for (const admin of admins) {
        if (!admin.email) continue;
        if (notifyByUser[admin.id] === false) continue;
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Datenbank-Update - HB9OM On Field - ${overallStatus}`,
            body: `Hallo,\n\ndie Referenzdatenbank wurde aktualisiert:\n\nStatus: ${overallStatus}\nDauer: ${(totalDuration / 1000).toFixed(1)}s\nErfolgreich: ${successCount}/${results.length}\n\nDetails:\n${summary}\n\nDie Aktualisierung umfasst nun auch APRS-Stationen (Digipeater, IGates, Wetterstationen) sowie BrandMeister-DMR-Verlinkungen.\n\n73,\nHB9OM On Field`
          });
        } catch (e) {}
      }
    } catch (e) {}

    return Response.json({ overall_status: overallStatus, total_duration_ms: totalDuration, results: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});