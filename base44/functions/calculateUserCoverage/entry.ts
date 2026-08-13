import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  calculateCoverage, buildUserParams, getBandFromFrequency, maidenheadToLatLng, isHFBand,
} from '../../shared/coverageCalc.ts';

// MODUS B: Calculate coverage polygon from a user's position.
// ITM+ model for VHF/UHF (LOS + Diffraction + Troposcatter + Reflection)
// KW model for HF (Ground Wave + Sky Wave + NVIS + Skip Zone)
// Returns an asymmetric GeoJSON polygon (36 radials) — NOT saved to database (privacy).

export default async function(req: any): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => (typeof req.body === 'object' ? req.body : {}));

    let lat = body?.lat;
    let lng = body?.lng;
    if ((lat == null || lng == null) && body?.qth_locator) {
      const pos = maidenheadToLatLng(body.qth_locator);
      if (pos) { lat = pos.lat; lng = pos.lng; }
    }
    if (lat == null || lng == null) {
      return Response.json({ error: 'Position erforderlich (lat/lng oder qth_locator)' }, { status: 400 });
    }

    let f_MHz = body?.frequency_mhz;
    if (f_MHz == null && body?.band) {
      const bandFreqs: Record<string, number> = {
        '160m': 1.85, '80m': 3.65, '60m': 5.3, '40m': 7.1, '30m': 10.1,
        '20m': 14.1, '17m': 18.1, '15m': 21.2, '12m': 24.9, '10m': 28.5,
        '6m': 50.5, '2m': 145.0, '1.25m': 220.0, '70cm': 435.0, '33cm': 915.0, '23cm': 1270.0,
      };
      f_MHz = bandFreqs[body.band] || 145.0;
    }
    if (f_MHz == null) {
      return Response.json({ error: 'Frequenz oder Band erforderlich' }, { status: 400 });
    }

    const deviceType = body?.device_type || 'mobil';
    const powerWatts = body?.power_watts || 50;
    const mode = body?.mode || 'FM';
    const antennaHeight = body?.antenna_height_m;
    const numRadials = body?.radials || 36;
    const nvisMode = body?.nvis_mode === true;
    const solarActivity = body?.solar_activity ?? 1.0;

    const params = buildUserParams(f_MHz, mode, powerWatts, deviceType, antennaHeight, nvisMode, solarActivity);
    const bandMaxRange = params.params.max_range_terrain_km;

    const result = await calculateCoverage(
      { lat, lng, elevation_m: null },
      params,
      { radials: numRadials, max_range_km: bandMaxRange, antenna_height_m: antennaHeight }
    );

    return Response.json({
      polygon: result.polygon,
      mode_polygons: result.mode_polygons,
      radials: result.radials,
      avg_range_km: result.avg_range_km,
      max_range_km: result.max_range_km,
      min_range_km: result.min_range_km,
      max_direction: result.max_direction,
      min_direction: result.min_direction,
      terrain_blocked_count: result.terrain_blocked_count,
      power_limited_count: result.power_limited_count,
      elevation_m: result.elevation_m,
      terrain_factor: result.terrain_factor,
      coverage_source: result.coverage_source,
      // ITM+ specific
      los_km: result.los_km,
      diffraction_km: result.diffraction_km,
      troposcatter_km: result.troposcatter_km,
      // KW specific
      muf_mhz: result.muf_mhz,
      luf_mhz: result.luf_mhz,
      time_of_day: result.time_of_day,
      skip_zone: result.skip_zone,
      is_hf: result.is_hf,
      params_used: {
        f_MHz: params.f_MHz, band: params.band, mode: params.mode,
        power_dbw: Math.round(params.P_TX_dbw * 10) / 10,
        antenna_gain_dBi: params.G_TX_dBi,
        antenna_height_m: params.antenna_height_m,
        rx_sensitivity_dbm: params.Rx_sensitivity_dbm,
        nvis_mode: params.nvis_mode,
        solar_activity: params.solar_activity,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}