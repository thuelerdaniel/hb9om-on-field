import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// This function runs every 5 minutes between 00:00-06:00 UTC via automation.
// It checks the DailyRefreshSchedule entity for sources whose next_run_utc
// has passed and haven't been executed yet today. It triggers each due source
// and records the result (success or detailed error).

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function isToday(isoStr: string): boolean {
  if (!isoStr) return false;
  return isoStr.startsWith(todayUTC());
}

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
    
    // Find sources that are due: enabled, next_run_utc <= now, and last_run not today
    const dueSources = (allSchedules || []).filter(s => {
      if (!s.enabled) return false;
      const nextRun = s.next_run_utc ? new Date(s.next_run_utc).getTime() : 0;
      if (nextRun === 0 || nextRun > now) return false;
      // Don't re-run if already ran today
      if (s.last_run_time && isToday(s.last_run_time) && s.last_status === 'success') return false;
      if (s.last_status === 'running') return false;
      return true;
    });

    if (dueSources.length === 0) {
      return Response.json({ status: 'idle', message: 'Keine Quellen fällig', checked_at: new Date().toISOString() });
    }

    const results = [];
    for (const src of dueSources) {
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

        const status = data?.status === 'failed' || data?.error ? 'failed' : 'success';
        const errorMsg = data?.error || '';
        
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
          last_count: data?.count || 0,
          last_duration_ms: duration,
          last_error: errorMsg.substring(0, 500),
          last_error_detail: errorDetail,
        });

        results.push({ source: src.source, status, count: data?.count || 0, duration_ms: duration, error: errorMsg });
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
    }

    return Response.json({
      status: 'processed',
      checked_at: new Date().toISOString(),
      triggered: results.length,
      results,
    });
  } catch (error) {
    return Response.json({ 
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}