// normalizeRepeaterOffsets — Korrigiert fehlerhafte offset_mhz Werte in der Repeater-Entity.
// Admin-only. Pagination verarbeitet ALLE Repeater (cursor-basiert mit id $gt).
//
// Korrektur-Logik (Reihenfolge):
//   1. offset === 0/null → Standard-Offset für Band
//   2. 2m mit |offset| > 10 → -0.6 (fängt 288.1, 287.9, 327.353, 600.0 etc.)
//   3. 70cm mit |offset| > 20 → -7.6
//   4. |offset| > 50 → kHz statt MHz → teile durch 1000 (andere Bänder)
//   5. 2m mit positivem offset > 0.5 → -0.6 (fängt 0.9875 — falsches Vorzeichen)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const STANDARD_OFFSETS: Record<string, number> = {
  '2m': -0.6,
  '70cm': -7.6,
  '10m': -0.1,
  '6m': -0.5,
  '4m': -0.5,
  '23cm': -12.0,
};

function normalizeOffset(offset: number | null, band: string | null): { value: number; changed: boolean; reason: string } {
  // 1. Null or zero → standard offset
  if (offset == null || offset === 0) {
    const std = STANDARD_OFFSETS[band || ''];
    if (std != null) return { value: std, changed: true, reason: `offset=0 → Standard ${std}` };
    return { value: 0, changed: false, reason: 'no band, no offset' };
  }

  // 2. 2m: |offset| > 10 → -0.6 (catches 288.1, 287.9, 327.353, 600.0, French/Italian 285-293)
  if (band === '2m' && (offset > 10 || offset < -10)) {
    return { value: -0.6, changed: true, reason: `offset=${offset} out of range for 2m → Standard -0.6` };
  }

  // 3. 70cm: |offset| > 20 → -7.6
  if (band === '70cm' && (offset > 20 || offset < -20)) {
    return { value: -7.6, changed: true, reason: `offset=${offset} out of range for 70cm → Standard -7.6` };
  }

  // 4. |offset| > 50 → kHz instead of MHz → divide by 1000 (for bands not caught above)
  if (Math.abs(offset) > 50) {
    const converted = Math.round((offset / 1000) * 1000) / 1000;
    return { value: converted, changed: true, reason: `kHz→MHz: ${offset} → ${converted}` };
  }

  // 5. 2m positive offset > 0.5 → wrong sign → -0.6 (catches 0.9875)
  if (band === '2m' && offset > 0.5) {
    return { value: -0.6, changed: true, reason: `offset=${offset} positive for 2m → Standard -0.6` };
  }

  return { value: offset, changed: false, reason: 'OK' };
}

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const batchSize = 1000;

    let totalChecked = 0;
    let totalCorrected = 0;
    let totalSkipped = 0;
    const allCorrections: any[] = [];
    const pendingUpdates: any[] = [];
    let skip = 0;
    let iterations = 0;
    const maxIterations = 200; // safety: 200 * 1000 = 200k records

    while (iterations < maxIterations) {
      iterations++;
      const batch = await base44.asServiceRole.entities.Repeater.filter({}, 'id', batchSize, skip);

      if (!batch || batch.length === 0) break;

      for (const r of batch) {
        totalChecked++;
        const result = normalizeOffset(r.offset_mhz, r.band);
        if (result.changed) {
          allCorrections.push({
            id: r.id,
            callsign: r.callsign,
            frequency: r.frequency,
            band: r.band,
            old_offset: r.offset_mhz,
            new_offset: result.value,
            reason: result.reason,
          });
          totalCorrected++;
          if (!dryRun) {
            pendingUpdates.push({ id: r.id, offset_mhz: result.value });
          }
        }
      }

      skip += batch.length;
      if (batch.length < batchSize) break;
    }

    // Apply corrections in bulk (500 per call) if not dry run
    if (!dryRun && pendingUpdates.length > 0) {
      for (let i = 0; i < pendingUpdates.length; i += 500) {
        const chunk = pendingUpdates.slice(i, i + 500);
        try {
          await base44.asServiceRole.entities.Repeater.bulkUpdate(chunk);
        } catch (e: any) {
          totalSkipped += chunk.length;
        }
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      total_checked: totalChecked,
      corrected: totalCorrected,
      skipped: totalSkipped,
      corrections: allCorrections.slice(0, 200),
      corrections_count: allCorrections.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}