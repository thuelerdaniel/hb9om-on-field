// ============================================================
// coverageCalc.ts — Repeater & User Coverage Calculation
// Line-of-Sight (LOS) with SRTM terrain, Fresnel zone, link budget
// ============================================================

export type DeviceType = 'mobil' | 'fix' | 'portabel';
export type Band = '10m' | '6m' | '2m' | '1.25m' | '70cm' | '33cm' | '23cm' | 'Other';

export interface BandParams {
  band: Band;
  max_range_flat_km: number;
  max_range_terrain_km: number;
  antenna_gain_dBi: number;
  fresnel_clearance_pct: number;
  ground_loss_db_per_km: number;
  vegetation_loss_db_per_km: number;
  building_loss_db: number;
  diffraction_factor: number;
  atmospheric_loss_db: number;
  k_factor: number;
}

export interface CoverageParams {
  f_MHz: number;
  band: Band;
  mode: string;
  P_TX_dbw: number;
  G_TX_dBi: number;
  antenna_height_m: number;
  Rx_sensitivity_dbm: number;
  params: BandParams;
}

export interface RadialResult {
  angle: number;
  range_km: number;
  los_blocked: boolean;
  block_distance_km: number | null;
  terrain_limited: boolean;
  power_limited: boolean;
}

export interface CoverageResult {
  polygon: { type: string; coordinates: number[][][] };
  radials: RadialResult[];
  avg_range_km: number;
  max_range_km: number;
  min_range_km: number;
  max_direction: { angle: number; range_km: number };
  min_direction: { angle: number; range_km: number };
  terrain_blocked_count: number;
  power_limited_count: number;
  elevation_m: number | null;
  terrain_factor: number;
  coverage_source: string;
}

export function getBandFromFrequency(f_MHz: number): Band {
  if (f_MHz >= 28 && f_MHz <= 29.7) return '10m';
  if (f_MHz >= 50 && f_MHz <= 54) return '6m';
  if (f_MHz >= 144 && f_MHz <= 148) return '2m';
  if (f_MHz >= 216 && f_MHz <= 225) return '1.25m';
  if (f_MHz >= 430 && f_MHz <= 450) return '70cm';
  if (f_MHz >= 902 && f_MHz <= 928) return '33cm';
  if (f_MHz >= 1240 && f_MHz <= 1300) return '23cm';
  return 'Other';
}

export const BAND_PARAMS: Record<Band, BandParams> = {
  '10m': { band: '10m', max_range_flat_km: 300, max_range_terrain_km: 150, antenna_gain_dBi: 5, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.1, vegetation_loss_db_per_km: 0.05, building_loss_db: 15, diffraction_factor: 0.7, atmospheric_loss_db: 0.0, k_factor: 4/3 },
  '6m': { band: '6m', max_range_flat_km: 200, max_range_terrain_km: 100, antenna_gain_dBi: 5, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.15, vegetation_loss_db_per_km: 0.08, building_loss_db: 18, diffraction_factor: 0.65, atmospheric_loss_db: 0.0, k_factor: 4/3 },
  '2m': { band: '2m', max_range_flat_km: 80, max_range_terrain_km: 40, antenna_gain_dBi: 5, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.3, vegetation_loss_db_per_km: 0.15, building_loss_db: 20, diffraction_factor: 0.5, atmospheric_loss_db: 0.1, k_factor: 4/3 },
  '1.25m': { band: '1.25m', max_range_flat_km: 60, max_range_terrain_km: 30, antenna_gain_dBi: 6, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.4, vegetation_loss_db_per_km: 0.2, building_loss_db: 22, diffraction_factor: 0.45, atmospheric_loss_db: 0.1, k_factor: 4/3 },
  '70cm': { band: '70cm', max_range_flat_km: 50, max_range_terrain_km: 25, antenna_gain_dBi: 6, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.5, vegetation_loss_db_per_km: 0.25, building_loss_db: 25, diffraction_factor: 0.35, atmospheric_loss_db: 0.2, k_factor: 4/3 },
  '33cm': { band: '33cm', max_range_flat_km: 40, max_range_terrain_km: 20, antenna_gain_dBi: 8, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.7, vegetation_loss_db_per_km: 0.35, building_loss_db: 28, diffraction_factor: 0.25, atmospheric_loss_db: 0.3, k_factor: 4/3 },
  '23cm': { band: '23cm', max_range_flat_km: 30, max_range_terrain_km: 15, antenna_gain_dBi: 10, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.9, vegetation_loss_db_per_km: 0.5, building_loss_db: 30, diffraction_factor: 0.2, atmospheric_loss_db: 0.5, k_factor: 4/3 },
  'Other': { band: 'Other', max_range_flat_km: 50, max_range_terrain_km: 25, antenna_gain_dBi: 3, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.3, vegetation_loss_db_per_km: 0.15, building_loss_db: 20, diffraction_factor: 0.5, atmospheric_loss_db: 0.1, k_factor: 4/3 },
};

export function getModeSensitivity(mode: string): number {
  const m = (mode || 'FM').toUpperCase();
  if (m.includes('DMR')) return -120;
  if (m.includes('D-STAR') || m.includes('DSTAR')) return -118;
  if (m.includes('FUSION') || m.includes('C4FM') || m.includes('YSF')) return -118;
  if (m.includes('P25')) return -119;
  if (m.includes('NXDN')) return -119;
  if (m.includes('M17')) return -118;
  if (m.includes('SSB') || m.includes('CW')) return -124;
  return -117;
}

export function getDeviceAntennaGain(band: Band, deviceType: DeviceType): number {
  const gains: Record<DeviceType, Partial<Record<Band, number>>> = {
    mobil: { '10m': 1.5, '6m': 2.0, '2m': 3.0, '1.25m': 3.5, '70cm': 4.0, '33cm': 5.0, '23cm': 6.0, 'Other': 3.0 },
    fix: { '10m': 2.15, '6m': 2.15, '2m': 2.15, '1.25m': 2.15, '70cm': 2.15, '33cm': 2.15, '23cm': 2.15, 'Other': 2.15 },
    portabel: { '10m': -3, '6m': -2, '2m': -1.5, '1.25m': -2, '70cm': 0, '33cm': 0.5, '23cm': 1.0, 'Other': -1.5 },
  };
  return gains[deviceType]?.[band] ?? 0;
}

export function getDeviceAntennaHeight(deviceType: DeviceType): number {
  if (deviceType === 'mobil') return 1.7;
  if (deviceType === 'fix') return 10;
  return 1.5;
}

export function getDeviceDefaultPower(deviceType: DeviceType): number {
  if (deviceType === 'mobil') return 50;
  if (deviceType === 'fix') return 100;
  return 5;
}

export function calculateFSPL(d_km: number, f_MHz: number): number {
  return 20 * Math.log10(Math.max(d_km, 0.1)) + 20 * Math.log10(f_MHz) + 32.44;
}

export function calculateFresnelRadius(d_km: number, f_GHz: number): number {
  return 17.3 * Math.sqrt(d_km / (4 * f_GHz));
}

export function calculateEarthCurvature(d_km: number, k_factor: number): number {
  const R = 6371;
  return (d_km * d_km) / (2 * R * k_factor);
}

export function knifeEdgeDiffraction(f_MHz: number, h_m: number, d1_km: number, d2_km: number): number {
  if (h_m <= 0) return 0;
  const lambda = 300 / f_MHz;
  const nu = h_m * Math.sqrt((2 * (d1_km + d2_km)) / (lambda * d1_km * d2_km * 1000));
  if (nu <= -0.78) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((nu - 0.1) ** 2 + 1) + nu - 0.1);
}

export function calculateLinkBudget(
  params: CoverageParams,
  d_km: number,
  terrainData: { forest_km: number; urban_km: number; obstacle_h_m: number; obstacle_d1_km: number; obstacle_d2_km: number }
): { rx_power_dbm: number; l_total_db: number; coverage: boolean } {
  const { f_MHz, P_TX_dbw, G_TX_dBi, Rx_sensitivity_dbm, params: bp } = params;
  const fspl = calculateFSPL(d_km, f_MHz);
  const l_ground = bp.ground_loss_db_per_km * d_km;
  const l_vegetation = bp.vegetation_loss_db_per_km * terrainData.forest_km;
  const l_building = bp.building_loss_db * terrainData.urban_km;
  const l_atmosphere = bp.atmospheric_loss_db * (d_km / 30);
  const l_diffraction = knifeEdgeDiffraction(f_MHz, terrainData.obstacle_h_m, terrainData.obstacle_d1_km, terrainData.obstacle_d2_km);
  const l_total = fspl + l_ground + l_vegetation + l_building + l_atmosphere + l_diffraction;
  const erp_dbw = P_TX_dbw + G_TX_dBi; // NO cable loss
  const rx_power = erp_dbw + 30 - l_total;
  return { rx_power_dbm: rx_power, l_total_db: l_total, coverage: rx_power >= Rx_sensitivity_dbm };
}

export async function fetchElevations(
  points: Array<{ lat: number; lng: number }>,
  apiUrl?: string
): Promise<(number | null)[]> {
  if (points.length === 0) return [];
  const baseUrl = apiUrl || 'https://api.opentopodata.org/v1/srtm30m';
  const results: (number | null)[] = [];
  const BATCH = 100;
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    const locations = batch.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
    let success = false;
    for (let retry = 0; retry < 3 && !success; retry++) {
      try {
        const resp = await fetch(`${baseUrl}?locations=${locations}`, { headers: { 'User-Agent': 'HB9OM-OnField/1.0' } });
        if (resp.status === 429) { await new Promise(r => setTimeout(r, 1000 * (retry + 1))); continue; }
        if (!resp.ok) { await new Promise(r => setTimeout(r, 500)); continue; }
        const data = await resp.json();
        for (const r of (data.results || [])) results.push(r.elevation ?? null);
        success = true;
      } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    if (!success) { for (let j = 0; j < batch.length; j++) results.push(null); }
    if (i + BATCH < points.length) await new Promise(r => setTimeout(r, 250));
  }
  return results;
}

export function destinationPoint(lat: number, lng: number, d_km: number, bearing_deg: number): { lat: number; lng: number } {
  const R = 6371;
  const bearing = bearing_deg * Math.PI / 180;
  const lat1 = lat * Math.PI / 180;
  const dRad = d_km / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dRad) + Math.cos(lat1) * Math.sin(dRad) * Math.cos(bearing));
  const lng2 = lng * Math.PI / 180 + Math.atan2(Math.sin(bearing) * Math.sin(dRad) * Math.cos(lat1), Math.cos(dRad) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
}

export function checkLOS(
  elevations: (number | null)[],
  distances_km: number[],
  tx_elevation_m: number,
  tx_antenna_height_m: number,
  k_factor: number
): { blocked: boolean; block_distance_km: number | null; obstacle_h_m: number; obstacle_d1_km: number; obstacle_d2_km: number } {
  const tx_total_h = tx_elevation_m + tx_antenna_height_m;
  let obstacle_h = 0, obstacle_d1 = 0, obstacle_d2 = 0;
  for (let i = 1; i < elevations.length; i++) {
    const elev = elevations[i];
    if (elev == null) continue;
    const d = distances_km[i];
    const earth_curv = calculateEarthCurvature(d, k_factor);
    const los_height = tx_total_h - earth_curv;
    const terrain_h = elev + 1.5;
    if (terrain_h > los_height) {
      const h_obstacle = terrain_h - los_height;
      if (h_obstacle > obstacle_h) { obstacle_h = h_obstacle; obstacle_d1 = d; obstacle_d2 = distances_km[distances_km.length - 1] - d; }
      return { blocked: true, block_distance_km: d, obstacle_h_m: obstacle_h, obstacle_d1_km: obstacle_d1, obstacle_d2_km: obstacle_d2 };
    }
  }
  return { blocked: false, block_distance_km: null, obstacle_h_m: 0, obstacle_d1_km: 0, obstacle_d2_km: 0 };
}

export function deriveTerrainFactor(repeaterElev: number, surroundingElevs: (number | null)[]): { factor: number; description: string } {
  const valid = surroundingElevs.filter((e): e is number => e !== null);
  if (valid.length < 3) return { factor: 1, description: 'unzureichende Höhendaten' };
  const avgSurrounding = valid.reduce((a, b) => a + b, 0) / valid.length;
  const heightDiff = repeaterElev - avgSurrounding;
  if (heightDiff > 200) return { factor: 1.4, description: 'exponierte Höhenlage (+200m)' };
  if (heightDiff > 100) return { factor: 1.25, description: 'hoch gelegen (+100m)' };
  if (heightDiff > 50) return { factor: 1.1, description: 'leicht erhöht (+50m)' };
  if (heightDiff < -200) return { factor: 0.6, description: 'in Talgebiet (-200m)' };
  if (heightDiff < -100) return { factor: 0.75, description: 'tief gelegen (-100m)' };
  if (heightDiff < -50) return { factor: 0.9, description: 'leicht abgesenkt (-50m)' };
  return { factor: 1.0, description: 'flaches Gelände' };
}

export async function calculateCoverage(
  origin: { lat: number; lng: number; elevation_m: number | null },
  params: CoverageParams,
  options: { radials?: number; max_range_km?: number; apiUrl?: string; antenna_height_m?: number }
): Promise<CoverageResult> {
  const numRadials = options.radials || 36;
  const bandMaxRange = options.max_range_km || params.params.max_range_terrain_km;
  const antennaHeight = options.antenna_height_m ?? params.antenna_height_m ?? 10;
  const stepKm = 1.0;
  const k_factor = params.params.k_factor;

  let elevation_m = origin.elevation_m;
  if (elevation_m == null) {
    const elevResult = await fetchElevations([{ lat: origin.lat, lng: origin.lng }], options.apiUrl);
    elevation_m = elevResult[0];
  }
  if (elevation_m == null) {
    return fallbackBandEstimate(origin, params, numRadials, bandMaxRange);
  }

  const allPoints: Array<{ lat: number; lng: number }> = [];
  const radialPointIndices: number[][] = [];
  let pointIdx = 0;
  const numSteps = Math.ceil(bandMaxRange / stepKm);

  for (let r = 0; r < numRadials; r++) {
    const angle = (360 / numRadials) * r;
    const indices: number[] = [];
    for (let s = 1; s <= numSteps; s++) {
      const d = s * stepKm;
      const pt = destinationPoint(origin.lat, origin.lng, d, angle);
      allPoints.push(pt);
      indices.push(pointIdx++);
    }
    radialPointIndices.push(indices);
  }

  const allElevations = await fetchElevations(allPoints, options.apiUrl);
  const firstRingElevs = radialPointIndices.map(indices => allElevations[indices[0]] ?? null);
  const terrainInfo = deriveTerrainFactor(elevation_m, firstRingElevs);

  const radialResults: RadialResult[] = [];
  const polygonPoints: number[][] = [];

  for (let r = 0; r < numRadials; r++) {
    const angle = (360 / numRadials) * r;
    const indices = radialPointIndices[r];
    const radialElevations = indices.map(i => allElevations[i]);
    const distances = indices.map((_, s) => (s + 1) * stepKm);

    const losResult = checkLOS(radialElevations, distances, elevation_m, antennaHeight, k_factor);

    let losRange = bandMaxRange;
    if (losResult.blocked && losResult.block_distance_km != null) {
      losRange = losResult.block_distance_km;
    }

    let linkBudgetRange = bandMaxRange;
    for (let s = 1; s <= numSteps; s++) {
      const d = s * stepKm;
      if (d > losRange) break;
      const segIdx = s - 1;
      const elevAtD = radialElevations[segIdx];
      let forest_km = 0, urban_km = 0;
      if (elevAtD != null) {
        const elevDiff = elevAtD - elevation_m;
        if (elevDiff > 50 && elevDiff < 200) forest_km = 0.5;
        if (elevDiff < 0) urban_km = 0.3;
      }
      const obstacle_h = losResult.blocked && losResult.block_distance_km === d ? losResult.obstacle_h_m : 0;
      const obstacle_d1 = losResult.block_distance_km ?? d;
      const obstacle_d2 = bandMaxRange - obstacle_d1;
      const lb = calculateLinkBudget(params, d, { forest_km, urban_km, obstacle_h_m: obstacle_h, obstacle_d1_km: obstacle_d1, obstacle_d2_km: obstacle_d2 });
      if (!lb.coverage) { linkBudgetRange = d - stepKm; break; }
    }

    const effectiveRange = Math.min(losRange, linkBudgetRange);
    const terrainLimited = losRange < linkBudgetRange;
    const powerLimited = linkBudgetRange < losRange;

    radialResults.push({
      angle, range_km: Math.round(effectiveRange * 10) / 10,
      los_blocked: losResult.blocked,
      block_distance_km: losResult.blocked ? Math.round((losResult.block_distance_km ?? 0) * 10) / 10 : null,
      terrain_limited: terrainLimited, power_limited: powerLimited,
    });

    const pt = destinationPoint(origin.lat, origin.lng, effectiveRange, angle);
    polygonPoints.push([pt.lng, pt.lat]);
  }

  polygonPoints.push(polygonPoints[0]);

  const ranges = radialResults.map(r => r.range_km);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const maxRange = Math.max(...ranges);
  const minRange = Math.min(...ranges);
  const maxIdx = ranges.indexOf(maxRange);
  const minIdx = ranges.indexOf(minRange);
  const terrainBlocked = radialResults.filter(r => r.los_blocked).length;
  const powerLimited = radialResults.filter(r => r.power_limited).length;

  return {
    polygon: { type: 'Polygon', coordinates: [polygonPoints] },
    radials: radialResults,
    avg_range_km: Math.round(avgRange * 10) / 10,
    max_range_km: Math.round(maxRange * 10) / 10,
    min_range_km: Math.round(minRange * 10) / 10,
    max_direction: { angle: radialResults[maxIdx].angle, range_km: radialResults[maxIdx].range_km },
    min_direction: { angle: radialResults[minIdx].angle, range_km: radialResults[minIdx].range_km },
    terrain_blocked_count: terrainBlocked,
    power_limited_count: powerLimited,
    elevation_m, terrain_factor: terrainInfo.factor, coverage_source: 'terrain_los',
  };
}

function fallbackBandEstimate(origin: { lat: number; lng: number }, params: CoverageParams, numRadials: number, bandMaxRange: number): CoverageResult {
  const radialResults: RadialResult[] = [];
  const polygonPoints: number[][] = [];
  for (let r = 0; r < numRadials; r++) {
    const angle = (360 / numRadials) * r;
    radialResults.push({ angle, range_km: bandMaxRange, los_blocked: false, block_distance_km: null, terrain_limited: false, power_limited: true });
    const pt = destinationPoint(origin.lat, origin.lng, bandMaxRange, angle);
    polygonPoints.push([pt.lng, pt.lat]);
  }
  polygonPoints.push(polygonPoints[0]);
  return {
    polygon: { type: 'Polygon', coordinates: [polygonPoints] },
    radials: radialResults, avg_range_km: bandMaxRange, max_range_km: bandMaxRange, min_range_km: bandMaxRange,
    max_direction: { angle: 0, range_km: bandMaxRange }, min_direction: { angle: 0, range_km: bandMaxRange },
    terrain_blocked_count: 0, power_limited_count: numRadials, elevation_m: null, terrain_factor: 1, coverage_source: 'band_estimate',
  };
}

export function maidenheadToLatLng(locator: string): { lat: number; lng: number } | null {
  const loc = locator.toUpperCase().trim();
  if (loc.length < 4) return null;
  const A = 'A'.charCodeAt(0);
  const lng = (loc.charCodeAt(0) - A) * 20 - 180;
  const lat = (loc.charCodeAt(1) - A) * 10 - 90;
  const lng2 = (loc.charCodeAt(2) - '0'.charCodeAt(0)) * 2;
  const lat2 = (loc.charCodeAt(3) - '0'.charCodeAt(0));
  let resultLng = lng + lng2 + 1;
  let resultLat = lat + lat2 + 0.5;
  if (loc.length >= 6) {
    resultLng += (loc.charCodeAt(4) - A) * (2 / 24) - (1 / 24);
    resultLat += (loc.charCodeAt(5) - A) * (1 / 24) - (1 / 48);
  }
  return { lat: resultLat, lng: resultLng };
}

export function wattsToDbw(watts: number): number {
  return 10 * Math.log10(Math.max(watts, 0.1));
}

export function buildUserParams(f_MHz: number, mode: string, power_watts: number, deviceType: DeviceType, antenna_height_m?: number): CoverageParams {
  const band = getBandFromFrequency(f_MHz);
  const bp = BAND_PARAMS[band];
  return {
    f_MHz, band, mode,
    P_TX_dbw: wattsToDbw(power_watts),
    G_TX_dBi: getDeviceAntennaGain(band, deviceType),
    antenna_height_m: antenna_height_m ?? getDeviceAntennaHeight(deviceType),
    Rx_sensitivity_dbm: getModeSensitivity(mode),
    params: bp,
  };
}

export function buildRepeaterParams(f_MHz: number, mode: string, power_watts?: number): CoverageParams {
  const band = getBandFromFrequency(f_MHz);
  const bp = BAND_PARAMS[band];
  const p_watts = power_watts || 25;
  return {
    f_MHz, band, mode,
    P_TX_dbw: wattsToDbw(p_watts),
    G_TX_dBi: bp.antenna_gain_dBi,
    antenna_height_m: 10,
    Rx_sensitivity_dbm: getModeSensitivity(mode),
    params: bp,
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function calculatePathProfile(
  from: { lat: number; lng: number; elevation_m: number | null },
  to: { lat: number; lng: number; elevation_m: number | null },
  params: CoverageParams,
  options: { apiUrl?: string; from_antenna_height_m?: number; to_antenna_height_m?: number }
): Promise<{
  distance_km: number; los_blocked: boolean; block_distance_km: number | null;
  rx_power_dbm: number; l_total_db: number; link_budget_range_km: number;
  coverage: boolean; reserve_db: number;
  profile: Array<{ d_km: number; elevation_m: number | null; los_height_m: number }>;
  elevation_from: number | null; elevation_to: number | null;
}> {
  const stepKm = 0.5;
  const distance = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const numSteps = Math.ceil(distance / stepKm);
  const fromHeight = options.from_antenna_height_m ?? params.antenna_height_m;
  const toHeight = options.to_antenna_height_m ?? 1.5;

  const points: Array<{ lat: number; lng: number }> = [];
  for (let s = 0; s <= numSteps; s++) {
    const frac = s / numSteps;
    points.push({ lat: from.lat + (to.lat - from.lat) * frac, lng: from.lng + (to.lng - from.lng) * frac });
  }

  const elevations = await fetchElevations(points, options.apiUrl);

  let elevFrom = from.elevation_m ?? elevations[0];
  let elevTo = to.elevation_m ?? elevations[elevations.length - 1];
  if (elevFrom == null) { const e = await fetchElevations([{ lat: from.lat, lng: from.lng }], options.apiUrl); elevFrom = e[0]; }
  if (elevTo == null) { const e = await fetchElevations([{ lat: to.lat, lng: to.lng }], options.apiUrl); elevTo = e[0]; }

  const profile: Array<{ d_km: number; elevation_m: number | null; los_height_m: number }> = [];
  const txTotalH = (elevFrom ?? 0) + fromHeight;
  for (let s = 0; s <= numSteps; s++) {
    const d = (s / numSteps) * distance;
    const earthCurv = calculateEarthCurvature(d, params.params.k_factor);
    const losH = txTotalH - earthCurv;
    profile.push({ d_km: d, elevation_m: elevations[s], los_height_m: losH });
  }

  let blocked = false, blockDistance: number | null = null;
  let obstacleH = 0, obstacleD1 = 0, obstacleD2 = 0;
  for (let s = 1; s < profile.length; s++) {
    const p = profile[s];
    if (p.elevation_m == null) continue;
    const terrainH = p.elevation_m + toHeight;
    if (terrainH > p.los_height_m) {
      blocked = true; blockDistance = p.d_km;
      obstacleH = terrainH - p.los_height_m;
      obstacleD1 = p.d_km; obstacleD2 = distance - p.d_km;
      break;
    }
  }

  const lb = calculateLinkBudget(params, distance, {
    forest_km: 0, urban_km: 0,
    obstacle_h_m: blocked ? obstacleH : 0, obstacle_d1_km: obstacleD1, obstacle_d2_km: obstacleD2,
  });

  let lbRange = distance;
  for (let d = 1; d <= distance; d += stepKm) {
    const lbCheck = calculateLinkBudget(params, d, {
      forest_km: 0, urban_km: 0,
      obstacle_h_m: blocked && d >= (blockDistance ?? 0) ? obstacleH : 0,
      obstacle_d1_km: obstacleD1, obstacle_d2_km: obstacleD2,
    });
    if (!lbCheck.coverage) { lbRange = d - stepKm; break; }
  }

  const reserve = lb.rx_power_dbm - params.Rx_sensitivity_dbm;

  return {
    distance_km: Math.round(distance * 10) / 10,
    los_blocked: blocked,
    block_distance_km: blocked ? Math.round((blockDistance ?? 0) * 10) / 10 : null,
    rx_power_dbm: Math.round(lb.rx_power_dbm * 10) / 10,
    l_total_db: Math.round(lb.l_total_db * 10) / 10,
    link_budget_range_km: Math.round(lbRange * 10) / 10,
    coverage: lb.coverage,
    reserve_db: Math.round(reserve * 10) / 10,
    profile, elevation_from: elevFrom, elevation_to: elevTo,
  };
}