import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { todayUTC, isToday, extractCount, extractStatus, shuffle } from '../../shared/syncHelpers.ts';
import { isInternalCall, getInternalSecret } from '../../shared/internalAuth.ts';

// ─── Weekly Sync Batch Scheduler ───
// Replaces the old daily scheduler. Runs on Mondays (full sync, 01:00-05:00 UTC)
// and Thursdays (partial CH/EU repeater sync, 03:00-04:00 UTC).
//
// Key rules:
// - Monday: All sources with weekly_enabled=true and "Monday" in weekly_days
// - Thursday: Only sources with "Thursday" in weekly_days (eu_priority1, eu_priority2, uk, fm_funknetz, ch_links)
// - Other days: idle (APRS streaming runs separately via its own daily automation)
// - Max 1 source at a time (sequential, no parallelism)
// - Each source runs at most 1x per scheduled day ("already ran today" check)
// - SOTA: chunked CSV processing — if hasMore=true, status stays 'pending' and resumes next tick
// - After Monday batch completion: triggers sendDailyAdminReport with mode='weekly'
// - APRS (fetchAprsFi/fetchAprsStations) excluded — runs via separate daily automation

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SOURCE_TIMEOUT_MS = 120000;
const SOTA_TIMEOUT_MS = 200000; // SOTA needs more time for CSV download + chunk processing
const LIGHTHOUSE_TIMEOUT_MS = 60000;
const RETRY_DELAY_MS = 30000;
const HEAVY_PAUSE_MS = 10000;
const HEAVY_SOURCES = new Set(['sota', 'hbff', 'castle']);

// Time windows per day (UTC hours)
const WINDOWS: Record<string, { start: number; deadline: number; hardEnd: number }> = {
  Monday: { start: 1, deadline: 5, hardEnd: 5 },    // 01:00-05:00 UTC
  Thursday: { start: 3, deadline: 4, hardEnd: 4 },   // 03:00-04:00 UTC
};

function getTimeWindow(dayName: string) {
  return WINDOWS[dayName] || null;
}

function inTimeWindow(dayName: string): boolean {
  const win = getTimeWindow(dayName);
  if (!win) return false;
  const now = new Date();
  const h = now.getUTCHours();
  if (h < win.start) return false;
  if (h >= win.hardEnd) return false;
  return true;
}

function isPastDeadline(dayName: string): boolean {
  const win = getTimeWindow(dayName);
  if (!win) return true;
  const now = new Date();
  const h = now.getUTCHours();
  if (h > win.deadline) return true;
  return false;
}

// ─── Source state logic ───
function needsToRun(s: any): boolean {
  if (s.last_status === 'running') return false;
  if (s.last_status === 'pending') return true;
  return !isToday(s.last_run_time);
}

function isDone(s: any): boolean {
  if (s.last_status === 'pending' || s.last_status === 'running') return false;
  return isToday(s.last_run_time);
}

// Get or create today's shuffled order (stored in AppSettings)
async function getTodaysOrder(base44: any, dayName: string, enabledSources: any[]): Promise<string[]> {
  const key = 'weekly_batch_order_' + dayName + '_' + todayUTC();
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key });

  if (settings.length > 0) {
    try {
      const state = JSON.parse(settings[0].value || '{}');
      if (state.date === todayUTC() && state.day === dayName && Array.isArray(state.order) && state.order.length > 0) {
        return state.order;
      }
    } catch {}
  }

  const pending = enabledSources.filter(s => needsToRun(s));
  const shuffled = shuffle(pending);
  const order = shuffled.map((s: any) => s.source);
  const state = { date: todayUTC(), day: dayName, order, createdAt: new Date().toISOString() };

  if (settings.length > 0) {
    await base44.asServiceRole.entities.AppSetting.update(settings[0].id, { value: JSON.stringify(state) });
  } else {
    await base44.asServiceRole.entities.AppSetting.create({ key, value: JSON.stringify(state) });
  }

  return order;
}

// Check if report was already sent today
async function isReportSentToday(base44: any): Promise<boolean> {
  const key = 'weekly_report_sent_' + todayUTC();
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key });
  return settings.length > 0;
}

async function markReportSent(base44: any): Promise<void> {
  const key = 'weekly_report_sent_' + todayUTC();
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key });
  if (settings.length > 0) return;
  try {
    await base44.asServiceRole.entities.AppSetting.create({ key, value: new Date().toISOString() });
  } catch {}
}

// Run a source with timeout
async function runSourceWithTimeout(base44: any, src: any, timeout: number, incrementalOverride?: boolean): Promise<{ ok: boolean; data: any; timedOut: boolean }> {
  const incremental = incrementalOverride !== undefined ? incrementalOverride : !!src.incremental_enabled;
  const payload = { ...(src.function_payload || {}), scheduled: true, incremental };
  try {
    const data = await Promise.race([
      base44.functions.invoke(src.function_name, payload).then((res: any) => res?.data || res),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeout)),
    ]);
    return { ok: true, data, timedOut: false };
  } catch (e: any) {
    if (e?.message === 'TIMEOUT') return { ok: false, data: null, timedOut: true };
    return { ok: false, data: { error: e?.message || String(e) }, timedOut: false };
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Authorization: internal calls (from automation) pass a server-side secret.
    // Manual runs require admin. The client-controllable `scheduled` flag is NOT trusted for auth.
    if (!isInternalCall(body)) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    // Determine day of week
    const now = new Date();
    const dayName = DAY_NAMES[now.getUTCDay()];

    // Manual runs can override the day (for testing)
    const effectiveDay = body.day || dayName;

    // Check if this day has a sync window
    const win = getTimeWindow(effectiveDay);
    if (!win) {
      return Response.json({ status: 'idle', message: `Kein Sync-Fenster für ${effectiveDay} (APRS läuft separat)` });
    }

    // Check time window (scheduled runs only — manual runs bypass)
    if (body.scheduled === true && !inTimeWindow(effectiveDay)) {
      return Response.json({ status: 'idle', message: `Ausserhalb Zeitfenster für ${effectiveDay}` });
    }

    // Check auto_update setting
    if (body.scheduled === true) {
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'auto_update' });
        const anyDisabled = (settings || []).some((s: any) => s.enabled === false);
        if (anyDisabled) {
          return Response.json({ skipped: true, message: 'Automatische Aktualisierung deaktiviert' });
        }
      } catch {}
    }

    // Get all schedules and filter by weekly_enabled + day
    const allSchedules = await base44.asServiceRole.entities.DailyRefreshSchedule.list('display_order', 100);

    // Read per-source config from AppSettings
    let sourceConfig: Record<string, any> = {};
    try {
      const configRow = await base44.asServiceRole.entities.AppSetting.filter({ key: 'source_config' });
      if (configRow.length > 0 && configRow[0].value) {
        sourceConfig = JSON.parse(configRow[0].value);
      }
    } catch {}

    // Get default config for a source
    const getDefaultCfg = (src: string): any => {
      const base = { schedule_mode: 'weekly', incremental: false, auto_incremental_after_full: true, admin_override: false, first_full_load_done: false, enabled: true };
      if (src === 'aprs') return { ...base, schedule_mode: 'daily', auto_incremental_after_full: false };
      if (src.startsWith('repeater')) return { ...base, incremental: true, first_full_load_done: true };
      return base;
    };
    const getCfg = (src: string) => ({ ...getDefaultCfg(src), ...(sourceConfig[src] || {}) });

    const enabledSources = (allSchedules || []).filter((s: any) => {
      const cfg = getCfg(s.source);
      // Check if source is enabled in source_config (fall back to weekly_enabled)
      const isEnabled = cfg.enabled !== false && s.weekly_enabled;
      if (!isEnabled) return false;
      // Check if schedule_mode matches the current day
      if (cfg.schedule_mode === 'daily') return true; // daily runs every day
      if (cfg.schedule_mode === 'weekly') {
        return Array.isArray(s.weekly_days) && s.weekly_days.includes(effectiveDay);
      }
      if (cfg.schedule_mode === 'monthly') {
        // Monthly: run on first day of month OR the configured day
        const dayOfMonth = new Date().getUTCDate();
        return dayOfMonth === 1 || effectiveDay === 'Monday'; // simplified
      }
      return Array.isArray(s.weekly_days) && s.weekly_days.includes(effectiveDay);
    });

    if (enabledSources.length === 0) {
      return Response.json({ status: 'idle', message: `Keine aktivierten Quellen für ${effectiveDay}` });
    }

    // ─── Deadline check (scheduled runs only) ───
    if (body.scheduled === true && isPastDeadline(effectiveDay)) {
      const remaining = enabledSources.filter((s: any) => needsToRun(s));
      let skippedCount = 0;
      for (const src of remaining) {
        try {
          await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, {
            last_status: 'skipped',
            last_error: `Übersprungen: ${effectiveDay} Deadline erreicht`,
            last_run_time: new Date().toISOString(),
          });
          skippedCount++;
        } catch {}
      }

      // Send weekly report on Monday if not already sent
      if (effectiveDay === 'Monday' && !(await isReportSentToday(base44))) {
        try {
          await base44.functions.invoke('sendDailyAdminReport', { scheduled: true, mode: 'weekly', internal_secret: getInternalSecret() });
          await markReportSent(base44);
        } catch {}
      }

      return Response.json({
        status: 'deadline',
        day: effectiveDay,
        skipped: skippedCount,
        message: 'Deadline erreicht — verbleibende Quellen übersprungen',
      });
    }

    // ─── Get or create today's shuffled order ───
    const order = await getTodaysOrder(base44, effectiveDay, enabledSources);
    const sourceMap = new Map(enabledSources.map((s: any) => [s.source, s]));

    // ─── Find next source to process ───
    let nextSource: any = null;
    for (const key of order) {
      const src = sourceMap.get(key);
      if (!src) continue;
      if (!needsToRun(src)) continue;
      nextSource = src;
      break;
    }

    if (!nextSource) {
      // No due source — check if all done, then send report (Monday only)
      const allDone = enabledSources.every((s: any) => isDone(s));
      if (allDone && effectiveDay === 'Monday' && !(await isReportSentToday(base44))) {
        try {
          await base44.functions.invoke('sendDailyAdminReport', { scheduled: true, mode: 'weekly', internal_secret: getInternalSecret() });
          await markReportSent(base44);
        } catch {}
        return Response.json({ status: 'complete', day: effectiveDay, message: 'Alle Quellen abgeschlossen, Wochen-Report versendet' });
      }
      return Response.json({ status: 'idle', day: effectiveDay, message: 'Keine fällige Quelle' });
    }

    // ─── Heavy source pause BEFORE ───
    if (HEAVY_SOURCES.has(nextSource.source)) {
      await new Promise(r => setTimeout(r, HEAVY_PAUSE_MS));
    }

    // Mark as running
    try {
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(nextSource.id, {
        last_status: 'running',
      });
    } catch {}

    const taskStart = Date.now();
    const timeout = nextSource.source === 'sota'
      ? SOTA_TIMEOUT_MS
      : nextSource.source.startsWith('lighthouse')
      ? LIGHTHOUSE_TIMEOUT_MS
      : SOURCE_TIMEOUT_MS;

    // Get per-source config for this source
    const cfg = getCfg(nextSource.source);

    // ─── First attempt ───
    let result = await runSourceWithTimeout(base44, nextSource, timeout, cfg.incremental);
    let retried = false;

    // ─── Retry on failure (1x after 30s) — but NOT for SOTA partial chunks ───
    const isSotaPartial = nextSource.source === 'sota' && result.ok && result.data?.has_more;
    const firstFailed = !isSotaPartial && (result.timedOut || (!result.timedOut && extractStatus(result.data) === 'failed'));
    if (firstFailed) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      result = await runSourceWithTimeout(base44, nextSource, timeout, cfg.incremental);
      retried = true;
    }

    const duration = Date.now() - taskStart;

    // ─── SOTA chunked: if hasMore=true, keep status='pending' to resume next tick ───
    if (nextSource.source === 'sota' && result.ok && result.data?.has_more) {
      const progressPct = result.data.progress_pct || 0;
      const processedSoFar = result.data.processed_so_far || 0;
      const totalCount = result.data.total || 0;
      try {
        await base44.asServiceRole.entities.DailyRefreshSchedule.update(nextSource.id, {
          last_run_time: new Date().toISOString(),
          last_status: 'pending', // Keep pending so it runs again next tick
          last_count: processedSoFar,
          last_duration_ms: duration,
          last_error: `Chunked: ${progressPct}% verarbeitet (${processedSoFar}/${totalCount})`,
        });
      } catch {}

      // Write SyncLog for the chunk
      try {
        await base44.asServiceRole.entities.SyncLog.create({
          timestamp: new Date().toISOString(),
          overall_status: 'partial',
          total_duration_ms: duration,
          results: [{
            source: 'sota',
            label: nextSource.label,
            status: 'partial',
            count: result.data.count || 0,
            duration_ms: duration,
            error: `Chunk ${progressPct}% (${processedSoFar}/${totalCount})`,
            retried: false,
          }],
          trigger: body.scheduled ? 'scheduled' : 'manual',
        });
      } catch {}

      return Response.json({
        status: 'processed_chunk',
        day: effectiveDay,
        source: 'sota',
        progress_pct: progressPct,
        processed_so_far: processedSoFar,
        total: totalCount,
        has_more: true,
        duration_ms: duration,
      });
    }

    // ─── Normal completion ───
    const status = result.timedOut
      ? 'timeout'
      : extractStatus(result.data);
    const count = result.timedOut ? 0 : extractCount(result.data);
    const errorMsg = result.timedOut
      ? `Timeout nach ${timeout / 1000}s`
      : (result.data?.error || (status === 'success' && count === 0 ? 'Warnung: 0 Einträge geladen' : ''));

    let errorDetail = '';
    if (status !== 'success') {
      errorDetail = JSON.stringify({
        source: nextSource.source,
        function: nextSource.function_name,
        timedOut: result.timedOut,
        retried,
        error: errorMsg,
        response: result.data ? JSON.stringify(result.data).substring(0, 2000) : 'null',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }, null, 2);
    }

    // Update schedule record
    try {
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(nextSource.id, {
        last_run_time: new Date().toISOString(),
        last_status: status === 'timeout' ? 'failed' : status,
        last_count: count,
        last_duration_ms: duration,
        last_error: (errorMsg || '').substring(0, 500),
        last_error_detail: errorDetail,
      });
    } catch {}

    // Write SyncLog
    try {
      await base44.asServiceRole.entities.SyncLog.create({
        timestamp: new Date().toISOString(),
        overall_status: status === 'success' ? 'success' : 'failed',
        total_duration_ms: duration,
        results: [{
          source: nextSource.source,
          label: nextSource.label,
          status,
          count,
          duration_ms: duration,
          error: errorMsg,
          retried,
        }],
        trigger: body.scheduled ? 'scheduled' : 'manual',
      });
    } catch {}

    // ─── Update per-source config in AppSettings ───
    try {
      const configRow2 = await base44.asServiceRole.entities.AppSetting.filter({ key: 'source_config' });
      let sc: Record<string, any> = {};
      if (configRow2.length > 0 && configRow2[0].value) {
        try { sc = JSON.parse(configRow2[0].value); } catch {}
      }
      const defCfg = getDefaultCfg(nextSource.source);
      const curCfg = { ...defCfg, ...(sc[nextSource.source] || {}) };

      const wasFullSync = !curCfg.incremental;
      const syncSuccess = status === 'success';

      // Update last run info
      curCfg.last_run = new Date().toISOString();
      curCfg.last_result = status === 'timeout' ? 'timeout' : status;
      curCfg.last_records = count;
      curCfg.last_duration_seconds = Math.round(duration / 1000);
      curCfg.last_error = status === 'success' ? null : (errorMsg || '').substring(0, 500);

      // Auto-logic: after successful full sync, switch to incremental + weekly
      if (syncSuccess && wasFullSync && curCfg.auto_incremental_after_full && !curCfg.admin_override) {
        curCfg.first_full_load_done = true;
        curCfg.incremental = true;
        curCfg.schedule_mode = 'weekly';
        curCfg.repeat_enabled = false;
        curCfg.repeat_interval_minutes = 0;
      } else if (syncSuccess && wasFullSync) {
        curCfg.first_full_load_done = true;
      }

      // Calculate next_run
      const next = new Date();
      if (curCfg.schedule_mode === 'daily') {
        next.setUTCDate(next.getUTCDate() + 1);
        next.setUTCHours(1, 0, 0, 0);
      } else if (curCfg.schedule_mode === 'weekly') {
        next.setUTCDate(next.getUTCDate() + 7);
        next.setUTCHours(1, 0, 0, 0);
      } else if (curCfg.schedule_mode === 'monthly') {
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(1);
        next.setUTCHours(1, 0, 0, 0);
      }
      curCfg.next_run = next.toISOString();

      sc[nextSource.source] = curCfg;
      const valueToSave = JSON.stringify(sc);
      if (configRow2.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(configRow2[0].id, { value: valueToSave });
      } else {
        await base44.asServiceRole.entities.AppSetting.create({ key: 'source_config', value: valueToSave });
      }
    } catch {}

    // ─── Heavy source pause AFTER ───
    if (HEAVY_SOURCES.has(nextSource.source)) {
      await new Promise(r => setTimeout(r, HEAVY_PAUSE_MS));
    }

    // ─── Check if all done → send weekly report (Monday only) ───
    let reportTriggered = false;
    try {
      const allAfter = await base44.asServiceRole.entities.DailyRefreshSchedule.list('display_order', 100);
      const stillIncomplete = (allAfter || []).filter((s: any) => {
        if (!s.weekly_enabled || !Array.isArray(s.weekly_days) || !s.weekly_days.includes(effectiveDay)) return false;
        if (s.function_name === 'fetchAprsFi' || s.function_name === 'fetchAprsStations') return false;
        return !isDone(s);
      });
      if (stillIncomplete.length === 0 && effectiveDay === 'Monday' && !(await isReportSentToday(base44))) {
        await base44.functions.invoke('sendDailyAdminReport', { scheduled: true, mode: 'weekly', internal_secret: getInternalSecret() });
        await markReportSent(base44);
        reportTriggered = true;
      }
    } catch {}

    return Response.json({
      status: 'processed',
      day: effectiveDay,
      checked_at: new Date().toISOString(),
      source: nextSource.source,
      label: nextSource.label,
      result_status: status,
      count,
      duration_ms: duration,
      retried,
      report_triggered: reportTriggered,
    });
  } catch (error: any) {
    return Response.json({
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}