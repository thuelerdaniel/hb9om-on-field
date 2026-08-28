import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade WWFF-Spots von spots.wwff.co und speichere in ActivitySpot.
// frequency_khz ist bereits in kHz — keine Konvertierung noetig.
// spot_time ist Unix-Timestamp (Sekunden) — * 1000 fuer JS Date.
// Polling: alle 30 Sekunden (empfohlen von WWFF).

const DEFAULT_LOCATOR = 'JN36FL';
const ONE_HOUR_MS = 60 * 60 * 1000;
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

    // Alte WWFF-Spots löschen (> 1 Std)
    const cutoff = new Date(Date.now() - ONE_HOUR_MS);
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        activity_type: 'WWFF',
        spot_time: { $lt: cutoff.toISOString() }
      });
    } catch {}

    // WWFF API laden
    let wwffSpots: any[] = [];
    let apiError: string | null = null;
    try {
      const resp = await fetch('https://spots.wwff.co/static/spots.json', {
        headers: { 'Accept': 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        wwffSpots = await resp.json();
        if (!Array.isArray(wwffSpots)) wwffSpots = [];
      } else { apiError = `HTTP ${resp.status}`; }
    } catch (e: any) { apiError = e.message; }

    if (wwffSpots.length === 0) {
      return Response.json({ success: true, fetched: 0, saved: 0, warning: apiError || 'Keine WWFF-Spots verfügbar' });
    }

    // WwffPoint-Koordinaten für Referenzen ohne API-Koordinaten vorab laden
    const refsNeedingCoords = new Set<string>();
    for (const s of wwffSpots) {
      const lat = Number(s.latitude);
      const lon = Number(s.longitude);
      if ((isNaN(lat) || isNaN(lon)) && s.reference) refsNeedingCoords.add(s.reference);
    }
    const wwffCoordMap = new Map<string, { lat: number; lon: number }>();
    for (const ref of refsNeedingCoords) {
      try {
        const points = await base44.asServiceRole.entities.WwffPoint.filter({ code: ref });
        if (points && points.length > 0 && points[0].lat != null) {
          wwffCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng) });
        }
      } catch {}
    }

    const records = wwffSpots
      .filter((s: any) => s.activator && s.frequency_khz)
      .map((s: any) => {
        const frequency = Number(s.frequency_khz); // bereits kHz
        if (!frequency || isNaN(frequency)) return null;
        const band = deriveBand(frequency);
        const spotTime = s.spot_time ? new Date(s.spot_time * 1000) : (s.spot_time_formatted ? new Date(s.spot_time_formatted) : new Date());
        const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
        let lat = Number(s.latitude);
        let lon = Number(s.longitude);

        if ((isNaN(lat) || isNaN(lon)) && s.reference) {
          const fallback = wwffCoordMap.get(s.reference);
          if (fallback) { lat = fallback.lat; lon = fallback.lon; }
        }

        let distance: number | null = null;
        let azimuth: number | null = null;
        if (!isNaN(lat) && !isNaN(lon)) {
          distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lon));
          azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lon));
        }

        const comments = s.remarks || '';
        const isQRT = /\bQRT\b/i.test(comments);
        return {
          call: s.activator,
          activity_type: 'WWFF',
          reference: s.reference || '',
          name: s.reference_name || '',
          frequency, band,
          mode: s.mode || 'SSB',
          latitude: !isNaN(lat) ? lat : undefined,
          longitude: !isNaN(lon) ? lon : undefined,
          comments,
          spotter: s.spotter || '',
          source: 'WWFF-Spotline',
          spot_time: spotTime.toISOString(),
          age_seconds: ageSeconds,
          distance, azimuth,
          is_active: !isQRT,
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

    return Response.json({ success: true, fetched: wwffSpots.length, saved: savedCount });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}