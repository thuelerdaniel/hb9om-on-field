// Shared hunting fetch logic — used by refreshHuntingData (inline, no sub-function calls).
// Avoids 403 Forbidden errors from base44.functions.invoke() by running fetch logic directly.
// Individual fetch functions (fetchSotaSpots, etc.) remain for direct frontend calls.

import { deriveBand, calculateBandConditions } from "./bandDerivation.ts";
import { maidenheadToLatLon, haversine, bearing } from "./geoUtils.ts";

const DEFAULT_LOCATOR = 'JN36FL';
const UA = 'HB9OM-OnField/1.0';
const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function getStationPos(body: any, base44: any): { lat: number; lon: number } {
  if (typeof body?.station_lat === 'number' && typeof body?.station_lng === 'number') {
    return { lat: body.station_lat, lon: body.station_lng };
  }
  return { lat: 46.5, lon: 6.5 }; // Switzerland default
}

function extractLocator(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b([A-R]{2}[0-9]{2}[a-x]{2,})\b/i);
  return match ? match[1].toUpperCase() : null;
}

// === DX Spots: jo30.de + Spothole ===
export async function fetchDxSpotsInline(base44: any, body: any = {}): Promise<{ saved: number; warning: string | null }> {
  const stationPos = getStationPos(body, base44);
  const SPOTHOLE_SIGS = 'POTA,SOTA,WWFF,GMA,WCA,MOTA,Towers,IOTA,ARLHS,ILLW,HEMA';
  const SIG_MAP: Record<string, string> = {
    'SOTA': 'SOTA', 'POTA': 'POTA', 'WWFF': 'WWFF',
    'GMA': 'GMA', 'WCA': 'WCA', 'MOTA': 'MOTA', 'Towers': 'TOTA',
    'IOTA': 'IOTA', 'ARLHS': 'LOTA', 'ILLW': 'LOTA', 'HEMA': 'HEMA',
  };

  // Fetch jo30.de
  let joSpots: any[] = [];
  let apiWarning: string | null = null;
  try {
    const resp = await fetch('https://dxc.jo30.de/dxcache/spots', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const raw = await resp.json();
      joSpots = Array.isArray(raw) ? raw : (raw.spots || raw.data || []);
    } else { apiWarning = `jo30.de Status ${resp.status}`; }
  } catch { apiWarning = 'jo30.de nicht erreichbar'; }

  // Fetch Spothole
  let spotholeSpots: any[] = [];
  let spotholeWarning: string | null = null;
  try {
    const resp = await fetch(`https://spothole.app/api/v2/spots?sig=${SPOTHOLE_SIGS}&limit=500`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      spotholeSpots = await resp.json();
      if (!Array.isArray(spotholeSpots)) spotholeSpots = [];
    } else { spotholeWarning = `Spothole Status ${resp.status}`; }
  } catch { spotholeWarning = 'Spothole nicht erreichbar'; }

  // Delete old spots
  try { await base44.asServiceRole.entities.DxSpot.deleteMany({}); } catch {}

  const now = Date.now();
  const mergeMap = new Map<string, any>();

  // Normalize jo30.de spots
  for (const s of joSpots) {
    const freqKHz = Number(s.frequency || s.freq || 0);
    const call = s.spotted || s.call || s.dxcallsign;
    if (!freqKHz || !call) continue;
    const spotTime = s.when ? new Date(s.when) : (s.time ? new Date(s.time) : new Date());
    const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));
    const message = s.message || s.comment || '';
    const comments = message ? [message] : [];
    let locator = '';
    const locMatch = message.match(/\b([A-R]{2}\d{2}[A-X]{2})\b/i);
    if (locMatch) locator = locMatch[1].toUpperCase();
    let activity = '', activityRef = '';
    const dxccSpotted = s.dxcc_spotted || {};
    if (dxccSpotted.sota_ref) { activity = 'SOTA'; activityRef = String(dxccSpotted.sota_ref); }
    else if (dxccSpotted.pota_ref) { activity = 'POTA'; activityRef = String(dxccSpotted.pota_ref); }
    else if (dxccSpotted.iota_ref) { activity = 'IOTA'; activityRef = String(dxccSpotted.iota_ref); }
    else if (dxccSpotted.wwff_ref) { activity = 'WWFF'; activityRef = String(dxccSpotted.wwff_ref); }
    const dxPos = locator ? maidenheadToLatLon(locator) : null;
    let distance = 0, azimuth = 0, finalLat: number | undefined, finalLng: number | undefined;
    if (dxPos) {
      distance = haversine(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
      azimuth = bearing(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
      finalLat = Math.round(dxPos.lat * 10000) / 10000;
      finalLng = Math.round(dxPos.lon * 10000) / 10000;
    }
    mergeMap.set(`${String(call).toUpperCase()}_${Math.round(freqKHz)}`, {
      call: String(call).toUpperCase().trim(), frequency: freqKHz, band: deriveBand(freqKHz),
      mode: s.mode || 'Unknown', country: dxccSpotted.entity || '', countryCode: dxccSpotted.flag || '',
      source: 'DXCluster (jo30.de)', sources: ['DXCluster (jo30.de)'],
      spotter: s.spotter || '', age_seconds: ageSeconds, spot_time: spotTime.toISOString(),
      confidence: 50, distance, azimuth, locator, lat: finalLat, lng: finalLng,
      comments, activity, activity_ref: activityRef || undefined, is_active: true,
    });
  }

  // Normalize Spothole spots + merge
  for (const s of spotholeSpots) {
    const freqKHz = Math.round(Number(s.freq || 0) / 1000);
    const call = s.dx_call;
    if (!freqKHz || !call) continue;
    const spotTime = s.time_iso ? new Date(s.time_iso) : new Date();
    const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));
    const sig = s.sig || '';
    const activity = SIG_MAP[sig] || sig || '';
    const sigRef = s.sig_refs?.[0];
    const activityRef = sigRef?.id || '';
    const refName = sigRef?.name || '';
    const comments = refName ? [`${activity} ${activityRef}: ${refName}`] : [];
    const locator = s.dx_grid || '';
    const dxLat = s.dx_latitude || (sigRef?.latitude ? Number(sigRef.latitude) : 0);
    const dxLng = s.dx_longitude || (sigRef?.longitude ? Number(sigRef.longitude) : 0);
    let dxPos: { lat: number; lon: number } | null = null;
    if (dxLat && dxLng) dxPos = { lat: Number(dxLat), lon: Number(dxLng) };
    else if (locator) dxPos = maidenheadToLatLon(locator);
    let distance = 0, azimuth = 0, finalLat: number | undefined, finalLng: number | undefined;
    if (dxPos) {
      distance = haversine(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
      azimuth = bearing(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon);
      finalLat = Math.round(dxPos.lat * 10000) / 10000;
      finalLng = Math.round(dxPos.lon * 10000) / 10000;
    }
    const key = `${String(call).toUpperCase()}_${Math.round(freqKHz)}`;
    const existing = mergeMap.get(key);
    if (existing) {
      if (activity && !existing.activity) {
        existing.activity = activity; existing.activity_ref = activityRef;
        existing.sources.push('Spothole');
        if (comments.length > 0) existing.comments.push(...comments);
      }
    } else {
      mergeMap.set(key, {
        call: String(call).toUpperCase().trim(), frequency: freqKHz, band: s.band || deriveBand(freqKHz),
        mode: s.mode || 'Unknown', country: s.dx_country || '', countryCode: s.dx_flag || '',
        source: 'Spothole', sources: ['Spothole'], spotter: s.de_call || '',
        age_seconds: ageSeconds, spot_time: spotTime.toISOString(), confidence: 60,
        distance, azimuth, locator, lat: finalLat, lng: finalLng,
        comments, activity, activity_ref: activityRef || undefined, is_active: true,
      });
    }
  }

  // PUNKT 4: Enrich spots without coordinates via reference lookup
  const merged = Array.from(mergeMap.values());
  const refsNeedingCoords: { type: string; ref: string; spotIdx: number }[] = [];
  for (let i = 0; i < merged.length; i++) {
    const spot = merged[i];
    if ((!spot.lat || !spot.lng) && spot.activity_ref) {
      refsNeedingCoords.push({ type: spot.activity, ref: spot.activity_ref, spotIdx: i });
    }
  }
  // Batch lookup references
  for (const { type, ref, spotIdx } of refsNeedingCoords.slice(0, 100)) {
    try {
      let entityName = '';
      if (type === 'SOTA') entityName = 'SotaPoint';
      else if (type === 'POTA') entityName = 'PotaPoint';
      else if (type === 'WWFF') entityName = 'WwffPoint';
      else if (type === 'IOTA') entityName = 'IotaPoint';
      if (!entityName) continue;
      const points = await base44.asServiceRole.entities[entityName].filter({ code: ref });
      if (points && points.length > 0 && points[0].lat != null) {
        const lat = Number(points[0].lat), lon = Number(points[0].lng);
        merged[spotIdx].lat = Math.round(lat * 10000) / 10000;
        merged[spotIdx].lng = Math.round(lon * 10000) / 10000;
        merged[spotIdx].distance = haversine(stationPos.lat, stationPos.lon, lat, lon);
        merged[spotIdx].azimuth = bearing(stationPos.lat, stationPos.lon, lat, lon);
      }
    } catch {}
  }

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

  // Update DataSourceStatus
  try {
    const updateStatus = async (name: string, url: string, ok: boolean, spots: number, warning: string | null) => {
      const existing = await base44.asServiceRole.entities.DataSourceStatus.filter({ source_name: name });
      const statusData = {
        source_name: name, source_type: 'DXCLUSTER', url,
        status: !ok ? 'FAIL' : warning ? 'WARN' : 'OK',
        last_check: new Date().toISOString(),
        last_success: ok ? new Date().toISOString() : undefined,
        spots_received: spots, error_message: warning || undefined, is_active: true,
      };
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.DataSourceStatus.update(existing[0].id, statusData);
      } else {
        await base44.asServiceRole.entities.DataSourceStatus.create(statusData);
      }
    };
    await updateStatus('DX-Cluster (jo30.de)', 'https://dxc.jo30.de/dxcache/spots', joSpots.length > 0, joSpots.length, apiWarning);
    await updateStatus('Spothole (SIG-Filter)', 'https://spothole.app/api/v2/spots', spotholeSpots.length > 0, spotholeSpots.length, spotholeWarning);
  } catch {}

  return { saved: savedCount, warning: [apiWarning, spotholeWarning].filter(Boolean).join('; ') || null };
}

// === Propagation: NOAA SWPC ===
export async function fetchPropagationInline(base44: any): Promise<{ success: boolean; bestBand: string | null; solarFlux: number | null }> {
  let solarFlux = 150, kIndex = 3;
  try {
    const resp = await fetch('https://services.swpc.noaa.gov/json/f107_cm_flux.json', { signal: AbortSignal.timeout(10000) });
    if (resp.ok) {
      const data = await resp.json();
      const arr = Array.isArray(data) ? data : (data?.data || []);
      const last = arr.length > 0 ? arr[arr.length - 1] : null;
      if (last) {
        const raw = last.f107 ?? last.flux ?? last.value;
        const parsed = Number(raw);
        if (!isNaN(parsed) && parsed > 0) solarFlux = parsed;
      }
    }
  } catch {}
  try {
    const resp = await fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', { signal: AbortSignal.timeout(10000) });
    if (resp.ok) {
      const data = await resp.json();
      const arr = Array.isArray(data) ? data : (data?.data || []);
      const last = arr.length > 0 ? arr[arr.length - 1] : null;
      if (last) {
        const raw = last.estimated_kp ?? last.kp ?? last.k_index ?? last.kp_value;
        const parsed = Number(raw);
        if (!isNaN(parsed)) kIndex = parsed;
      }
    }
  } catch {}
  if (isNaN(solarFlux) || solarFlux <= 0) solarFlux = 150;
  if (isNaN(kIndex)) kIndex = 3;
  const aIndex = kIndex * 4;
  const muf = Math.round((15 + (solarFlux - 100) * 0.05) * 10) / 10;
  const bands = calculateBandConditions(solarFlux, kIndex);
  const bestBand = bands.reduce((best, b) => (b.score || 0) > (best.score || 0) ? b : best, { band: '—', score: -1 });
  const propagationData = { solar_flux: solarFlux, a_index: aIndex, k_index: kIndex, muf, bands, updated: new Date().toISOString(), source: 'NOAA SWPC' };
  try { await base44.asServiceRole.entities.Propagation.deleteMany({}); } catch {}
  try { await base44.asServiceRole.entities.Propagation.create(propagationData); } catch {}
  return { success: true, bestBand: bestBand.band, solarFlux };
}

// === SOTA Spots: api2.sota.org.uk ===
export async function fetchSotaSpotsInline(base44: any, body: any = {}): Promise<{ saved: number }> {
  const stationPos = getStationPos(body, base44);
  const SOTA_BASE = 'https://api-db2.sota.org.uk';
  const SPOTS_QUERY = '?client=sotawatch&user=anon';

  // Delete old SOTA spots (>24h)
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  try { await base44.asServiceRole.entities.ActivitySpot.deleteMany({ activity_type: 'SOTA', spot_time: { $lt: cutoff.toISOString() } }); } catch {}

  let sotaSpots: any[] = [];
  const spotsUrl = `${SOTA_BASE}/api/spots/200/all/all${SPOTS_QUERY}`;
  for (const url of [spotsUrl, `https://corsproxy.io/?url=${encodeURIComponent(spotsUrl)}`]) {
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const raw = await resp.json();
        sotaSpots = Array.isArray(raw) ? raw.filter((s: any) => s.type !== 'DEPRECATED') : [];
        break;
      }
    } catch {}
  }
  if (sotaSpots.length === 0) return { saved: 0 };

  const records = sotaSpots
    .filter((s: any) => s.activatorCallsign && s.frequency)
    .map((s: any) => {
      const frequency = Number(s.frequency) * 1000;
      if (!frequency || isNaN(frequency)) return null;
      const band = deriveBand(frequency);
      const spotTime = s.timeStamp ? new Date(s.timeStamp) : new Date();
      const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
      const comments = s.comments || '';
      const isQRT = /\bQRT\b/i.test(comments);
      let lat = s.latitude != null ? Number(s.latitude) : undefined;
      let lon = s.longitude != null ? Number(s.longitude) : undefined;
      const locator = extractLocator(comments);
      if ((lat == null || lon == null) && locator) {
        const pos = maidenheadToLatLon(locator);
        if (pos) { lat = pos.lat; lon = pos.lon; }
      }
      let distance: number | null = null, azimuth: number | null = null;
      if (lat != null && lon != null) {
        distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lon));
        azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lon));
      }
      return {
        call: s.activatorCallsign, activity_type: 'SOTA', reference: s.summitCode || '',
        name: s.summitName || s.summitDetails || '', locationDesc: s.associationName || '',
        frequency, band, mode: s.mode || 'CW', latitude: lat, longitude: lon,
        comments, spotter: s.callsign || '', source: 'SOTA API',
        spot_time: spotTime.toISOString(), age_seconds: ageSeconds,
        distance, azimuth, is_active: !isQRT,
      };
    })
    .filter((r: any) => r !== null && r.call && r.frequency);

  let savedCount = 0;
  if (records.length > 0) {
    try { await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records); savedCount = records.length; } catch {}
  }
  return { saved: savedCount };
}

// === SOTA Alerts ===
export async function fetchSotaAlertsInline(base44: any): Promise<{ saved: number }> {
  const SOTA_BASE = 'https://api-db2.sota.org.uk';
  const SPOTS_QUERY = '?client=sotawatch&user=anon';
  try { await base44.asServiceRole.entities.ActivitySpot.deleteMany({ activity_type: 'SOTA-ALERT' as any }); } catch {}

  let alerts: any[] = [];
  const alertUrl = `${SOTA_BASE}/api/alerts/100/all/all${SPOTS_QUERY}`;
  for (const url of [alertUrl, `https://corsproxy.io/?url=${encodeURIComponent(alertUrl)}`]) {
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
      if (resp.ok) {
        const raw = await resp.json();
        alerts = Array.isArray(raw) ? raw.filter((a: any) => a.activatingCallsign && a.summitDetails !== 'Unrecognized summit') : [];
        break;
      }
    } catch {}
  }
  if (alerts.length === 0) return { saved: 0 };

  // Lookup coordinates from SotaPoint
  const refCoordMap = new Map<string, { lat: number; lon: number; name: string }>();
  for (const a of alerts.slice(0, 300)) {
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
    const ref = a.associationCode && a.summitCode ? `${a.associationCode}/${a.summitCode}` : '';
    const coords = refCoordMap.get(ref);
    const freqNum = a.frequency ? parseFloat(String(a.frequency)) : NaN;
    const frequency = !isNaN(freqNum) ? freqNum * 1000 : 0;
    return {
      call: a.activatingCallsign || '', activity_type: 'SOTA-ALERT', reference: ref,
      name: a.summitDetails || coords?.name || '', frequency,
      band: frequency ? deriveBand(frequency) : '', mode: a.mode || '',
      latitude: coords?.lat, longitude: coords?.lon, comments: a.comments || '',
      spotter: a.posterCallsign || '', source: 'SOTA-Alerts',
      spot_time: a.dateActivated ? new Date(a.dateActivated).toISOString() : new Date().toISOString(),
      is_future: true, is_active: false,
    };
  }).filter((r: any) => r.call);

  let savedCount = 0;
  if (records.length > 0) {
    try { await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records); savedCount = records.length; } catch {}
  }
  return { saved: savedCount };
}

// === POTA Spots: api.pota.app ===
export async function fetchPotaSpotsInline(base44: any, body: any = {}): Promise<{ saved: number }> {
  const stationPos = getStationPos(body, base44);
  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  try { await base44.asServiceRole.entities.ActivitySpot.deleteMany({ activity_type: 'POTA', spot_time: { $lt: cutoff.toISOString() } }); } catch {}

  let potaSpots: any[] = [];
  try {
    const resp = await fetch('https://api.pota.app/spot/activator', { headers: { 'Accept': 'application/json', 'User-Agent': UA } });
    if (resp.ok) potaSpots = await resp.json();
  } catch {}
  if (potaSpots.length === 0) return { saved: 0 };

  // PotaPoint coordinate fallback
  const refsNeedingCoords = new Set<string>();
  for (const s of potaSpots) {
    const lat = Number(s.latitude), lon = Number(s.longitude);
    if ((isNaN(lat) || isNaN(lon)) && s.reference) refsNeedingCoords.add(s.reference);
  }
  const potaCoordMap = new Map<string, { lat: number; lon: number }>();
  for (const ref of refsNeedingCoords) {
    try {
      const points = await base44.asServiceRole.entities.PotaPoint.filter({ code: ref });
      if (points && points.length > 0 && points[0].lat != null) {
        potaCoordMap.set(ref, { lat: Number(points[0].lat), lon: Number(points[0].lng) });
      }
    } catch {}
  }

  const records = potaSpots
    .filter((s: any) => s.activator && s.frequency)
    .map((s: any) => {
      const frequency = Number(s.frequency);
      const band = deriveBand(frequency);
      const spotTime = s.spotTime ? new Date(s.spotTime) : new Date();
      const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
      let lat = Number(s.latitude), lon = Number(s.longitude);
      if ((isNaN(lat) || isNaN(lon)) && s.reference) {
        const fallback = potaCoordMap.get(s.reference);
        if (fallback) { lat = fallback.lat; lon = fallback.lon; }
      }
      let distance: number | null = null, azimuth: number | null = null;
      if (!isNaN(lat) && !isNaN(lon)) {
        distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lon));
        azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lon));
      }
      const comments = s.comments || '';
      return {
        call: s.activator, activity_type: 'POTA', reference: s.reference || '',
        name: s.name || '', locationDesc: s.locationDesc || '', frequency, band,
        mode: s.mode || 'SSB', latitude: !isNaN(lat) ? lat : undefined, longitude: !isNaN(lon) ? lon : undefined,
        grid6: s.grid6 || undefined, comments, spotter: s.spotter || '',
        source: 'POTA API', spot_time: spotTime.toISOString(), age_seconds: ageSeconds,
        distance, azimuth, count: s.count != null ? Number(s.count) : undefined,
        is_active: !/\bQRT\b/i.test(comments),
      };
    })
    .filter((r: any) => r.call && r.frequency);

  let savedCount = 0;
  if (records.length > 0) {
    try { await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records); savedCount = records.length; } catch {}
  }
  return { saved: savedCount };
}

// === WWFF Spots: spots.wwff.co ===
export async function fetchWwffSpotsInline(base44: any, body: any = {}): Promise<{ saved: number }> {
  const stationPos = getStationPos(body, base44);
  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  try { await base44.asServiceRole.entities.ActivitySpot.deleteMany({ activity_type: 'WWFF', spot_time: { $lt: cutoff.toISOString() } }); } catch {}

  let wwffSpots: any[] = [];
  try {
    const resp = await fetch('https://spots.wwff.co/static/spots.json', { headers: { 'Accept': 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (resp.ok) {
      wwffSpots = await resp.json();
      if (!Array.isArray(wwffSpots)) wwffSpots = [];
    }
  } catch {}
  if (wwffSpots.length === 0) return { saved: 0 };

  // WwffPoint coordinate fallback
  const refsNeedingCoords = new Set<string>();
  for (const s of wwffSpots) {
    const lat = Number(s.latitude), lon = Number(s.longitude);
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
      const frequency = Number(s.frequency_khz);
      if (!frequency || isNaN(frequency)) return null;
      const band = deriveBand(frequency);
      const spotTime = s.spot_time ? new Date(s.spot_time * 1000) : new Date();
      const ageSeconds = Math.round((Date.now() - spotTime.getTime()) / 1000);
      let lat = Number(s.latitude), lon = Number(s.longitude);
      if ((isNaN(lat) || isNaN(lon)) && s.reference) {
        const fallback = wwffCoordMap.get(s.reference);
        if (fallback) { lat = fallback.lat; lon = fallback.lon; }
      }
      let distance: number | null = null, azimuth: number | null = null;
      if (!isNaN(lat) && !isNaN(lon)) {
        distance = Math.round(haversine(stationPos.lat, stationPos.lon, lat, lon));
        azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, lat, lon));
      }
      const comments = s.remarks || '';
      return {
        call: s.activator, activity_type: 'WWFF', reference: s.reference || '',
        name: s.reference_name || '', frequency, band, mode: s.mode || 'SSB',
        latitude: !isNaN(lat) ? lat : undefined, longitude: !isNaN(lon) ? lon : undefined,
        comments, spotter: s.spotter || '', source: 'WWFF-Spotline',
        spot_time: spotTime.toISOString(), age_seconds: ageSeconds,
        distance, azimuth, is_active: !/\bQRT\b/i.test(comments),
      };
    })
    .filter((r: any) => r !== null && r.call && r.frequency);

  let savedCount = 0;
  if (records.length > 0) {
    try { await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records); savedCount = records.length; } catch {}
  }
  return { saved: savedCount };
}

// === GMA Spots: Spothole ===
export async function fetchGmaSpotsInline(base44: any, body: any = {}): Promise<{ saved: number; warning: string | null }> {
  const stationPos = getStationPos(body, base44);
  const cutoff = new Date(Date.now() - ONE_HOUR_MS);
  try { await base44.asServiceRole.entities.ActivitySpot.deleteMany({ activity_type: 'GMA', spot_time: { $lt: cutoff.toISOString() } }); } catch {}

  let spotholeSpots: any[] = [];
  let apiWarning: string | null = null;
  try {
    const resp = await fetch('https://spothole.app/api/v2/spots?sig=GMA&limit=100', {
      headers: { 'Accept': 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const raw = await resp.json();
      spotholeSpots = Array.isArray(raw) ? raw : [];
    } else { apiWarning = `Spothole Status ${resp.status}`; }
  } catch (e: any) { apiWarning = `Spothole: ${e.message}`; }
  if (spotholeSpots.length === 0) return { saved: 0, warning: apiWarning };

  const now = Date.now();
  const records = spotholeSpots.map((s: any) => {
    const freqKHz = Math.round(Number(s.freq || 0) / 1000);
    const call = s.dx_call || '';
    if (!freqKHz || !call) return null;
    const spotTime = s.time_iso ? new Date(s.time_iso) : new Date();
    const ageSeconds = Math.max(0, Math.round((now - spotTime.getTime()) / 1000));
    const sigRef = s.sig_refs?.[0];
    const reference = sigRef?.id || '';
    const refName = sigRef?.name || '';
    const comments = refName ? `GMA ${reference}: ${refName}` : '';
    const locator = s.dx_grid || '';
    const dxLat = s.dx_latitude || (sigRef?.latitude ? Number(sigRef.latitude) : 0);
    const dxLng = s.dx_longitude || (sigRef?.longitude ? Number(sigRef.longitude) : 0);
    let dxPos: { lat: number; lon: number } | null = null;
    if (dxLat && dxLng) dxPos = { lat: Number(dxLat), lon: Number(dxLng) };
    else if (locator) dxPos = maidenheadToLatLon(locator);
    let distance: number | null = null, azimuth: number | null = null;
    let lat: number | undefined, lon: number | undefined;
    if (dxPos) {
      distance = Math.round(haversine(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon));
      azimuth = Math.round(bearing(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon));
      lat = Math.round(dxPos.lat * 10000) / 10000;
      lon = Math.round(dxPos.lon * 10000) / 10000;
    }
    return {
      call: String(call).toUpperCase().trim(), activity_type: 'GMA' as const,
      reference, name: refName, frequency: freqKHz, band: s.band || deriveBand(freqKHz),
      mode: s.mode || 'SSB', latitude: lat, longitude: lon,
      comments, spotter: s.de_call || '', source: 'Spothole (GMA)',
      spot_time: spotTime.toISOString(), age_seconds: ageSeconds,
      distance, azimuth, is_active: !/\bQRT\b/i.test(comments),
    };
  }).filter((r: any) => r !== null && r.call && r.frequency);

  let savedCount = 0;
  if (records.length > 0) {
    try { await base44.asServiceRole.entities.ActivitySpot.bulkCreate(records); savedCount = records.length; } catch {}
  }

  // DataSourceStatus
  try {
    const existing = await base44.asServiceRole.entities.DataSourceStatus.filter({ source_name: 'GMA (Spothole)' });
    const statusData = {
      source_name: 'GMA (Spothole)', source_type: 'API', url: 'https://spothole.app/api/v2/spots?sig=GMA',
      status: apiWarning ? 'WARN' : (savedCount > 0 ? 'OK' : 'FAIL'),
      last_check: new Date().toISOString(), last_success: savedCount > 0 ? new Date().toISOString() : undefined,
      spots_received: savedCount, error_message: apiWarning || undefined, is_active: true,
    };
    if (existing && existing.length > 0) {
      await base44.asServiceRole.entities.DataSourceStatus.update(existing[0].id, statusData);
    } else {
      await base44.asServiceRole.entities.DataSourceStatus.create(statusData);
    }
  } catch {}

  return { saved: savedCount, warning: apiWarning };
}