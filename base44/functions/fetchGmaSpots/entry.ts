import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade GMA-Spots (Global Mountain Activity) über Spothole API.
// Die originale cqgma.org API ist rate-limited und liefert HTML-Fehlerseiten.
// Spothole aggregiert DX-Cluster + GMA-Spots als HTTP-JSON-API.
// Endpoint: https://spothole.app/api/v2/spots?sig=GMA&limit=100

const DEFAULT_LOCATOR = 'JN36FL';
const ONE_HOUR_MS = 60 * 60 * 1000;
const UA = 'HB9OM-On-Field/1.0';

function normalizeMode(apiMode: string, modeType: string): string {
  const mt = (modeType || '').toUpperCase();
  if (mt === 'USB' || mt === 'LSB') return 'SSB';
  if (mt === 'FT8') return 'FT8';
  if (mt === 'FT4') return 'FT4';
  if (mt === 'CW') return 'CW';
  if (mt === 'FM') return 'FM';
  if (mt) return mt;
  const m = (apiMode || '').toUpperCase();
  if (m === 'PHONE') return 'SSB';
  if (m === 'DIGI') return 'FT8';
  return apiMode || 'SSB';
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

    // GMA-Spots von Spothole laden
    let spotholeSpots: any[] = [];
    let apiWarning: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(
        'https://spothole.app/api/v2/spots?sig=GMA&limit=10000',
        { headers: { 'Accept': 'application/json', 'User-Agent': UA }, signal: controller.signal }
      );
      clearTimeout(timeout);
      if (resp.ok) {
        const raw = await resp.json();
        spotholeSpots = Array.isArray(raw) ? raw : [];
      } else { apiWarning = `Spothole API Status ${resp.status}`; }
    } catch (e: any) { apiWarning = `Spothole API nicht erreichbar: ${e.message}`; }

    if (spotholeSpots.length === 0) {
      return Response.json({ success: true, fetched: 0, saved: 0, warning: apiWarning || 'Keine GMA-Spots verfügbar' });
    }

    const now = Date.now();
    const records = spotholeSpots
      .map((s: any) => {
        const freqKHz = Math.round(Number(s.freq || 0) / 1000);
        const call = s.dx_call || '';
        if (!freqKHz || !call) return null;

        const spotTime = s.time_iso ? new Date(s.time_iso) : (s.time ? new Date(s.time * 1000) : new Date());
        const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));
        const comment = s.comment || '';
        const comments = comment ? [comment] : [];

        const sigRef = s.sig_refs?.[0];
        const reference = sigRef?.id || '';
        const refName = sigRef?.name || '';
        if (refName && !comments.includes(`GMA ${reference}: ${refName}`)) {
          comments.push(`GMA ${reference}: ${refName}`);
        }

        const locator = s.dx_grid || '';
        const dxLat = s.dx_latitude || (sigRef?.latitude ? Number(sigRef.latitude) : 0);
        const dxLng = s.dx_longitude || (sigRef?.longitude ? Number(sigRef.longitude) : 0);

        let dxPos: { lat: number; lon: number } | null = null;
        if (dxLat && dxLng) dxPos = { lat: Number(dxLat), lon: Number(dxLng) };
        else if (locator) dxPos = maidenheadToLatLon(locator);

        let distance: number | null = null;
        let azimuth: number | null = null;
        let lat: number | undefined = undefined;
        let lon: number | undefined = undefined;
        if (dxPos) {
          distance = Math.round(haversine(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon));
          azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon));
          lat = Math.round(dxPos.lat * 10000) / 10000;
          lon = Math.round(dxPos.lon * 10000) / 10000;
        }

        const isQRT = /\bQRT\b/i.test(comments.join(' '));
        return {
          call: String(call).toUpperCase().trim(),
          activity_type: 'GMA' as const,
          reference,
          name: refName,
          frequency: freqKHz,
          band: s.band || deriveBand(freqKHz),
          mode: normalizeMode(s.mode, s.mode_type),
          latitude: lat, longitude: lon,
          grid4: locator ? locator.substring(0, 4) : undefined,
          grid6: locator ? locator.substring(0, 6) : undefined,
          comments: comments.join(' '),
          spotter: s.de_call || '',
          source: 'Spothole (GMA)',
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
      } catch {
        for (const r of records) {
          try { await base44.asServiceRole.entities.ActivitySpot.create(r); savedCount++; } catch {}
        }
      }
    }

    // DataSourceStatus aktualisieren
    try {
      const existing = await base44.asServiceRole.entities.DataSourceStatus.filter({ source_name: 'GMA (Spothole)' });
      const statusData = {
        source_name: 'GMA (Spothole)',
        source_type: 'API' as const,
        url: 'https://spothole.app/api/v2/spots?sig=GMA',
        status: apiWarning ? 'WARN' as const : (savedCount > 0 ? 'OK' as const : 'FAIL' as const),
        last_check: new Date().toISOString(),
        last_success: savedCount > 0 ? new Date().toISOString() : null,
        spots_received: savedCount,
        error_message: apiWarning || null,
        is_active: true,
      };
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.DataSourceStatus.update(existing[0].id, statusData);
      } else {
        await base44.asServiceRole.entities.DataSourceStatus.create(statusData);
      }
    } catch {}

    return Response.json({ success: true, fetched: spotholeSpots.length, saved: savedCount, warning: apiWarning });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}