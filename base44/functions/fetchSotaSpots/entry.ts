import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade SOTA-Spots von api-db2.sota.org.uk (NEUE korrekte Domain — api2 ist DEPRECATED).
// Fix v0.9015: korrekte API-Endpunkte aus SOTAWatch3 Source-Code extrahiert.
//   Spots:  /api/spots/200/all/all?client=sotawatch&user=anon
//   Alerts: /api/alerts?client=sotawatch&user=anon
// Mode 1 (default): Live Spots
// Mode 2 (body.alerts=true): SOTA Alerts (geplante Aktivierungen)
// User-Agent: "HB9OM-On-Field/1.0"

const SOTA_BASE = 'https://api-db2.sota.org.uk';
const DEFAULT_LOCATOR = 'JN36FL';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const UA = 'HB9OM-On-Field/1.0';
const SPOTS_QUERY = '?client=sotawatch&user=anon';

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
            const raw = await resp.json();
            // Fix v0.9015: api-db2 hat KEINE Deprecation-Warning mehr.
            // Filter nur RBNHOLE und "Unrecognized summit"
            alerts = Array.isArray(raw) ? raw.filter((a: any) =>
              a.activatingCallsign &&
              a.summitDetails !== 'Unrecognized summit'
            ) : [];
            break;
          } else { apiError = `HTTP ${resp.status}`; }
        } catch (e: any) { apiError = e.message; }
      }

      if (alerts.length === 0) {
        return Response.json({ success: false, warning: apiError || 'Keine SOTA-Alerts verfügbar', alerts: [] });
      }

      // SotaPoint-Koordinaten vorab laden (Alerts haben KEINE lat/lon im Response)
      const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
      for (const a of alerts.slice(0, 300)) {
        // Fix v0.9015: Alerts haben associationCode + summitCode GETRENNT
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

      const records = alerts.slice(0, 300).map((a: any) => {
        // Fix v0.9015: Alerts haben associationCode + summitCode GETRENNT
        const ref = a.associationCode && a.summitCode ? `${a.associationCode}/${a.summitCode}` : '';
        const coords = refCoordMap.get(ref);
        // Fix v0.9015: frequency bei Alerts ist STRING (z.B. "7.032-cw-7.144-ssb...")
        const freqNum = a.frequency ? parseFloat(String(a.frequency)) : NaN;
        const frequency = !isNaN(freqNum) ? freqNum * 1000 : 0;
        return {
          call: a.activatingCallsign || '',
          activity_type: 'SOTA-ALERT',
          reference: ref,
          name: a.summitDetails || coords?.name || '',
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
          is_active: false,
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
    // Alte SOTA-Spots löschen (> 24 Std) — akkumuliert Spots über den ganzen Tag
    const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        activity_type: 'SOTA',
        spot_time: { $lt: cutoff.toISOString() }
      });
    } catch {}

    let sotaSpots: any[] = [];
    let apiError: string | null = null;
    // Fix v0.9015: korrekte URL /api/spots/200/all/all?client=sotawatch&user=anon
    // DREI Pfadsegmente: count/filter/sort + Query-Parameter erforderlich
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
          // Fix v0.9030: BEIDE Spot-Typen anzeigen — NORMAL (manuell) + RBNHOLE (automatisch).
          // RBNHole-Spots haben callsign="RBNHOLE" und type=null, comments mit SNR/WPM Info.
          // Nur DEPRECATED-Typ herausfiltern.
          sotaSpots = Array.isArray(raw) ? raw.filter((s: any) =>
            s.type !== 'DEPRECATED'
          ) : [];
          console.log('[SOTA] Spots received (NORMAL + RBNHOLE):', sotaSpots.length);
          break;
        } else { apiError = `HTTP ${resp.status}`; }
      } catch (e: any) { apiError = e.message; }
    }

    if (sotaSpots.length === 0) {
      return Response.json({ success: true, fetched: 0, saved: 0, warning: apiError || 'Keine SOTA-Spots verfügbar' });
    }

    // Fix v0.9015: api-db2 liefert latitude/longitude FÜR DEN SUMMIT direkt im Spot.
    // SotaPoint-Lookup nur noch als Fallback falls Koordinaten fehlen.
    const refsNeedingCoords = new Set<string>();
    for (const s of sotaSpots) {
      if (s.latitude == null || s.longitude == null) {
        const comments = s.comments || '';
        const locator = extractLocator(comments);
        // Fix v0.9015: summitCode bei Spots = KOMPLETTE Referenz (z.B. "DM/BW-015")
        const ref = s.summitCode || '';
        if (!locator && ref) refsNeedingCoords.add(ref);
      }
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
        // Fix v0.9015: frequency ist NUMMER (z.B. 144.31)
        const frequency = Number(s.frequency) * 1000;
        if (!frequency || isNaN(frequency)) return null;
        const band = deriveBand(frequency);
        const spotTime = s.timeStamp ? new Date(s.timeStamp) : new Date();
        const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
        const comments = s.comments || '';
        const isQRT = /\bQRT\b/i.test(comments);
        const locator = extractLocator(comments);
        // Fix v0.9015: latitude/longitude direkt im Spot verfügbar!
        let lat: number | undefined = s.latitude != null ? Number(s.latitude) : undefined;
        let lon: number | undefined = s.longitude != null ? Number(s.longitude) : undefined;
        let grid6: string | undefined;
        if ((lat == null || lon == null) && locator) {
          const pos = maidenheadToLatLon(locator);
          if (pos) { lat = pos.lat; lon = pos.lon; grid6 = locator; }
        }
        if ((lat == null || lon == null) && s.summitCode) {
          const fallback = sotaCoordMap.get(s.summitCode);
          if (fallback) { lat = fallback.lat; lon = fallback.lon; }
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
          // Fix v0.9015: summitCode = KOMPLETTE Referenz (z.B. "DM/BW-015")
          reference: s.summitCode || '',
          // Fix v0.9015: summitName ist separates Feld
          name: s.summitName || s.summitDetails || '',
          locationDesc: s.associationName || '',
          frequency, band,
          mode: s.mode || 'CW',
          latitude: lat, longitude: lon, grid6,
          comments,
          spotter: s.callsign || '',
          source: 'SOTA API',
          spot_time: spotTime.toISOString(),
          age_seconds: ageSeconds,
          distance, azimuth,
          is_active: !isQRT,
        };
      })
      .filter((r: any) => r !== null && r.call && r.frequency);

    // Deduplikation: existierende SOTA-Spots laden, nur neue erstellen
    let savedCount = 0;
    if (records.length > 0) {
      try {
        const existing = await base44.asServiceRole.entities.ActivitySpot.filter({ activity_type: 'SOTA' });
        const existingKeys = new Set(
          (existing || []).map((e: any) => `${e.call}|${e.frequency}|${e.spot_time}`)
        );
        const newRecords = records.filter((r: any) =>
          !existingKeys.has(`${r.call}|${r.frequency}|${r.spot_time}`)
        );
        if (newRecords.length > 0) {
          await base44.asServiceRole.entities.ActivitySpot.bulkCreate(newRecords);
          savedCount = newRecords.length;
        }
      } catch {}
    }

    return Response.json({ success: true, fetched: sotaSpots.length, saved: savedCount });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}