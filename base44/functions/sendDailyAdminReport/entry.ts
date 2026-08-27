import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { isInternalCall, getInternalSecret } from '../../shared/internalAuth.ts';

// This function sends a sync report to admins.
// mode='weekly' (default for scheduled Monday runs): Weekly sync report with delta comparison
// mode='daily' (manual or legacy): Daily report without delta
//
// Triggered by runDailySyncBatch after Monday batch completion, or manually by admins.

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function isToday(isoStr: string): boolean {
  if (!isoStr) return false;
  return isoStr.startsWith(todayUTC());
}

// Generate a CSS bar chart row for usage stats
function barRow(label: string, count: number, maxCount: number, color: string): string {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return `
    <tr>
      <td style="padding:4px 8px;font-size:13px;color:#333;">${label}</td>
      <td style="padding:4px 8px;width:200px;">
        <div style="background:#e8e8e8;border-radius:4px;height:18px;overflow:hidden;">
          <div style="background:${color};height:18px;width:${pct}%;border-radius:4px;min-width:2px;"></div>
        </div>
      </td>
      <td style="padding:4px 8px;font-size:13px;color:#333;text-align:right;font-weight:600;">${count}</td>
    </tr>`;
}

// Status badge HTML
function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    success: '#16a34a',
    failed: '#dc2626',
    pending: '#f59e0b',
    running: '#3b82f6',
    skipped: '#9ca3af',
    partial: '#f59e0b',
  };
  const bg = colors[status] || '#9ca3af';
  return `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">${status}</span>`;
}

// Format delta with color
function formatDelta(current: number, previous: number | undefined): string {
  if (previous == null) return '<span style="color:#3b82f6;font-size:11px;">Neu</span>';
  const delta = current - previous;
  if (delta > 0) return `<span style="color:#16a34a;font-size:11px;">+${delta}</span>`;
  if (delta < 0) return `<span style="color:#dc2626;font-size:11px;">${delta}</span>`;
  return `<span style="color:#9ca3af;font-size:11px;">±0</span>`;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const mode = body.mode || 'weekly';

    // --- 1. Collect source results ---
    const allSchedules = await base44.asServiceRole.entities.DailyRefreshSchedule.list("display_order", 100);

    // For weekly mode, don't block on incomplete sources — the scheduler only calls
    // this after all sources are done (or deadline reached).
    // For manual/daily mode, check if sources are still incomplete.
    if (mode === 'daily' && body.scheduled === true) {
      const incompleteSources = (allSchedules || []).filter(s => {
        if (!s.enabled) return false;
        if (s.last_status === 'pending' || s.last_status === 'running') return true;
        if (!s.last_run_time || !isToday(s.last_run_time)) return true;
        return false;
      });
      if (incompleteSources.length > 0) {
        return Response.json({
          status: 'waiting',
          message: `${incompleteSources.length} Quelle(n) noch ausstehend — Report verschoben`,
          incomplete: incompleteSources.length,
        });
      }
    }

    const todaySources = (allSchedules || []).filter(s => s.last_run_time && isToday(s.last_run_time));
    const pendingSources = (allSchedules || []).filter(s => !s.last_run_time || !isToday(s.last_run_time));

    const successCount = todaySources.filter(s => s.last_status === 'success' && s.last_count > 0).length;
    const warningCount = todaySources.filter(s => s.last_status === 'success' && (s.last_count == null || s.last_count === 0)).length;
    const failedCount = todaySources.filter(s => s.last_status === 'failed').length;
    const totalCount = todaySources.length;
    const overallStatus = failedCount > 0 ? (failedCount < totalCount ? 'partial' : 'failed') : (warningCount > 0 ? 'partial' : 'success');

    // --- 2. Gather usage statistics ---
    let stats: any = {
      totalUsers: 0, totalQsos: 0, qsosByCountry: {}, refTypes: {},
      totalRepeaters: 0, totalSotaPoints: 0, totalPotaPoints: 0, totalPrivateNodes: 0,
      totalWwffPoints: 0, totalTotaPoints: 0, totalRepeaterLinks: 0,
      cacheLayers: {} as Record<string, number>,
    };

    try {
      const users = await base44.asServiceRole.entities.User.list();
      stats.totalUsers = users.length;
    } catch {}

    try {
      const logs = await base44.asServiceRole.entities.Log.list("-created_date", 5000);
      stats.totalQsos = logs.length;
      for (const log of logs) {
        const rawCountry = log.operator_country || 'Unbekannt';
        const country = rawCountry.charAt(0).toUpperCase() + rawCountry.slice(1).toLowerCase();
        stats.qsosByCountry[country] = (stats.qsosByCountry[country] || 0) + 1;
        const refType = log.my_reference_type || 'custom';
        stats.refTypes[refType] = (stats.refTypes[refType] || 0) + 1;
      }
    } catch {}

    try {
      const refData = await base44.asServiceRole.entities.ReferenceData.list();
      const refMap: Record<string, any> = {};
      for (const entry of refData || []) {
        refMap[entry.type] = entry;
      }
      const refTypes = ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'lighthouse', 'iota'];
      for (const t of refTypes) {
        const entry = refMap[t];
        const refs = entry?.references || [];
        const totalCount = entry?.total_count || 0;
        stats.cacheLayers[t] = Math.max(refs.length, totalCount);
      }
      stats.totalSotaPoints = stats.cacheLayers['sota'] || 0;
      stats.totalPotaPoints = stats.cacheLayers['pota'] || 0;
      stats.totalWwffPoints = stats.cacheLayers['hbff'] || 0;
    } catch {}

    try {
      const repeaters = await base44.asServiceRole.entities.Repeater.filter({});
      stats.totalRepeaters = repeaters.length;
      stats.cacheLayers['repeater'] = repeaters.length;
    } catch {}

    try {
      const privateNodes = await base44.asServiceRole.entities.PrivateNode.filter({});
      stats.totalPrivateNodes = privateNodes.length;
      stats.cacheLayers['aprs'] = privateNodes.length;
    } catch {}

    try {
      const totaPoints = await base44.asServiceRole.entities.TotaPoint.filter({});
      stats.totalTotaPoints = totaPoints.length;
      stats.cacheLayers['tota'] = totaPoints.length;
    } catch {}

    try {
      const repLinks = await base44.asServiceRole.entities.RepeaterLink.filter({ status: "approved" });
      stats.totalRepeaterLinks = repLinks.length;
      stats.cacheLayers['repeaterLinks'] = repLinks.length;
    } catch {}

    // --- 3. Weekly delta: load last week's counts ---
    let lastWeekCounts: Record<string, number> = {};
    if (mode === 'weekly') {
      try {
        const lastWeekSetting = await base44.asServiceRole.entities.AppSetting.filter({ key: 'weekly_report_last_counts' });
        if (lastWeekSetting && lastWeekSetting.length > 0 && lastWeekSetting[0].value) {
          lastWeekCounts = JSON.parse(lastWeekSetting[0].value);
        }
      } catch {}
    }

    // --- 4. Build HTML email ---
    const today = new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const reportTitle = mode === 'weekly' ? 'Wochen-Sync Bericht' : 'Daten-Report';
    const reportSubtitle = mode === 'weekly' ? `Wochen-Sync · ${today}` : `Täglicher Daten-Report · ${today}`;

    // Source results table
    const sourceRows = (allSchedules || []).map(s => {
      const rawStatus = s.last_status || 'pending';
      const ran = s.last_run_time && isToday(s.last_run_time);
      let displayStatus = rawStatus;
      let warningNote = '';
      if (!ran) {
        displayStatus = 'skipped';
      } else if (rawStatus === 'success' && (s.last_count == null || s.last_count === 0)) {
        displayStatus = 'skipped';
        warningNote = '<div style="font-size:11px;color:#f59e0b;margin-top:2px;">⚠ 0 Einträge — Quelle möglicherweise nicht erreichbar</div>';
      } else if (rawStatus === 'pending' && ran) {
        displayStatus = 'partial';
        warningNote = '<div style="font-size:11px;color:#f59e0b;margin-top:2px;">⏳ Chunked — wird in nächstem Tick fortgesetzt</div>';
      }
      const duration = s.last_duration_ms ? `${(s.last_duration_ms / 1000).toFixed(1)}s` : '—';
      const count = s.last_count != null ? s.last_count : '—';
      const error = s.last_error ? `<div style="font-size:11px;color:#dc2626;margin-top:2px;">${s.last_error}</div>` : '';
      const deltaCell = mode === 'weekly' ? `<td style="padding:6px 8px;font-size:13px;text-align:right;">${formatDelta(count !== '—' ? count : 0, lastWeekCounts[s.source])}</td>` : '';
      return `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:6px 8px;font-size:13px;font-weight:600;color:#333;">${s.label || s.source}${error}${warningNote}</td>
          <td style="padding:6px 8px;">${statusBadge(displayStatus)}</td>
          <td style="padding:6px 8px;font-size:13px;color:#666;text-align:right;">${count}</td>
          <td style="padding:6px 8px;font-size:13px;color:#666;text-align:right;">${duration}</td>
          ${deltaCell}
        </tr>`;
    }).join('');

    // Problems section
    const problemSources = (allSchedules || []).filter(s => {
      const ran = s.last_run_time && isToday(s.last_run_time);
      if (!ran) return false;
      return s.last_status === 'failed' || (s.last_status === 'success' && (s.last_count == null || s.last_count === 0));
    });
    const problemsHtml = problemSources.length > 0 ? `
    <div style="padding:16px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 10px;font-size:15px;color:#dc2626;">⚠️ Probleme (${problemSources.length})</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #ddd;">
            <th style="padding:5px 6px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Quelle</th>
            <th style="padding:5px 6px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Status</th>
            <th style="padding:5px 6px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Fehler</th>
          </tr>
        </thead>
        <tbody>${problemSources.map(s => `
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:5px 6px;font-size:12px;font-weight:600;color:#333;">${s.label || s.source}</td>
            <td style="padding:5px 6px;">${statusBadge(s.last_status === 'success' ? 'skipped' : s.last_status)}</td>
            <td style="padding:5px 6px;font-size:11px;color:#dc2626;">${s.last_error || '0 Einträge geladen'}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>` : '';

    // APRS streaming section
    const aprsCount = stats.totalPrivateNodes || 0;
    const aprsDelta = mode === 'weekly' ? formatDelta(aprsCount, lastWeekCounts['aprs']) : '';
    const aprsSection = `
    <div style="padding:16px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 10px;font-size:15px;color:#333;">📡 APRS-Streaming</h2>
      <p style="margin:0;font-size:13px;color:#666;">
        Aktuelle AprsStation-Anzahl: <strong style="font-size:16px;color:#8b5cf6;">${aprsCount.toLocaleString('de-CH')}</strong>
        ${aprsDelta ? ` &nbsp; ${aprsDelta}` : ''}
        <br/><span style="font-size:11px;color:#999;">Inkrementelle Synchronisation läuft separat (täglich 06:30 UTC)</span>
      </p>
    </div>`;

    // Country stats (top 10)
    const countryEntries = Object.entries(stats.qsosByCountry).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10);
    const maxCountry = countryEntries.length > 0 ? countryEntries[0][1] : 1;
    const countryColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6'];
    const countryRows = countryEntries.map((entry: any, i: number) =>
      barRow(entry[0] || 'Unbekannt', entry[1], maxCountry, countryColors[i % countryColors.length])
    ).join('');

    // Reference type stats
    const refTypeLabels: Record<string, string> = {
      sota: 'SOTA', pota: 'POTA', hbff: 'WWFF', wwbota: 'WWBOTA', castle: 'Burgen',
      iota: 'IOTA', lighthouse: 'Leuchttürme', repeater: 'Relais', swiss_protected: 'Naturzonen',
      generell: 'Generell', custom: 'Eigenes',
    };
    const refEntries = Object.entries(stats.refTypes).sort((a: any, b: any) => b[1] - a[1]);
    const maxRef = refEntries.length > 0 ? refEntries[0][1] : 1;
    const refRows = refEntries.map((entry: any, i: number) =>
      barRow(refTypeLabels[entry[0]] || entry[0], entry[1], maxRef, countryColors[i % countryColors.length])
    ).join('');

    // Cache layer labels
    const cacheLayerLabels: Record<string, string> = {
      sota: 'SOTA-Gipfel', pota: 'POTA-Parks', hbff: 'WWFF-Gebiete',
      wwbota: 'WWBOTA-Bunker', castle: 'Burgen/Schlösser', lighthouse: 'Leuchttürme',
      iota: 'IOTA-Inseln', repeater: 'Relais', aprs: 'APRS-Nodes',
      tota: 'TOTA-Türme', repeaterLinks: 'Relais-Verlinkungen',
    };
    const cacheLayerColors: Record<string, string> = {
      sota: '#ef4444', pota: '#22c55e', hbff: '#a855f7', wwbota: '#78350f',
      castle: '#f97316', lighthouse: '#eab308', iota: '#3b82f6',
      repeater: '#3b82f6', aprs: '#8b5cf6', tota: '#f97316', repeaterLinks: '#14b8a6',
    };
    const cacheRows = Object.entries(stats.cacheLayers || {}).map(([key, count]: any) =>
      `<tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:5px 8px;font-size:13px;color:#333;">${cacheLayerLabels[key] || key}</td>
        <td style="padding:5px 8px;font-size:14px;color:${cacheLayerColors[key] || '#666'};font-weight:700;text-align:right;">${(count || 0).toLocaleString('de-CH')}</td>
      </tr>`
    ).join('');

    // Total batch duration
    const totalBatchDuration = todaySources.reduce((sum: number, s: any) => sum + (s.last_duration_ms || 0), 0);
    const batchDurationStr = `${Math.floor(totalBatchDuration / 60000)}m ${Math.round((totalBatchDuration % 60000) / 1000)}s`;

    const deltaHeader = mode === 'weekly' ? '<th style="padding:5px 6px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;">Delta</th>' : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="width:100%;max-width:650px;margin:0 auto;background:#fff;border-radius:0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#2d5a8e);padding:20px 16px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">📡 HB9OM On Field</h1>
      <p style="margin:4px 0 0;color:#a8c8e8;font-size:13px;">${reportSubtitle}</p>
    </div>

    <!-- Overall Status -->
    <div style="padding:16px;border-bottom:1px solid #eee;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        ${statusBadge(overallStatus)}
        <span style="font-size:14px;font-weight:600;color:#333;">${successCount}/${totalCount} Quellen erfolgreich</span>
      </div>
      <div style="margin-top:8px;font-size:12px;color:#666;">
        Batch-Dauer gesamt: <strong>${batchDurationStr}</strong> · Total Einträge verarbeitet: <strong>${todaySources.reduce((s: number, src: any) => s + (src.last_count || 0), 0).toLocaleString('de-CH')}</strong>
      </div>
      ${failedCount > 0 ? `<div style="margin-top:8px;padding:8px 12px;background:#fef2f2;border-radius:6px;font-size:12px;color:#dc2626;">⚠️ ${failedCount} Quelle(n) fehlgeschlagen — siehe Probleme unten.</div>` : ''}
      ${warningCount > 0 ? `<div style="margin-top:8px;padding:8px 12px;background:#fffbeb;border-radius:6px;font-size:12px;color:#f59e0b;">⚠️ ${warningCount} Quelle(n) mit 0 Einträgen — Quelle möglicherweise nicht erreichbar.</div>` : ''}
      ${pendingSources.length > 0 ? `<div style="margin-top:8px;padding:8px 12px;background:#f3f4f6;border-radius:6px;font-size:12px;color:#6b7280;">⏭️ ${pendingSources.length} Quelle(n) übersprungen / nicht ausgeführt.</div>` : ''}
    </div>

    <!-- Source Results Table -->
    <div style="padding:16px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 10px;font-size:15px;color:#333;">📋 Quellen-Status</h2>
      <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;min-width:300px;">
        <thead>
          <tr style="border-bottom:2px solid #ddd;">
            <th style="padding:5px 6px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Quelle</th>
            <th style="padding:5px 6px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;">Status</th>
            <th style="padding:5px 6px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;">Einträge</th>
            <th style="padding:5px 6px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;">Dauer</th>
            ${deltaHeader}
          </tr>
        </thead>
        <tbody>${sourceRows}</tbody>
      </table>
      </div>
    </div>

    ${problemsHtml}

    ${aprsSection}

    <!-- Cache Storage -->
    <div style="padding:16px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 10px;font-size:15px;color:#333;">💾 Daten-Cache Speicherung</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${cacheRows}</tbody>
      </table>
    </div>

    <!-- Usage Statistics -->
    <div style="padding:16px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 10px;font-size:15px;color:#333;">📊 App-Nutzung</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:6px;">
        <div style="background:#f0f9ff;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#3b82f6;">${stats.totalUsers}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;">Benutzer</div>
        </div>
        <div style="background:#f0fdf4;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#16a34a;">${stats.totalQsos}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;">QSO-Logs</div>
        </div>
        <div style="background:#fef3c7;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#f59e0b;">${stats.totalRepeaters}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;">Relais</div>
        </div>
        <div style="background:#fdf4ff;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#8b5cf6;">${stats.totalSotaPoints}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;">SOTA</div>
        </div>
        <div style="background:#ecfdf5;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#10b981;">${stats.totalPotaPoints}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;">POTA</div>
        </div>
        <div style="background:#f0f9ff;border-radius:6px;padding:8px;text-align:center;">
          <div style="font-size:20px;font-weight:700;color:#06b6d4;">${stats.totalPrivateNodes}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;">APRS</div>
        </div>
      </div>
    </div>

    ${countryRows ? `
    <!-- QSOs by Country -->
    <div style="padding:16px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 10px;font-size:15px;color:#333;">🌍 QSOs nach Land (Top 10)</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${countryRows}</tbody>
      </table>
    </div>` : ''}

    ${refRows ? `
    <!-- Layer Usage -->
    <div style="padding:16px;border-bottom:1px solid #eee;">
      <h2 style="margin:0 0 10px;font-size:15px;color:#333;">🗺️ Häufigste Referenz-Typen</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${refRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:12px 16px;background:#f8f8f8;">
      <p style="margin:0;font-size:10px;color:#999;text-align:center;">
        ${mode === 'weekly' ? 'Dieser Report wird wöchentlich am Montag nach Abschluss des Sync-Batches automatisch generiert.' : 'Dieser Report wird nach Abschluss des Sync-Batches automatisch generiert.'}<br/>
        HB9OM On Field · Amateurfunk Referenz-Map
      </p>
    </div>
  </div>
</body></html>`;

    // --- 5. Get admin users ---
    const allUsers = await base44.asServiceRole.entities.User.list();
    let admins = allUsers.filter((u: any) => u.role === 'admin' && u.email);
    admins = admins.filter((u: any) => u.admin_email_enabled !== false);

    if (body.targetUserId) {
      admins = admins.filter((u: any) => u.id === body.targetUserId);
    }

    if (admins.length === 0) {
      return Response.json({ status: 'skipped', message: 'Keine Admin-E-Mails gefunden oder alle deaktiviert' });
    }

    const recipients = admins.map((admin: any) => ({
      admin,
      email: (admin.admin_email_override && admin.admin_email_verified) ? admin.admin_email_override : admin.email,
    }));

    // --- 6. Send the report ---
    const subject = mode === 'weekly'
      ? `📡 HB9OM Wochen-Sync Bericht – ${today} – ${overallStatus.toUpperCase()}`
      : `📡 HB9OM Daily Report – ${today} – ${overallStatus.toUpperCase()}`;

    const sendResults = [];
    for (const recipient of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: recipient.email,
          subject,
          body: html,
        });
        sendResults.push({ admin: recipient.email, status: 'success' });
      } catch (e: any) {
        sendResults.push({ admin: recipient.email, status: 'failed', error: e?.message || String(e) });
      }
    }

    // --- 7. Store this week's counts for next week's delta (weekly mode only) ---
    if (mode === 'weekly') {
      try {
        const currentCounts: Record<string, number> = {};
        for (const s of allSchedules || []) {
          if (s.last_count != null) {
            currentCounts[s.source] = s.last_count;
          }
        }
        // Also store APRS count
        currentCounts['aprs'] = stats.totalPrivateNodes || 0;

        const existing = await base44.asServiceRole.entities.AppSetting.filter({ key: 'weekly_report_last_counts' });
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.AppSetting.update(existing[0].id, { value: JSON.stringify(currentCounts) });
        } else {
          await base44.asServiceRole.entities.AppSetting.create({ key: 'weekly_report_last_counts', value: JSON.stringify(currentCounts) });
        }
      } catch {}
    }

    return Response.json({
      status: 'success',
      mode,
      overall_status: overallStatus,
      sources_total: totalCount,
      sources_success: successCount,
      sources_failed: failedCount,
      email_verified: true,
      emails_sent: sendResults.filter((r: any) => r.status === 'success').length,
      emails_failed: sendResults.filter((r: any) => r.status === 'failed').length,
      send_results: sendResults,
      stats,
    });
  } catch (error) {
    return Response.json({
      status: 'failed',
      error: error.message || String(error),
      stack: error.stack || '',
    }, { status: 500 });
  }
}