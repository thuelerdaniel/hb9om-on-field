import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";

// Lade WWBOTA-Spots von api.wwbota.org (NICHT api.wwbota.net!).
// freq ist in MHz — * 1000 fuer kHz.
// references[] ist ein Array — pro Referenz wird ein separater ActivitySpot erstellt.
// Parameter: age=2 (letzte 2 Stunden fuer mehr Spots).

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

    // Alte WWBOTA-Spots löschen (> 1 Std)
    const cutoff = new Date(Date.now() - ONE_HOUR_MS);
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({
        activity_type: 'WWBOTA',
        spot_time: { $lt: cutoff.toISOString() }
      });
    } catch {}

    // WWBOTA API laden — versuche age=2, dann age=6 falls leer
    let wwbotaSpots: any[] = [];
    let apiError: string | null = null;
    const ages = [body.age || 2, 6, 12];
    for (const age of ages) {
      try {
        const resp = await fetch(`https://api.wwbota.org/spots/?age=${age}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': UA },
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          wwbotaSpots = await resp.json();
          if (Array.isArray(wwbotaSpots) && wwbotaSpots.length > 0) break;
          if (!Array.isArray(wwbotaSpots)) wwbotaSpots = [];
        } else { apiError = `HTTP ${resp.status}`; }
      } catch (e: any) { apiError = e.message; }
    }

    if (wwbotaSpots.length === 0) {
      return Response.json({ success: true, fetched: 0, saved: 0, warning: apiError || 'Keine WWBOTA-Spots verfügbar' });
    }

    // Fix 8: Ein Record pro Spot (NICHT pro Referenz) — verhindert Duplikate.
    // Alle Referenzen werden kommasepariert im reference-Feld gespeichert.
    // Deduplikation: call + freq (gerundet) + sortierte Referenzen
    const seenKeys = new Set<string>();
    const records: any[] = [];
    for (const s of wwbotaSpots) {
      if (!s.call || !s.freq) continue;
      const frequency = Number(s.freq) * 1000; // MHz → kHz
      if (!frequency || isNaN(frequency)) continue;
      const band = deriveBand(frequency);
      const spotTime = s.time ? new Date(s.time) : new Date();
      const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
      const isActive = s.type === 'Live';
      const refs = Array.isArray(s.references) ? s.references : [];
      if (refs.length === 0) continue;

      // Alle Referenzen sammeln
      const refStrings = refs.map((r: any) => r.reference || '').filter(Boolean);
      const allRefs = refStrings.join(', ');
      const freqRounded = Math.round(frequency);
      const dedupKey = `${s.call}_${freqRounded}_${refStrings.sort().join(',')}`;

      // Fix 8: Duplikatserkennung — gleicher Call + gleiche Freq + gleiche Referenzen = 1x
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      // Erste Referenz für Koordinaten (alle Referenzen im reference-Feld)
      const firstRef = refs[0];
      const lat = firstRef?.lat != null ? Number(firstRef.lat) : undefined;
      const lon = firstRef?.long != null ? Number(firstRef.long) : undefined;
      let distance: number | null = null;
      let azimuth: number | null = null;
      if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
        distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lon));
        azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lon));
      }

      // Namen aller Referenzen sammeln
      const allNames = refs.map((r: any) => r.name || '').filter(Boolean).join('; ');

      records.push({
        call: s.call,
        activity_type: 'WWBOTA',
        reference: allRefs,
        name: allNames || firstRef?.name || '',
        locationDesc: firstRef?.type || '',
        frequency, band,
        mode: s.mode || '',
        latitude: lat, longitude: lon,
        grid6: firstRef?.locator || undefined,
        comments: s.comment || '',
        spotter: s.spotter || '',
        source: 'WWBOTA-API',
        spot_time: spotTime.toISOString(),
        age_seconds: ageSeconds,
        distance, azimuth,
        is_active: isActive,
      });
    }

    let savedCount = 0;
    if (records.length > 0) {
      try {
        await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records);
        savedCount = records.length;
      } catch {}
    }

    return Response.json({ success: true, fetched: wwbotaSpots.length, saved: savedCount });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}