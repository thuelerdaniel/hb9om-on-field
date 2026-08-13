import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Hearham.com repeater API — alternative source for regions with poor RepeaterBook
// coverage (Canada, Asia, Africa). Free, no API key required.
//
// API: https://hearham.com/api/repeaters/v1
// Returns JSON array with fields: callsign, latitude, longitude, city, frequency (Hz),
// offset (Hz), mode, encode, decode, operational (0/1), description.
//
// Region filtering uses lat/lng bounding boxes:
// - canada: Lat 41-83, Lng -141 to -52
// - asia:   Lat -10 to 80, Lng 25 to 180
// - africa: Lat -35 to 37, Lng -20 to 55

const REGION_BOUNDS: Record<string, { north: number; south: number; east: number; west: number; country: string; cc: string }> = {
  canada: { north: 83, south: 41, east: -52, west: -141, country: 'Canada', cc: 'CA' },
  asia: { north: 80, south: -10, east: 180, west: 25, country: '', cc: '' },
  africa: { north: 37, south: -35, east: 55, west: -20, country: '', cc: '' },
};

function bandFromFreq(freqMHz: number): string {
  if (freqMHz >= 28 && freqMHz < 30) return '10m';
  if (freqMHz >= 50 && freqMHz < 54) return '6m';
  if (freqMHz >= 70 && freqMHz < 71) return '4m';
  if (freqMHz >= 144 && freqMHz < 148) return '2m';
  if (freqMHz >= 430 && freqMHz < 450) return '70cm';
  if (freqMHz >= 1240 && freqMHz < 1300) return '23cm';
  return 'Other';
}

function normalizeMode(mode: string): { primary: string; modes: string[] } {
  const m = (mode || '').toUpperCase().trim();
  const modes: string[] = [];
  if (m.includes('DMR')) modes.push('DMR');
  if (m.includes('D-STAR') || m.includes('DSTAR')) modes.push('D-STAR');
  if (m.includes('FUSION') || m.includes('YSF') || m.includes('C4FM')) modes.push('Fusion');
  if (m.includes('P25') || m.includes('P-25')) modes.push('P25');
  if (m.includes('NXDN')) modes.push('NXDN');
  if (m.includes('M17')) modes.push('M17');
  if (m.includes('FM') || modes.length === 0) modes.push('FM');
  const primary = modes[0] || 'FM';
  return { primary, modes };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const region = body.region || 'canada';
    const bounds = REGION_BOUNDS[region];
    if (!bounds) {
      return Response.json({ error: `Unknown region: ${region}. Valid: canada, asia, africa` }, { status: 400 });
    }

    // Fetch all repeaters from Hearham API
    const resp = await fetch('https://hearham.com/api/repeaters/v1', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'application/json' },
    });
    if (!resp.ok) {
      return Response.json({ error: `Hearham API returned ${resp.status}` }, { status: 502 });
    }
    const allRepeaters = await resp.json();

    if (!Array.isArray(allRepeaters)) {
      return Response.json({ error: 'Hearham API returned non-array data' }, { status: 502 });
    }

    // Filter by region bounding box
    const regionRepeaters: any[] = [];
    for (const r of allRepeaters) {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;
      if (lat < bounds.south || lat > bounds.north) continue;
      if (lng < bounds.west || lng > bounds.east) continue;

      const freqHz = parseFloat(r.frequency);
      const freqMHz = isNaN(freqHz) ? 0 : freqHz / 1000000;
      const offsetHz = parseFloat(r.offset);
      const offsetMHz = isNaN(offsetHz) ? 0 : offsetHz / 1000000;
      if (freqMHz < 0.1 || freqMHz > 2000) continue; // skip invalid frequencies

      const { primary, modes } = normalizeMode(r.mode);
      const status = r.operational === 1 || r.operational === '1' ? 'on-air' : 'off-air';

      regionRepeaters.push({
        callsign: (r.callsign || '').toUpperCase().trim(),
        frequency: freqMHz,
        offset_mhz: offsetMHz,
        tone: r.encode || '',
        modes,
        primary_mode: primary,
        location_name: r.city || r.description || '',
        country: bounds.country || r.city || '',
        country_code: bounds.cc,
        lat,
        lng,
        band: bandFromFreq(freqMHz),
        status,
        source: 'Hearham',
        web_url: 'https://hearham.com/repeaters',
      });
    }

    // Deduplicate by callsign + frequency (keep first)
    const seen = new Set<string>();
    const deduped = regionRepeaters.filter(r => {
      const key = `${r.callsign}|${r.frequency}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Delete old Hearham repeaters for this region
    // For Canada (country_code = CA), delete by country_code
    // For Asia/Africa (no single country_code), delete by source + bounding box
    if (bounds.cc) {
      await base44.asServiceRole.entities.Repeater.deleteMany({ source: 'Hearham', country_code: bounds.cc });
    } else {
      // Delete all Hearham-sourced repeaters in the region's bounding box
      // We can't do a bbox deleteMany directly, so we fetch and delete by IDs
      const oldHearham = await base44.asServiceRole.entities.Repeater.filter({ source: 'Hearham' });
      const toDelete = (oldHearham || []).filter((r: any) =>
        r.lat != null && r.lng != null &&
        r.lat >= bounds.south && r.lat <= bounds.north &&
        r.lng >= bounds.west && r.lng <= bounds.east
      );
      for (let i = 0; i < toDelete.length; i += 100) {
        const batch = toDelete.slice(i, i + 100);
        await Promise.all(batch.map((r: any) => base44.asServiceRole.entities.Repeater.delete(r.id)));
      }
    }

    // Bulk create new repeaters
    for (let i = 0; i < deduped.length; i += 100) {
      const batch = deduped.slice(i, i + 100);
      await base44.asServiceRole.entities.Repeater.bulkCreate(batch);
    }

    return Response.json({
      status: 'success',
      label: `Relais ${region === 'canada' ? 'Kanada' : region === 'asia' ? 'Asien' : 'Afrika'} (Hearham)`,
      count: deduped.length,
      source: 'Hearham API',
      region,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}