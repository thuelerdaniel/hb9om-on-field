import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { LIGHTHOUSE_REGIONS } from '../../shared/referenceFetchers.ts';
import { REPEATER_REGIONS } from '../../shared/repeaterScraper.ts';

// --- Source definitions ---
// Each source has a function to call and a payload. The orchestrator assigns
// a random time within 00:00-06:00 UTC to each source, different every day.
// Lighthouse regions are listed individually so admins can trigger single-region
// updates without waiting for a full worldwide fetch.
const SOURCES = [
  { source: 'sota', label: 'SOTA', function_name: 'refreshDataSource', function_payload: { source: 'sota', scheduled: true }, order: 1 },
  { source: 'pota', label: 'POTA', function_name: 'refreshDataSource', function_payload: { source: 'pota', scheduled: true }, order: 2 },
  { source: 'hbff', label: 'WWFF', function_name: 'refreshDataSource', function_payload: { source: 'hbff', scheduled: true }, order: 3 },
  { source: 'wwbota', label: 'WWBOTA', function_name: 'refreshDataSource', function_payload: { source: 'wwbota', scheduled: true }, order: 4 },
  { source: 'castle', label: 'Burgen/Schlösser', function_name: 'refreshDataSource', function_payload: { source: 'castle', scheduled: true }, order: 5 },
  // Lighthouse: individual regions (sequential scraping to avoid Overpass timeouts)
  ...LIGHTHOUSE_REGIONS.map((r, i) => ({
    source: `lighthouse_${r.id}`,
    label: r.label,
    function_name: 'fetchLighthouses',
    function_payload: { region: r.id, scheduled: true },
    order: 60 + i,
  })),
  { source: 'iota', label: 'IOTA', function_name: 'refreshDataSource', function_payload: { source: 'iota', scheduled: true }, order: 7 },
  { source: 'aprs', label: 'APRS.fi', function_name: 'fetchAprsFi', function_payload: { scheduled: true }, order: 8 },
  // Repeater: individual regions (sequential scraping to avoid platform timeouts)
  // Each region can be triggered separately, like lighthouse regions.
  ...REPEATER_REGIONS.map((r, i) => ({
    source: `repeater_${r.id}`,
    label: r.label,
    function_name: 'fetchRepeaters',
    function_payload: { region: r.id, scheduled: true },
    order: 90 + i,
  })),
  // Hearham API repeaters — alternative source for regions with poor RepeaterBook coverage
  { source: 'repeater_canada_hearham', label: 'Relais Kanada (Hearham)', function_name: 'fetchHearhamRepeaters', function_payload: { region: 'canada', scheduled: true }, order: 96 },
  { source: 'repeater_asia_hearham', label: 'Relais Asien (Hearham)', function_name: 'fetchHearhamRepeaters', function_payload: { region: 'asia', scheduled: true }, order: 97 },
  { source: 'repeater_africa_hearham', label: 'Relais Afrika (Hearham)', function_name: 'fetchHearhamRepeaters', function_payload: { region: 'africa', scheduled: true }, order: 98 },
  { source: 'tota', label: 'TOTA weltweit', function_name: 'fetchTota', function_payload: { action: 'fetchWorldwide', scheduled: true }, order: 10 },
  { source: 'fm_funknetz', label: 'FM-Funknetz TGs', function_name: 'fetchFmFunknetz', function_payload: { scheduled: true }, order: 11 },
  { source: 'ch_repeater_links', label: 'CH-Relais-Links', function_name: 'fetchCHRepeaterLinks', function_payload: { scheduled: true }, order: 12 },
];

// Assign fixed sequential times to sources, 10 minutes apart, starting at 00:00 UTC.
// SOTA is forced to 03:00 UTC (as requested — it takes ~276s and should not block others).
// All other sources get times in order: 00:00, 00:10, 00:20, ..., skipping the 03:00 slot.
const SLOT_INTERVAL_MIN = 10;

function fixedTimeForIndex(index: number, isSota: boolean): string {
  if (isSota) return '03:00';
  // Assign slots before 03:00 first (00:00-02:50), then after 03:00 (03:10-05:50)
  const slotsBeforeSota = 18; // 00:00-02:50 (18 × 10min = 180min = 3h)
  if (index < slotsBeforeSota) {
    const totalMin = index * SLOT_INTERVAL_MIN;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // After SOTA: start at 03:10
  const afterIndex = index - slotsBeforeSota;
  const totalMin = 3 * 60 + 10 + afterIndex * SLOT_INTERVAL_MIN; // 03:10 + offset
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Convert HH:MM UTC to today's ISO datetime
function timeToIsoUTC(hhmm: string): string {
  const now = new Date();
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0, 0));
  // If the time has already passed today, schedule for tomorrow
  if (d.getTime() < Date.now()) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Authorization: scheduled runs have no user context. Manual runs require admin.
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    // Check auto_update setting for scheduled runs
    if (body.scheduled === true) {
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'auto_update' });
        const anyDisabled = (settings || []).some(s => s.enabled === false);
        if (anyDisabled) {
          return Response.json({ skipped: true, message: 'Automatische Aktualisierung deaktiviert' });
        }
      } catch {}
    }

    // Reset all sources to "pending" and assign fixed sequential times for today.
    // Sources are sorted by display_order, then assigned 10-min slots.
    // SOTA is forced to 03:00 UTC.
    const sortedSources = [...SOURCES].sort((a, b) => a.order - b.order);
    let slotIndex = 0;
    const schedule = [];
    for (const src of sortedSources) {
      const isSota = src.source === 'sota';
      const scheduledTime = fixedTimeForIndex(slotIndex, isSota);
      const nextRunIso = timeToIsoUTC(scheduledTime);
      if (!isSota) slotIndex++;

      // Find existing record for this source
      const existing = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({ source: src.source });
      
      const recordData = {
        source: src.source,
        label: src.label,
        enabled: true,
        function_name: src.function_name,
        function_payload: src.function_payload,
        scheduled_time_utc: scheduledTime,
        next_run_utc: nextRunIso,
        last_status: 'pending',
        last_count: 0,
        last_duration_ms: 0,
        last_error: '',
        last_error_detail: '',
        display_order: src.order,
      };

      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.DailyRefreshSchedule.update(existing[0].id, recordData);
      } else {
        await base44.asServiceRole.entities.DailyRefreshSchedule.create(recordData);
      }

      schedule.push({ source: src.source, label: src.label, scheduled_time_utc: scheduledTime, next_run_utc: nextRunIso });
    }

    // Sort by scheduled time for display
    schedule.sort((a, b) => a.scheduled_time_utc.localeCompare(b.scheduled_time_utc));

    return Response.json({
      status: 'success',
      message: 'Zeitplan für heute erstellt',
      schedule,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ 
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}