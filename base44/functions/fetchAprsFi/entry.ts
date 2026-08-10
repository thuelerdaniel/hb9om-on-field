import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// APRS.fi API integration — fetches APRS station positions by callsign lookup.
// The aprs.fi API only supports name-based queries (no geographic area search).
// We query known repeater callsigns from our DB to:
// 1. Update repeater coordinates from APRS data
// 2. Create PrivateNode records for stations that are digipeaters/IGates
// API docs: https://aprs.fi/page/api

const APRS_API_BASE = 'https://api.aprs.fi/api/get';

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

    const apiKey = (user as any)?.aprs_fi_api_key || process.env.APRS_FI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'APRS_FI_API_KEY secret not set' }, { status: 500 });
    }

    const startTime = Date.now();
    let repeatersUpdated = 0;
    let aprsNodesFound = 0;
    let nodesSaved = 0;
    let totalCallsignsQueried = 0;
    let debugSample: any = null;
    let debugFirstResponse: any = null;

    // Step 1: Query all repeater callsigns from DB in batches of 100 (API limit)
    const repeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);
    totalCallsignsQueried = repeaters.length;

    const nodeRecords: any[] = [];

    for (let i = 0; i < repeaters.length; i += 100) {
      const chunk = repeaters.slice(i, i + 100);
      const names = chunk.map(r => r.callsign).filter(Boolean).join(',');
      if (!names) continue;
      try {
        const url = `${APRS_API_BASE}?name=${encodeURIComponent(names)}&what=loc&apikey=${apiKey}&format=json`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        if (!debugFirstResponse) debugFirstResponse = { result: data.result, found: data.found, entries: data.entries?.length || 0, desc: data.description || null, firstNames: (data.entries || []).slice(0, 3).map((e: any) => e.name) };
        if (data.result !== 'ok' || !data.entries) continue;
        if (!debugSample && data.entries.length > 0) debugSample = data.entries[0];

        for (const entry of data.entries) {
          if (!entry.lat || !entry.lng) continue;

          // Update repeater coordinates
          const repeater = chunk.find(r => r.callsign === entry.name);
          if (repeater && (repeater.lat == null || repeater.lng == null)) {
            try {
              await base44.asServiceRole.entities.Repeater.update(repeater.id, {
                lat: parseFloat(entry.lat),
                lng: parseFloat(entry.lng),
              });
              repeatersUpdated++;
            } catch {}
          }

          // Create PrivateNode records for digipeaters (type 'd') and IGates (type 'i')
          if (entry.type === 'd' || entry.type === 'i' || (entry.symbol && ['/#', '/r', '/R', '/i', '/&', '/T'].includes(entry.symbol))) {
            const { node_type, network, mode } = determineNodeType(entry);
            nodeRecords.push({
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
            });
            aprsNodesFound++;
          }
        }
      } catch {}
      // Rate limit: aprs.fi allows ~1 request per second
      if (i + 100 < repeaters.length) await new Promise(r => setTimeout(r, 1200));
    }

    // Step 2: Delete existing aprs.fi-sourced private nodes and bulk insert new ones
    try {
      await base44.asServiceRole.entities.PrivateNode.deleteMany({ source: 'aprs.fi' });
    } catch {}

    for (let i = 0; i < nodeRecords.length; i += 100) {
      const batch = nodeRecords.slice(i, i + 100);
      try {
        await base44.asServiceRole.entities.PrivateNode.bulkCreate(batch);
        nodesSaved += batch.length;
      } catch {}
    }

    return Response.json({
      status: 'success',
      repeaters_queried: totalCallsignsQueried,
      repeaters_updated_with_coords: repeatersUpdated,
      aprs_nodes_found: aprsNodesFound,
      private_nodes_saved: nodesSaved,
      duration_ms: Date.now() - startTime,
      debug: {
        sample: debugSample ? { name: debugSample.name, symbol: debugSample.symbol, type: debugSample.type } : null,
        firstResponse: debugFirstResponse,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}