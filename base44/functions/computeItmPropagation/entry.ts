// computeItmPropagation — Longley-Rice ITM path loss between two points.
// Fetches SRTM 30m elevation profile, computes ITM + clutter loss, returns signal quality.
// Available to all authenticated users.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeItmPathLoss } from '../../shared/itmModel.ts';

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
      lat1, lng1, lat2, lng2, frequency_mhz,
      tx_height_m, rx_height_m, tx_power_w, tx_gain_db, rx_gain_db, climate,
    } = body;

    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null || frequency_mhz == null) {
      return Response.json({ success: false, error: 'Missing required params (lat1, lng1, lat2, lng2, frequency_mhz)' }, { status: 400 });
    }

    const result = await computeItmPathLoss({
      lat1, lng1, lat2, lng2, frequency_mhz,
      tx_height_m, rx_height_m, tx_power_w, tx_gain_db, rx_gain_db, climate,
    });

    return Response.json({ success: true, ...result });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}