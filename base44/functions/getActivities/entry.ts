import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Lade alle ActivitySpot-Einträge (sort -spot_time, limit 500).
// Gruppiert nach activity_type: { sota, pota, wwff, wwbota, gma, alerts, other, total }
// Wenn include_future=true: zusaetzlich SOTA-Alerts von der SOTA API.
// Fix v0.9015: korrekte API-Endpunkte api-db2.sota.org.uk mit ?client=sotawatch&user=anon

const SOTA_BASE = 'https://api-db2.sota.org.uk';
const UA = 'HB9OM-On-Field/1.0';
const SPOTS_QUERY = '?client=sotawatch&user=anon';

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
      // Fix v0.9015: korrekte URL /api/spots/200/all/all?client=sotawatch&user=anon
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
            // Fix v0.9015: KEINE Deprecation-Warning, nur RBNHOLE filtern
            const sotaSpots = Array.isArray(raw) ? raw.filter((s: any) =>
              s.activatorCallsign && s.frequency &&
              s.callsign !== 'RBNHOLE' &&
              s.type !== 'DEPRECATED'
            ) : [];
            console.log('[SOTA] Live spots received:', sotaSpots.length);
            // Fix v0.9015: SotaPoint-Lookup nur für Spots ohne lat/lon
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
            liveSota = sotaSpots.map((s: any) => {
              // Fix v0.9015: frequency ist NUMMER, summitCode = komplette Referenz
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
                // Fix v0.9015: lat/lon direkt im Spot
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
            break;
          }
        } catch {}
      }
    }

    // SOTA-Alerts (geplante Aktivierungen)
    let futureAlerts: any[] = [];
    let sotaAlertsAvailable = false;
    if (includeFuture) {
      const alertUrl = `${SOTA_BASE}/api/alerts${SPOTS_QUERY}`;
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
            // Fix v0.9015: KEINE Deprecation-Warning, "Unrecognized summit" filtern
            const alertList = Array.isArray(raw) ? raw.filter((a: any) =>
              a.activatingCallsign &&
              a.summitDetails !== 'Unrecognized summit'
            ) : [];
            // Fix v0.9015: Alerts haben associationCode + summitCode GETRENNT
            const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
            for (const a of alertList.slice(0, 300)) {
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
            futureAlerts = alertList.slice(0, 300).map((a: any) => {
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
              };
            }).filter((s: any) => s.call);
            break;
          }
        } catch {}
      }
    }

    // Fix 2: SOTA Spots + Alerts kombiniert für SOTA-Tab
    // LIVE Spots zuerst (nach Zeit absteigend), dann ALERTS (nach dateActivated aufsteigend)
    const combinedSota = [
      ...liveSota.map((s: any) => ({ ...s, spot_type: 'LIVE' })),
      ...futureAlerts.map((a: any) => ({ ...a, spot_type: 'ALERT', is_future: true })),
    ].sort((a, b) => {
      const aLive = a.spot_type === 'LIVE';
      const bLive = b.spot_type === 'LIVE';
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      if (aLive) {
        return new Date(b.spot_time || 0).getTime() - new Date(a.spot_time || 0).getTime();
      }
      return new Date(a.spot_time || 0).getTime() - new Date(b.spot_time || 0).getTime();
    });

    console.log('[SOTA] Spots:', liveSota.length, 'Alerts:', futureAlerts.length, 'Total:', combinedSota.length);

    return Response.json({
      success: true,
      sota: combinedSota,
      pota,
      wwff,
      wwbota,
      gma,
      alerts: [...alerts, ...futureAlerts],
      other,
      sotaAlertsAvailable,
      total: combinedSota.length,
      futureTotal: futureAlerts.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}