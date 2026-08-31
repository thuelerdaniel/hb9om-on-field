// computeItmCoverage — ITM-based coverage polygon for a repeater.
// Samples N directions, steps outward, computes ITM path loss at each step.
// Returns coverage polygon (array of [lat, lng]) + per-direction details.
// Available to all authenticated users.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  haversine,
  destinationPoint,
  fetchElevationsBatch,
  computeLongleyRice,
  computeClutterLoss,
  getQuality,
} from '../../shared/itmModel.ts';

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      lat, lng, frequency_mhz,
      tx_height_m = 10, tx_power_w = 50, tx_gain_db = 6,
      band, max_range_km, directions = 16, step_km = 3,
      climate = 5,
    } = body;

    if (lat == null || lng == null || frequency_mhz == null) {
      return Response.json({ success: false, error: 'Missing required params (lat, lng, frequency_mhz)' }, { status: 400 });
    }

    // Determine max range based on band if not provided
    const maxRange = max_range_km || (band === '2m' ? 80 : band === '70cm' ? 50 : 60);
    const maxSteps = Math.ceil(maxRange / step_km);

    // Generate all sample points: directions × steps
    const allPoints: Array<{ lat: number; lng: number; dir: number; step: number }> = [];
    for (let d = 0; d < directions; d++) {
      const azimuth = (d / directions) * 360;
      for (let s = 1; s <= maxSteps; s++) {
        const dist = s * step_km;
        const pt = destinationPoint(lat, lng, dist, azimuth);
        allPoints.push({ ...pt, dir: d, step: s });
      }
    }

    // Batch fetch all elevations (includes repeater location as first point)
    const elevations = await fetchElevationsBatch([{ lat, lng }, ...allPoints]);
    const repeaterElev = elevations[0] || 500;
    const pointElevations = elevations.slice(1);

    // Organize elevations by direction
    const dirProfiles: Array<Array<number>> = Array.from({ length: directions }, () => [repeaterElev]);
    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i];
      dirProfiles[p.dir].push(pointElevations[i] || 500);
    }

    // For each direction, compute ITM at each step, find max reach
    const coveragePoints: Array<[number, number]> = [];
    const directionDetails: Array<{ azimuth: number; max_reach_km: number; signal_dbm: number; quality: string }> = [];

    for (let d = 0; d < directions; d++) {
      const azimuth = (d / directions) * 360;
      const profile = dirProfiles[d];
      let maxReach = 0;
      let maxSignalDbm = -999;
      let maxQuality = 'none';

      for (let s = 1; s < profile.length; s++) {
        const dist = s * step_km;
        const partialProfile = profile.slice(0, s + 1).map(elev => ({ elevation: elev }));

        const itmLoss = computeLongleyRice({
          frequency_mhz,
          tx_height_m,
          rx_height_m: 1.5,
          elevation_profile: partialProfile,
          distance_km: dist,
          climate,
        });

        const clutterLoss = computeClutterLoss(partialProfile);
        const totalLoss = itmLoss + clutterLoss;

        const txPowerDbm = 10 * Math.log10(tx_power_w * 1000);
        const eirp = txPowerDbm + tx_gain_db;
        const rxSignalDbm = eirp - totalLoss;
        const quality = getQuality(rxSignalDbm);

        if (quality !== 'none') {
          maxReach = dist;
          maxSignalDbm = rxSignalDbm;
          maxQuality = quality;
        } else {
          break; // no signal beyond this point
        }
      }

      if (maxReach > 0) {
        const pt = destinationPoint(lat, lng, maxReach, azimuth);
        coveragePoints.push([pt.lat, pt.lng]);
      } else {
        // No coverage in this direction — use a small distance to avoid gaps
        const pt = destinationPoint(lat, lng, step_km * 0.5, azimuth);
        coveragePoints.push([pt.lat, pt.lng]);
      }

      directionDetails.push({
        azimuth,
        max_reach_km: maxReach,
        signal_dbm: maxSignalDbm,
        quality: maxQuality,
      });
    }

    // Close the polygon
    if (coveragePoints.length > 0) {
      coveragePoints.push([...coveragePoints[0]]);
    }

    return Response.json({
      success: true,
      coverage_polygon: coveragePoints,
      geojson: {
        type: 'Polygon',
        coordinates: [coveragePoints.map(([la, lo]) => [lo, la])],
      },
      directions: directionDetails,
      repeater_elevation_m: repeaterElev,
    });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}