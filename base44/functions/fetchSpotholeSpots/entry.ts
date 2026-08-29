import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from '../../shared/internalAuth.ts';

// Spothole API integration — primary data source for spots and propagation.
// No API key required.
//
// Endpoints:
//   GET https://spothole.app/api/v2/spots?needs_sig=true&limit=500   (xOTA spots)
//   GET https://spothole.app/api/v2/spots?source=Cluster&limit=200    (DX-Cluster spots)
//   GET https://spothole.app/api/v2/solar                              (propagation)
//
// This function:
//   1. Fetches xOTA spots (needs_sig=true) — extracts sig_refs and upserts to SotaPoint/PotaPoint/WwffPoint
//   2. Fetches DX-Cluster spots — saves to ActivitySpot entity with source="Cluster"
//   3. Fetches solar data — saves to Propagation entity
//   4. Returns summary counts

const SPOTHOLE_BASE = 'https://spothole.app/api/v2';

// Map Spothole sig type to entity name
const SIG_ENTITY_MAP: Record<string, 'SotaPoint' | 'PotaPoint' | 'WwffPoint'> = {
  'SOTA': 'SotaPoint',
  'POTA': 'PotaPoint',
  'WWFF': 'WwffPoint',
};

interface SpotholeSpot {
  id: string;
  dx_call: string;
  dx_name?: string;
  dx_qth?: string;
  dx_country?: string;
  dx_continent?: string;
  dx_grid?: string;
  dx_latitude?: number;
  dx_longitude?: number;
  mode?: string;
  freq?: number;
  band?: string;
  sig?: string;
  sig_refs?: Array<{
    id: string;
    sig: string;
    name: string;
    ref_type: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    grid?: string;
    activation_score?: number;
  }>;
  time?: number;
  time_iso?: string;
  source?: string;
  comment?: string;
  de_call?: string;
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Upsert sig_refs into the corresponding point entity (SotaPoint/PotaPoint/WwffPoint)
async function upsertSigRefs(base44: any, sigType: string, sigRefs: any[]): Promise<number> {
  const entityName = SIG_ENTITY_MAP[sigType];
  if (!entityName || sigRefs.length === 0) return 0;

  const entity = base44.asServiceRole.entities[entityName];
  let upserted = 0;

  for (const ref of sigRefs) {
    if (!ref.id || ref.latitude == null || ref.longitude == null) continue;
    try {
      // Check if reference already exists by code
      const existing = await entity.filter({ code: ref.id });
      const pointData: any = {
        code: ref.id,
        name: ref.name || ref.id,
        lat: ref.latitude,
        lng: ref.longitude,
      };
      // Add altitude for SOTA
      if (sigType === 'SOTA' && ref.altitude != null) {
        pointData.altitude_m = ref.altitude;
        pointData.points = ref.activation_score;
      }
      if (sigType === 'POTA') {
        pointData.parkType = ref.ref_type || '';
        pointData.active = true;
      }
      if (sigType === 'WWFF') {
        pointData.link = `https://wwff.co/directory/?showRef=${ref.id}`;
      }

      if (existing && existing.length > 0) {
        // Update existing record with better coordinates/name if available
        await entity.update(existing[0].id, pointData);
      } else {
        // Create new record
        await entity.create(pointData);
      }
      upserted++;
    } catch {
      // Skip individual failures — continue with next ref
    }
  }
  return upserted;
}

// Save DX-Cluster spots to ActivitySpot entity
async function saveClusterSpots(base44: any, spots: SpotholeSpot[]): Promise<number> {
  if (spots.length === 0) return 0;
  const entity = base44.asServiceRole.entities.ActivitySpot;
  let saved = 0;

  for (const spot of spots) {
    try {
      const spotTime = spot.time_iso || (spot.time ? new Date(spot.time * 1000).toISOString() : new Date().toISOString());
      const activityType = spot.sig || 'DX';
      const refData = spot.sig_refs?.[0];

      await entity.create({
        call: spot.dx_call || '',
        activity_type: activityType as any,
        reference: refData?.id || '',
        name: refData?.name || spot.dx_qth || '',
        frequency: spot.freq ? spot.freq / 1000 : 0, // Convert Hz to kHz
        band: spot.band || '',
        mode: spot.mode || '',
        latitude: spot.dx_latitude || refData?.latitude,
        longitude: spot.dx_longitude || refData?.longitude,
        grid4: spot.dx_grid ? spot.dx_grid.substring(0, 4) : '',
        grid6: spot.dx_grid || '',
        comments: spot.comment || '',
        spotter: spot.de_call || '',
        source: `Spothole:${spot.source || 'Cluster'}`,
        spot_time: spotTime,
        is_active: true,
      });
      saved++;
    } catch {
      // Skip individual failures
    }
  }
  return saved;
}

// Save solar/propagation data to Propagation entity
async function savePropagation(base44: any, solar: any): Promise<boolean> {
  try {
    const entity = base44.asServiceRole.entities.Propagation;

    // Build band conditions array from hf_conditions
    const bandConditions = [];
    if (solar.hf_conditions) {
      for (const [key, val] of Object.entries(solar.hf_conditions)) {
        bandConditions.push({ band: key, condition: val as string, score: 0 });
      }
    }

    const propData: any = {
      solar_flux: solar.sfi || 0,
      a_index: solar.a_index || 0,
      k_index: solar.k_index || 0,
      bands: bandConditions,
      updated: new Date().toISOString(),
      source: 'Spothole',
    };

    // Add MUF if available (use foF2 max as approximation, or leave undefined)
    if (solar.muf) propData.muf = solar.muf;

    // Check if a recent propagation record exists (within 1 hour)
    const existing = await entity.list('-updated', 1);
    if (existing && existing.length > 0) {
      const lastUpdate = new Date(existing[0].updated || existing[0].created_date);
      const ageHours = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
      if (ageHours < 1) {
        // Update existing record
        await entity.update(existing[0].id, propData);
        return true;
      }
    }
    // Create new record
    await entity.create(propData);
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { skip_spots, skip_cluster, skip_solar } = body;
    const results: any = { spots: 0, sig_refs_upserted: {}, cluster_spots: 0, propagation: false };

    // 1. Fetch xOTA spots (needs_sig=true)
    if (!skip_spots) {
      try {
        const spots: SpotholeSpot[] = await fetchJson(
          `${SPOTHOLE_BASE}/spots?needs_sig=true&limit=10000`,
          15000
        );
        results.spots = spots.length;

        // Group sig_refs by type and upsert
        const refsByType: Record<string, any[]> = {};
        for (const spot of spots) {
          if (spot.sig_refs && spot.sig_refs.length > 0) {
            for (const ref of spot.sig_refs) {
              const sigType = ref.sig || spot.sig || '';
              if (!refsByType[sigType]) refsByType[sigType] = [];
              // Deduplicate by ref.id within this batch
              if (!refsByType[sigType].some(r => r.id === ref.id)) {
                refsByType[sigType].push(ref);
              }
            }
          }
        }

        // Upsert each type in parallel
        const upsertPromises = Object.entries(refsByType).map(async ([sigType, refs]) => {
          const count = await upsertSigRefs(base44, sigType, refs);
          return [sigType, count];
        });
        const upsertResults = await Promise.all(upsertPromises);
        for (const [sigType, count] of upsertResults) {
          results.sig_refs_upserted[sigType as string] = count as number;
        }
      } catch (e: any) {
        results.spots_error = e.message;
      }
    }

    // 2. Fetch DX-Cluster spots (source=Cluster)
    if (!skip_cluster) {
      try {
        const clusterSpots: SpotholeSpot[] = await fetchJson(
          `${SPOTHOLE_BASE}/spots?source=Cluster&limit=10000`,
          15000
        );
        results.cluster_spots = await saveClusterSpots(base44, clusterSpots);
      } catch (e: any) {
        results.cluster_error = e.message;
      }
    }

    // 3. Fetch APRS-like stations from Spothole (alternative APRS source)
    // Spothole spots with dx_latitude/dx_longitude but no sig are position-bearing stations
    // that can supplement the aprs.fi data as an alternative APRS source.
    if (!body.skip_aprs) {
      try {
        const allSpots: SpotholeSpot[] = await fetchJson(
          `${SPOTHOLE_BASE}/spots?limit=10000`,
          15000
        );
        // Filter spots that have position but no sig (APRS-like, not activity-based)
        const aprsLike = allSpots.filter(s =>
          s.dx_latitude != null && s.dx_longitude != null &&
          (!s.sig || s.sig === '') &&
          !(s.sig_refs && s.sig_refs.length > 0)
        );
        if (aprsLike.length > 0) {
          const aprsEntity = base44.asServiceRole.entities.AprsStation;
          let aprsSaved = 0;
          for (const spot of aprsLike.slice(0, 100)) {
            try {
              // Check if station already exists by callsign
              const existing = await aprsEntity.filter({ callsign: spot.dx_call });
              const stationData: any = {
                callsign: spot.dx_call || '',
                lat: spot.dx_latitude,
                lng: spot.dx_longitude,
                comment: spot.dx_qth || spot.comment || '',
                last_heard: spot.time_iso || new Date().toISOString(),
                source_callsign: spot.de_call || '',
                is_swiss: (spot.dx_call || '').startsWith('HB9') || (spot.dx_call || '').startsWith('HB9'),
              };
              if (existing && existing.length > 0) {
                await aprsEntity.update(existing[0].id, stationData);
              } else {
                await aprsEntity.create(stationData);
              }
              aprsSaved++;
            } catch { /* skip individual failures */ }
          }
          results.aprs_stations = aprsSaved;
        }
      } catch (e: any) {
        results.aprs_error = e.message;
      }
    }

    // 4. Fetch solar/propagation data
    if (!skip_solar) {
      try {
        const solar = await fetchJson(`${SPOTHOLE_BASE}/solar`, 10000);
        results.propagation = await savePropagation(base44, solar);
        results.solar_flux = solar.sfi;
        results.k_index = solar.k_index;
      } catch (e: any) {
        results.solar_error = e.message;
      }
    }

    return Response.json({ saved: true, ...results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});