import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";
import { isInternalCall } from "../../shared/internalAuth.ts";

// Lade DX-Spots von jo30.de (DX-Cluster) + Spothole (SIG-gefiltert: SOTA, POTA, WWFF, etc.)
// Spothole liefert sig + sig_refs mit Referenz-Name und Koordinaten.
// Merge: Spothole-Spots reichern jo30.de-Spots mit Activity-Daten an.

const DEFAULT_LOCATOR = 'JN36FL';

const SPOTHOLE_SIGS = 'POTA,SOTA,WWFF,WWBOTA,GMA,WCA,MOTA,Towers,IOTA,ARLHS,ILLW,HEMA';
const SIG_MAP: Record<string, string> = {
  'SOTA': 'SOTA', 'POTA': 'POTA', 'WWFF': 'WWFF', 'WWBOTA': 'WWBOTA',
  'GMA': 'GMA', 'WCA': 'WCA', 'MOTA': 'MOTA', 'Towers': 'TOTA',
  'IOTA': 'IOTA', 'ARLHS': 'LOTA', 'ILLW': 'LOTA', 'HEMA': 'HEMA',
};

function normalizeMode(apiMode: string, submode: string): string {
  const sub = (submode || '').toUpperCase();
  if (sub === 'USB' || sub === 'LSB') return 'SSB';
  if (sub === 'FT8') return 'FT8';
  if (sub === 'FT4') return 'FT4';
  if (sub === 'CW') return 'CW';
  if (sub === 'FM') return 'FM';
  if (sub) return sub;
  const m = (apiMode || '').toUpperCase();
  if (m === 'PHONE') return 'SSB';
  if (m === 'DIGI') return 'FT8';
  if (m === 'CW') return 'CW';
  return apiMode || 'Unknown';
}

// FIX 5: Verbesserte Aktivitätserkennung aus Kommentaren
function detectActivity(comments: string[]): string {
  if (!comments || !comments.length) return '';
  const text = comments.join(' ').toUpperCase();
  if (text.includes('SOTA')) return 'SOTA';
  if (text.includes('POTA')) return 'POTA';
  if (text.includes('WWFF') || text.includes('WCA')) return 'WWFF';
  if (text.includes('IOTA')) return 'IOTA';
  // SOTA Summit-Code Pattern: z.B. W7Y/TT-161, G/SP-001, OE/ST-003
  const sotaPattern = /\b([A-Z0-9]{1,4}\/[A-Z]{2}-\d{3})\b/;
  if (sotaPattern.test(text)) return 'SOTA';
  // POTA Reference Pattern: 2 Buchstaben-Bindestrich-Zahl, z.B. US-1948, DE-0018
  const potaPattern = /\b([A-Z]{2}-\d{1,5})\b/;
  if (potaPattern.test(text) && !text.includes('DXCC')) return 'POTA';
  return '';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let stationLocator = DEFAULT_LOCATOR;
    try {
      const settings = await base44.asServiceRole.entities.AppSetting.filter({ key: 'station_info' });
      if (settings && settings.length > 0) {
        const info = JSON.parse(settings[0].value || '{}');
        if (info.locator) stationLocator = info.locator.toUpperCase();
      }
    } catch {}

    // GPS-Koordinaten vom Client haben Vorrang vor dem konfigurierten Locator
    let stationPos: { lat: number; lon: number };
    if (typeof body.station_lat === 'number' && typeof body.station_lng === 'number' &&
        !isNaN(body.station_lat) && !isNaN(body.station_lng)) {
      stationPos = { lat: body.station_lat, lon: body.station_lng };
    } else {
      stationPos = maidenheadToLatLon(stationLocator) || { lat: 46.5, lon: 6.5 };
    }

    // === 1. jo30.de DX-Cluster (all spots) ===
    let joSpots: any[] = [];
    let apiWarning: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch('https://dxc.jo30.de/dxcache/spots', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const raw = await resp.json();
        joSpots = Array.isArray(raw) ? raw : (raw.spots || raw.data || []);
      } else { apiWarning = `jo30.de API Status ${resp.status}`; }
    } catch { apiWarning = 'jo30.de API nicht erreichbar'; }

    // === 2. Spothole API (SIG-gefiltert: SOTA, POTA, WWFF, etc.) ===
    let spotholeSpots: any[] = [];
    let spotholeWarning: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(
        `https://spothole.app/api/v2/spots?sig=${SPOTHOLE_SIGS}&limit=500`,
        { headers: { 'Accept': 'application/json' }, signal: controller.signal }
      );
      clearTimeout(timeout);
      if (resp.ok) {
        spotholeSpots = await resp.json();
        if (!Array.isArray(spotholeSpots)) spotholeSpots = [];
      } else { spotholeWarning = `Spothole API Status ${resp.status}`; }
    } catch { spotholeWarning = 'Spothole API nicht erreichbar'; }

    // Fix 4: ALLE Spots vor dem Neuladen löschen — verhindert Duplikat-Akkumulation
    try {
      await base44.asServiceRole.entities.DxSpot.deleteMany({});
    } catch {}

    const now = Date.now();

    // === 3. jo30.de Spots normalisieren ===
    const joNormalized: any[] = [];
    for (const s of joSpots) {
      const freqKHz = Number(s.frequency || s.freq || 0);
      const call = s.spotted || s.call || s.dxcallsign;
      if (!freqKHz || !call) continue;

      let spotTime: Date;
      if (s.when) spotTime = new Date(s.when);
      else if (s.time) { const t = Number(s.time); spotTime = !isNaN(t) && t > 1e9 ? new Date(t * 1000) : new Date(s.time); }
      else if (s.spotted_at) spotTime = new Date(s.spotted_at);
      else spotTime = new Date();

      const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));
      const message = s.message || s.comment || s.info || '';
      const comments = message ? [message] : [];
      const dxccSpotted = s.dxcc_spotted || {};
      const dxLat = dxccSpotted.lat ? Number(dxccSpotted.lat) : 0;
      const dxLng = dxccSpotted.lng ? Number(dxccSpotted.lng) : 0;
      const country = dxccSpotted.entity || s.country || s.dxcc || '';
      const countryCode = dxccSpotted.flag || s.countryCode || '';

      let locator = '';
      const locMatch = message.match(/\b([A-R]{2}\d{2}[A-X]{2})\b/i);
      if (locMatch) locator = locMatch[1].toUpperCase();

      let activity = '';
      let activityRef = '';
      if (dxccSpotted.sota_ref) { activity = 'SOTA'; activityRef = String(dxccSpotted.sota_ref); }
      else if (dxccSpotted.pota_ref) { activity = 'POTA'; activityRef = String(dxccSpotted.pota_ref); }
      else if (dxccSpotted.iota_ref) { activity = 'IOTA'; activityRef = String(dxccSpotted.iota_ref); }
      else if (dxccSpotted.wwff_ref) { activity = 'WWFF'; activityRef = String(dxccSpotted.wwff_ref); }
      else {
        // FIX 5: Verbesserte Aktivitätserkennung via detectActivity
        activity = detectActivity(comments);
      }

      // FIX 4: Nur Locator-basierte Koordinaten verwenden — keine DXCC-Center-Koordinaten
      let dxPos: { lat: number; lon: number } | null = locator ? maidenheadToLatLon(locator) : null;

      let distance = 0, azimuth = 0, finalLat = 0, finalLng = 0;
      if (dxPos) {
        distance = haversine(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
        azimuth = bearing(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
        finalLat = Math.round(dxPos.lat * 10000) / 10000;
        finalLng = Math.round(dxPos.lon * 10000) / 10000;
      }

      let confidence = 50;
      if (s.spotter || s.spotted_by) confidence += 20;
      if (locator) confidence += 10;
      if (country) confidence += 10;
      if (activity) confidence += 10;
      confidence = Math.min(100, confidence);

      joNormalized.push({
        call: String(call).toUpperCase().trim(),
        frequency: freqKHz,
        band: deriveBand(freqKHz),
        mode: normalizeMode(s.mode, s.submode),
        country, countryCode,
        source: 'DXCluster (jo30.de)',
        sources: ['DXCluster (jo30.de)'],
        spotter: s.spotter || s.spotted_by || '',
        age_seconds: ageSeconds,
        spot_time: spotTime.toISOString(),
        confidence,
        distance, azimuth, locator,
        lat: finalLat || undefined, lng: finalLng || undefined,
        comments, activity, activity_ref: activityRef || undefined,
        is_active: true,
      });
    }

    // === 4. Spothole Spots normalisieren ===
    const spotholeNormalized: any[] = [];
    for (const s of spotholeSpots) {
      const freqKHz = Math.round(Number(s.freq || 0) / 1000);
      const call = s.dx_call;
      if (!freqKHz || !call) continue;

      const spotTime = s.time_iso ? new Date(s.time_iso) : (s.time ? new Date(s.time * 1000) : new Date());
      const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));
      const comment = s.comment || '';
      const comments = comment ? [comment] : [];

      const sig = s.sig || '';
      const activity = SIG_MAP[sig] || sig || '';
      const sigRef = s.sig_refs?.[0];
      const activityRef = sigRef?.id || '';
      const refName = sigRef?.name || '';

      if (refName && !comments.includes(`${activity} ${activityRef}: ${refName}`)) {
        comments.push(`${activity} ${activityRef}: ${refName}`);
      }

      const country = s.dx_country || '';
      const countryCode = s.dx_flag || '';
      const locator = s.dx_grid || '';
      const dxLat = s.dx_latitude || (sigRef?.latitude ? Number(sigRef.latitude) : 0);
      const dxLng = s.dx_longitude || (sigRef?.longitude ? Number(sigRef.longitude) : 0);

      let dxPos: { lat: number; lon: number } | null = null;
      if (dxLat && dxLng) dxPos = { lat: Number(dxLat), lon: Number(dxLng) };
      else if (locator) dxPos = maidenheadToLatLon(locator);

      let distance = 0, azimuth = 0, finalLat = 0, finalLng = 0;
      if (dxPos) {
        distance = haversine(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
        azimuth = bearing(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
        finalLat = Math.round(dxPos.lat * 10000) / 10000;
        finalLng = Math.round(dxPos.lon * 10000) / 10000;
      }

      let confidence = 60;
      if (s.de_call) confidence += 20;
      if (locator) confidence += 10;
      if (country) confidence += 10;
      confidence = Math.min(100, confidence);

      spotholeNormalized.push({
        call: String(call).toUpperCase().trim(),
        frequency: freqKHz,
        band: s.band || deriveBand(freqKHz),
        mode: normalizeMode(s.mode, s.mode_type),
        country, countryCode,
        source: 'Spothole',
        sources: ['Spothole'],
        spotter: s.de_call || '',
        age_seconds: ageSeconds,
        spot_time: spotTime.toISOString(),
        confidence,
        distance, azimuth, locator,
        lat: finalLat || undefined, lng: finalLng || undefined,
        comments, activity, activity_ref: activityRef || undefined,
        is_active: true,
      });
    }

    // === 5. Merge: Spothole reichert jo30.de an ===
    const mergeMap = new Map<string, any>();
    for (const spot of joNormalized) {
      const key = `${spot.call}_${Math.round(spot.frequency)}`;
      mergeMap.set(key, spot);
    }
    for (const spot of spotholeNormalized) {
      const key = `${spot.call}_${Math.round(spot.frequency)}`;
      const existing = mergeMap.get(key);
      if (existing) {
        if (spot.activity && !existing.activity) {
          existing.activity = spot.activity;
          existing.activity_ref = spot.activity_ref;
          existing.sources.push('Spothole');
          if (spot.comments?.length > 1) existing.comments.push(...spot.comments.slice(1));
        }
      } else {
        mergeMap.set(key, spot);
      }
    }

    const merged = Array.from(mergeMap.values());

    let savedCount = 0;
    if (merged.length > 0) {
      try {
        await base44.asServiceRole.entities.DxSpot.bulkCreate(merged);
        savedCount = merged.length;
      } catch {
        for (const spot of merged) {
          try { await base44.asServiceRole.entities.DxSpot.create(spot); savedCount++; } catch {}
        }
      }
    }

    const latest = await base44.entities.DxSpot.list('-spot_time', 500);

    const warnings = [apiWarning, spotholeWarning].filter(Boolean);

    // DataSourceStatus aktualisieren (jo30.de + Spothole)
    try {
      const updateStatus = async (name: string, type: string, url: string, ok: boolean, spots: number, warning: string | null) => {
        const existing = await base44.asServiceRole.entities.DataSourceStatus.filter({ source_name: name });
        const statusData = {
          source_name: name,
          source_type: type,
          url,
          status: ok ? 'OK' : 'FAIL',
          last_check: new Date().toISOString(),
          last_success: ok ? new Date().toISOString() : undefined,
          spots_received: spots,
          error_message: warning || undefined,
          is_active: true,
        };
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.DataSourceStatus.update(existing[0].id, statusData);
        } else {
          await base44.asServiceRole.entities.DataSourceStatus.create(statusData);
        }
      };
      await updateStatus('DX-Cluster (jo30.de)', 'DXCLUSTER', 'https://dxc.jo30.de/dxcache/spots', joSpots.length > 0, joSpots.length, apiWarning);
      await updateStatus('Spothole (SIG-Filter)', 'API', 'https://spothole.app/api/v2/spots', spotholeSpots.length > 0, spotholeSpots.length, spotholeWarning);
    } catch {}

    return Response.json({
      success: true,
      fetched: joSpots.length + spotholeSpots.length,
      saved: savedCount,
      spots: latest,
      warning: warnings.length > 0 ? warnings.join('; ') : null,
      stationLocator,
      stationPos: { lat: stationPos.lat, lon: stationPos.lon },
      usingGps: typeof body.station_lat === 'number',
      sources: { jo30de: joSpots.length, spothole: spotholeSpots.length },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}