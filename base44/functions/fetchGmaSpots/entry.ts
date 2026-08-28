import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade GMA-Spots (Global Mountain Activity) von cqgma.org.
// Endpoint: https://cqgma.org/api/spots/dspgma25.php
// Polling: alle 60 Sekunden.

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

    // Alte GMA-Spots löschen (> 1 Std)
    const cutoff = new Date(Date.now() - ONE_HOUR_MS);
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        activity_type: 'GMA',
        spot_time: { $lt: cutoff.toISOString() }
      });
    } catch {}

    // GMA API laden
    let gmaSpots: any[] = [];
    let apiError: string | null = null;
    try {
      const resp = await fetch('https://cqgma.org/api/spots/dspgma25.php', {
        headers: { 'Accept': 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const raw = await resp.json();
        gmaSpots = Array.isArray(raw) ? raw : (raw.spots || []);
      } else { apiError = `HTTP ${resp.status}`; }
    } catch (e: any) { apiError = e.message; }

    if (gmaSpots.length === 0) {
      return Response.json({ success: true, fetched: 0, saved: 0, warning: apiError || 'Keine GMA-Spots verfügbar' });
    }

    const records = gmaSpots
      .map((s: any) => {
        const call = s.activator || s.call || s.callsign || '';
        const ref = s.reference || s.ref || s.summit || '';
        const freqStr = String(s.frequency || s.freq || '');
        const frequency = parseFloat(freqStr) * 1000; // MHz → kHz
        if (!call || !frequency || isNaN(frequency)) return null;
        const band = deriveBand(frequency);
        const spotTime = s.time || s.timestamp ? new Date(s.time || s.timestamp) : new Date();
        const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
        const lat = s.lat != null ? Number(s.lat) : (s.latitude != null ? Number(s.latitude) : undefined);
        const lon = s.lon != null ? Number(s.lon) : (s.longitude != null ? Number(s.longitude) : undefined);

        let distance: number | null = null;
        let azimuth: number | null = null;
        if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
          distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lon));
          azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lon));
        }

        return {
          call,
          activity_type: 'GMA',
          reference: ref,
          name: s.name || s.summit_name || '',
          frequency, band,
          mode: s.mode || 'SSB',
          latitude: lat, longitude: lon,
          comments: s.comments || s.remarks || '',
          spotter: s.spotter || '',
          source: 'GMA-Feed',
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

    return Response.json({ success: true, fetched: gmaSpots.length, saved: savedCount });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}