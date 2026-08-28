import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade SOTA-Spots von api-db2.sota.org.uk (NEUE Domain — api2 ist DEPRECATED).
// Mode 1 (default): Live Spots von /api/spots/2/all (letzte 2 Stunden)
// Mode 2 (body.alerts=true): SOTA Alerts von /api/alerts (geplante Aktivierungen)
// Filtert Deprecation-Warning (id=9999999999999999).
// User-Agent: "HB9OM-On-Field/1.0"

const SOTA_BASE = 'https://api-db2.sota.org.uk';
const DEFAULT_LOCATOR = 'JN36FL';
const ONE_HOUR_MS = 60 * 60 * 1000;
const UA = 'HB9OM-On-Field/1.0';

function extractLocator(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b([A-R]{2}[0-9]{2}[a-x]{2,})\b/i);
  return match ? match[1].toUpperCase() : null;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true && body.alerts !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Station-Position
    let stationPos: { lat: number; lon: number };
    if (typeof body.station_lat === 'number' && typeof body.station_lng === 'number') {
      stationPos = { lat: body.station_lat, lon: body.station_lng };
    } else {
      let stationLocator = DEFAULT_LOCATOR;
      try {
        const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'station_info' });
        if (settings && settings.length > 0) {
          const info = JSON.parse(settings[0].value || '{}');
          if (info.locator) stationLocator = info.locator.toUpperCase();
        }
      } catch {}
      stationPos = maidenheadToLatLon(stationLocator) || { lat: 46.5, lon: 6.5 };
    }

    // === ALERTS MODE — SOTA Alerts (geplante Aktivierungen) ===
    if (body.alerts === true) {
      // Alte SOTA-Alerts löschen
      try {
        await base44.asServiceRole.entities.ActivitySpot.deleteMany({ activity_type: 'SOTA-ALERT' as any });
      } catch {}

      let alerts: any[] = [];
      let apiError: string | null = null;
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
            const raw = await resp.json();
            alerts = Array.isArray(raw) ? raw.filter((s: any) => s.id !== 9999999999999999 && s.callsign !== 'DEPRECATED') : [];
            break;
          } else { apiError = `HTTP ${resp.status}`; }
        } catch (e: any) { apiError = e.message; }
      }

      if (alerts.length === 0) {
        return Response.json({ success: false, warning: apiError || 'Keine SOTA-Alerts verfügbar', alerts: [] });
      }

      // SotaPoint-Koordinaten vorab laden
      const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
      for (const a of alerts.slice(0, 200)) {
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

      const records = alerts.slice(0, 200).map((a: any) => {
        const summitCode = a.summitCode || a.summit_code || '';
        const assocCode = a.associationCode || a.association_code || '';
        const ref = summitCode ? `${assocCode}/${summitCode}` : '';
        const coords = refCoordMap.get(ref);
        const frequency = a.frequency ? Number(a.frequency) * 1000 : null;
        return {
          call: a.activatingCallsign || a.activator_callsign || a.callsign || '',
          activity_type: 'SOTA-ALERT',
          reference: ref,
          name: a.summitDetails || a.summit_details || coords?.name || '',
          frequency,
          band: frequency ? deriveBand(frequency) : '',
          mode: a.mode || '',
          latitude: coords?.lat,
          longitude: coords?.lon,
          comments: a.comments || '',
          spotter: a.posterCallsign || '',
          source: 'SOTA-Alerts',
          spot_time: a.dateActivated ? new Date(a.dateActivated).toISOString() : new Date().toISOString(),
          is_future: true,
          is_active: true,
        };
      }).filter((r: any) => r.call);

      let savedCount = 0;
      if (records.length > 0) {
        try {
          await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records);
          savedCount = records.length;
        } catch {}
      }

      return Response.json({ success: true, fetched: alerts.length, saved: savedCount, alerts: records });
    }

    // === LIVE SPOTS MODE ===
    // Alte SOTA-Spots löschen (> 1 Std)
    const cutoff = new Date(Date.now() - ONE_HOUR_MS);
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        activity_type: 'SOTA',
        spot_time: { $lt: cutoff.toISOString() }
      });
    } catch {}

    let sotaSpots: any[] = [];
    let apiError: string | null = null;
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
          sotaSpots = Array.isArray(raw) ? raw.filter((s: any) => s.id !== 9999999999999999 && s.callsign !== 'DEPRECATED' && s.activatorCallsign !== 'DEPRECATED') : [];
          break;
        } else { apiError = `HTTP ${resp.status}`; }
      } catch (e: any) { apiError = e.message; }
    }

    if (sotaSpots.length === 0) {
      return Response.json({ success: true, fetched: 0, saved: 0, warning: apiError || 'Keine SOTA-Spots verfügbar' });
    }

    // SotaPoint-Koordinaten vorab laden
    const refsNeedingCoords = new Set<string>();
    for (const s of sotaSpots) {
      const comments = s.comments || '';
      const locator = extractLocator(comments);
      const ref = s.summitCode ? `${s.associationCode || ''}/${s.summitCode}` : '';
      if (!locator && ref) refsNeedingCoords.add(ref);
    }
    const sotaCoordMap = new Map<string, { lat: number; lon: number }>();
    for (const ref of refsNeedingCoords) {
      try {
        const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
        if (points && points.length > 0 && points[0].lat != null) {
          sotaCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng) });
        }
      } catch {}
    }

    const records = sotaSpots
      .filter((s: any) => s.activatorCallsign && s.frequency)
      .map((s: any) => {
        const frequency = Number(s.frequency) * 1000;
        if (!frequency || isNaN(frequency)) return null;
        const band = deriveBand(frequency);
        const spotTime = s.timeStamp ? new Date(s.timeStamp) : new Date();
        const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
        const comments = s.comments || '';
        const locator = extractLocator(comments);
        let lat: number | undefined;
        let lon: number | undefined;
        let grid6: string | undefined;
        if (locator) {
          const pos = maidenheadToLatLon(locator);
          if (pos) { lat = pos.lat; lon = pos.lon; grid6 = locator; }
        }
        if (lat == null || lon == null) {
          const ref = s.summitCode ? `${s.associationCode || ''}/${s.summitCode}` : '';
          if (ref) {
            const fallback = sotaCoordMap.get(ref);
            if (fallback) { lat = fallback.lat; lon = fallback.lon; }
          }
        }
        let distance: number | null = null;
        let azimuth: number | null = null;
        if (lat != null && lon != null) {
          distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lon));
          azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lon));
        }
        return {
          call: s.activatorCallsign,
          activity_type: 'SOTA',
          reference: s.summitCode ? `${s.associationCode || ''}/${s.summitCode}` : '',
          name: s.summitDetails || '',
          locationDesc: s.associationName || '',
          frequency, band,
          mode: s.mode || 'CW',
          latitude: lat, longitude: lon, grid6,
          comments,
          spotter: s.spotterCallsign || '',
          source: 'SOTA API',
          spot_time: spotTime.toISOString(),
          age_seconds: ageSeconds,
          distance, azimuth,
          is_active: true,
        };
      })
      .filter((r: any) => r !== null && r.call && r.frequency);

    let savedCount = 0;
    if (records.length > 0) {
      try {
        await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records);
        savedCount = records.length;
      } catch {}
    }

    return Response.json({ success: true, fetched: sotaSpots.length, saved: savedCount });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}