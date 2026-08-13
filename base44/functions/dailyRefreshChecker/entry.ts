import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { todayUTC, isToday, extractCount, extractStatus } from '../../shared/syncHelpers.ts';

// This function runs every 5 minutes via automation.
// It checks the DailyRefreshSchedule entity for sources whose next_run_utc
// has passed and haven't been executed yet today. It triggers ONE due source
// per run (to avoid blocking other sources) and records the result.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Authorization: scheduled runs have no user. Manual runs require admin.
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const now = Date.now();
    const allSchedules = await base44.asServiceRole.entities.DailyRefreshSchedule.list("display_order", 100);
    
    // Find sources that are due: enabled, next_run_utc <= now, and not yet run today.
    // Each source runs AT MOST ONCE per day — no re-runs for failed sources.
    // This prevents a slow/failing source (e.g. SOTA ~270s) from blocking the queue
    // by re-running every 5 minutes. Retries are handled inside each fetch function
    // via exponential backoff, not at the scheduler level.
    const dueSources = (allSchedules || []).filter(s => {
      if (!s.enabled) return false;
      const nextRun = s.next_run_utc ? new Date(s.next_run_utc).getTime() : 0;
      if (nextRun === 0 || nextRun > now) return false;
      // Don't re-run if already ran today (regardless of success/failure)
      if (s.last_run_time && isToday(s.last_run_time)) return false;
      if (s.last_status === 'running') return false;
      return true;
    });

    if (dueSources.length === 0) {
      return Response.json({ status: 'idle', message: 'Keine Quellen fällig', checked_at: new Date().toISOString() });
    }

    // Process only ONE due source per run to avoid blocking other sources.
    // The checker runs every 5 minutes, so the next due source will be picked up
    // on the next run. This prevents a slow source (e.g. SOTA ~276s) from blocking
    // all other sources in the same invocation.
    const src = dueSources[0];
    const results = [];

    // Mark as running
    try {
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, { last_status: 'running' });
    } catch {}

    const taskStart = Date.now();
    try {
      const payload = { ...(src.function_payload || {}), scheduled: true };
      const res = await base44.functions.invoke(src.function_name, payload);
      const data = res?.data || res;
      const duration = Date.now() - taskStart;

      const status = extractStatus(data);
      const errorMsg = data?.error || '';
      const count = extractCount(data);

      // A source that returns 0 entries is technically successful but suspicious.
      // Mark it as 'success' but add a warning to the error field.
      const warningMsg = (status === 'success' && count === 0)
        ? 'Warnung: 0 Einträge geladen — Quelle möglicherweise nicht erreichbar'
        : '';

      // Build detailed error info for admins
      let errorDetail = '';
      if (status === 'failed') {
        errorDetail = JSON.stringify({
          source: src.source,
          function: src.function_name,
          http_status: data?.status_code || data?.http_status || 'n/a',
          error: errorMsg,
          response_body: typeof data === 'object' ? JSON.stringify(data).substring(0, 2000) : String(data).substring(0, 2000),
          duration_ms: duration,
          timestamp: new Date().toISOString(),
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

      results.push({ source: src.source, status, count, duration_ms: duration, error: errorMsg || warningMsg });
    } catch (e: any) {
      const duration = Date.now() - taskStart;
      const errorMsg = e?.message || String(e);

      // Build detailed error info including HTTP status if available
      let errorDetail = JSON.stringify({
        source: src.source,
        function: src.function_name,
        error: errorMsg,
        stack: e?.stack || '',
        http_status: e?.status || e?.statusCode || 'n/a',
        response_text: e?.responseText || e?.body || '',
        duration_ms: duration,
        timestamp: new Date().toISOString(),
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

      results.push({ source: src.source, status: 'failed', count: 0, duration_ms: duration, error: errorMsg });
    }

    // After processing a source, check if ALL enabled sources have completed today.
    // If yes, trigger the daily admin report (so it sends immediately after the last
    // source completes, not at a fixed time). The report function has its own "waiting"
    // guard to prevent duplicate sends.
    let reportTriggered = false;
    try {
      const allAfter = await base44.asServiceRole.entities.DailyRefreshSchedule.list("display_order", 100);
      const stillIncomplete = (allAfter || []).filter(s => {
        if (!s.enabled) return false;
        if (s.last_status === 'pending' || s.last_status === 'running') return true;
        if (!s.last_run_time || !isToday(s.last_run_time)) return true;
        return false;
      });
      if (stillIncomplete.length === 0) {
        await base44.functions.invoke('sendDailyAdminReport', { scheduled: true });
        reportTriggered = true;
      }
    } catch {}

    return Response.json({
      status: 'processed',
      checked_at: new Date().toISOString(),
      triggered: results.length,
      results,
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