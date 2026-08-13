import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// ─── Sync Schedule Management ───
// Handles: schedule settings (day/time), source toggles, incremental toggles,
// global manual triggers (full batch, repeater-only, APRS stream).
//
// Schedule settings are stored in AppSettings:
//   sync_schedule_config → JSON { full_batch_day, full_batch_time, partial_sync_day, partial_sync_time, aprs_stream_time }
//   auto_update → global auto-sync toggle (enabled boolean)
//
// Per-source toggles use the DailyRefreshSchedule entity (weekly_enabled, incremental_enabled).

const DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

const DEFAULT_CONFIG = {
  full_batch_day: 'Monday',
  full_batch_time: '01:00',
  full_batch_end_time: '05:00',
  partial_sync_day: 'Thursday',
  partial_sync_time: '03:00',
  partial_sync_end_time: '04:00',
  aprs_stream_time: '06:30',
};

async function getSetting(base44: any, key: string): Promise<any | null> {
  try {
    const rows = await base44.asServiceRole.entities.AppSetting.filter({ key });
    return rows.length > 0 ? rows[0] : null;
  } catch { return null; }
}

async function saveSetting(base44: any, key: string, value: string, enabled = true): Promise<void> {
  const existing = await getSetting(base44, key);
  if (existing) {
    await base44.asServiceRole.entities.AppSetting.update(existing.id, { value, enabled });
  } else {
    await base44.asServiceRole.entities.AppSetting.create({ key, value, enabled });
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // All actions require admin
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const action = body.action || 'getSettings';

    // ─── getSettings: return schedule config + all source states ───
    if (action === 'getSettings') {
      const configRow = await getSetting(base44, 'sync_schedule_config');
      let config = DEFAULT_CONFIG;
      if (configRow?.value) {
        try { config = { ...DEFAULT_CONFIG, ...JSON.parse(configRow.value) }; } catch {}
      }

      const autoUpdateRow = await getSetting(base44, 'auto_update');
      const globalAutoSync = autoUpdateRow ? autoUpdateRow.enabled !== false : true;

      const schedules = await base44.asServiceRole.entities.DailyRefreshSchedule.list('display_order', 100);

      return Response.json({
        status: 'success',
        config,
        global_auto_sync: globalAutoSync,
        sources: schedules || [],
      });
    }

    // ─── saveSettings: save schedule day/time config ───
    if (action === 'saveSettings') {
      const newConfig = {
        full_batch_day: body.full_batch_day || DEFAULT_CONFIG.full_batch_day,
        full_batch_time: body.full_batch_time || DEFAULT_CONFIG.full_batch_time,
        full_batch_end_time: body.full_batch_end_time || DEFAULT_CONFIG.full_batch_end_time,
        partial_sync_day: body.partial_sync_day || DEFAULT_CONFIG.partial_sync_day,
        partial_sync_time: body.partial_sync_time || DEFAULT_CONFIG.partial_sync_time,
        partial_sync_end_time: body.partial_sync_end_time || DEFAULT_CONFIG.partial_sync_end_time,
        aprs_stream_time: body.aprs_stream_time || DEFAULT_CONFIG.aprs_stream_time,
      };
      await saveSetting(base44, 'sync_schedule_config', JSON.stringify(newConfig));
      return Response.json({ status: 'success', message: 'Schedule-Konfiguration gespeichert', config: newConfig });
    }

    // ─── toggleGlobalAutoSync: enable/disable all automatic syncs ───
    if (action === 'toggleGlobalAutoSync') {
      const enabled = body.enabled !== false;
      await saveSetting(base44, 'auto_update', enabled ? 'true' : 'false', enabled);
      return Response.json({ status: 'success', message: `Auto-Sync ${enabled ? 'aktiviert' : 'deaktiviert'}`, global_auto_sync: enabled });
    }

    // ─── toggleSource: enable/disable a single source ───
    if (action === 'toggleSource') {
      const { source, enabled } = body;
      if (!source) return Response.json({ error: 'source required' }, { status: 400 });
      const rows = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({ source });
      if (rows.length === 0) return Response.json({ error: 'Quelle nicht gefunden' }, { status: 404 });
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(rows[0].id, { weekly_enabled: !!enabled });
      return Response.json({ status: 'success', source, weekly_enabled: !!enabled });
    }

    // ─── toggleIncremental: enable/disable incremental sync per source ───
    if (action === 'toggleIncremental') {
      const { source, enabled } = body;
      if (!source) return Response.json({ error: 'source required' }, { status: 400 });
      const rows = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({ source });
      if (rows.length === 0) return Response.json({ error: 'Quelle nicht gefunden' }, { status: 404 });
      await base44.asServiceRole.entities.DailyRefreshSchedule.update(rows[0].id, { incremental_enabled: !!enabled });
      return Response.json({ status: 'success', source, incremental_enabled: !!enabled });
    }

    // ─── triggerBatch: manually trigger a sync batch ───
    // mode: 'full' (all sources), 'repeater' (repeater only), 'aprs' (APRS stream)
    if (action === 'triggerBatch') {
      const mode = body.mode || 'full';
      let day = body.day || null;

      if (mode === 'full') {
        // Trigger runDailySyncBatch with Monday override
        const res = await base44.functions.invoke('runDailySyncBatch', { scheduled: false, day: day || 'Monday' });
        return Response.json({ status: 'success', message: 'Voll-Batch gestartet', result: res?.data || res });
      }
      if (mode === 'repeater') {
        // Trigger runDailySyncBatch with Thursday override
        const res = await base44.functions.invoke('runDailySyncBatch', { scheduled: false, day: day || 'Thursday' });
        return Response.json({ status: 'success', message: 'Relais-Sync gestartet', result: res?.data || res });
      }
      if (mode === 'aprs') {
        const res = await base44.functions.invoke('fetchAprsStations', {});
        return Response.json({ status: 'success', message: 'APRS-Stream gestartet', result: res?.data || res });
      }
      return Response.json({ error: 'Unknown mode' }, { status: 400 });
    }

    // ─── triggerSource: manually trigger a single source ───
    if (action === 'triggerSource') {
      const { source } = body;
      if (!source) return Response.json({ error: 'source required' }, { status: 400 });
      const rows = await base44.asServiceRole.entities.DailyRefreshSchedule.filter({ source });
      if (rows.length === 0) return Response.json({ error: 'Quelle nicht gefunden' }, { status: 404 });
      const src = rows[0];
      const payload = { ...(src.function_payload || {}), scheduled: false };
      const res = await base44.functions.invoke(src.function_name, payload);
      return Response.json({ status: 'success', source, result: res?.data || res });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return Response.json({
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}