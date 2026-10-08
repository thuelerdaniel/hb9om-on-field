import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { todayUTC, isToday, extractCount, extractStatus } from '../../shared/syncHelpers.ts';
import { isInternalCall, getInternalSecret } from '../../shared/internalAuth.ts';
import { getDueNachlaufe, clearNachlauf, checkThreshold, getErrorAction, scheduleNachlauf, shouldPreserveData } from '../../shared/syncRobustness.ts';

// This function runs every 5 minutes via automation.
// It checks the DailyRefreshSchedule entity for sources whose next_run_utc
// has passed and haven't been executed yet today. It triggers ONE due source
// per run (to avoid blocking other sources) and records the result.
//
// v0.951-FIX: Only fires on Monday (full batch) and Thursday (partial repeater sync).
// v0.959 FIX: Checks weekly_days + weekly_enabled — prevents triggering SOTA/POTA/WWFF
//   on Thursday and APRS (weekly_enabled=false, runs via daily workflow).
// v0.959: Processes Nachläufe (retry of failed sources later in the day).

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Process a single source (shared by regular + Nachlauf paths) ───
async function processSource(base44: any, src: any, body: any, isNachlauf: boolean = false): Promise<void> {
  // Mark as running
  try {
    await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, { last_status: 'running' });
  } catch {}

  const taskStart = Date.now();
  try {
    const payload = { ...(src.function_payload || {}), scheduled: true, preserve_on_failure: true };
    const res = await base44.functions.invoke(src.function_name, payload);
    const data = res?.data || res;
    const duration = Date.now() - taskStart;

    const status = extractStatus(data);
    const errorMsg = data?.error || '';
    const count = extractCount(data);

    // v0.959: Threshold check — warn if below expected minimum
    const thresholdWarning = checkThreshold(src.source, count);
    const warningMsg = (status === 'success' && count === 0 && !errorMsg)
      ? (thresholdWarning || 'Warnung: 0 Einträge geladen — Quelle möglicherweise nicht erreichbar')
      : (thresholdWarning || '');

    // Build detailed error info for admins
    let errorDetail = '';
    if (status === 'failed' || (status === 'success' && count === 0 && thresholdWarning)) {
      errorDetail = JSON.stringify({
        source: src.source,
        function: src.function_name,
        error: errorMsg || thresholdWarning,
        response: typeof data === 'object' ? JSON.stringify(data).substring(0, 2000) : String(data).substring(0, 2000),
        duration_ms: duration,
        timestamp: new Date().toISOString(),
        nachlauf: isNachlauf,
      }, null, 2);
    }

    await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, {
      last_run_time: new Date().toISOString(),
      last_status: status,
      last_count: count,
      last_duration_ms: duration,
      last_error: (errorMsg || warningMsg).substring(0, 500),
      last_error_detail: errorDetail,
    });

    // v0.959: If source failed, schedule a Nachlauf (if not already a Nachlauf)
    if (status === 'failed' && !isNachlauf) {
      await scheduleNachlauf(base44, src.source, 120); // Retry in 2 hours
    }
    // v0.959: If Nachlauf succeeded, clear the Nachlauf marker
    if (isNachlauf) {
      await clearNachlauf(base44, src.source);
    }

    // v0.959: Error counter — track consecutive failures for escalation
    let consecutiveFailures = 0;
    try {
      const cfKey = 'consecutive_failures_' + src.source;
      const cfSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: cfKey });
      if (cfSettings && cfSettings.length > 0) {
        consecutiveFailures = parseInt(cfSettings[0].value || '0') || 0;
      }
    } catch {}

    // v0.959-HF: Fixed condition — was `!thresholdWarning === false` (confusing double negation).
    // Increment failures if: source failed, OR count=0 with a threshold warning.
    if (status === 'failed' || (count === 0 && thresholdWarning)) {
      consecutiveFailures++;
    } else {
      consecutiveFailures = 0;
    }

    try {
      const cfKey = 'consecutive_failures_' + src.source;
      const cfSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: cfKey });
      const cfValue = String(consecutiveFailures);
      if (cfSettings && cfSettings.length > 0) {
        await base44.asServiceRole.entities.AppSetting.update(cfSettings[0].id, { value: cfValue });
      } else {
        await base44.asServiceRole.entities.AppSetting.create({ key: cfKey, value: cfValue });
      }
    } catch {}

    // v0.959: 3rd consecutive error → auto-pause source
    const action = getErrorAction(consecutiveFailures);
    if (action === 'pause') {
      try {
        await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, {
          weekly_enabled: false,
          last_error: `AUTO-PAUSIERT: 3 aufeinanderfolgende Fehler — Daniel muss Quelle reaktivieren`,
        });
      } catch {}
    }

    // Write SyncLog entry
    try {
      await base44.asServiceRole.entities.SyncLog.create({
        timestamp: new Date().toISOString(),
        overall_status: status,
        total_duration_ms: duration,
        results: [{
          source: src.source,
          label: src.label,
          status,
          count,
          duration_ms: duration,
          error: errorMsg || warningMsg,
          retried: isNachlauf,
        }],
        trigger: isInternalCall(body) ? 'scheduled' : 'manual',
      });
    } catch {}
  } catch (e: any) {
    const duration = Date.now() - taskStart;
    const errorMsg = e?.message || String(e);

    let errorDetail = JSON.stringify({
      source: src.source,
      function: src.function_name,
      error: errorMsg,
      stack: e?.stack || '',
      duration_ms: duration,
      timestamp: new Date().toISOString(),
      nachlauf: isNachlauf,
    }, null, 2);

    try {
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, {
        last_run_time: new Date().toISOString(),
        last_status: 'failed',
        last_count: 0,
        last_duration_ms: duration,
        last_error: errorMsg.substring(0, 500),
        last_error_detail: errorDetail,
      });
    } catch {}

    // Schedule Nachlauf if not already a Nachlauf
    if (!isNachlauf) {
      await scheduleNachlauf(base44, src.source, 120);
    } else {
      await clearNachlauf(base44, src.source);
    }

    try {
      await base44.asServiceRole.entities.SyncLog.create({
        timestamp: new Date().toISOString(),
        overall_status: 'failed',
        total_duration_ms: duration,
        results: [{
          source: src.source,
          label: src.label,
          status: 'failed',
          count: 0,
          duration_ms: duration,
          error: errorMsg,
          retried: isNachlauf,
        }],
        trigger: isInternalCall(body) ? 'scheduled' : 'manual',
      });
    } catch {}
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Authorization: internal calls (from automation) pass a server-side secret.
    if (!isInternalCall(body)) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    // v0.951-FIX: Only run on Monday (full batch) or Thursday (partial repeater sync).
    const dayName = DAY_NAMES[new Date().getUTCDay()];
    if (dayName !== 'Monday' && dayName !== 'Thursday') {
      return Response.json({ status: 'idle', message: `Kein Sync-Tag (${dayName}) — nur Mo/Do` });
    }

    const now = Date.now();
    const allSchedules = await base44.asServiceRole.entities.DailyRefreshSchedule.list("display_order", 100);

    // v0.959 FIX: Check weekly_days + weekly_enabled — prevents triggering SOTA/POTA/WWFF
    // on Thursday (should only run Monday) and APRS (weekly_enabled=false, runs via daily workflow).
    const dueSources = (allSchedules || []).filter(s => {
      if (!s.enabled) return false;
      if (s.weekly_enabled === false) return false;
      if (Array.isArray(s.weekly_days) && s.weekly_days.length > 0 && !s.weekly_days.includes(dayName)) return false;
      const nextRun = s.next_run_utc ? new Date(s.next_run_utc).getTime() : 0;
      if (nextRun === 0 || nextRun > now) return false;
      if (s.last_run_time && isToday(s.last_run_time)) return false;
      if (s.last_status === 'running') return false;
      return true;
    });

    // v0.959: Check for due Nachläufe (retry of failed sources later in the day)
    if (dueSources.length === 0) {
      const dueNachlaufe = await getDueNachlaufe(base44);
      if (dueNachlaufe.length > 0) {
        for (const nachlaufSource of dueNachlaufe) {
          const nachlaufSchedule = (allSchedules || []).find(s => s.source === nachlaufSource);
          if (nachlaufSchedule) {
            await processSource(base44, nachlaufSchedule, body, true);
            return Response.json({
              status: 'nachlauf',
              checked_at: new Date().toISOString(),
              source: nachlaufSource,
              message: `Nachlauf für ${nachlaufSchedule.label || nachlaufSource}`,
            });
          }
        }
      }
      return Response.json({ status: 'idle', message: 'Keine Quellen fällig', checked_at: new Date().toISOString() });
    }

    // Process only ONE due source per run
    const src = dueSources[0];
    await processSource(base44, src, body, false);

    // After processing, check if ALL enabled sources have completed today.
    // If yes, trigger the daily admin report.
    let reportTriggered = false;
    try {
      const allAfter = await base44.asServiceRole.entities.DailyRefreshSchedule.list("display_order", 100);
      const stillIncomplete = (allAfter || []).filter(s => {
        if (!s.enabled || s.weekly_enabled === false) return false;
        if (Array.isArray(s.weekly_days) && s.weekly_days.length > 0 && !s.weekly_days.includes(dayName)) return false;
        if (s.last_status === 'pending' || s.last_status === 'running') return true;
        if (!s.last_run_time || !isToday(s.last_run_time)) return true;
        return false;
      });
      if (stillIncomplete.length === 0) {
        await base44.functions.invoke('sendDailyAdminReport', { scheduled: true, internal_secret: getInternalSecret() });
        reportTriggered = true;
      }
    } catch {}

    return Response.json({
      status: 'processed',
      checked_at: new Date().toISOString(),
      triggered: 1,
      source: src.source,
      remaining_due: dueSources.length - 1,
      report_triggered: reportTriggered,
    });
  } catch (error) {
    return Response.json({ 
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}