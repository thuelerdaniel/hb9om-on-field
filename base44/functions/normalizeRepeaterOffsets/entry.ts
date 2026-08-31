// normalizeRepeaterOffsets — Korrigiert fehlerhafte offset_mhz Werte in der Repeater-Entity.
// Admin-only. Fehlerhafte Werte:
//   - |offset| > 50 → wahrscheinlich kHz statt MHz → teile durch 1000
//   - offset === 0 und Band bekannt → setze Standard-Offset
//   - |offset| > 10 für 2m → sehr wahrscheinlich falsch → setze -0.6

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
  // Null or zero → standard offset
  if (offset == null || offset === 0) {
    const std = STANDARD_OFFSETS[band || ''];
    if (std != null) return { value: std, changed: true, reason: `offset=0 → Standard ${std}` };
    return { value: 0, changed: false, reason: 'no band, no offset' };
  }

  // |offset| > 50 → kHz instead of MHz → divide by 1000
  if (Math.abs(offset) > 50) {
    return { value: Math.round((offset / 1000) * 1000) / 1000, changed: true, reason: `kHz→MHz: ${offset} → ${offset / 1000}` };
  }

  // 2m band with |offset| > 10 → very likely wrong → set -0.6
  if (band === '2m' && Math.abs(offset) > 10) {
    return { value: -0.6, changed: true, reason: `2m offset>${10} → -0.6` };
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
    const limit = body?.limit || 50000;

    // Fetch all repeaters
    const repeaters = await base44.asServiceRole.entities.Repeater.filter({}, '-created_date', limit);

    let checked = 0, corrected = 0, skipped = 0;
    const corrections: any[] = [];

    for (const r of repeaters) {
      checked++;
      const result = normalizeOffset(r.offset_mhz, r.band);
      if (result.changed) {
        if (dryRun) {
          corrections.push({
            id: r.id,
            callsign: r.callsign,
            frequency: r.frequency,
            band: r.band,
            old_offset: r.offset_mhz,
            new_offset: result.value,
            reason: result.reason,
          });
          corrected++;
        } else {
          try {
            await base44.asServiceRole.entities.Repeater.update(r.id, {
              offset_mhz: result.value,
            });
            corrections.push({
              id: r.id,
              callsign: r.callsign,
              frequency: r.frequency,
              band: r.band,
              old_offset: r.offset_mhz,
              new_offset: result.value,
              reason: result.reason,
            });
            corrected++;
          } catch (e: any) {
            skipped++;
          }
        }
      }
    }

    return Response.json({
      success: true,
      dry_run: dryRun,
      total_checked: checked,
      corrected,
      skipped,
      corrections: corrections.slice(0, 100),
      corrections_count: corrections.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}