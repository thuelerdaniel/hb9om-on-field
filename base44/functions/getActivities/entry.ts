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

    let sota = spots.filter(s => s.activity_type === 'SOTA');
    const pota = spots.filter(s => s.activity_type === 'POTA');

    // Fix 1: Falls keine SOTA-Spots in DB: direkt von SOTA API laden (mit CORS-Proxy Fallback)
    if (sota.length === 0) {
      const sotaUrls = [
        'https://api2.sota.org.uk/api/spots',
        `https://corsproxy.io/?url=${encodeURIComponent('https://api2.sota.org.uk/api/spots')}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api2.sota.org.uk/api/spots')}`,
      ];
      for (const url of sotaUrls) {
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-Online/1.0' },
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) {
            const raw = await resp.json();
            const sotaSpots = Array.isArray(raw) ? raw.filter((s: any) => s.activatorCallsign && s.frequency) : [];
            console.log(`[SOTA Active] geladen: ${sotaSpots.length} (via ${url.split('//')[1]?.split('/')[0]})`);
            const refCoordMap = new Map<string, { lat: number; lon: number }>();
            for (const s of sotaSpots) {
              const ref = s.summitCode ? `${s.associationCode || ''}/${s.summitCode}` : '';
              if (ref && !refCoordMap.has(ref)) {
                try {
                  const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
                  if (points && points.length > 0 && points[0].lat != null) {
                    refCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng) });
                  }
                } catch {}
              }
            }
            sota = sotaSpots.map((s: any) => {
              const frequency = Number(s.frequency) * 1000;
              const spotTime = s.timeStamp ? new Date(s.timeStamp) : new Date();
              const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
              const ref = s.summitCode ? `${s.associationCode || ''}/${s.summitCode}` : '';
              const coords = ref ? refCoordMap.get(ref) : undefined;
              return {
                call: s.activatorCallsign,
                activity_type: 'SOTA',
                reference: ref,
                name: s.summitDetails || '',
                frequency,
                band: '',
                mode: s.mode || 'CW',
                latitude: coords?.lat,
                longitude: coords?.lon,
                comments: s.comments || s.comment || '',
                spotter: s.spotterCallsign || '',
                source: 'SOTA API (live)',
                spot_time: spotTime.toISOString(),
                age_seconds: ageSeconds,
                distance: null,
                azimuth: null,
                is_active: true,
              };
            });
            break;
          }
        } catch (e: any) {
          console.warn(`[SOTA Active] ${url.split('//')[1]?.split('/')[0]}: ${e.message}`);
        }
      }
    }

    let futureSota: any[] = [];
    let futurePota: any[] = [];
    let sotaScheduledAvailable = false;

    if (includeFuture) {
      // Fix 2: SOTA scheduled activations — mit CORS-Proxy Fallback und mehreren Endpunkten
      const scheduledUrls = [
        'https://api2.sota.org.uk/api/scheduled_activations',
        `https://corsproxy.io/?url=${encodeURIComponent('https://api2.sota.org.uk/api/scheduled_activations')}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent('https://api2.sota.org.uk/api/scheduled_activations')}`,
      ];
      for (const url of scheduledUrls) {
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-Online/1.0' },
            signal: AbortSignal.timeout(15000),
          });
          if (resp.ok) {
            sotaScheduledAvailable = true;
            const raw = await resp.json();
            const scheduled = Array.isArray(raw) ? raw.filter((s: any) => s.callsign !== 'DEPRECATED') : [];
            console.log(`[SOTA Scheduled] geladen: ${scheduled.length} (via ${url.split('//')[1]?.split('/')[0]})`);
            const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
            for (const a of scheduled.slice(0, 200)) {
              const ref = a.summit || a.summit_code || a.summitCode || '';
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
              const ref = a.summit || a.summit_code || a.summitCode || '';
              const coords = refCoordMap.get(ref);
              return {
                call: a.callsign || a.activator_callsign || '',
                activity_type: 'SOTA',
                reference: ref,
                name: coords?.name || a.summit_details || a.summitDetails || '',
                frequency: 0,
                mode: a.mode || '',
                spot_time: (a.date || a.activation_date) ? new Date(a.date || a.activation_date).toISOString() : null,
                is_future: true,
                latitude: coords?.lat,
                longitude: coords?.lon,
                is_active: false,
              };
            }).filter((s: any) => s.call);
            break;
          }
        } catch (e: any) {
          console.warn(`[SOTA Scheduled] ${url.split('//')[1]?.split('/')[0]}: ${e.message}`);
        }
      }

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