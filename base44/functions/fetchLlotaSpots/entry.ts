import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { deriveBand } from "../../shared/bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "../../shared/geoUtils.ts";
import { isInternalCall } from "../../shared/internalAuth.ts";

// Fetch LLOTA live spots from two sources:
// 1. LLOTA direct: https://llota.app/api/spots (live spots with history)
// 2. Spothole enriched: https://spothole.app/api/v2/spots?sig=LLOTA (with coordinates, grid, CQ/ITU zone)
// Merge: LLOTA direct spots enriched with Spothole coordinate data.
// Save to ActivitySpot entity with activity_type='LLOTA'.

const DEFAULT_LOCATOR = 'JN36FL';
const ONE_HOUR_MS = 60 * 60 * 1000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Station position: GPS from client takes priority
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

    // Delete ALL existing LLOTA spots before saving new ones — prevents duplicates from multiple calls
    try {
      await base44.asServiceRole.entities.ActivitySpot.deleteMany({ activity_type: 'LLOTA' });
    } catch {}

    // 1. Fetch LLOTA direct spots
    let llotaSpots: any[] = [];
    let llotaWarning: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch('https://llota.app/api/spots', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        llotaSpots = await resp.json();
        if (!Array.isArray(llotaSpots)) llotaSpots = [];
      } else {
        llotaWarning = `LLOTA direct HTTP ${resp.status}`;
      }
    } catch (e: any) {
      llotaWarning = `LLOTA direct: ${e?.message || 'unreachable'}`;
    }

    // 2. Fetch Spothole enriched LLOTA spots
    let spotholeSpots: any[] = [];
    let spotholeWarning: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(
        'https://spothole.app/api/v2/spots?sig=LLOTA&limit=200',
        { headers: { 'Accept': 'application/json' }, signal: controller.signal }
      );
      clearTimeout(timeout);
      if (resp.ok) {
        spotholeSpots = await resp.json();
        if (!Array.isArray(spotholeSpots)) spotholeSpots = [];
      } else {
        spotholeWarning = `Spothole LLOTA HTTP ${resp.status}`;
      }
    } catch (e: any) {
      spotholeWarning = `Spothole LLOTA: ${e?.message || 'unreachable'}`;
    }

    // 3. Build Spothole lookup map for enrichment (key: callsign_freqKHz)
    const spotholeMap = new Map<string, any>();
    for (const s of spotholeSpots) {
      const freqKHz = Math.round(Number(s.freq || 0) / 1000);
      const key = `${s.dx_call}_${freqKHz}`;
      spotholeMap.set(key, s);
    }

    // 4. Merge: LLOTA direct + Spothole enrichment
    const now = Date.now();
    const merged: any[] = [];

    for (const ls of llotaSpots) {
      const freqKHz = Math.round(parseFloat(ls.frequency) * 1000);
      const enriched = spotholeMap.get(`${ls.callsign}_${freqKHz}`);

      let lat: number | null = null;
      let lng: number | null = null;
      if (enriched?.dx_latitude != null && enriched?.dx_longitude != null) {
        lat = Number(enriched.dx_latitude);
        lng = Number(enriched.dx_longitude);
      }

      // Fallback: look up coordinates from LlotaRef entity
      if ((lat == null || lng == null) && ls.reference) {
        try {
          const refs = await base44.asServiceRole.entities.LlotaRef.filter({ code: ls.reference });
          if (refs && refs.length > 0 && refs[0].lat != null) {
            lat = Number(refs[0].lat);
            lng = Number(refs[0].lng);
          }
        } catch {}
      }

      let distance: number | null = null;
      let azimuth: number | null = null;
      if (lat != null && lng != null) {
        distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lng));
        azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lng));
      }

      const spotTime = ls.updated_at ? new Date(ls.updated_at) : (ls.created_at ? new Date(ls.created_at) : new Date());
      const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));
      const comment = (ls.history && ls.history[0]) ? (ls.history[0].comment || '') : '';

      merged.push({
        call: ls.callsign,
        activity_type: 'LLOTA',
        reference: ls.reference || '',
        name: ls.reference_name || '',
        locationDesc: ls.country_name || '',
        frequency: freqKHz,
        band: deriveBand(freqKHz),
        mode: ls.mode || 'SSB',
        latitude: lat != null ? lat : undefined,
        longitude: lng != null ? lng : undefined,
        grid6: enriched?.dx_grid || undefined,
        comments: comment,
        spotter: ls.spotted_by_app || '',
        source: 'LLOTA (llota.app)',
        spot_time: spotTime.toISOString(),
        age_seconds: ageSeconds,
        distance,
        azimuth,
        count: undefined,
        is_active: true,
      });
    }

    // 5. Add Spothole-only LLOTA spots (not in LLOTA direct feed)
    const llotaKeys = new Set(llotaSpots.map(s => `${s.callsign}_${Math.round(parseFloat(s.frequency) * 1000)}`));
    for (const s of spotholeSpots) {
      const freqKHz = Math.round(Number(s.freq || 0) / 1000);
      const key = `${s.dx_call}_${freqKHz}`;
      if (llotaKeys.has(key)) continue;

      const sigRef = (s.sig_refs && s.sig_refs[0]) ? s.sig_refs[0].id : '';
      let lat: number | null = s.dx_latitude ? Number(s.dx_latitude) : null;
      let lng: number | null = s.dx_longitude ? Number(s.dx_longitude) : null;

      // Fallback: LlotaRef lookup
      if ((lat == null || lng == null) && sigRef) {
        try {
          const refs = await base44.asServiceRole.entities.LlotaRef.filter({ code: sigRef });
          if (refs && refs.length > 0 && refs[0].lat != null) {
            lat = Number(refs[0].lat);
            lng = Number(refs[0].lng);
          }
        } catch {}
      }

      let distance: number | null = null;
      let azimuth: number | null = null;
      if (lat != null && lng != null) {
        distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lng));
        azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lng));
      }

      const spotTime = s.time_iso ? new Date(s.time_iso) : (s.time ? new Date(s.time * 1000) : new Date());
      const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));

      merged.push({
        call: s.dx_call,
        activity_type: 'LLOTA',
        reference: sigRef,
        name: s.dx_qth || '',
        locationDesc: s.dx_country || '',
        frequency: freqKHz,
        band: s.band || deriveBand(freqKHz),
        mode: s.mode || 'SSB',
        latitude: lat != null ? lat : undefined,
        longitude: lng != null ? lng : undefined,
        grid6: s.dx_grid || undefined,
        comments: s.comment || '',
        spotter: s.de_call || '',
        source: 'Spothole-LLOTA',
        spot_time: spotTime.toISOString(),
        age_seconds: ageSeconds,
        distance,
        azimuth,
        count: undefined,
        is_active: true,
      });
    }

    // 6. Save to ActivitySpot
    let savedCount = 0;
    if (merged.length > 0) {
      try {
        await base44.asServiceRole.entities.ActivitySpot.bulkCreate(merged);
        savedCount = merged.length;
      } catch {
        for (const spot of merged) {
          try { await base44.asServiceRole.entities.ActivitySpot.create(spot); savedCount++; } catch {}
        }
      }
    }

    // Update DataSourceStatus
    try {
      const updateStatus = async (name: string, type: string, url: string, ok: boolean, spots: number, warning: string | null) => {
        const existing = await base44.asServiceRole.entities.DataSourceStatus.filter({ source_name: name });
        const statusData = {
          source_name: name,
          source_type: type,
          url,
          status: !ok ? 'FAIL' : warning ? 'WARN' : 'OK',
          last_check: new Date().toISOString(),
          last_success: ok ? new Date().toISOString() : null,
          spots_received: spots,
          error_message: warning || null,
          is_active: true,
        };
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.DataSourceStatus.update(existing[0].id, statusData);
        } else {
          await base44.asServiceRole.entities.DataSourceStatus.create(statusData);
        }
      };
      const safeUpdate = async (...args: Parameters<typeof updateStatus>) => {
        try { await updateStatus(...args); } catch (e: any) { if (String(e?.message || e) !== 'Rate limit exceeded') console.error(`[DataSourceStatus] ${args[0]}:`, e?.message || e); }
      };
      await safeUpdate('LLOTA Spots (llota.app)', 'API', 'https://llota.app/api/spots', llotaSpots.length > 0, llotaSpots.length, llotaWarning);
      await safeUpdate('LLOTA Spots (Spothole)', 'API', 'https://spothole.app/api/v2/spots?sig=LLOTA', spotholeSpots.length > 0, spotholeSpots.length, spotholeWarning);
    } catch {}

    return Response.json({
      success: true,
      fetched: llotaSpots.length + spotholeSpots.length,
      llota_direct: llotaSpots.length,
      spothole_enriched: spotholeSpots.length,
      merged: merged.length,
      saved: savedCount,
      warning: [llotaWarning, spotholeWarning].filter(Boolean).join('; ') || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}