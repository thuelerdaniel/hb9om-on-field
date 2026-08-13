import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { todayUTC, isToday, extractCount, extractStatus, shuffle } from '../../shared/syncHelpers.ts';

// ─── Dynamic Daily Sync Batch Scheduler ───
// Replaces the old 5-minute checker + fixed-time orchestrator.
// Runs every 5 minutes between 03:00-06:30 UTC via cron automation.
// Each run processes ONE source from a daily-shuffled order.
// After all sources complete (or 06:15 UTC deadline), sends admin report.
//
// Key rules:
// - Max 1 source at a time (sequential, no parallelism)
// - Each source runs at most 1x per day ("already ran today" check)
// - Heavy sources (SOTA, WWFF, Castle): 10s pause before/after
// - Per-source timeout: 120s (lighthouse 60s)
// - Retry 1x after 30s on failure
// - 06:15 UTC deadline: remaining sources marked "skipped", report sent
// - APRS (fetchAprsFi) excluded — handled by fetchAprsStations separately

const SOURCE_TIMEOUT_MS = 120000;
const LIGHTHOUSE_TIMEOUT_MS = 60000;
const RETRY_DELAY_MS = 30000;
const HEAVY_PAUSE_MS = 10000;
const HEAVY_SOURCES = new Set(['sota', 'hbff', 'castle']);
const WINDOW_START_HOUR = 3;
const DEADLINE_HOUR = 6;
const DEADLINE_MIN = 15;
const HARD_END_HOUR = 6;
const HARD_END_MIN = 30;

function inTimeWindow(): boolean {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  if (h < WINDOW_START_HOUR) return false;
  if (h > HARD_END_HOUR) return false;
  if (h === HARD_END_HOUR && m > HARD_END_MIN) return false;
  return true;
}

function isPastDeadline(): boolean {
  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  if (h > DEADLINE_HOUR) return true;
  if (h === DEADLINE_HOUR && m >= DEADLINE_MIN) return true;
  return false;
}

// Get or create today's shuffled order (stored in AppSettings)
async function getTodaysOrder(base44: any, enabledSources: any[]): Promise<string[]> {
  const key = 'daily_batch_order_' + todayUTC();
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key });

  if (settings.length > 0) {
    try {
      const state = JSON.parse(settings[0].value || '{}');
      if (state.date === todayUTC() && Array.isArray(state.order) && state.order.length > 0) {
        return state.order;
      }
    } catch {}
  }

  // Create new shuffled order from sources not yet run today
  const pending = enabledSources.filter(s => !isToday(s.last_run_time));
  const shuffled = shuffle(pending);
  const order = shuffled.map((s: any) => s.source);
  const state = { date: todayUTC(), order, createdAt: new Date().toISOString() };

  if (settings.length > 0) {
    await base44.asServiceRole.entities.AppSetting.update(settings[0].id, { value: JSON.stringify(state) });
  } else {
    await base44.asServiceRole.entities.AppSetting.create({ key, value: JSON.stringify(state) });
  }

  return order;
}

// Check if report was already sent today
async function isReportSentToday(base44: any): Promise<boolean> {
  const key = 'daily_report_sent_' + todayUTC();
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key });
  return settings.length > 0;
}

// Mark report as sent today
async function markReportSent(base44: any): Promise<void> {
  const key = 'daily_report_sent_' + todayUTC();
  const settings = await base44.asServiceRole.entities.AppSetting.filter({ key });
  if (settings.length > 0) return;
  try {
    await base44.asServiceRole.entities.AppSetting.create({ key, value: new Date().toISOString() });
  } catch {}
}

// Run a source with timeout
async function runSourceWithTimeout(base44: any, src: any, timeout: number): Promise<{ ok: boolean; data: any; timedOut: boolean }> {
  const payload = { ...(src.function_payload || {}), scheduled: true };
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

    // Authorization: scheduled runs bypass auth. Manual runs require admin.
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    // Check time window (scheduled runs only — manual runs bypass)
    if (body.scheduled === true && !inTimeWindow()) {
      return Response.json({ status: 'idle', message: 'Ausserhalb Zeitfenster (03:00-06:30 UTC)' });
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

    const allSchedules = await base44.asServiceRole.entities.DailyRefreshSchedule.list('display_order', 100);
    // Filter out APRS (fetchAprsFi) — handled by fetchAprsStations separately
    const enabledSources = (allSchedules || []).filter((s: any) =>
      s.enabled && s.function_name !== 'fetchAprsFi'
    );

    if (enabledSources.length === 0) {
      return Response.json({ status: 'idle', message: 'Keine aktivierten Quellen' });
    }

    // ─── Deadline check: 06:15 UTC ───
    // Mark remaining sources as skipped and send report
    if (isPastDeadline()) {
      const remaining = enabledSources.filter((s: any) =>
        !isToday(s.last_run_time) && s.last_status !== 'skipped' && s.last_status !== 'running'
      );
      let skippedCount = 0;
      for (const src of remaining) {
        try {
          await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, {
            last_status: 'skipped',
            last_error: 'Übersprungen: 06:15 UTC Deadline erreicht',
            last_run_time: new Date().toISOString(),
          });
          skippedCount++;
        } catch {}
      }

      // Send report if not already sent
      if (!(await isReportSentToday(base44))) {
        try {
          await base44.functions.invoke('sendDailyAdminReport', { scheduled: true });
          await markReportSent(base44);
        } catch {}
      }

      return Response.json({
        status: 'deadline',
        skipped: skippedCount,
        message: 'Deadline erreicht — verbleibende Quellen übersprungen, Report versendet',
      });
    }

    // ─── Get or create today's shuffled order ───
    const order = await getTodaysOrder(base44, enabledSources);
    const sourceMap = new Map(enabledSources.map((s: any) => [s.source, s]));

    // ─── Find next source to process ───
    let nextSource: any = null;
    for (const key of order) {
      const src = sourceMap.get(key);
      if (!src) continue;
      if (src.last_status === 'running') continue; // Currently running (concurrent invocation)
      if (isToday(src.last_run_time)) continue; // Already ran today
      if (src.last_status === 'skipped') continue; // Already skipped
      nextSource = src;
      break;
    }

    if (!nextSource) {
      // No due source — check if all done, then send report
      const allDone = enabledSources.every((s: any) =>
        isToday(s.last_run_time) || s.last_status === 'skipped'
      );
      if (allDone && !(await isReportSentToday(base44))) {
        try {
          await base44.functions.invoke('sendDailyAdminReport', { scheduled: true });
          await markReportSent(base44);
        } catch {}
        return Response.json({ status: 'complete', message: 'Alle Quellen abgeschlossen, Report versendet' });
      }
      return Response.json({ status: 'idle', message: 'Keine fällige Quelle' });
    }

    // ─── Heavy source pause BEFORE ───
    if (HEAVY_SOURCES.has(nextSource.source)) {
      await new Promise(r => setTimeout(r, HEAVY_PAUSE_MS));
    }

    // Mark as running (BEFORE processing — prevents concurrent invocations picking same source)
    try {
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(nextSource.id, {
        last_status: 'running',
      });
    } catch {}

    const taskStart = Date.now();
    const timeout = nextSource.source.startsWith('lighthouse')
      ? LIGHTHOUSE_TIMEOUT_MS
      : SOURCE_TIMEOUT_MS;

    // ─── First attempt ───
    let result = await runSourceWithTimeout(base44, nextSource, timeout);
    let retried = false;

    // ─── Retry on failure (1x after 30s) ───
    const firstFailed = result.timedOut || (!result.timedOut && extractStatus(result.data) === 'failed');
    if (firstFailed) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      result = await runSourceWithTimeout(base44, nextSource, timeout);
      retried = true;
    }

    const duration = Date.now() - taskStart;
    const status = result.timedOut
      ? 'timeout'
      : extractStatus(result.data);
    const count = result.timedOut ? 0 : extractCount(result.data);
    const errorMsg = result.timedOut
      ? `Timeout nach ${timeout / 1000}s`
      : (result.data?.error || (status === 'success' && count === 0 ? 'Warnung: 0 Einträge geladen' : ''));

    // Build error detail for admins
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

    // ─── Heavy source pause AFTER ───
    if (HEAVY_SOURCES.has(nextSource.source)) {
      await new Promise(r => setTimeout(r, HEAVY_PAUSE_MS));
    }

    // ─── Check if all done → send report ───
    let reportTriggered = false;
    try {
      const allAfter = await base44.asServiceRole.entities.DailyRefreshSchedule.list('display_order', 100);
      const stillIncomplete = (allAfter || []).filter((s: any) => {
        if (!s.enabled) return false;
        if (s.function_name === 'fetchAprsFi') return false; // Excluded
        if (s.last_status === 'pending' || s.last_status === 'running') return true;
        if (!isToday(s.last_run_time) && s.last_status !== 'skipped') return true;
        return false;
      });
      if (stillIncomplete.length === 0 && !(await isReportSentToday(base44))) {
        await base44.functions.invoke('sendDailyAdminReport', { scheduled: true });
        await markReportSent(base44);
        reportTriggered = true;
      }
    } catch {}

    return Response.json({
      status: 'processed',
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