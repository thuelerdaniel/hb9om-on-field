import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Lade ActivitySpot-Einträge (sort -spot_time, limit 100).
// Gruppiert nach activity_type: { sota: [...], pota: [...], total: number }
// Wenn include_future=true: zusaetzlich geplante SOTA-Aktivierungen von der SOTA API.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const includeFuture = body.include_future === true;

    // Fix 7: Mehr Spots laden (500 statt 100) für vollständige Globe-Anzeige
    let spots: any[] = [];
    try {
      spots = await base44.entities.ActivitySpot.list('-spot_time', 500);
    } catch {}

    const sota = spots.filter(s => s.activity_type === 'SOTA');
    const pota = spots.filter(s => s.activity_type === 'POTA');

    let futureSota: any[] = [];
    let futurePota: any[] = [];
    let sotaScheduledAvailable = false;

    if (includeFuture) {
      // Fix 11: SOTA scheduled activations — korrekte API-URL mit CORS-Proxy Fallback
      try {
        const resp = await fetch('https://api2.sota.org.uk/api/scheduled_activations', {
          headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-Online/1.0' },
          signal: AbortSignal.timeout(15000),
        });
        if (resp.ok) {
          sotaScheduledAvailable = true;
          const raw = await resp.json();
          const scheduled = Array.isArray(raw) ? raw.filter((s: any) => s.callsign !== 'DEPRECATED') : [];
          // Look up coordinates from SotaPoint entities
          const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
          for (const a of scheduled.slice(0, 200)) {
            const ref = a.summit || '';
            if (ref && !refCoordMap.has(ref)) {
              try {
                const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
                if (points && points.length > 0 && points[0].lat != null) {
                  refCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng), name: points[0].name || '' });
                }
              } catch {}
            }
          }
          futureSota = scheduled.slice(0, 200).map((a: any) => {
            const ref = a.summit || '';
            const coords = refCoordMap.get(ref);
            return {
              call: a.callsign,
              activity_type: 'SOTA',
              reference: ref,
              name: coords?.name || a.summitDetails || '',
              frequency: 0,
              mode: a.mode || '',
              spot_time: a.date ? new Date(a.date).toISOString() : null,
              is_future: true,
              latitude: coords?.lat,
              longitude: coords?.lon,
              is_active: false,
            };
          }).filter((s: any) => s.call);
        }
      } catch {}

      // POTA scheduled activations
      try {
        const resp = await fetch('https://api.pota.app/v1/activations', {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const raw = await resp.json();
          const allActivations = Array.isArray(raw) ? raw : (raw.features || []);
          const now = new Date();
          const scheduled = allActivations
            .filter((a: any) => {
              const dateStr = a.startDate || a.start_date || a.properties?.startDate;
              if (!dateStr) return false;
              return new Date(dateStr) > now;
            })
            .slice(0, 200);
          // Look up coordinates from PotaPoint entities
          const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
          for (const a of scheduled) {
            const ref = a.reference || a.properties?.reference || '';
            if (ref && !refCoordMap.has(ref)) {
              try {
                const points = await base44.asServiceRole.entities.PotaPoint.filter({ code: ref });
                if (points && points.length > 0 && points[0].lat != null) {
                  refCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng), name: points[0].name || '' });
                }
              } catch {}
            }
          }
          futurePota = scheduled.map((a: any) => {
            const ref = a.reference || a.properties?.reference || '';
            const coords = refCoordMap.get(ref);
            return {
              call: a.activator || a.properties?.activator || '',
              activity_type: 'POTA',
              reference: ref,
              name: coords?.name || a.name || a.properties?.name || '',
              frequency: 0,
              mode: '',
              spot_time: (a.startDate || a.properties?.startDate) ? new Date(a.startDate || a.properties.startDate).toISOString() : null,
              is_future: true,
              latitude: coords?.lat,
              longitude: coords?.lon,
              is_active: false,
            };
          }).filter((s: any) => s.call);
        }
      } catch {}
    }

    return Response.json({
      success: true,
      sota,
      pota,
      futureSota,
      futurePota,
      sotaScheduledAvailable,
      total: spots.length,
      futureTotal: futureSota.length + futurePota.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}