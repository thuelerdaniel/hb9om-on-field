import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Lade alle ActivitySpot-Einträge (sort -spot_time, limit 500).
// Gruppiert nach activity_type: { sota, pota, wwff, wwbota, gma, alerts, other, total }
// Wenn include_future=true: zusaetzlich SOTA-Alerts von der SOTA API.

const SOTA_BASE = 'https://api-db2.sota.org.uk';
const UA = 'HB9OM-On-Field/1.0';

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

    // Alle ActivitySpots laden
    let spots: any[] = [];
    try {
      spots = await base44.entities.ActivitySpot.list('-spot_time', 500);
    } catch {}

    // Gruppiere nach activity_type
    const sota = spots.filter(s => s.activity_type === 'SOTA');
    const pota = spots.filter(s => s.activity_type === 'POTA');
    const wwff = spots.filter(s => s.activity_type === 'WWFF');
    const wwbota = spots.filter(s => s.activity_type === 'WWBOTA');
    const gma = spots.filter(s => s.activity_type === 'GMA');
    const alerts = spots.filter(s => s.activity_type === 'SOTA-ALERT');
    const other = spots.filter(s => !['SOTA', 'POTA', 'WWFF', 'WWBOTA', 'GMA', 'SOTA-ALERT'].includes(s.activity_type));

    // Falls keine SOTA-Spots in DB: direkt von SOTA API laden
    let liveSota = sota;
    if (liveSota.length === 0) {
      const sotaUrls = [
        `${SOTA_BASE}/api/spots/2/all`,
        `${SOTA_BASE}/api/spots/-1`,
        `https://corsproxy.io/?url=${encodeURIComponent(`${SOTA_BASE}/api/spots/2/all`)}`,
      ];
      for (const url of sotaUrls) {
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': UA },
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) {
            const raw = await resp.json();
            const sotaSpots = Array.isArray(raw) ? raw.filter((s: any) => s.id !== 9999999999999999 && s.activatorCallsign && s.frequency) : [];
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
            liveSota = sotaSpots.map((s: any) => {
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
                comments: s.comments || '',
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
        } catch {}
      }
    }

    // SOTA-Alerts (geplante Aktivierungen)
    let futureAlerts: any[] = [];
    let sotaAlertsAvailable = false;
    if (includeFuture) {
      const alertUrls = [
        `${SOTA_BASE}/api/alerts`,
        `https://corsproxy.io/?url=${encodeURIComponent(`${SOTA_BASE}/api/alerts`)}`,
      ];
      for (const url of alertUrls) {
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': UA },
            signal: AbortSignal.timeout(15000),
          });
          if (resp.ok) {
            sotaAlertsAvailable = true;
            const raw = await resp.json();
            const alertList = Array.isArray(raw) ? raw.filter((s: any) => s.id !== 9999999999999999 && s.callsign !== 'DEPRECATED') : [];
            const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
            for (const a of alertList.slice(0, 200)) {
              const summitCode = a.summitCode || a.summit_code || '';
              const assocCode = a.associationCode || a.association_code || '';
              const ref = summitCode ? `${assocCode}/${summitCode}` : '';
              if (ref && !refCoordMap.has(ref)) {
                try {
                  const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
                  if (points && points.length > 0 && points[0].lat != null) {
                    refCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng), name: points[0].name || '' });
                  }
                } catch {}
              }
            }
            futureAlerts = alertList.slice(0, 200).map((a: any) => {
              const summitCode = a.summitCode || a.summit_code || '';
              const assocCode = a.associationCode || a.association_code || '';
              const ref = summitCode ? `${assocCode}/${summitCode}` : '';
              const coords = refCoordMap.get(ref);
              return {
                call: a.activatingCallsign || a.activator_callsign || a.callsign || '',
                activity_type: 'SOTA-ALERT',
                reference: ref,
                name: coords?.name || a.summitDetails || a.summit_details || '',
                frequency: 0,
                mode: a.mode || '',
                spot_time: a.dateActivated ? new Date(a.dateActivated).toISOString() : null,
                is_future: true,
                latitude: coords?.lat,
                longitude: coords?.lon,
                is_active: false,
              };
            }).filter((s: any) => s.call);
            break;
          }
        } catch {}
      }
    }

    return Response.json({
      success: true,
      sota: liveSota,
      pota,
      wwff,
      wwbota,
      gma,
      alerts: [...alerts, ...futureAlerts],
      other,
      sotaAlertsAvailable,
      total: spots.length,
      futureTotal: futureAlerts.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}