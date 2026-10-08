// v0.959-HF2: ONE code path to run a DailyRefreshSchedule source and record its result.
// Used by: manageSyncSchedule (manual "Jetzt starten"), dailyRefreshChecker (scheduled),
// runDailySyncBatch (batch — uses interpretResult + recordSourceRun around its retry loop),
// and self-recording sources (direct calls, own workflows, tests) via recordOwnRun.
//
// Every run writes last_run_time, last_status, last_count, last_duration_ms, last_error (+ detail)
// to DailyRefreshSchedule, mirrors the same values into AppSetting 'source_config' (shown in the
// Sync-Plan cards) and adds a SyncLog entry. 'skipped' (e.g. monthly cache) and 'pending'
// (chunked partial run) are recorded as their own status with a readable reason.
import { extractCount, extractStatus } from './syncHelpers.ts';
import { checkThreshold } from './syncRobustness.ts';

export type RunStatus = 'success' | 'skipped' | 'pending' | 'failed';
export type RunTrigger = 'scheduled' | 'manual';

export interface RunOutcome {
  source: string;
  label: string;
  status: RunStatus;
  count: number;
  duration_ms: number;
  message: string;
  has_more: boolean;
  data: any;
}

export function interpretResult(source: string, data: any, timedOut: boolean, timeoutMs: number) {
  if (timedOut) {
    return { status: 'failed' as RunStatus, count: 0, message: `Timeout nach ${Math.round(timeoutMs / 1000)}s`, has_more: false };
  }
  const count = extractCount(data);
  if (extractStatus(data) === 'failed') {
    return { status: 'failed' as RunStatus, count, message: String(data?.error || 'Unbekannter Fehler'), has_more: false };
  }
  if (data?.skipped) {
    return { status: 'skipped' as RunStatus, count, message: String(data.reason || 'Übersprungen'), has_more: false };
  }
  if (data?.has_more) {
    return { status: 'pending' as RunStatus, count, message: String(data.progress_note || 'Teil-Lauf — wird im nächsten Lauf fortgesetzt'), has_more: true };
  }
  const message = [data?.note, checkThreshold(source, count)].filter(Boolean).join(' · ');
  return { status: 'success' as RunStatus, count, message, has_more: false };
}

export async function recordSourceRun(base44: any, src: any, outcome: RunOutcome, trigger: RunTrigger, extra: Record<string, any> = {}): Promise<void> {
  const now = new Date().toISOString();
  const msg = (outcome.message || '').substring(0, 500);
  const withDetail = outcome.status === 'failed' || (outcome.status === 'success' && !!outcome.message);
  const detail = withDetail ? JSON.stringify({
    source: outcome.source,
    function: src.function_name,
    trigger,
    status: outcome.status,
    error: outcome.message,
    ...extra,
    response: outcome.data == null ? 'null' : JSON.stringify(outcome.data).substring(0, 2000),
    duration_ms: outcome.duration_ms,
    timestamp: now,
  }, null, 2) : '';

  try {
    await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, {
      last_run_time: now,
      last_status: outcome.status,
      last_count: outcome.count,
      last_duration_ms: outcome.duration_ms,
      last_error: msg,
      last_error_detail: detail,
    });
  } catch (e: any) {
    console.log(`[sourceRunner] DailyRefreshSchedule update failed for ${outcome.source}: ${e?.message || e}`);
  }

  try {
    const rows = await base44.asServiceRole.entities.AppSetting.filter({ key: 'source_config' });
    let sc: Record<string, any> = {};
    try { sc = JSON.parse(rows[0]?.value || '{}'); } catch {}
    sc[outcome.source] = {
      ...(sc[outcome.source] || {}),
      last_run: now,
      last_result: outcome.status,
      last_records: outcome.count,
      last_duration_seconds: Math.round(outcome.duration_ms / 1000),
      last_error: outcome.status === 'failed' ? msg : null,
      last_note: outcome.status === 'failed' ? null : (msg || null),
    };
    const value = JSON.stringify(sc);
    if (rows.length > 0) {
      await base44.asServiceRole.entities.AppSetting.update(rows[0].id, { value });
    } else {
      await base44.asServiceRole.entities.AppSetting.create({ key: 'source_config', value });
    }
  } catch {}

  try {
    await base44.asServiceRole.entities.SyncLog.create({
      timestamp: now,
      overall_status: outcome.status === 'failed' ? 'failed' : outcome.status === 'pending' ? 'partial' : 'success',
      total_duration_ms: outcome.duration_ms,
      results: [{
        source: outcome.source,
        label: outcome.label,
        status: outcome.status,
        count: outcome.count,
        duration_ms: outcome.duration_ms,
        error: outcome.message,
        ...extra,
      }],
      trigger,
    });
  } catch {}
}

// Invoke the source's backend function with a timeout, interpret and record the result.
export async function runSource(
  base44: any,
  src: any,
  opts: { trigger: RunTrigger; timeoutMs: number; extra?: Record<string, any> },
): Promise<RunOutcome> {
  try {
    await base44.asServiceRole.entities.DailyRefreshSchedule.update(src.id, { last_status: 'running' });
  } catch {}

  // _runner tells self-recording sources that this runner records the result (no double entry).
  const payload = {
    ...(src.function_payload || {}),
    scheduled: opts.trigger === 'scheduled',
    preserve_on_failure: true,
    _runner: true,
  };
  const start = Date.now();
  let data: any = null;
  let timedOut = false;
  let timer: any;
  try {
    data = await Promise.race([
      base44.functions.invoke(src.function_name, payload).then((res: any) => res?.data ?? res),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('RUNNER_TIMEOUT')), opts.timeoutMs); }),
    ]);
  } catch (e: any) {
    if (e?.message === 'RUNNER_TIMEOUT') timedOut = true;
    else data = { error: e?.response?.data?.error || e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }

  const r = interpretResult(src.source, data, timedOut, opts.timeoutMs);
  const outcome: RunOutcome = {
    source: src.source,
    label: src.label || src.source,
    ...r,
    duration_ms: Date.now() - start,
    data,
  };
  await recordSourceRun(base44, src, outcome, opts.trigger, opts.extra || {});
  return outcome;
}

// For sources that are also called directly (own workflow, admin panel, tests):
// record their own result on the matching DailyRefreshSchedule row.
export async function recordOwnRun(base44: any, source: string, data: any, durationMs: number, trigger: RunTrigger): Promise<void> {
  try {
    const rows = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({ source });
    if (!rows || rows.length === 0) return;
    const src = rows[0];
    const r = interpretResult(source, data, false, 0);
    await recordSourceRun(base44, src, {
      source,
      label: src.label || source,
      ...r,
      duration_ms: durationMs,
      data,
    }, trigger);
  } catch (e: any) {
    console.log(`[sourceRunner] recordOwnRun failed for ${source}: ${e?.message || e}`);
  }
}