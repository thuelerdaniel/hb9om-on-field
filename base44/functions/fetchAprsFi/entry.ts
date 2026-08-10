import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// APRS.fi API integration — fetches APRS station positions (digipeaters, IGates,
// repeaters, private nodes/hotspots) worldwide and stores them as PrivateNode records.
// API docs: https://aprs.fi/page/api

const APRS_API_BASE = 'https://api.aprs.fi/api/get';

// APRS symbols that indicate repeaters, digipeaters, IGates, or nodes.
// Format: tableChar + symbolChar
const REPEATER_SYMBOLS = ['/#', '/r', '/R', '/i', '/&', '/T', '\\#', '\\r'];

// Geographic query centers covering major world regions.
// range in km, limit per query.
const QUERY_REGIONS = [
  { name: 'Europe', lat: 50, lng: 10, range: 2500, limit: 500 },
  { name: 'North America', lat: 45, lng: -100, range: 3000, limit: 500 },
  { name: 'South America', lat: -15, lng: -60, range: 3000, limit: 300 },
  { name: 'Asia', lat: 35, lng: 105, range: 3000, limit: 500 },
  { name: 'Africa', lat: 5, lng: 20, range: 3000, limit: 300 },
  { name: 'Oceania', lat: -25, lng: 135, range: 2500, limit: 300 },
];

function isRepeaterOrNode(entry: any): boolean {
  if (!entry.symbol) return false;
  if (REPEATER_SYMBOLS.includes(entry.symbol)) return true;
  // Also check type field: 'd' = digipeater, 'i' = igate
  if (entry.type === 'd' || entry.type === 'i') return true;
  // Check comment for repeater/node keywords
  const comment = (entry.comment || '').toLowerCase();
  if (comment.includes('repeater') || comment.includes('digipeater') || comment.includes('igate') || comment.includes('node') || comment.includes('hotspot')) return true;
  return false;
}

function determineNodeType(entry: any): { node_type: string; network: string; mode: string } {
  const symbol = entry.symbol || '';
  const comment = (entry.comment || '').toLowerCase();

  if (symbol === '/i' || entry.type === 'i' || comment.includes('igate')) {
    return { node_type: 'echolink_node', network: 'APRS IGate', mode: 'APRS' };
  }
  if (comment.includes('echolink')) {
    return { node_type: 'echolink_node', network: 'EchoLink', mode: 'EchoLink' };
  }
  if (comment.includes('allstar') || comment.includes('all star')) {
    return { node_type: 'allstar_node', network: 'AllStar', mode: 'AllStar' };
  }
  if (comment.includes('dmr') || comment.includes('brandmeister')) {
    return { node_type: 'repeater_node', network: 'Brandmeister', mode: 'DMR' };
  }
  if (comment.includes('d-star') || comment.includes('dstar')) {
    return { node_type: 'repeater_node', network: 'D-STAR', mode: 'D-STAR' };
  }
  if (comment.includes('fusion') || comment.includes('c4fm') || comment.includes('ysf')) {
    return { node_type: 'repeater_node', network: 'Fusion', mode: 'Fusion' };
  }
  if (comment.includes('hotspot') || comment.includes('pi-star') || comment.includes('pistar')) {
    return { node_type: 'hotspot', network: 'Hotspot', mode: 'DMR' };
  }
  // Default: digipeater
  return { node_type: 'repeater_node', network: 'APRS', mode: 'APRS' };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const apiKey = process.env.APRS_FI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'APRS_FI_API_KEY secret not set' }, { status: 500 });
    }

    const startTime = Date.now();
    const allEntries: any[] = [];
    const seenNames = new Set<string>();

    // Query each geographic region
    for (const region of QUERY_REGIONS) {
      try {
        const url = `${APRS_API_BASE}?what=loc&lat=${region.lat}&lng=${region.lng}&range=${region.range}&limit=${region.limit}&apikey=${apiKey}&format=json`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)', Accept: 'application/json' },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        if (data.result !== 'ok' || !data.entries) continue;

        for (const entry of data.entries) {
          if (!entry.name || !entry.lat || !entry.lng) continue;
          if (seenNames.has(entry.name)) continue;
          if (!isRepeaterOrNode(entry)) continue;
          seenNames.add(entry.name);
          allEntries.push(entry);
        }
      } catch {
        // skip failed regions
      }
    }

    // Also query aprs.fi for known repeater callsigns from the DB to update their coordinates
    const repeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);
    const repeatersWithoutCoords = repeaters.filter(r => r.lat == null || r.lng == null);
    let repeatersUpdated = 0;

    // Query aprs.fi for up to 100 repeater callsigns at a time (API limit)
    for (let i = 0; i < Math.min(repeatersWithoutCoords.length, 500); i += 100) {
      const chunk = repeatersWithoutCoords.slice(i, i + 100);
      const names = chunk.map(r => r.callsign).filter(Boolean).join(',');
      if (!names) continue;
      try {
        const url = `${APRS_API_BASE}?name=${encodeURIComponent(names)}&what=loc&apikey=${apiKey}&format=json`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        if (data.result !== 'ok' || !data.entries) continue;

        for (const entry of data.entries) {
          if (!entry.lat || !entry.lng) continue;
          const repeater = chunk.find(r => r.callsign === entry.name);
          if (repeater) {
            try {
              await base44.asServiceRole.entities.Repeater.update(repeater.id, {
                lat: parseFloat(entry.lat),
                lng: parseFloat(entry.lng),
              });
              repeatersUpdated++;
            } catch {}
          }
        }
      } catch {}
    }

    // Build PrivateNode records from APRS entries
    const nodeRecords = allEntries.map(entry => {
      const { node_type, network, mode } = determineNodeType(entry);
      return {
        callsign: entry.name,
        node_type,
        frequency: 0,
        mode,
        network,
        node_number: '',
        location_name: (entry.comment || '').substring(0, 100),
        country: '',
        country_code: '',
        lat: parseFloat(entry.lat),
        lng: parseFloat(entry.lng),
        description: entry.comment || '',
        source: 'aprs.fi',
        status: 'active',
      };
    });

    // Delete existing aprs.fi-sourced private nodes (keep RepeaterBook-sourced ones)
    try {
      await base44.asServiceRole.entities.PrivateNode.deleteMany({ source: 'aprs.fi' });
    } catch {}

    // BulkCreate in batches of 100
    let nodesSaved = 0;
    for (let i = 0; i < nodeRecords.length; i += 100) {
      const batch = nodeRecords.slice(i, i + 100);
      try {
        await base44.asServiceRole.entities.PrivateNode.bulkCreate(batch);
        nodesSaved += batch.length;
      } catch {}
    }

    return Response.json({
      status: 'success',
      aprs_stations_found: allEntries.length,
      private_nodes_saved: nodesSaved,
      repeaters_updated_with_coords: repeatersUpdated,
      regions_queried: QUERY_REGIONS.length,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}