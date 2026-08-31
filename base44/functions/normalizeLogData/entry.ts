import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// normalizeLogData — v0.9017 BUG 6
// Normalizes Log entity records:
// 1. Band fields to lowercase (15M → 15m, 80M → 80m, 2M → 2m, 70CM → 70cm)
// 2. club_operator_callsign: if it equals club_callsign (club call instead of operator call), clear it
// 3. Detects duplicates (same callsign + qso_date + frequency) and reports them
// Admin-only — modifies all Log records.

const BAND_NORMALIZE: Record<string, string> = {
  '160M': '160m', '80M': '80m', '60M': '60m', '40M': '40m', '30M': '30m',
  '20M': '20m', '17M': '17m', '15M': '15m', '12M': '12m', '10M': '10m',
  '6M': '6m', '4M': '4m', '2M': '2m', '70CM': '70cm', '23CM': '23cm',
  'OTHER': 'Other',
};

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
    const dryRun = body.dry_run !== false; // Default: dry run (preview only)
    const batchSize = body.batch_size || 500;
    const maxBatches = body.max_batches || 100; // 100 * 500 = 50k records max

    let bandsNormalized = 0;
    let operatorFixed = 0;
    let duplicatesFound = 0;
    let totalProcessed = 0;
    const duplicateSamples: any[] = [];

    // Collect all records in paginated batches
    for (let page = 0; page < maxBatches; page++) {
      const batch = await base44.asServiceRole.entities.Log.list('-created_date', batchSize, page * batchSize);
      if (!Array.isArray(batch) || batch.length === 0) break;

      const updates: any[] = [];
      const seenKeys = new Set<string>();

      for (const log of batch) {
        const updates_needed: any = {};
        let changed = false;

        // 1. Normalize band to lowercase
        if (log.band) {
          const normalized = BAND_NORMALIZE[log.band.toUpperCase()] || log.band.toLowerCase();
          if (normalized !== log.band) {
            updates_needed.band = normalized;
            changed = true;
            bandsNormalized++;
          }
        }

        // 2. Fix club_operator_callsign — if it equals club_callsign, it's the club call not the operator
        if (log.is_clubstation && log.club_operator_callsign && log.club_callsign) {
          if (log.club_operator_callsign.toUpperCase() === log.club_callsign.toUpperCase()) {
            updates_needed.club_operator_callsign = '';
            changed = true;
            operatorFixed++;
          }
        }

        // 3. Detect duplicates (callsign + qso_date + frequency)
        const freq = log.frequency != null ? String(log.frequency) : '';
        const dedupKey = `${(log.callsign || '').toUpperCase()}|${log.qso_date || ''}|${freq}`;
        if (seenKeys.has(dedupKey)) {
          duplicatesFound++;
          if (duplicateSamples.length < 10) {
            duplicateSamples.push({
              id: log.id,
              callsign: log.callsign,
              qso_date: log.qso_date,
              frequency: log.frequency,
              is_clubstation: log.is_clubstation,
            });
          }
        } else {
          seenKeys.add(dedupKey);
        }

        if (changed && !dryRun) {
          updates.push({ id: log.id, ...updates_needed });
        }
        totalProcessed++;
      }

      // Bulk update if not dry run
      if (!dryRun && updates.length > 0) {
        try {
          await base44.asServiceRole.entities.Log.bulkUpdate(updates);
        } catch {
          // Fall back to individual updates
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
      total_processed: totalProcessed,
      bands_normalized: bandsNormalized,
      operator_callsign_fixed: operatorFixed,
      duplicates_found: duplicatesFound,
      duplicate_samples: duplicateSamples,
      message: dryRun
        ? `Dry Run: ${bandsNormalized} Bänder zu normalisieren, ${operatorFixed} Operator-Calls zu korrigieren, ${duplicatesFound} Duplikate gefunden`
        : `Done: ${bandsNormalized} Bänder normalisiert, ${operatorFixed} Operator-Calls korrigiert, ${duplicatesFound} Duplikate gefunden`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}