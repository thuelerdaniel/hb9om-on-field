// ============================================================
// coverageCalc.ts — ITM+ & KW Propagation Model
// VHF/UHF: LOS + Diffraction (knife-edge) + Troposcatter + Two-Ray Reflection
// KW/HF: Ground Wave + Sky Wave (MUF/LUF) + NVIS + Skip Zone
// ============================================================

export type DeviceType = 'mobil' | 'fix' | 'portabel';
export type Band = '160m' | '80m' | '60m' | '40m' | '30m' | '20m' | '17m' | '15m' | '12m' | '10m' | '6m' | '2m' | '1.25m' | '70cm' | '33cm' | '23cm' | 'Other';

export function isHFBand(band: Band): boolean {
  return ['160m','80m','60m','40m','30m','20m','17m','15m','12m','10m'].includes(band);
}

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
  // KW-specific
  ground_alpha_moist?: number;
  ground_alpha_dry?: number;
  sky_wave_max_km?: number;
  nvis_max_km?: number;
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
  nvis_mode?: boolean;
  solar_activity?: number;
  time_override?: Date | null;
}

export interface RadialResult {
  angle: number;
  range_km: number;
  mode: string;
  rx_dbm: number;
  margin_db: number;
  los_blocked: boolean;
  block_distance_km: number | null;
  los_range_km: number;
  diffraction_range_km: number;
  troposcatter_range_km: number;
  terrain_limited: boolean;
  power_limited: boolean;
}

export interface CoverageResult {
  polygon: { type: string; coordinates: number[][][] };
  mode_polygons: Record<string, { type: string; coordinates: number[][][] }>;
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
  los_km?: number;
  diffraction_km?: number;
  troposcatter_km?: number;
  muf_mhz?: number;
  luf_mhz?: number;
  time_of_day?: string;
  skip_zone?: { inner_km: number; outer_km: number };
  is_hf?: boolean;
}

export function getBandFromFrequency(f_MHz: number): Band {
  if (f_MHz >= 1.8 && f_MHz <= 2.0) return '160m';
  if (f_MHz >= 3.5 && f_MHz <= 4.0) return '80m';
  if (f_MHz >= 5.0 && f_MHz <= 5.5) return '60m';
  if (f_MHz >= 7.0 && f_MHz <= 7.3) return '40m';
  if (f_MHz >= 10.0 && f_MHz <= 10.2) return '30m';
  if (f_MHz >= 14.0 && f_MHz <= 14.4) return '20m';
  if (f_MHz >= 18.0 && f_MHz <= 18.2) return '17m';
  if (f_MHz >= 21.0 && f_MHz <= 21.5) return '15m';
  if (f_MHz >= 24.8 && f_MHz <= 25.0) return '12m';
  if (f_MHz >= 28.0 && f_MHz <= 29.7) return '10m';
  if (f_MHz >= 50 && f_MHz <= 54) return '6m';
  if (f_MHz >= 144 && f_MHz <= 148) return '2m';
  if (f_MHz >= 216 && f_MHz <= 225) return '1.25m';
  if (f_MHz >= 430 && f_MHz <= 450) return '70cm';
  if (f_MHz >= 902 && f_MHz <= 928) return '33cm';
  if (f_MHz >= 1240 && f_MHz <= 1300) return '23cm';
  return 'Other';
}

export const BAND_PARAMS: Record<Band, BandParams> = {
  '160m': { band: '160m', max_range_flat_km: 200, max_range_terrain_km: 150, antenna_gain_dBi: 0, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.03, vegetation_loss_db_per_km: 0.02, building_loss_db: 10, diffraction_factor: 0.9, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 0.02, ground_alpha_dry: 0.05, sky_wave_max_km: 3000, nvis_max_km: 0 },
  '80m': { band: '80m', max_range_flat_km: 120, max_range_terrain_km: 100, antenna_gain_dBi: 0, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.08, vegetation_loss_db_per_km: 0.04, building_loss_db: 12, diffraction_factor: 0.85, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 0.05, ground_alpha_dry: 0.12, sky_wave_max_km: 3000, nvis_max_km: 500 },
  '60m': { band: '60m', max_range_flat_km: 80, max_range_terrain_km: 70, antenna_gain_dBi: 0, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.13, vegetation_loss_db_per_km: 0.06, building_loss_db: 14, diffraction_factor: 0.82, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 0.08, ground_alpha_dry: 0.18, sky_wave_max_km: 3000, nvis_max_km: 500 },
  '40m': { band: '40m', max_range_flat_km: 60, max_range_terrain_km: 50, antenna_gain_dBi: 2.15, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.22, vegetation_loss_db_per_km: 0.10, building_loss_db: 16, diffraction_factor: 0.78, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 0.15, ground_alpha_dry: 0.30, sky_wave_max_km: 3000, nvis_max_km: 500 },
  '30m': { band: '30m', max_range_flat_km: 40, max_range_terrain_km: 35, antenna_gain_dBi: 2.15, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.38, vegetation_loss_db_per_km: 0.15, building_loss_db: 18, diffraction_factor: 0.75, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 0.25, ground_alpha_dry: 0.50, sky_wave_max_km: 3000, nvis_max_km: 400 },
  '20m': { band: '20m', max_range_flat_km: 20, max_range_terrain_km: 18, antenna_gain_dBi: 2.15, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.60, vegetation_loss_db_per_km: 0.25, building_loss_db: 20, diffraction_factor: 0.70, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 0.40, ground_alpha_dry: 0.80, sky_wave_max_km: 3000, nvis_max_km: 0 },
  '17m': { band: '17m', max_range_flat_km: 15, max_range_terrain_km: 13, antenna_gain_dBi: 2.15, fresnel_clearance_pct: 60, ground_loss_db_per_km: 0.90, vegetation_loss_db_per_km: 0.35, building_loss_db: 22, diffraction_factor: 0.65, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 0.60, ground_alpha_dry: 1.20, sky_wave_max_km: 3000, nvis_max_km: 0 },
  '15m': { band: '15m', max_range_flat_km: 10, max_range_terrain_km: 9, antenna_gain_dBi: 3, fresnel_clearance_pct: 60, ground_loss_db_per_km: 1.15, vegetation_loss_db_per_km: 0.45, building_loss_db: 24, diffraction_factor: 0.60, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 0.80, ground_alpha_dry: 1.50, sky_wave_max_km: 3000, nvis_max_km: 0 },
  '12m': { band: '12m', max_range_flat_km: 8, max_range_terrain_km: 7, antenna_gain_dBi: 3, fresnel_clearance_pct: 60, ground_loss_db_per_km: 1.50, vegetation_loss_db_per_km: 0.55, building_loss_db: 26, diffraction_factor: 0.55, atmospheric_loss_db: 0, k_factor: 4/3, ground_alpha_moist: 1.00, ground_alpha_dry: 2.00, sky_wave_max_km: 3000, nvis_max_km: 0 },
  '10m': { band: '10m', max_range_flat_km: 300, max_range_terrain_km: 150, antenna_gain_dBi: 5, fresnel_clearance_pct: 60, ground_loss_db_per_km: 1.85, vegetation_loss_db_per_km: 0.05, building_loss_db: 15, diffraction_factor: 0.7, atmospheric_loss_db: 0.0, k_factor: 4/3, ground_alpha_moist: 1.20, ground_alpha_dry: 2.50, sky_wave_max_km: 3000, nvis_max_km: 0 },
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
    mobil: { '160m': -5, '80m': -2, '60m': -1, '40m': 0, '30m': 1, '20m': 2, '17m': 2.5, '15m': 3, '12m': 3.5, '10m': 4, '6m': 2.0, '2m': 3.0, '1.25m': 3.5, '70cm': 4.0, '33cm': 5.0, '23cm': 6.0, 'Other': 3.0 },
    fix: { '160m': 0, '80m': 0, '60m': 0, '40m': 2.15, '30m': 2.15, '20m': 2.15, '17m': 2.15, '15m': 3, '12m': 3, '10m': 4, '6m': 2.15, '2m': 2.15, '1.25m': 2.15, '70cm': 2.15, '33cm': 2.15, '23cm': 2.15, 'Other': 2.15 },
    portabel: { '160m': -8, '80m': -3, '60m': -2, '40m': 0, '30m': 1, '20m': 1, '17m': 1.5, '15m': 2, '12m': 2, '10m': 3, '6m': -2, '2m': -1.5, '1.25m': -2, '70cm': 0, '33cm': 0.5, '23cm': 1.0, 'Other': -1.5 },
  };
  return gains[deviceType]?.[band] ?? 0;
}

export function getDeviceAntennaHeight(deviceType: DeviceType): number {
  if (deviceType === 'mobil') return 1.7;
  if (deviceType === 'fix') return 10;
  return 1.5;
}

export function getDeviceDefaultPower(deviceType: DeviceType, band?: Band): number {
  if (isHFBand(band || 'Other')) {
    if (deviceType === 'mobil') return 100;
    if (deviceType === 'fix') return 100;
    return 10;
  }
  if (deviceType === 'mobil') return 50;
  if (deviceType === 'fix') return 100;
  return 5;
}

// ============================================================
// Utility Functions
// ============================================================

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

// Troposcatter loss (ITM-based): L_tropo = 30*log10(d) + 20*log10(f) - 103.4 + 0.2*d
function troposcatterLoss(d_km: number, f_MHz: number): number {
  return 30 * Math.log10(Math.max(d_km, 1)) + 20 * Math.log10(f_MHz) - 103.4 + 0.2 * d_km;
}

// Two-ray ground reflection: returns Rx adjustment in dB (can be positive or negative)
function twoRayLossAdjust(d_km: number, f_MHz: number, h_tx: number, h_rx: number, reflectionCoeff: number): number {
  const lambda = 300 / f_MHz;
  const d = d_km * 1000; // m
  const d_direct = Math.sqrt(d * d + (h_tx - h_rx) ** 2);
  const d_reflected = Math.sqrt(d * d + (h_tx + h_rx) ** 2);
  const delta_d = d_reflected - d_direct;
  const phi = 2 * Math.PI * delta_d / lambda;
  // |1 + Gamma * e^(-j*phi)|^2 = 1 + Gamma^2 + 2*Gamma*cos(phi)
  const factor = 1 + reflectionCoeff * reflectionCoeff + 2 * reflectionCoeff * Math.cos(phi);
  if (factor <= 0) return -6; // Cap at 6 dB loss (don't completely cancel)
  return 10 * Math.log10(factor);
}

function getReflectionCoeff(elevation_m: number | null): number {
  if (elevation_m == null) return -0.6;
  if (elevation_m < 50) return -0.85; // Near water / moist
  if (elevation_m < 500) return -0.75; // Moist soil
  if (elevation_m < 1000) return -0.60; // Dry soil / forest
  return -0.50; // Rock
}

// ============================================================
// KW/HF: Solar & Ionosphere
// ============================================================

export function computeSolarElevation(lat: number, lng: number, date: Date): number {
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365) * rad;
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const localHours = utcHours + lng / 15;
  const hourAngle = (localHours - 12) * 15 * rad;
  const latRad = lat * rad;
  const elev = Math.asin(Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle));
  return elev * 180 / Math.PI;
}

export function computeMUF(lat: number, lng: number, date: Date, solarActivity: number): { muf: number; luf: number; foF2: number; timeOfDay: string } {
  const elev = computeSolarElevation(lat, lng, date);
  const sunFactor = Math.max(0, Math.sin(elev * Math.PI / 180));
  const foF2 = (1.5 + 4.5 * sunFactor) * solarActivity;
  const muf = foF2 * 3.5;
  const luf = sunFactor > 0.1 ? 5 * solarActivity : 2 * solarActivity;
  let timeOfDay = 'day';
  if (elev < -6) timeOfDay = 'night';
  else if (elev < 6) timeOfDay = 'twilight';
  return { muf: Math.round(muf * 10) / 10, luf: Math.round(luf * 10) / 10, foF2: Math.round(foF2 * 10) / 10, timeOfDay };
}

// Ground wave loss: FSPL + alpha * d
function groundWaveLoss(d_km: number, f_MHz: number, alpha: number): number {
  return calculateFSPL(d_km, f_MHz) + alpha * d_km;
}

// Sky wave loss: path via ionosphere (F2 layer at 300 km)
function skyWaveLoss(d_km: number, f_MHz: number, absorption_db: number): number {
  const h_iono = 300;
  const d_iono = 2 * Math.sqrt(h_iono * h_iono + (d_km / 2) ** 2);
  return 20 * Math.log10(d_iono) + 20 * Math.log10(f_MHz) + 32.44 + absorption_db + 2; // +2 dB ground reflection
}

// NVIS loss: steep up and down, d_iono ≈ 2 * h_iono
function nvisLoss(f_MHz: number, absorption_db: number): number {
  const d_iono = 600; // 2 * 300 km
  return 20 * Math.log10(d_iono) + 20 * Math.log10(f_MHz) + 32.44 + absorption_db;
}

// ============================================================
// Elevation Data
// ============================================================

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
  k_factor: number,
  rx_height_m: number = 1.5
): { blocked: boolean; block_distance_km: number | null; obstacle_h_m: number; obstacle_d1_km: number; obstacle_d2_km: number } {
  const tx_total_h = tx_elevation_m + tx_antenna_height_m;
  let obstacle_h = 0, obstacle_d1 = 0, obstacle_d2 = 0;
  for (let i = 1; i < elevations.length; i++) {
    const elev = elevations[i];
    if (elev == null) continue;
    const d = distances_km[i];
    const earth_curv = calculateEarthCurvature(d, k_factor);
    const los_height = tx_total_h - earth_curv;
    const terrain_h = elev + rx_height_m;
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

// ============================================================
// Main Coverage Calculation (dispatches VHF vs KW)
// ============================================================

export async function calculateCoverage(
  origin: { lat: number; lng: number; elevation_m: number | null },
  params: CoverageParams,
  options: { radials?: number; max_range_km?: number; apiUrl?: string; antenna_height_m?: number }
): Promise<CoverageResult> {
  if (isHFBand(params.band)) {
    return await calculateHFCoverage(origin, params, options);
  }
  return await calculateVHFCoverage(origin, params, options);
}

// ============================================================
// VHF/UHF Coverage — ITM+ Model
// LOS + Diffraction + Troposcatter + Two-Ray Reflection
// ============================================================

async function calculateVHFCoverage(
  origin: { lat: number; lng: number; elevation_m: number | null },
  params: CoverageParams,
  options: { radials?: number; max_range_km?: number; apiUrl?: string; antenna_height_m?: number }
): Promise<CoverageResult> {
  const numRadials = options.radials || 36;
  const bandMaxRange = options.max_range_km || params.params.max_range_terrain_km;
  const antennaHeight = options.antenna_height_m ?? params.antenna_height_m ?? 10;
  const stepKm = 1.0;
  const k_factor = params.params.k_factor;
  const rxHeight = 1.5;

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
  const losPolyPoints: number[][] = [];
  const diffPolyPoints: number[][] = [];
  const tropoPolyPoints: number[][] = [];
  const overallPolyPoints: number[][] = [];

  const erp_dbw = params.P_TX_dbw + params.G_TX_dBi;
  const G_RX = 0; // Receiver antenna gain (handheld/mobile)
  const reflectionCoeff = getReflectionCoeff(elevation_m);

  for (let r = 0; r < numRadials; r++) {
    const angle = (360 / numRadials) * r;
    const indices = radialPointIndices[r];
    const radialElevations = indices.map(i => allElevations[i]);
    const distances = indices.map((_, s) => (s + 1) * stepKm);

    const losResult = checkLOS(radialElevations, distances, elevation_m, antennaHeight, k_factor, rxHeight);

    // Compute three ranges: LOS, diffraction, troposcatter
    let losRange = 0, diffRange = 0, tropoRange = 0;
    let losBlocked = false;
    let blockDist: number | null = null;
    let obstacleH = 0, obstacleD1 = 0, obstacleD2 = 0;

    if (losResult.blocked && losResult.block_distance_km != null) {
      losBlocked = true;
      blockDist = losResult.block_distance_km;
      obstacleH = losResult.obstacle_h_m;
      obstacleD1 = losResult.obstacle_d1_km;
      obstacleD2 = losResult.obstacle_d2_km;
      losRange = blockDist;
    } else {
      losRange = bandMaxRange;
    }

    // Compute link budget at each step to find where signal drops below sensitivity
    let lastGoodRx = -999, lastGoodMode = 'los', lastGoodMargin = -999;

    for (let s = 1; s <= numSteps; s++) {
      const d = s * stepKm;
      if (d > bandMaxRange) break;
      const segIdx = s - 1;
      const elevAtD = radialElevations[segIdx];

      // Terrain-derived losses
      let forest_km = 0, urban_km = 0;
      if (elevAtD != null) {
        const elevDiff = elevAtD - elevation_m;
        if (elevDiff > 50 && elevDiff < 200) forest_km = 0.5;
        if (elevDiff < 0) urban_km = 0.3;
      }

      const fspl = calculateFSPL(d, params.f_MHz);
      const l_ground = params.params.ground_loss_db_per_km * d;
      const l_vegetation = params.params.vegetation_loss_db_per_km * forest_km;
      const l_atmosphere = params.params.atmospheric_loss_db * (d / 30);

      // Diffraction loss (only beyond LOS blockage)
      let l_diff = 0;
      if (losBlocked && d >= blockDist!) {
        l_diff = knifeEdgeDiffraction(params.f_MHz, obstacleH, obstacleD1, obstacleD2);
      }

      // Direct path with diffraction
      const l_total_direct = fspl + l_diff + l_ground + l_vegetation + l_atmosphere;
      const rx_direct = erp_dbw + 30 - l_total_direct + G_RX;

      // Two-ray reflection (close range, low antenna)
      let rx_two_ray = -999;
      if ((antennaHeight < 5 || rxHeight < 5) && d < 15) {
        const adjust = twoRayLossAdjust(d, params.f_MHz, antennaHeight, rxHeight, reflectionCoeff);
        rx_two_ray = rx_direct + adjust;
      }

      // Troposcatter (only when LOS blocked and direct insufficient)
      let rx_tropo = -999;
      if (losBlocked && d >= blockDist! && rx_direct < params.Rx_sensitivity_dbm) {
        const l_tropo = troposcatterLoss(d, params.f_MHz);
        rx_tropo = erp_dbw + 30 - l_tropo + G_RX;
      }

      const rx_final = Math.max(rx_direct, rx_two_ray, rx_tropo);

      if (rx_final >= params.Rx_sensitivity_dbm) {
        lastGoodRx = rx_final;
        lastGoodMargin = rx_final - params.Rx_sensitivity_dbm;
        // Determine mode
        if (!losBlocked || d < blockDist!) {
          lastGoodMode = 'los';
        } else if (rx_direct >= params.Rx_sensitivity_dbm) {
          lastGoodMode = 'diffraction';
        } else if (rx_tropo >= params.Rx_sensitivity_dbm) {
          lastGoodMode = 'troposcatter';
        } else {
          lastGoodMode = 'reflection';
        }
        // Update ranges
        if (lastGoodMode === 'los') losRange = d;
        if (lastGoodMode === 'los' || lastGoodMode === 'diffraction') diffRange = d;
        tropoRange = d; // troposcatter range = overall max
      } else {
        break; // Signal below sensitivity — stop
      }
    }

    const effectiveRange = Math.max(losRange, diffRange, tropoRange);

    radialResults.push({
      angle, range_km: Math.round(effectiveRange * 10) / 10,
      mode: lastGoodMode,
      rx_dbm: Math.round(lastGoodRx * 10) / 10,
      margin_db: Math.round(lastGoodMargin * 10) / 10,
      los_blocked: losBlocked,
      block_distance_km: losBlocked ? Math.round((blockDist ?? 0) * 10) / 10 : null,
      los_range_km: Math.round(losRange * 10) / 10,
      diffraction_range_km: Math.round(diffRange * 10) / 10,
      troposcatter_range_km: Math.round(tropoRange * 10) / 10,
      terrain_limited: losBlocked && diffRange === 0 && tropoRange === 0,
      power_limited: !losBlocked && effectiveRange < bandMaxRange,
    });

    const losPt = destinationPoint(origin.lat, origin.lng, losRange, angle);
    const diffPt = destinationPoint(origin.lat, origin.lng, diffRange, angle);
    const tropoPt = destinationPoint(origin.lat, origin.lng, tropoRange, angle);
    const overallPt = destinationPoint(origin.lat, origin.lng, effectiveRange, angle);
    losPolyPoints.push([losPt.lng, losPt.lat]);
    diffPolyPoints.push([diffPt.lng, diffPt.lat]);
    tropoPolyPoints.push([tropoPt.lng, tropoPt.lat]);
    overallPolyPoints.push([overallPt.lng, overallPt.lat]);
  }

  losPolyPoints.push(losPolyPoints[0]);
  diffPolyPoints.push(diffPolyPoints[0]);
  tropoPolyPoints.push(tropoPolyPoints[0]);
  overallPolyPoints.push(overallPolyPoints[0]);

  const ranges = radialResults.map(r => r.range_km);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const maxRange = Math.max(...ranges);
  const minRange = Math.min(...ranges);
  const maxIdx = ranges.indexOf(maxRange);
  const minIdx = ranges.indexOf(minRange);
  const losAvg = radialResults.reduce((a, r) => a + r.los_range_km, 0) / radialResults.length;
  const diffAvg = radialResults.reduce((a, r) => a + Math.max(0, r.diffraction_range_km - r.los_range_km), 0) / radialResults.length;
  const tropoAvg = radialResults.reduce((a, r) => a + Math.max(0, r.troposcatter_range_km - r.diffraction_range_km), 0) / radialResults.length;

  return {
    polygon: { type: 'Polygon', coordinates: [overallPolyPoints] },
    mode_polygons: {
      los: { type: 'Polygon', coordinates: [losPolyPoints] },
      diffraction: { type: 'Polygon', coordinates: [diffPolyPoints] },
      troposcatter: { type: 'Polygon', coordinates: [tropoPolyPoints] },
    },
    radials: radialResults,
    avg_range_km: Math.round(avgRange * 10) / 10,
    max_range_km: Math.round(maxRange * 10) / 10,
    min_range_km: Math.round(minRange * 10) / 10,
    max_direction: { angle: radialResults[maxIdx].angle, range_km: radialResults[maxIdx].range_km },
    min_direction: { angle: radialResults[minIdx].angle, range_km: radialResults[minIdx].range_km },
    terrain_blocked_count: radialResults.filter(r => r.los_blocked).length,
    power_limited_count: radialResults.filter(r => r.power_limited).length,
    elevation_m, terrain_factor: terrainInfo.factor, coverage_source: 'terrain_los',
    los_km: Math.round(losAvg * 10) / 10,
    diffraction_km: Math.round(diffAvg * 10) / 10,
    troposcatter_km: Math.round(tropoAvg * 10) / 10,
  };
}

// ============================================================
// KW/HF Coverage — Ground Wave + Sky Wave + NVIS
// ============================================================

async function calculateHFCoverage(
  origin: { lat: number; lng: number; elevation_m: number | null },
  params: CoverageParams,
  options: { radials?: number; max_range_km?: number; apiUrl?: string; antenna_height_m?: number }
): Promise<CoverageResult> {
  const numRadials = options.radials || 36;
  const antennaHeight = options.antenna_height_m ?? params.antenna_height_m ?? 10;
  const stepKm = 2.0;
  const bp = params.params;
  const f = params.f_MHz;
  const erp_dbw = params.P_TX_dbw + params.G_TX_dBi;
  const G_RX = 0;

  // Solar/ionosphere
  const now = params.time_override || new Date();
  const solarActivity = params.solar_activity ?? 1.0;
  const iono = computeMUF(origin.lat, origin.lng, now, solarActivity);

  // Determine if NVIS is applicable (3-10 MHz, low antenna or NVIS mode)
  const nvisActive = (params.nvis_mode || antennaHeight <= 3) && f >= 3 && f <= 10 && f <= iono.foF2 + 1;
  const nvisMaxRange = nvisActive ? (bp.nvis_max_km || 500) : 0;

  // Sky wave check
  const skyWavePossible = f >= iono.luf && f <= iono.muf;
  const absorption_db = f < iono.luf ? 20 : 5;
  const skyWaveMaxRange = skyWavePossible ? (bp.sky_wave_max_km || 3000) : 0;

  // Skip zone (for non-NIS antennas at higher bands)
  const isNVISantenna = antennaHeight <= 3;
  const skipZoneInner = isNVISantenna ? 0 : Math.min(20, bp.max_range_flat_km);
  const skipZoneOuter = isNVISantenna ? 0 : 2 * 300 * Math.tan(30 * Math.PI / 180); // ~346 km

  // Ground wave max range (radial calculation with elevation)
  const groundMaxRange = options.max_range_km || bp.max_range_terrain_km;

  let elevation_m = origin.elevation_m;
  if (elevation_m == null) {
    const elevResult = await fetchElevations([{ lat: origin.lat, lng: origin.lng }], options.apiUrl);
    elevation_m = elevResult[0];
  }
  if (elevation_m == null) {
    return fallbackHFEstimate(origin, params, numRadials, groundMaxRange, iono, nvisActive, skyWavePossible, skipZoneInner, skipZoneOuter, nvisMaxRange, skyWaveMaxRange);
  }

  // Fetch elevation points for ground wave range only
  const allPoints: Array<{ lat: number; lng: number }> = [];
  const radialPointIndices: number[][] = [];
  let pointIdx = 0;
  const numSteps = Math.ceil(groundMaxRange / stepKm);

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

  // Ground type from elevation
  const isDry = elevation_m > 1000;
  const alpha = isDry ? (bp.ground_alpha_dry || 0.3) : (bp.ground_alpha_moist || 0.1);

  const radialResults: RadialResult[] = [];
  const groundPolyPoints: number[][] = [];
  const nvisPolyPoints: number[][] = [];
  const skyPolyPoints: number[][] = [];
  const overallPolyPoints: number[][] = [];

  for (let r = 0; r < numRadials; r++) {
    const angle = (360 / numRadials) * r;
    const indices = radialPointIndices[r];
    const radialElevations = indices.map(i => allElevations[i]);
    const distances = indices.map((_, s) => (s + 1) * stepKm);

    // Ground wave range — compute link budget
    let groundRange = 0;
    let lastGoodRx = -999, lastGoodMargin = -999;

    for (let s = 1; s <= numSteps; s++) {
      const d = s * stepKm;
      if (d > groundMaxRange) break;
      const l_gw = groundWaveLoss(d, f, alpha);
      const rx_gw = erp_dbw + 30 - l_gw + G_RX;
      if (rx_gw >= params.Rx_sensitivity_dbm) {
        groundRange = d;
        lastGoodRx = rx_gw;
        lastGoodMargin = rx_gw - params.Rx_sensitivity_dbm;
      } else {
        break;
      }
    }

    // NVIS range (if active)
    let nvisRange = 0;
    if (nvisActive) {
      const l_nvis = nvisLoss(f, absorption_db);
      const rx_nvis = erp_dbw + 30 - l_nvis + G_RX;
      if (rx_nvis >= params.Rx_sensitivity_dbm) {
        nvisRange = nvisMaxRange;
      }
    }

    // Sky wave range (if possible)
    let skyRange = 0;
    if (skyWavePossible) {
      // Check sky wave at a few distances
      for (let d = Math.max(skipZoneOuter, 100); d <= skyWaveMaxRange; d += 100) {
        const l_sky = skyWaveLoss(d, f, absorption_db);
        const rx_sky = erp_dbw + 30 - l_sky + G_RX;
        if (rx_sky >= params.Rx_sensitivity_dbm) {
          skyRange = d;
        } else {
          break;
        }
      }
    }

    // Overall range = max of ground, NVIS, sky (accounting for skip zone)
    let effectiveRange = groundRange;
    let mode = 'ground_wave';
    if (nvisRange > effectiveRange) { effectiveRange = nvisRange; mode = 'nvis'; }
    // Sky wave only counts beyond skip zone
    if (skyRange > 0 && skyRange > effectiveRange) {
      effectiveRange = skyRange;
      mode = 'sky_wave';
    }

    radialResults.push({
      angle, range_km: Math.round(effectiveRange * 10) / 10,
      mode,
      rx_dbm: Math.round(lastGoodRx * 10) / 10,
      margin_db: Math.round(lastGoodMargin * 10) / 10,
      los_blocked: false,
      block_distance_km: null,
      los_range_km: Math.round(groundRange * 10) / 10,
      diffraction_range_km: 0,
      troposcatter_range_km: Math.round(nvisRange * 10) / 10,
      terrain_limited: false,
      power_limited: groundRange < groundMaxRange,
    });

    const groundPt = destinationPoint(origin.lat, origin.lng, groundRange, angle);
    const nvisPt = destinationPoint(origin.lat, origin.lng, nvisRange, angle);
    const skyPt = destinationPoint(origin.lat, origin.lng, skyRange, angle);
    const overallPt = destinationPoint(origin.lat, origin.lng, effectiveRange, angle);
    groundPolyPoints.push([groundPt.lng, groundPt.lat]);
    nvisPolyPoints.push([nvisPt.lng, nvisPt.lat]);
    skyPolyPoints.push([skyPt.lng, skyPt.lat]);
    overallPolyPoints.push([overallPt.lng, overallPt.lat]);
  }

  groundPolyPoints.push(groundPolyPoints[0]);
  nvisPolyPoints.push(nvisPolyPoints[0]);
  skyPolyPoints.push(skyPolyPoints[0]);
  overallPolyPoints.push(overallPolyPoints[0]);

  const ranges = radialResults.map(r => r.range_km);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const maxRange = Math.max(...ranges);
  const minRange = Math.min(...ranges);
  const maxIdx = ranges.indexOf(maxRange);
  const minIdx = ranges.indexOf(minRange);

  return {
    polygon: { type: 'Polygon', coordinates: [overallPolyPoints] },
    mode_polygons: {
      ground_wave: { type: 'Polygon', coordinates: [groundPolyPoints] },
      ...(nvisActive ? { nvis: { type: 'Polygon', coordinates: [nvisPolyPoints] } } : {}),
      ...(skyWavePossible ? { sky_wave: { type: 'Polygon', coordinates: [skyPolyPoints] } } : {}),
    },
    radials: radialResults,
    avg_range_km: Math.round(avgRange * 10) / 10,
    max_range_km: Math.round(maxRange * 10) / 10,
    min_range_km: Math.round(minRange * 10) / 10,
    max_direction: { angle: radialResults[maxIdx].angle, range_km: radialResults[maxIdx].range_km },
    min_direction: { angle: radialResults[minIdx].angle, range_km: radialResults[minIdx].range_km },
    terrain_blocked_count: 0,
    power_limited_count: radialResults.filter(r => r.power_limited).length,
    elevation_m, terrain_factor: terrainInfo.factor, coverage_source: 'terrain_los',
    muf_mhz: iono.muf, luf_mhz: iono.luf, time_of_day: iono.timeOfDay,
    skip_zone: skipZoneOuter > skipZoneInner ? { inner_km: Math.round(skipZoneInner), outer_km: Math.round(skipZoneOuter) } : undefined,
    is_hf: true,
  };
}

// ============================================================
// Fallbacks
// ============================================================

function fallbackBandEstimate(origin: { lat: number; lng: number }, params: CoverageParams, numRadials: number, bandMaxRange: number): CoverageResult {
  const radialResults: RadialResult[] = [];
  const polyPoints: number[][] = [];
  for (let r = 0; r < numRadials; r++) {
    const angle = (360 / numRadials) * r;
    radialResults.push({ angle, range_km: bandMaxRange, mode: 'los', rx_dbm: -999, margin_db: -999, los_blocked: false, block_distance_km: null, los_range_km: bandMaxRange, diffraction_range_km: 0, troposcatter_range_km: 0, terrain_limited: false, power_limited: true });
    const pt = destinationPoint(origin.lat, origin.lng, bandMaxRange, angle);
    polyPoints.push([pt.lng, pt.lat]);
  }
  polyPoints.push(polyPoints[0]);
  return {
    polygon: { type: 'Polygon', coordinates: [polyPoints] },
    mode_polygons: { los: { type: 'Polygon', coordinates: [polyPoints] } },
    radials: radialResults, avg_range_km: bandMaxRange, max_range_km: bandMaxRange, min_range_km: bandMaxRange,
    max_direction: { angle: 0, range_km: bandMaxRange }, min_direction: { angle: 0, range_km: bandMaxRange },
    terrain_blocked_count: 0, power_limited_count: numRadials, elevation_m: null, terrain_factor: 1, coverage_source: 'band_estimate',
  };
}

function fallbackHFEstimate(
  origin: { lat: number; lng: number }, params: CoverageParams, numRadials: number,
  groundMax: number, iono: { muf: number; luf: number; foF2: number; timeOfDay: string },
  nvisActive: boolean, skyWavePossible: boolean, skipInner: number, skipOuter: number,
  nvisMax: number, skyMax: number
): CoverageResult {
  const radialResults: RadialResult[] = [];
  const groundPts: number[][] = [];
  const overallPts: number[][] = [];
  for (let r = 0; r < numRadials; r++) {
    const angle = (360 / numRadials) * r;
    const range = Math.max(groundMax, nvisActive ? nvisMax : 0, skyWavePossible ? skyMax : 0);
    radialResults.push({ angle, range_km: range, mode: nvisActive ? 'nvis' : skyWavePossible ? 'sky_wave' : 'ground_wave', rx_dbm: -999, margin_db: -999, los_blocked: false, block_distance_km: null, los_range_km: groundMax, diffraction_range_km: 0, troposcatter_range_km: 0, terrain_limited: false, power_limited: true });
    const pt = destinationPoint(origin.lat, origin.lng, range, angle);
    groundPts.push([pt.lng, pt.lat]);
    overallPts.push([pt.lng, pt.lat]);
  }
  groundPts.push(groundPts[0]);
  overallPts.push(overallPts[0]);
  return {
    polygon: { type: 'Polygon', coordinates: [overallPts] },
    mode_polygons: { ground_wave: { type: 'Polygon', coordinates: [groundPts] } },
    radials: radialResults, avg_range_km: groundMax, max_range_km: groundMax, min_range_km: groundMax,
    max_direction: { angle: 0, range_km: groundMax }, min_direction: { angle: 0, range_km: groundMax },
    terrain_blocked_count: 0, power_limited_count: numRadials, elevation_m: null, terrain_factor: 1, coverage_source: 'band_estimate',
    muf_mhz: iono.muf, luf_mhz: iono.luf, time_of_day: iono.timeOfDay,
    skip_zone: skipOuter > skipInner ? { inner_km: skipInner, outer_km: skipOuter } : undefined,
    is_hf: true,
  };
}

// ============================================================
// Helpers
// ============================================================

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

export function buildUserParams(
  f_MHz: number, mode: string, power_watts: number, deviceType: DeviceType,
  antenna_height_m?: number, nvis_mode?: boolean, solar_activity?: number
): CoverageParams {
  const band = getBandFromFrequency(f_MHz);
  const bp = BAND_PARAMS[band];
  let h = antenna_height_m ?? getDeviceAntennaHeight(deviceType);
  // NVIS mode: force low antenna for KW bands
  if (nvis_mode && isHFBand(band) && f_MHz >= 3 && f_MHz <= 10) {
    h = 2;
  }
  return {
    f_MHz, band, mode,
    P_TX_dbw: wattsToDbw(power_watts),
    G_TX_dBi: getDeviceAntennaGain(band, deviceType),
    antenna_height_m: h,
    Rx_sensitivity_dbm: getModeSensitivity(mode),
    params: bp,
    nvis_mode,
    solar_activity: solar_activity ?? 1.0,
    time_override: null,
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

// ============================================================
// Path Profile (for MODUS A — point-to-point)
// ============================================================

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

  const fspl = calculateFSPL(distance, params.f_MHz);
  const l_diff = blocked ? knifeEdgeDiffraction(params.f_MHz, obstacleH, obstacleD1, obstacleD2) : 0;
  const l_ground = params.params.ground_loss_db_per_km * distance;
  const l_atmos = params.params.atmospheric_loss_db * (distance / 30);
  const l_total = fspl + l_diff + l_ground + l_atmos;
  const erp_dbw = params.P_TX_dbw + params.G_TX_dBi;
  const rx_power = erp_dbw + 30 - l_total;

  let lbRange = distance;
  for (let d = 1; d <= distance; d += stepKm) {
    const fsplCheck = calculateFSPL(d, params.f_MHz);
    const l_diffCheck = blocked && d >= (blockDistance ?? 0) ? knifeEdgeDiffraction(params.f_MHz, obstacleH, obstacleD1, obstacleD2) : 0;
    const l_totalCheck = fsplCheck + l_diffCheck + params.params.ground_loss_db_per_km * d + params.params.atmospheric_loss_db * (d / 30);
    const rxCheck = erp_dbw + 30 - l_totalCheck;
    if (rxCheck < params.Rx_sensitivity_dbm) { lbRange = d - stepKm; break; }
  }

  const reserve = rx_power - params.Rx_sensitivity_dbm;

  return {
    distance_km: Math.round(distance * 10) / 10,
    los_blocked: blocked,
    block_distance_km: blocked ? Math.round((blockDistance ?? 0) * 10) / 10 : null,
    rx_power_dbm: Math.round(rx_power * 10) / 10,
    l_total_db: Math.round(l_total * 10) / 10,
    link_budget_range_km: Math.round(lbRange * 10) / 10,
    coverage: rx_power >= params.Rx_sensitivity_dbm,
    reserve_db: Math.round(reserve * 10) / 10,
    profile, elevation_from: elevFrom, elevation_to: elevTo,
  };
}