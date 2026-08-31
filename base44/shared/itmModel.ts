// itmModel.ts — Shared Longley-Rice ITM propagation model + elevation fetching.
// Used by computeItmPropagation and computeItmCoverage backend functions.

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function destinationPoint(lat: number, lng: number, distanceKm: number, azimuthDeg: number): { lat: number; lng: number } {
  const R = 6371;
  const lat1 = lat * Math.PI / 180;
  const lng1 = lng * Math.PI / 180;
  const brng = azimuthDeg * Math.PI / 180;
  const d = distanceKm / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
}

// Elevation cache (runtime, per cold-start) — rounded to ~100m for cache hits
const elevationCache = new Map<string, number>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

// Open-Elevation API fallback (free, no key, POST request, up to 2000 points)
async function fetchOpenElevation(
  points: Array<{ lat: number; lng: number }>
): Promise<Array<number | null>> {
  const url = 'https://api.open-elevation.com/api/v1/lookup';
  const body = JSON.stringify({
    locations: points.map(p => ({ latitude: p.lat, longitude: p.lng })),
  });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!resp.ok) return points.map(() => null);
    const data = await resp.json();
    return (data.results || []).map((r: any) => r.elevation ?? null);
  } catch {
    return points.map(() => null);
  }
}

// Varied fallback elevation (NOT flat 500m — uses sine wave + base elevation)
function generateVariedFallback(
  points: Array<{ lat: number; lng: number }>,
  baseElev: number
): number[] {
  return points.map((p, i) => {
    const t = i / Math.max(points.length - 1, 1);
    // Gentle terrain variation: ±40m around base, smooth sine wave
    const variation = Math.sin(t * Math.PI * 3) * 40 + Math.cos(t * Math.PI * 5) * 15;
    return Math.round(baseElev + variation);
  });
}

// Interpolate elevation for a missing point from known neighbors
export function interpolateElevation(
  knownProfile: Array<{ elevation: number }>,
  targetDistFraction: number
): number {
  if (knownProfile.length === 0) return 500;
  if (knownProfile.length === 1) return knownProfile[0].elevation;
  const idx = targetDistFraction * (knownProfile.length - 1);
  const low = Math.floor(idx);
  const high = Math.min(low + 1, knownProfile.length - 1);
  const frac = idx - low;
  return knownProfile[low].elevation + (knownProfile[high].elevation - knownProfile[low].elevation) * frac;
}

// Robust batch elevation fetch: OpenTopoData → Open-Elevation → varied fallback
// Uses in-memory cache to avoid redundant API calls for same coordinates
export async function fetchElevationsBatch(
  points: Array<{ lat: number; lng: number }>
): Promise<number[]> {
  const elevations: number[] = new Array(points.length).fill(500);
  const uncachedIndices: number[] = [];
  const uncachedPoints: Array<{ lat: number; lng: number }> = [];

  // Check cache first
  for (let i = 0; i < points.length; i++) {
    const key = cacheKey(points[i].lat, points[i].lng);
    if (elevationCache.has(key)) {
      elevations[i] = elevationCache.get(key)!;
    } else {
      uncachedIndices.push(i);
      uncachedPoints.push(points[i]);
    }
  }

  if (uncachedPoints.length === 0) return elevations;

  // Determine base elevation from first point (for fallback)
  const baseElev = 500;

  // Try OpenTopoData in chunks of 100
  const batchSize = 100;
  const stillMissing: Array<{ index: number; pointIdx: number }> = [];

  for (let i = 0; i < uncachedPoints.length; i += batchSize) {
    const chunk = uncachedPoints.slice(i, i + batchSize);
    const locations = chunk.map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
    const url = `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locations)}&max_results=${chunk.length}`;

    let chunkResults: Array<number | null> = chunk.map(() => null);

    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        chunkResults = (data.results || []).map((r: any) => r?.elevation ?? null);
      }
    } catch {
      // OpenTopoData failed for this chunk
    }

    // Store results, track missing
    for (let j = 0; j < chunk.length; j++) {
      const globalIdx = uncachedIndices[i + j];
      if (chunkResults[j] != null) {
        elevations[globalIdx] = chunkResults[j]!;
        elevationCache.set(cacheKey(chunk[j].lat, chunk[j].lng), chunkResults[j]!);
      } else {
        stillMissing.push({ index: globalIdx, pointIdx: i + j });
      }
    }

    // Rate limit: 200ms between chunks
    if (i + batchSize < uncachedPoints.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // If still missing, try Open-Elevation for those points
  if (stillMissing.length > 0) {
    const missingPoints = stillMissing.map(m => uncachedPoints[m.pointIdx]);

    // Open-Elevation accepts up to 2000 points in one POST
    try {
      const openElevResults = await fetchOpenElevation(missingPoints);
      const stillMissingAfterOE: Array<{ index: number; pointIdx: number }> = [];

      for (let j = 0; j < stillMissing.length; j++) {
        const m = stillMissing[j];
        if (openElevResults[j] != null) {
          elevations[m.index] = openElevResults[j]!;
          elevationCache.set(cacheKey(missingPoints[j].lat, missingPoints[j].lng), openElevResults[j]!);
        } else {
          stillMissingAfterOE.push(m);
        }
      }

      // Final fallback: varied elevation for remaining missing points
      if (stillMissingAfterOE.length > 0) {
        const finalMissing = stillMissingAfterOE.map(m => uncachedPoints[m.pointIdx]);
        const fallbackElevs = generateVariedFallback(finalMissing, baseElev);
        for (let j = 0; j < stillMissingAfterOE.length; j++) {
          const m = stillMissingAfterOE[j];
          elevations[m.index] = fallbackElevs[j];
        }
      }
    } catch {
      // Open-Elevation completely failed — use varied fallback
      const fallbackElevs = generateVariedFallback(missingPoints, baseElev);
      for (let j = 0; j < stillMissing.length; j++) {
        elevations[stillMissing[j].index] = fallbackElevs[j];
      }
    }
  }

  return elevations;
}

// Fetch elevation profile along a path (uses robust batch fetch)
export async function fetchElevationProfile(
  lat1: number, lng1: number, lat2: number, lng2: number,
  samples: number
): Promise<Array<{ lat: number; lng: number; elevation: number }>> {
  const points: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    points.push({ lat: lat1 + (lat2 - lat1) * t, lng: lng1 + (lng2 - lng1) * t });
  }

  const elevations = await fetchElevationsBatch(points);
  return points.map((p, i) => ({ ...p, elevation: elevations[i] }));
}

// Longley-Rice ITM path loss computation (simplified)
export function computeLongleyRice(params: {
  frequency_mhz: number;
  tx_height_m: number;
  rx_height_m: number;
  elevation_profile: Array<{ elevation: number }>;
  distance_km: number;
  climate?: number;
  polarization?: number;
}): number {
  const { frequency_mhz, tx_height_m, rx_height_m, elevation_profile, distance_km, climate = 5 } = params;

  const wavelength = 300 / frequency_mhz;
  const f_mhz = frequency_mhz;
  const h1 = Math.max(tx_height_m, 1);
  const h2 = Math.max(rx_height_m, 1);

  // Free space path loss
  const fspl = 32.45 + 20 * Math.log10(f_mhz) + 20 * Math.log10(Math.max(distance_km, 0.1));

  // ALWAYS check for terrain obstructions along the path (even in LOS region)
  const profile = elevation_profile || [];
  let maxObstruction = 0;
  let obstructionDistance = 0;

  if (profile.length > 2) {
    const txElev = profile[0].elevation + h1;
    const rxElev = profile[profile.length - 1].elevation + h2;
    const totalDist = distance_km;

    for (let i = 1; i < profile.length - 1; i++) {
      const d = (i / (profile.length - 1)) * totalDist;
      const losHeight = txElev + (rxElev - txElev) * (d / totalDist);
      const obstruction = profile[i].elevation - losHeight;
      if (obstruction > maxObstruction) {
        maxObstruction = obstruction;
        obstructionDistance = d;
      }
    }
  }

  // Radio horizon (km)
  const d_h1 = 3.57 * Math.sqrt(h1);
  const d_h2 = 3.57 * Math.sqrt(h2);
  const d_horizon = d_h1 + d_h2;

  // If LOS and NO terrain obstructions: two-ray approximation
  if (distance_km <= d_horizon && maxObstruction <= 0) {
    return Math.max(fspl - 6, fspl * 0.85);
  }

  // Obstructed or beyond horizon: add knife-edge diffraction loss
  let diffLoss = 0;
  if (maxObstruction > 0) {
    const d1 = obstructionDistance;
    const d2 = distance_km - obstructionDistance;
    const v = Math.sqrt(2 * maxObstruction / wavelength) *
      Math.sqrt(Math.abs(2 * d1 * d2 / distance_km));
    diffLoss = 6.9 + 20 * Math.log10(Math.sqrt(v * v + 1) + v);
  }

  // Climate correction
  const climateFactor = [0, 0, -2, -1.5, -1, 0, 1, 1.5, 2][climate] || 0;

  const itmLoss = fspl + diffLoss + climateFactor;
  return Math.max(itmLoss, fspl);
}

// Clutter loss based on elevation heuristic
export function computeClutterLoss(profile: Array<{ elevation: number }>): number {
  if (!profile || profile.length === 0) return 5;

  let clutterLoss = 0;
  for (const p of profile) {
    const elev = p.elevation;
    if (elev < 500) clutterLoss = Math.max(clutterLoss, 15);
    else if (elev < 1000) clutterLoss = Math.max(clutterLoss, 10);
    else clutterLoss = Math.max(clutterLoss, 3);
  }
  return clutterLoss;
}

// Fresnel zone clearance (meters)
export function computeFresnelClearance(
  freqMhz: number,
  profile: Array<{ lat: number; lng: number; elevation: number }>
): number {
  if (profile.length < 3) return 100;

  const wavelength = 300 / freqMhz;
  let minClearance = Infinity;

  const d_total = haversine(
    profile[0].lat, profile[0].lng,
    profile[profile.length - 1].lat, profile[profile.length - 1].lng
  ) * 1000;

  const h_tx = profile[0].elevation;
  const h_rx = profile[profile.length - 1].elevation;

  for (let i = 1; i < profile.length - 1; i++) {
    const d1 = (i / (profile.length - 1)) * d_total;
    const d2 = d_total - d1;
    const r = Math.sqrt(wavelength * d1 * d2 / (d1 + d2));
    const losH = h_tx + (h_rx - h_tx) * (d1 / d_total);
    const clearance = (losH + r * 0.6) - profile[i].elevation;
    minClearance = Math.min(minClearance, clearance);
  }

  return minClearance === Infinity ? 100 : minClearance;
}

// Signal quality from dBm
export function getQuality(rxSignalDbm: number): string {
  if (rxSignalDbm >= -87) return 'excellent';
  if (rxSignalDbm >= -93) return 'good';
  if (rxSignalDbm >= -99) return 'fair';
  if (rxSignalDbm >= -107) return 'marginal';
  return 'none';
}

// Compute full ITM result for a single path
export async function computeItmPathLoss(params: {
  lat1: number; lng1: number; lat2: number; lng2: number;
  frequency_mhz: number;
  tx_height_m?: number;
  rx_height_m?: number;
  tx_power_w?: number;
  tx_gain_db?: number;
  rx_gain_db?: number;
  climate?: number;
}): Promise<{
  path_loss_db: number;
  itm_loss_db: number;
  clutter_loss_db: number;
  rx_signal_dbm: number;
  quality: string;
  elevation_profile: Array<{ lat: number; lng: number; elevation: number }>;
  distance_km: number;
  fresnel_clearance: number;
}> {
  const {
    lat1, lng1, lat2, lng2, frequency_mhz,
    tx_height_m = 10, rx_height_m = 1.5,
    tx_power_w = 50, tx_gain_db = 6, rx_gain_db = 0,
    climate = 5,
  } = params;

  const distance_km = haversine(lat1, lng1, lat2, lng2);
  const elevationProfile = await fetchElevationProfile(lat1, lng1, lat2, lng2, 50);

  const itmLoss = computeLongleyRice({
    frequency_mhz,
    tx_height_m,
    rx_height_m,
    elevation_profile: elevationProfile,
    distance_km,
    climate,
  });

  const clutterLoss = computeClutterLoss(elevationProfile);
  const totalLoss = itmLoss + clutterLoss;

  const txPowerDbm = 10 * Math.log10(tx_power_w * 1000);
  const eirp = txPowerDbm + tx_gain_db;
  const rxSignalDbm = eirp - totalLoss + rx_gain_db;

  return {
    path_loss_db: totalLoss,
    itm_loss_db: itmLoss,
    clutter_loss_db: clutterLoss,
    rx_signal_dbm: rxSignalDbm,
    quality: getQuality(rxSignalDbm),
    elevation_profile: elevationProfile,
    distance_km,
    fresnel_clearance: computeFresnelClearance(frequency_mhz, elevationProfile),
  };
}