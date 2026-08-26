import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Lade alle Log-Einträge des Users und extrahiere Worked-Status:
// calls[], callsOnBand[] ("CALL|BAND"), countries[], countriesOnBand[] ("COUNTRY|BAND")

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const logs = await base44.entities.Log.list('-updated_date', 5000);

    const calls = new Set<string>();
    const callsOnBand = new Set<string>();
    const countries = new Set<string>();
    const countriesOnBand = new Set<string>();

    for (const log of (logs || [])) {
      const call = (log.callsign || '').toUpperCase().trim();
      const band = log.band || '';
      const country = (log.operator_country || '').toUpperCase().trim();

      if (call) {
        calls.add(call);
        if (band) callsOnBand.add(`${call}|${band}`);
      }
      if (country) {
        countries.add(country);
        if (band) countriesOnBand.add(`${country}|${band}`);
      }
    }

    return Response.json({
      success: true,
      worked: {
        calls: [...calls],
        callsOnBand: [...callsOnBand],
        countries: [...countries],
        countriesOnBand: [...countriesOnBand],
      },
      totalLogs: logs?.length || 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}