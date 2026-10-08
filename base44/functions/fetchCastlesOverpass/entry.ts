import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { recordOwnRun } from '../../shared/sourceRunner.ts';

// Fetch castles from OpenStreetMap Overpass API for countries with sparse WCA coverage.
// Stores Overpass castles in a SEPARATE ReferenceData entry (type='castle_overpass').
// The frontend merges 'castle' (WCA) and 'castle_overpass' (OSM) when loading.
// Generates WCA-compatible reference codes (TA-00001, SX-00001, etc.).
//
// v0.959-HF2: Chunked across many short calls (one quadrant per call, ≤75s total budget)
// so each call stays well under the 100s gateway limit. A monthly cache skip returns
// 'skipped' with a readable reason. Dedup by name+coords prevents the 22k→3k duplicate
// explosion the old single-call version produced. Progress is persisted in AppSetting
// ('castle_overpass_cycle') so a cycle resumes across the 5-min scheduler ticks.

interface CountryConfig {
  prefix: string;
  name: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

const COUNTRIES: CountryConfig[] = [
  { prefix: 'TA', name: 'Türkei', south: 35.0, west: 25.0, north: 43.0, east: 45.0 },
  { prefix: 'SX', name: 'Griechenland', south: 34.0, west: 19.0, north: 42.0, east: 28.0 },
  { prefix: '4L', name: 'Georgien', south: 41.0, west: 40.0, north: 43.0, east: 47.0 },
  { prefix: 'EK', name: 'Armenien', south: 38.0, west: 43.0, north: 42.0, east: 47.0 },
  { prefix: 'LZ', name: 'Bulgarien', south: 41.0, west: 22.0, north: 44.0, east: 28.0 },
  { prefix: 'YO', name: 'Rumänien', south: 43.0, west: 20.0, north: 48.0, east: 30.0 },
  { prefix: 'YU', name: 'Serbien', south: 42.0, west: 18.0, north: 46.0, east: 23.0 },
  { prefix: 'ZA', name: 'Albanien', south: 39.0, west: 19.0, north: 43.0, east: 21.0 },
  { prefix: 'Z3', name: 'Nordmazedonien', south: 40.0, west: 20.0, north: 43.0, east: 23.0 },
  { prefix: 'E7', name: 'Bosnien', south: 42.0, west: 15.0, north: 45.0, east: 20.0 },
  { prefix: '4O', name: 'Montenegro', south: 41.0, west: 18.0, north: 43.0, east: 21.0 },
  { prefix: 'CN', name: 'Marokko', south: 27, west: -10, north: 36, east: 0 },
  { prefix: '3V', name: 'Tunesien', south: 30, west: 7, north: 38, east: 12 },
  { prefix: 'OD', name: 'Libanon', south: 33, west: 34, north: 35, east: 37 },
  { prefix: 'JY', name: 'Jordanien', south: 29, west: 34, north: 33, east: 40 },
];

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const CALL_BUDGET_MS = 75000;        // total wall-clock budget per call (< 100s gateway limit)
const REQUEST_TIMEOUT_MS = 15000;   // per Overpass request
const MIN_REQUEST_TIME_MS = 5000;   // don't start a new request if < 5s budget remains
const PER_QUADRANT_BUDGET_MS = 30000; // cap mirror attempts per quadrant (2 mirrors × 15s)
const REFRESH_INTERVAL_DAYS = 30;   // monthly — castles change rarely
const CURSOR_KEY = 'castle_overpass_cycle';
const MAX_TASK_FAILURES = 3;         // skip a quadrant after this many failed attempts

function buildTasks(countries: CountryConfig[]): Array<{ label: string; prefix: string; south: number; west: number; north: number; east: number }> {
  const tasks: any[] = [];
  for (const c of countries) {
    const midLat = (c.south + c.north) / 2;
    const midLng = (c.west + c.east) / 2;
    tasks.push({ label: `${c.prefix}-SW`, prefix: c.prefix, south: c.south, west: c.west, north: midLat, east: midLng });
    tasks.push({ label: `${c.prefix}-SE`, prefix: c.prefix, south: c.south, west: midLng, north: midLat, east: c.east });
    tasks.push({ label: `${c.prefix}-NW`, prefix: c.prefix, south: midLat, west: c.west, north: c.north, east: midLng });
    tasks.push({ label: `${c.prefix}-NE`, prefix: c.prefix, south: midLat, west: midLng, north: c.north, east: c.east });
  }
  return tasks;
}

async function fetchOverpassBBox(south: number, west: number, north: number, east: number, deadlineMs?: number): Promise<any[]> {
  const query = `[out:json][timeout:15];
(
  node["historic"="castle"](${south},${west},${north},${east});
  way["historic"="castle"](${south},${west},${north},${east});
  relation["historic"="castle"](${south},${west},${north},${east});
  node["building"="castle"](${south},${west},${north},${east});
  way["building"="castle"](${south},${west},${north},${east});
  node["ruins"="castle"](${south},${west},${north},${east});
  way["ruins"="castle"](${south},${west},${north},${east});
  node["historic"="fort"](${south},${west},${north},${east});
  way["historic"="fort"](${south},${west},${north},${east});
);
out center 500;`;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (deadlineMs && Date.now() > deadlineMs) break; // stop if quadrant budget exhausted
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data?.elements || [];
      }
      if (resp.status === 429 || resp.status === 503 || resp.status === 521) continue; // rate limited → next mirror
    } catch {}
  }
  return null; // all mirrors failed
}

function extractName(tags: any, fallback: string): string {
  if (!tags) return fallback;
  return tags.name || tags['name:de'] || tags['name:en'] || fallback;
}

async function syncCastles(base44: any, body: any): Promise<any> {
  const deadline = Date.now() + CALL_BUDGET_MS;
  const force = body?.force === true || body?.force_recalc === true;
  const countryPrefix = body?.country_prefix;

  // Load existing castle_overpass document (largest total_count)
  const existingRows = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'castle_overpass' });
  let primaryRow: any = null;
  for (const row of existingRows) {
    if (!primaryRow || (row.total_count || 0) > (primaryRow.total_count || 0)) primaryRow = row;
  }
  const existingCastles: any[] = primaryRow?.references || [];
  const lastUpdated = primaryRow?.last_updated ? new Date(primaryRow.last_updated) : null;

  // ─── Targeted run: one country, no cycle cursor ───
  if (countryPrefix) {
    const country = COUNTRIES.find(c => c.prefix === countryPrefix);
    if (!country) return { error: `Unbekanntes country_prefix: ${countryPrefix}` };
    const tasks = buildTasks([country]);
    const dedupMap = new Map<string, any>();
    for (const c of existingCastles) dedupMap.set((c.name || '').toLowerCase() + '|' + c.lat.toFixed(4) + ',' + c.lng.toFixed(4), c);
    const newCastles: any[] = [];
    let attempts = 0, failures = 0;
    for (const task of tasks) {
      if (Date.now() > deadline - MIN_REQUEST_TIME_MS) break;
      attempts++;
      const els = await fetchOverpassBBox(task.south, task.west, task.north, task.east, Date.now() + PER_QUADRANT_BUDGET_MS);
      if (els == null) { failures++; continue; }
      for (const el of els) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (lat == null || lng == null) continue;
        const name = extractName(el.tags, `${task.prefix}-Castle`);
        const key = name.toLowerCase() + '|' + lat.toFixed(4) + ',' + lng.toFixed(4);
        if (dedupMap.has(key)) continue;
        dedupMap.set(key, true);
        newCastles.push({ name, lat, lng, country: country.name, country_prefix: task.prefix, source: 'openstreetmap-overpass', osm_id: el.id, osm_type: el.type });
      }
    }
    const merged = [...existingCastles, ...newCastles];
    const now = new Date().toISOString();
    if (primaryRow) {
      await base44.asServiceRole.entities.ReferenceData.update(primaryRow.id, { references: merged, total_count: merged.length, last_updated: now });
    } else {
      await base44.asServiceRole.entities.ReferenceData.create({ type: 'castle_overpass', references: merged, total_count: merged.length, source: 'OpenStreetMap Overpass', last_updated: now });
    }
    return {
      success: true, targeted: true, country: country.name,
      attempts, failures, new_castles: newCastles.length, total_overpass: merged.length,
      count: merged.length, saved: newCastles.length, duration_ms: Date.now() - (deadline - CALL_BUDGET_MS),
    };
  }

  // ─── Full cycle (chunked across calls) ───
  const ageDays = lastUpdated ? (Date.now() - lastUpdated.getTime()) / 86400000 : Infinity;
  if (!force && ageDays < REFRESH_INTERVAL_DAYS) {
    return {
      skipped: true,
      reason: `Monatlicher Cache — letzte Aktualisierung ${lastUpdated.toISOString().slice(0, 10)}, nächste fällig in ${Math.ceil(REFRESH_INTERVAL_DAYS - ageDays)} Tagen`,
      count: existingCastles.length, total_overpass: existingCastles.length,
    };
  }

  let cycle: any = { tasks_done: [], new_castles: 0, task_failures: {} };
  try {
    const cursorRows = await base44.asServiceRole.entities.AppSetting.filter({ key: CURSOR_KEY });
    if (cursorRows.length > 0) cycle = JSON.parse(cursorRows[0].value || '{}');
    if (!Array.isArray(cycle.tasks_done)) cycle.tasks_done = [];
    if (!cycle.task_failures) cycle.task_failures = {};
  } catch {}

  const allTasks = buildTasks(COUNTRIES);
  const dedupMap = new Map<string, any>();
  for (const c of existingCastles) dedupMap.set((c.name || '').toLowerCase() + '|' + c.lat.toFixed(4) + ',' + c.lng.toFixed(4), c);
  const newCastles: any[] = [];
  let attempts = 0, failures = 0;

  for (const task of allTasks) {
    if (Date.now() > deadline - MIN_REQUEST_TIME_MS) break;
    if (cycle.tasks_done.includes(task.label)) continue;
    if ((cycle.task_failures[task.label] || 0) >= MAX_TASK_FAILURES) continue;

    attempts++;
    const els = await fetchOverpassBBox(task.south, task.west, task.north, task.east, Date.now() + PER_QUADRANT_BUDGET_MS);
    if (els == null) {
      failures++;
      cycle.task_failures[task.label] = (cycle.task_failures[task.label] || 0) + 1;
      continue;
    }
    for (const el of els) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) continue;
      const name = extractName(el.tags, `${task.prefix}-Castle`);
      const key = name.toLowerCase() + '|' + lat.toFixed(4) + ',' + lng.toFixed(4);
      if (dedupMap.has(key)) continue;
      dedupMap.set(key, true);
      const country = COUNTRIES.find(c => c.prefix === task.prefix);
      newCastles.push({ name, lat, lng, country: country?.name, country_prefix: task.prefix, source: 'openstreetmap-overpass', osm_id: el.id, osm_type: el.type });
    }
    cycle.tasks_done.push(task.label);
  }

  const merged = [...existingCastles, ...newCastles];
  const cycleDone = cycle.tasks_done.length >= allTasks.length;
  const now = new Date().toISOString();
  const progressPct = Math.round((cycle.tasks_done.length / allTasks.length) * 100);
  const progressNote = `Chunked: ${progressPct}% (${cycle.tasks_done.length}/${allTasks.length} Quadranten) — ${newCastles.length} neue Burgen in diesem Lauf`;

  if (primaryRow) {
    await base44.asServiceRole.entities.ReferenceData.update(primaryRow.id, {
      references: merged,
      total_count: merged.length,
      last_updated: cycleDone ? now : primaryRow.last_updated, // only stamp on full cycle completion
    });
  } else {
    await base44.asServiceRole.entities.ReferenceData.create({
      type: 'castle_overpass', references: merged, total_count: merged.length,
      source: 'OpenStreetMap Overpass', last_updated: now,
    });
  }

  cycle.new_castles = (cycle.new_castles || 0) + newCastles.length;
  if (cycleDone) cycle = { tasks_done: [], new_castles: 0, task_failures: {} }; // reset for next month
  try {
    const cursorRows = await base44.asServiceRole.entities.AppSetting.filter({ key: CURSOR_KEY });
    if (cursorRows.length > 0) await base44.asServiceRole.entities.AppSetting.update(cursorRows[0].id, { value: JSON.stringify(cycle) });
    else await base44.asServiceRole.entities.AppSetting.create({ key: CURSOR_KEY, value: JSON.stringify(cycle) });
  } catch {}

  return {
    success: !cycleDone, has_more: !cycleDone,
    attempts, failures, new_castles: newCastles.length, total_overpass: merged.length,
    progress_pct: progressPct, tasks_done: cycle.tasks_done.length, total_tasks: allTasks.length,
    progress_note: progressNote,
    count: merged.length, saved: newCastles.length, duration_ms: Date.now() - (deadline - CALL_BUDGET_MS),
  };
}

export default async function (req: Request): Promise<Response> {
  const start = Date.now();
  let batchMode = false;
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Self-recording sources are also called by their own workflow / admin panel / tests.
    // Only record when NOT invoked by the shared sourceRunner (which records itself).
    batchMode = !body?._runner;
    const trigger = body?.scheduled ? 'scheduled' : 'manual';

    const result = await syncCastles(base44, body);
    if (batchMode) await recordOwnRun(base44, 'castle_overpass', result, Date.now() - start, trigger);
    return Response.json(result);
  } catch (error: any) {
    if (batchMode) {
      try {
        const base44 = createClientFromRequest(req);
        await recordOwnRun(base44, 'castle_overpass', { error: error.message || String(error), status: 'failed' }, Date.now() - start, 'manual');
      } catch {}
    }
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}