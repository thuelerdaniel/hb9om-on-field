import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  calculatePathProfile, buildUserParams, buildRepeaterParams, maidenheadToLatLng, haversineKm,
} from '../../shared/coverageCalc.ts';

// MODUS A: "Can I reach this repeater?"
// Calculates path profile (elevation, LOS, link budget) between user and repeater.

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

    const repeaterId = body?.repeater_id;
    if (!repeaterId) {
      return Response.json({ error: 'repeater_id erforderlich' }, { status: 400 });
    }

    const repeater = await base44.asServiceRole.entities.Repeater.get(repeaterId);
    if (!repeater || repeater.lat == null || repeater.lng == null) {
      return Response.json({ error: 'Repeater nicht gefunden oder keine Koordinaten' }, { status: 404 });
    }

    const deviceType = body?.device_type || 'mobil';
    const powerWatts = body?.power_watts || 50;
    const f_MHz = body?.frequency_mhz || repeater.frequency;
    const mode = body?.mode || repeater.primary_mode || (repeater.modes?.[0] || 'FM');
    const antennaHeight = body?.antenna_height_m;

    const txParams = buildUserParams(f_MHz, mode, powerWatts, deviceType, antennaHeight);
    const repeaterParams = buildRepeaterParams(repeater.frequency, repeater.primary_mode || mode);
    txParams.Rx_sensitivity_dbm = repeaterParams.Rx_sensitivity_dbm;

    const result = await calculatePathProfile(
      { lat, lng, elevation_m: null },
      { lat: repeater.lat, lng: repeater.lng, elevation_m: repeater.elevation_m },
      txParams,
      { from_antenna_height_m: antennaHeight, to_antenna_height_m: 10 }
    );

    let verdict = '', verdictColor = '';
    if (!result.coverage) {
      if (result.los_blocked && result.block_distance_km != null) {
        verdict = 'Nicht erreichbar — Gelände blockiert'; verdictColor = 'red';
      } else {
        verdict = 'Ausserhalb Reichweite'; verdictColor = 'red';
      }
    } else if (result.reserve_db < 10) {
      verdict = 'Knapp — bei Schätzung unzuverlässig'; verdictColor = 'amber';
    } else if (result.los_blocked) {
      verdict = 'Indirekt — Beugung versorgt'; verdictColor = 'amber';
    } else if (result.reserve_db > 20) {
      verdict = 'Gut erreichbar'; verdictColor = 'green';
    } else {
      verdict = 'Erreichbar'; verdictColor = 'green';
    }

    return Response.json({
      repeater: {
        id: repeater.id, callsign: repeater.callsign, frequency: repeater.frequency,
        location_name: repeater.location_name, lat: repeater.lat, lng: repeater.lng,
        elevation_m: repeater.elevation_m,
      },
      distance_km: result.distance_km,
      los_blocked: result.los_blocked,
      block_distance_km: result.block_distance_km,
      rx_power_dbm: result.rx_power_dbm,
      l_total_db: result.l_total_db,
      reserve_db: result.reserve_db,
      coverage: result.coverage,
      verdict, verdict_color: verdictColor,
      profile: result.profile,
      elevation_from: result.elevation_from,
      elevation_to: result.elevation_to,
      params_used: {
        f_MHz: txParams.f_MHz, band: txParams.band, mode: txParams.mode,
        power_dbw: Math.round(txParams.P_TX_dbw * 10) / 10,
        antenna_gain_dBi: txParams.G_TX_dBi,
        antenna_height_m: txParams.antenna_height_m,
        rx_sensitivity_dbm: txParams.Rx_sensitivity_dbm,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}