import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// normalizeLogClubCall — v0.9018
// Fixes Log records where is_clubstation=true but club_callsign='HB3YNF' (personal call)
// instead of 'HB9OM' (club call). This happened because fetchQrzClubLog used the ADIF
// STATION_CALLSIGN field which contained the personal call sign.
// Admin-only — modifies all club station Log records.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
    if ((user as any).role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const dryRun = body.dry_run !== false; // Default: dry run
    const batchSize = 500;
    const maxBatches = 100; // 100 * 500 = 50k records max

    let fixedCount = 0;
    let totalClubRecords = 0;
    let totalProcessed = 0;
    const samples: any[] = [];

    for (let page = 0; page < maxBatches; page++) {
      const batch = await base44.asServiceRole.entities.Log.filter(
        { is_clubstation: true },
        '-created_date', batchSize, page * batchSize
      );
      if (!Array.isArray(batch) || batch.length === 0) break;

      const updates: any[] = [];
      for (const log of batch) {
        totalClubRecords++;
        totalProcessed++;
        
        // Fix: club_callsign should be HB9OM, not HB3YNF or any personal call
        if (log.club_callsign && log.club_callsign.toUpperCase() !== 'HB9OM') {
          if (samples.length < 10) {
            samples.push({
              id: log.id,
              callsign: log.callsign,
              old_club_callsign: log.club_callsign,
              qso_date: log.qso_date,
            });
          }
          if (!dryRun) {
            updates.push({ id: log.id, club_callsign: 'HB9OM' });
          }
          fixedCount++;
        }
      }

      // Bulk update if not dry run
      if (!dryRun && updates.length > 0) {
        try {
          await base44.asServiceRole.entities.Log.bulkUpdate(updates);
        } catch {
          for (const u of updates) {
            try { await base44.asServiceRole.entities.Log.update(u.id, u); } catch {}
          }
        }
      }

      if (batch.length < batchSize) break;
    }

    return Response.json({
      status: 'success',
      dry_run: dryRun,
      total_club_records: totalClubRecords,
      total_processed: totalProcessed,
      fixed_count: fixedCount,
      samples: samples,
      message: dryRun
        ? `Dry Run: ${fixedCount} Club-Einträge mit falschem club_callsign gefunden (HB3YNF statt HB9OM)`
        : `Done: ${fixedCount} Club-Einträge korrigiert (club_callsign → HB9OM)`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}