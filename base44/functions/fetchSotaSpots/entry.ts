import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade SOTA-Spots von api2.sota.org.uk und speichere in ActivitySpot.
// HINWEIS: api2.sota.org.uk ist deprecated vor 31. Aug 2026.
// Falls nicht erreichbar: return success mit 0 spots (POTA + DX-Spot Kommentarerkenntung bleibt aktiv).
// Löscht vorher SOTA-Einträge älter als 1 Stunde.

const DEFAULT_LOCATOR = 'JN36FL';
const ONE_HOUR_MS = 60 * 60 * 1000;

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

    // Alte SOTA-Spots löschen (> 1 Std)
    const cutoff = new Date(Date.now() - ONE_HOUR_MS);
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        activity_type: 'SOTA',
        spot_time: { $lt: cutoff.toISOString() }
      });
    } catch {}

    // === SCHEDULED ACTIVATIONS MODE ===
    if (body.scheduled === true) {
      let scheduledSpots: any[] = [];
      let apiError: string | null = null;

      // Fix 11: SOTA Scheduled API — mit CORS-Proxy Fallback und korrekten Headern
      const baseUrl = 'https://api2.sota.org.uk/api/scheduled_activations';
      const scheduledUrls = [
        body.date ? `${baseUrl}?date=${body.date}` : baseUrl,
        body.date ? `${baseUrl}?year=${new Date().getFullYear()}` : `${baseUrl}?year=${new Date().getFullYear()}`,
        'https://api2.sota.org.uk/api/scheduled/',  // Alternative Endpunkt (mit trailing slash)
        `https://corsproxy.io/?url=${encodeURIComponent(baseUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(baseUrl)}`,
      ];
      for (let attempt = 1; attempt <= 3; attempt++) {
        const url = scheduledUrls[Math.min(attempt - 1, scheduledUrls.length - 1)];
        try {
          const resp = await fetch(url, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-Online/1.0', 'Origin': 'https://hb9om.online' },
            signal: AbortSignal.timeout(15000),
          });
          if (resp.ok) {
            const raw = await resp.json();
            scheduledSpots = Array.isArray(raw) ? raw : [];
            console.log(`[SOTA Scheduled] HTTP ${resp.status}, Datensätze: ${scheduledSpots.length}`);
            break;
          } else {
            apiError = `HTTP ${resp.status}`;
            console.warn(`[SOTA Scheduled] Attempt ${attempt} (${url.split('?')[0]}): ${apiError}`);
          }
        } catch (e: any) {
          apiError = e.message || 'SOTA Scheduled API nicht erreichbar';
          console.warn(`[SOTA Scheduled] Attempt ${attempt} (${url.split('?')[0]}): ${apiError}`);
        }
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }

      if (scheduledSpots.length === 0) {
        return Response.json({
          success: false,
          warning: 'SOTA Scheduled API temporär nicht erreichbar. Bitte später erneut versuchen.',
          spots: [],
          apiError,
        });
      }

      // Parse + mit SotaPoint-Datenbank verknüpfen für Koordinaten
      const records: any[] = [];
      for (const s of scheduledSpots) {
        const summitCode = s.summit_code || s.summitCode || '';
        const associationCode = s.association_code || s.associationCode || '';
        const ref = summitCode ? `${associationCode}/${summitCode}` : '';

        let lat: number | undefined;
        let lon: number | undefined;
        if (ref) {
          try {
            const points = await base44.asServiceRole.entities.SotaPoint.filter({ code: ref });
            if (points && points.length > 0 && points[0].lat != null) {
              lat = Number(points[0].lat);
              lon = Number(points[0].lng);
            }
          } catch {}
        }

        const frequency = s.frequency ? Number(s.frequency) * 1000 : null;
        const rec: any = {
          call: s.callsign || s.activator_callsign || '',
          activity_type: 'SOTA',
          reference: ref,
          name: s.summit_details || s.summitDetails || '',
          frequency,
          band: frequency ? deriveBand(frequency) : '',
          mode: s.mode || 'CW',
          latitude: lat,
          longitude: lon,
          spot_time: s.activation_date ? new Date(s.activation_date).toISOString() : new Date().toISOString(),
          source: 'SOTA Scheduled',
          is_active: true,
        };
        if (rec.call && rec.frequency) records.push(rec);
      }

      let savedCount = 0;
      if (records.length > 0) {
        try {
          await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records);
          savedCount = records.length;
        } catch {}
      }

      return Response.json({
        success: true,
        fetched: scheduledSpots.length,
        saved: savedCount,
        spots: records,
      });
    }

    // Fix 7: SOTA API laden — alle aktiven Spots (nicht nur 50)
    let sotaSpots: any[] = [];
    let apiError: string | null = null;
    try {
      const resp = await fetch('https://api2.sota.org.uk/api/spots/all', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-Online/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const raw = await resp.json();
        sotaSpots = Array.isArray(raw) ? raw.filter((s: any) => s.callsign !== 'DEPRECATED' && s.activatorCallsign !== 'DEPRECATED') : [];
        console.log(`[SOTA] API OK, ${sotaSpots.length} Spots geladen`);
      } else {
        apiError = `HTTP ${resp.status}`;
        console.error(`[SOTA] API Fehler: ${apiError}`);
      }
    } catch (e: any) {
      apiError = e.message || 'SOTA API nicht erreichbar';
      console.error(`[SOTA] API Fehler: ${apiError}`);
    }

    if (sotaSpots.length === 0) {
      return Response.json({
        success: true,
        fetched: 0,
        saved: 0,
        warning: apiError || 'Keine SOTA-Spots verfügbar (API deprecated)',
        stationPos: { lat: stationPos.lat, lon: stationPos.lon },
      });
    }

    // FIX 2: SotaPoint-Koordinaten für Referenzen ohne Locator vorab laden
    const refsNeedingCoords = new Set<string>();
    for (const s of sotaSpots) {
      const comments = s.comments || s.comment || '';
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

    // In ActivitySpot speichern
    const records = sotaSpots
      .filter((s: any) => s.activatorCallsign && s.frequency)
      .map((s: any) => {
        const frequency = Number(s.frequency) * 1000; // MHz → kHz
        if (!frequency || isNaN(frequency)) return null;
        const band = deriveBand(frequency);
        const spotTime = s.timeStamp ? new Date(s.timeStamp) : new Date();
        const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);

        // Koordinaten: Locator → SotaPoint-Fallback
        let lat: number | undefined;
        let lon: number | undefined;
        let grid6: string | undefined;
        const comments = s.comments || s.comment || '';
        const locator = extractLocator(comments);
        if (locator) {
          const pos = maidenheadToLatLon(locator);
          if (pos) { lat = pos.lat; lon = pos.lon; grid6 = locator; }
        }
        // FIX 2: SotaPoint-Fallback falls kein Locator
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
          frequency,
          band,
          mode: s.mode || 'CW',
          latitude: lat,
          longitude: lon,
          grid6,
          comments,
          spotter: s.spotterCallsign || '',
          source: 'SOTA API',
          spot_time: spotTime.toISOString(),
          age_seconds: ageSeconds,
          distance,
          azimuth,
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

    return Response.json({
      success: true,
      fetched: sotaSpots.length,
      saved: savedCount,
      stationPos: { lat: stationPos.lat, lon: stationPos.lon },
      usingGps: typeof body.station_lat === 'number',
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}