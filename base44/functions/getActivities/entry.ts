import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Lade alle ActivitySpot-Einträge und teile sie in LIVE und ALERTS.
// Fix v0.9016: Strikte Trennung von Live-Spots und geplanten Aktivierungen.
//   liveSpots: alle Live-Spots (SOTA, POTA, WWFF, WWBOTA, andere) — QRT gefiltert
//   alerts:   alle geplanten Aktivierungen (SOTA-Alerts + WWFF-Agendas)
// WWFF Agendas: spots.wwff.co/static/agendas_active.json
// SOTA API: api-db2.sota.org.uk mit ?client=sotawatch&user=anon

const SOTA_BASE = 'https://api-db2.sota.org.uk';
const WWFF_AGENDAS_URL = 'https://spots.wwff.co/static/agendas_active.json';
const UA = 'HB9OM-On-Field/1.0';
const SPOTS_QUERY = '?client=sotawatch&user=anon';

function isQRT(spot: any): boolean {
  const comments = (spot.comments || '').toUpperCase();
  if (comments.includes('QRT')) return true;
  if (!spot.frequency || spot.frequency === 0) return true;
  return false;
}

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

    // Fix v0.9016: Strikte Trennung Live vs Alerts
    // Live: nicht is_future, nicht SOTA-ALERT, nicht QRT, frequency > 0
    let liveSpots = spots.filter(s =>
      !s.is_future &&
      s.activity_type !== 'SOTA-ALERT' &&
      !isQRT(s)
    );

    // Alerts aus DB (is_future oder SOTA-ALERT)
    const dbAlerts = spots.filter(s =>
      s.is_future || s.activity_type === 'SOTA-ALERT'
    );

    // Falls keine Live-SOTA-Spots in DB: direkt von SOTA API laden
    const hasLiveSota = liveSpots.some(s => s.activity_type === 'SOTA');
    if (!hasLiveSota) {
      const spotsUrl = `${SOTA_BASE}/api/spots/200/all/all${SPOTS_QUERY}`;
      const sotaUrls = [
        spotsUrl,
        `https://corsproxy.io/?url=${encodeURIComponent(spotsUrl)}`,
      ];
      for (const url of sotaUrls) {
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': UA },
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) {
            const raw = await resp.json();
            // Fix v0.9016: QRT-Filter + RBNHOLE-Filter
            const sotaSpots = Array.isArray(raw) ? raw.filter((s: any) =>
              s.activatorCallsign && s.frequency &&
              s.callsign !== 'RBNHOLE' &&
              s.type !== 'DEPRECATED' &&
              !(s.comments && s.comments.toUpperCase().includes('QRT'))
            ) : [];
            console.log('[SOTA] Live spots received:', sotaSpots.length);
            // SotaPoint-Lookup nur für Spots ohne lat/lon
            const refCoordMap = new Map<string, { lat: number; lon: number }>();
            for (const s of sotaSpots) {
              if (s.latitude == null || s.longitude == null) {
                const ref = s.summitCode || '';
                if (ref && !refCoordMap.has(ref)) {
                  try {
                    const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
                    if (points && points.length > 0 && points[0].lat != null) {
                      refCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng) });
                    }
                  } catch {}
                }
              }
            }
            const liveSota = sotaSpots.map((s: any) => {
              const frequency = Number(s.frequency) * 1000;
              const spotTime = s.timeStamp ? new Date(s.timeStamp) : new Date();
              const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
              const ref = s.summitCode || '';
              const fallback = ref ? refCoordMap.get(ref) : undefined;
              return {
                call: s.activatorCallsign,
                activity_type: 'SOTA',
                reference: ref,
                name: s.summitName || s.summitDetails || '',
                frequency,
                band: '',
                mode: s.mode || 'CW',
                latitude: s.latitude != null ? Number(s.latitude) : fallback?.lat,
                longitude: s.longitude != null ? Number(s.longitude) : fallback?.lon,
                comments: s.comments || '',
                spotter: s.callsign || '',
                source: 'SOTA API (live)',
                spot_time: spotTime.toISOString(),
                age_seconds: ageSeconds,
                distance: null,
                azimuth: null,
                is_active: true,
              };
            });
            liveSpots = [...liveSpots, ...liveSota];
            break;
          }
        } catch {}
      }
    }

    // SOTA-Alerts (geplante Aktivierungen) von API
    let sotaAlerts: any[] = [];
    let sotaAlertsAvailable = false;
    if (includeFuture) {
      const alertUrl = `${SOTA_BASE}/api/alerts/100/all/all${SPOTS_QUERY}`;
      const alertUrls = [
        alertUrl,
        `https://corsproxy.io/?url=${encodeURIComponent(alertUrl)}`,
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
            const alertList = Array.isArray(raw) ? raw.filter((a: any) =>
              a.activatingCallsign &&
              a.summitDetails !== 'Unrecognized summit'
            ) : [];
            const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
            for (const a of alertList) {
              const ref = a.associationCode && a.summitCode ? `${a.associationCode}/${a.summitCode}` : '';
              if (ref && !refCoordMap.has(ref)) {
                try {
                  const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
                  if (points && points.length > 0 && points[0].lat != null) {
                    refCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng), name: points[0].name || '' });
                  }
                } catch {}
              }
            }
            sotaAlerts = alertList.map((a: any) => {
              const ref = a.associationCode && a.summitCode ? `${a.associationCode}/${a.summitCode}` : '';
              const coords = refCoordMap.get(ref);
              return {
                call: a.activatingCallsign || '',
                activity_type: 'SOTA-ALERT',
                reference: ref,
                name: coords?.name || a.summitDetails || '',
                frequency: 0,
                mode: a.mode || '',
                spot_time: a.dateActivated ? new Date(a.dateActivated).toISOString() : null,
                is_future: true,
                latitude: coords?.lat,
                longitude: coords?.lon,
                is_active: false,
                source: 'SOTA-Alerts',
              };
            }).filter((s: any) => s.call);
            break;
          }
        } catch {}
      }
    }

    // Fix v0.9016: WWFF Agendas (geplante WWFF-Aktivierungen)
    let wwffAgendas: any[] = [];
    try {
      const resp = await fetch(WWFF_AGENDAS_URL, {
        headers: { 'Accept': 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const raw = await resp.json();
        if (Array.isArray(raw)) {
          wwffAgendas = raw.map((a: any) => ({
            call: a.activator_call || '',
            activity_type: 'WWFF-ALERT',
            reference: a.reference || '',
            name: '',
            frequency: 0,
            mode: a.mode || '',
            spot_time: a.utc_start ? new Date(a.utc_start).toISOString() : null,
            comments: a.remarks || (a.band ? `Band: ${a.band}` : ''),
            spotter: a.poster || '',
            source: 'WWFF-Agenda',
            is_active: false,
            is_future: true,
          })).filter((s: any) => s.call && s.reference);
          console.log('[WWFF] Agendas received:', wwffAgendas.length);
        }
      }
    } catch (e: any) {
      console.log('[WWFF] Agendas fetch failed:', e.message);
    }

    // Alle Alerts kombiniert: DB-Alerts + SOTA-Alerts + WWFF-Agendas
    const allAlerts = [...dbAlerts, ...sotaAlerts, ...wwffAgendas];

    console.log('[Activities] Live:', liveSpots.length, 'Alerts:', allAlerts.length);

    return Response.json({
      success: true,
      liveSpots,
      alerts: allAlerts,
      liveTotal: liveSpots.length,
      alertsTotal: allAlerts.length,
      sotaAlertsAvailable,
      // Backward-compat: keep old fields for any other consumers
      sota: liveSpots.filter(s => s.activity_type === 'SOTA'),
      pota: liveSpots.filter(s => s.activity_type === 'POTA'),
      wwff: liveSpots.filter(s => s.activity_type === 'WWFF'),
      wwbota: liveSpots.filter(s => s.activity_type === 'WWBOTA'),
      gma: liveSpots.filter(s => s.activity_type === 'GMA'),
      other: liveSpots.filter(s => !['SOTA', 'POTA', 'WWFF', 'WWBOTA', 'GMA'].includes(s.activity_type)),
      total: liveSpots.length,
      futureTotal: allAlerts.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}