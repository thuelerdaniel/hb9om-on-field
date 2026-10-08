import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { isToday } from '../../shared/syncHelpers.ts';
import { isInternalCall, getInternalSecret } from '../../shared/internalAuth.ts';
import { getDueNachlaufe, clearNachlauf, checkThreshold, getErrorAction, scheduleNachlauf } from '../../shared/syncRobustness.ts';
import { runSource } from '../../shared/sourceRunner.ts';

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

const SCHEDULED_TIMEOUT_MS = 180000;

// ─── Process a single source (shared by regular + Nachlauf paths) ───
// v0.959-HF2: Invoke + interpret + record via the shared sourceRunner (same path as manual start).
async function processSource(base44: any, src: any, body: any, isNachlauf: boolean = false): Promise<void> {
  const trigger = isInternalCall(body) ? 'scheduled' : 'manual';
  const outcome = await runSource(base44, src, {
    trigger,
    timeoutMs: SCHEDULED_TIMEOUT_MS,
    extra: { retried: isNachlauf, nachlauf: isNachlauf },
  });
  const failed = outcome.status === 'failed';

  // v0.959: If source failed, schedule a Nachlauf (if not already a Nachlauf)
  if (failed && !isNachlauf) {
    await scheduleNachlauf(base44, src.source, 120); // Retry in 2 hours
  }
  // v0.959: Nachlauf done (success or not) → clear the marker
  if (isNachlauf) {
    await clearNachlauf(base44, src.source);
  }

  // v0.959: Error counter — track consecutive failures for escalation.
  // skipped (Monats-Cache) and pending (Teil-Lauf) are healthy runs.
  const cfKey = 'consecutive_failures_' + src.source;
  let consecutiveFailures = 0;
  let cfRow: any = null;
  try {
    const cfSettings = await base44.asServiceRole.entities.AppSetting.filter({ key: cfKey });
    cfRow = cfSettings?.[0] || null;
    consecutiveFailures = parseInt(cfRow?.value || '0') || 0;
  } catch {}

  const zeroWarning = outcome.status === 'success' && outcome.count === 0 && !!checkThreshold(src.source, 0);
  consecutiveFailures = (failed || zeroWarning) ? consecutiveFailures + 1 : 0;

  try {
    const cfValue = String(consecutiveFailures);
    if (cfRow) {
      await base44.asServiceRole.entities.AppSetting.update(cfRow.id, { value: cfValue });
    } else {
      await base44.asServiceRole.entities.AppSetting.create({ key: cfKey, value: cfValue });
    }
  } catch {}

  // v0.959: 3rd consecutive error → auto-pause source
  if (getErrorAction(consecutiveFailures) === 'pause') {
    try {
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, {
        weekly_enabled: false,
        last_error: `AUTO-PAUSIERT: 3 aufeinanderfolgende Fehler — Daniel muss Quelle reaktivieren`,
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