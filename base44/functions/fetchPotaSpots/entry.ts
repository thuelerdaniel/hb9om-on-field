import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade POTA-Spots von api.pota.app und speichere in ActivitySpot.
// Löscht vorher POTA-Einträge älter als 1 Stunde.

const DEFAULT_LOCATOR = 'JN36FL';
const ONE_HOUR_MS = 60 * 60 * 1000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Station-Position: GPS vom Client hat Vorrang
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

    // Alte POTA-Spots löschen (> 1 Std)
    const cutoff = new Date(Date.now() - ONE_HOUR_MS);
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        activity_type: 'POTA',
        spot_time: { $lt: cutoff.toISOString() }
      });
    } catch {}

    // POTA API laden
    let potaSpots: any[] = [];
    try {
      const resp = await fetch('https://api.pota.app/v1/spots', {
        headers: { 'Accept': 'application/json' },
      });
      if (resp.ok) {
        potaSpots = await resp.json();
      }
    } catch {}

    if (potaSpots.length === 0) {
      return Response.json({ success: true, fetched: 0, saved: 0, message: 'Keine POTA-Spots verfügbar' });
    }

    // In ActivitySpot speichern
    const records = potaSpots
      .filter((s: any) => s.activator && s.frequency)
      .map((s: any) => {
        const frequency = Number(s.frequency) / 1000; // POTA API gibt Hz zurück → kHz
        const band = deriveBand(frequency);
        const spotTime = s.spotTime ? new Date(s.spotTime) : new Date();
        const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
        const lat = Number(s.latitude);
        const lon = Number(s.longitude);

        let distance: number | null = null;
        let azimuth: number | null = null;
        if (!isNaN(lat) && !isNaN(lon)) {
          distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lon));
          azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lon));
        }

        return {
          call: s.activator,
          activity_type: 'POTA',
          reference: s.reference || '',
          name: s.name || '',
          locationDesc: s.locationDesc || s.location || '',
          frequency,
          band,
          mode: s.mode || 'SSB',
          latitude: !isNaN(lat) ? lat : undefined,
          longitude: !isNaN(lon) ? lon : undefined,
          comments: s.comments || s.comment || '',
          spotter: s.spotter || '',
          source: 'POTA API',
          spot_time: spotTime.toISOString(),
          age_seconds: ageSeconds,
          distance,
          azimuth,
          count: s.count != null ? Number(s.count) : undefined,
          is_active: true,
        };
      })
      .filter((r: any) => r.call && r.frequency);

    let savedCount = 0;
    if (records.length > 0) {
      try {
        await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records);
        savedCount = records.length;
      } catch {}
    }

    return Response.json({
      success: true,
      fetched: potaSpots.length,
      saved: savedCount,
      stationPos: { lat: stationPos.lat, lon: stationPos.lon },
      usingGps: typeof body.station_lat === 'number',
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}