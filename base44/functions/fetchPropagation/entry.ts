import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { calculateBandConditions } from "../../shared/bandDerivation.ts";

// Lade Solar-Flux und K-Index von NOAA SWPC.
// Berechne Band-Conditions und speichere in Propagation Entity.
// Gib propagationData und bestBand zurück.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Scheduled runs have no user context — skip auth. Manual runs require login.
    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let solarFlux = 150;
    let kIndex = 3;

    // Solar Flux laden (F10.7 cm flux)
    try {
      const fluxResp = await fetch('https://services.swpc.noaa.gov/json/f107_cm_flux.json');
      if (fluxResp.ok) {
        const fluxData = await fluxResp.json();
        const arr = Array.isArray(fluxData) ? fluxData : (fluxData?.data || []);
        const last = arr.length > 0 ? arr[arr.length - 1] : null;
        if (last) {
          const raw = last.f107 ?? last.flux ?? last.value;
          const parsed = Number(raw);
          if (!isNaN(parsed) && parsed > 0) solarFlux = parsed;
        }
      }
    } catch {}

    // K-Index laden (planetary K-index, 1-minute)
    try {
      const kResp = await fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json');
      if (kResp.ok) {
        const kData = await kResp.json();
        const arr = Array.isArray(kData) ? kData : (kData?.data || []);
        const last = arr.length > 0 ? arr[arr.length - 1] : null;
        if (last) {
          // NOAA nutzt versch. Feldnamen: estimated_kp, kp, k_index
          const raw = last.estimated_kp ?? last.kp ?? last.k_index ?? last.kp_value;
          const parsed = Number(raw);
          if (!isNaN(parsed)) kIndex = parsed;
        }
      }
    } catch {}

    // NaN-Schutz
    if (isNaN(solarFlux) || solarFlux <= 0) solarFlux = 150;
    if (isNaN(kIndex)) kIndex = 3;

    const aIndex = kIndex * 4;
    const muf = Math.round((15 + (solarFlux - 100) * 0.05) * 10) / 10;
    const bands = calculateBandConditions(solarFlux, kIndex);

    // Best Band = höchster Score
    const bestBand = bands.reduce((best, b) =>
      (b.score || 0) > (best.score || 0) ? b : best,
      { band: '—', score: -1, condition: '—' }
    );

    const propagationData = {
      solar_flux: solarFlux,
      a_index: aIndex,
      k_index: kIndex,
      muf,
      bands,
      updated: new Date().toISOString(),
      source: 'NOAA SWPC',
    };

    // Alte Propagation-Einträge löschen, dann neuen speichern
    try {
      await base44.asServiceRole.entities.Propagation.deleteMany({});
    } catch {}
    try {
      await base44.asServiceRole.entities.Propagation.create(propagationData);
    } catch {}

    return Response.json({
      success: true,
      propagation: propagationData,
      bestBand,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}