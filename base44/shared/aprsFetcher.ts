// Shared APRS.fi fetch logic — used by fetchAprsFi (admin-triggered) and refreshAllData (scheduled).
// Combines name-based callsign lookups with area-based (bbox) queries to capture
// digipeaters, IGates, weather stations, and nodes worldwide.

const APRS_API_BASE = 'https://api.aprs.fi/api/get';

// Area-based query boxes — split high-density continents into quadrants for more results
const APRS_BBOXES = [
  { name: 'Europe NW', bbox: '50,-15,72,5' },
  { name: 'Europe NE', bbox: '50,5,72,30' },
  { name: 'Europe SW', bbox: '35,-15,50,5' },
  { name: 'Europe SE', bbox: '35,5,50,30' },
  { name: 'NA NW', bbox: '45,-170,75,-100' },
  { name: 'NA NE', bbox: '45,-100,75,-50' },
  { name: 'NA SW', bbox: '15,-170,45,-100' },
  { name: 'NA SE', bbox: '15,-100,45,-50' },
  { name: 'SA N', bbox: '-10,-85,15,-30' },
  { name: 'SA S', bbox: '-60,-85,-10,-30' },
  { name: 'Asia N', bbox: '35,25,75,120' },
  { name: 'Asia E', bbox: '35,120,75,180' },
  { name: 'Asia S', bbox: '-10,25,35,120' },
  { name: 'Asia W', bbox: '25,25,50,80' },
  { name: 'Africa N', bbox: '0,-20,40,55' },
  { name: 'Africa S', bbox: '-40,-20,0,55' },
  { name: 'Oceania N', bbox: '-25,110,0,180' },
  { name: 'Oceania S', bbox: '-50,110,-25,180' },
];

function determineNodeType(entry: any): { node_type: string; network: string; mode: string } {
  const symbol = entry.symbol || '';
  const comment = (entry.comment || '').toLowerCase();

  if (symbol === '/W' || symbol === '/_' || entry.type === 'w' || comment.includes('weather')) {
    return { node_type: 'weather_station', network: 'APRS Weather', mode: 'APRS' };
  }
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
  return { node_type: 'repeater_node', network: 'APRS', mode: 'APRS' };
}

// Core APRS fetch logic — takes a base44 service-role client and API key, returns result stats.
export async function fetchAprsData(base44: any, apiKey: string) {
  const startTime = Date.now();
  let repeatersUpdated = 0;
  let aprsNodesFound = 0;
  let nodesSaved = 0;
  let totalCallsignsQueried = 0;
  let bboxQueries = 0;
  let bboxStationsFound = 0;
  let brandmeisterLinks = 0;

  // Step 1: Query all repeater callsigns from DB in batches of 100 (API limit)
  const repeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);
  totalCallsignsQueried = repeaters.length;

  const nodeRecords: any[] = [];
  const seenCallsigns = new Set<string>();
  const repeaterByCallsign = new Map<string, any>();
  for (const r of repeaters) {
    if (r.callsign) repeaterByCallsign.set(r.callsign, r);
  }

  const FIXED_SYMBOLS = ['/#', '/r', '/R', '/i', '/I', '/&', '/T', '/n', '/H', '/h', '/N',
    '/L', '/l', '/S', '/s', '/O', '/Y', '/y', '/`', '/d', '/o', '/W', '/_',
    '/x', '/a', '/A', '/f', '/F', '/m', '/M'];

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
      if (data.result !== 'ok' || !data.entries) continue;

      for (const entry of data.entries) {
        if (!entry.lat || !entry.lng) continue;
        seenCallsigns.add(entry.name);

        const repeater = repeaterByCallsign.get(entry.name);
        if (repeater && (repeater.lat == null || repeater.lng == null)) {
          try {
            await base44.asServiceRole.entities.Repeater.update(repeater.id, {
              lat: parseFloat(entry.lat),
              lng: parseFloat(entry.lng),
            });
            repeatersUpdated++;
          } catch {}
        }

        if (entry.type === 'd' || entry.type === 'i' || entry.type === 'w' || entry.type === 'o' ||
            (entry.symbol && FIXED_SYMBOLS.includes(entry.symbol))) {
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
    if (i + 100 < repeaters.length) await new Promise(r => setTimeout(r, 1200));
  }

  // Step 1b: Area-based queries (bbox)
  const FIXED_SYMBOLS_BBOX = ['/#', '/r', '/R', '/i', '/I', '/&', '/T', '/n', '/H', '/h',
    '/N', '/L', '/l', '/S', '/s', '/O', '/Y', '/y', '/`', '/d', '/o', '/W', '/_',
    '/p', '/P', '/s', '/m', '/M', '/x', '/a', '/A', '/f', '/F'];

  for (const box of APRS_BBOXES) {
    try {
      const url = `${APRS_API_BASE}?bbox=${box.bbox}&what=loc&apikey=${apiKey}&format=json&limit=500`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.result !== 'ok' || !data.entries) continue;
      bboxQueries++;
      bboxStationsFound += data.entries.length;

      for (const entry of data.entries) {
        if (!entry.lat || !entry.lng) continue;
        if (seenCallsigns.has(entry.name)) continue;
        seenCallsigns.add(entry.name);

        if (entry.type === 'd' || entry.type === 'i' || entry.type === 'w' || entry.type === 'o' || entry.type === 's' ||
            (entry.symbol && FIXED_SYMBOLS_BBOX.includes(entry.symbol))) {
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
    await new Promise(r => setTimeout(r, 800));
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

  // Step 3: Fetch DMR repeater linking data from BrandMeister API
  try {
    const bmResp = await fetch('https://api.brandmeister.network/v2/repeater/?limit=0', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
    });
    if (bmResp.ok) {
      const bmData = await bmResp.json();
      if (bmData && Array.isArray(bmData)) {
        const ourRepeatersByCall = new Map<string, any>();
        for (const r of repeaters) {
          if (r.callsign) ourRepeatersByCall.set(r.callsign, r);
        }
        const linkRecords: any[] = [];
        for (const bmRep of bmData) {
          const ourRep = ourRepeatersByCall.get(bmRep.callsign);
          if (!ourRep || !ourRep.lat || !ourRep.lng) continue;
          if (bmRep.peerIDs && Array.isArray(bmRep.peerIDs)) {
            for (const peerId of bmRep.peerIDs) {
              const peerRep = repeaters.find(r => r.echolink_node === String(peerId));
              if (peerRep && peerRep.lat && peerRep.lng && peerRep.callsign !== ourRep.callsign) {
                linkRecords.push({
                  from_callsign: ourRep.callsign,
                  from_frequency: ourRep.frequency,
                  from_lat: ourRep.lat,
                  from_lng: ourRep.lng,
                  to_callsign: peerRep.callsign,
                  to_frequency: peerRep.frequency,
                  to_lat: peerRep.lat,
                  to_lng: peerRep.lng,
                  link_type: 'permanent',
                  color: '#3b82f6',
                  line_style: 'dashed',
                  status: 'approved',
                  description: 'BrandMeister DMR Crosslink',
                  network: 'BrandMeister',
                });
                brandmeisterLinks++;
              }
            }
          }
        }
        if (linkRecords.length > 0) {
          try {
            await base44.asServiceRole.entities.RepeaterLink.deleteMany({ network: 'BrandMeister' });
          } catch {}
          for (let i = 0; i < linkRecords.length; i += 100) {
            const batch = linkRecords.slice(i, i + 100);
            try {
              await base44.asServiceRole.entities.RepeaterLink.bulkCreate(batch);
            } catch {}
          }
        }
      }
    }
  } catch {}

  return {
    repeaters_queried: totalCallsignsQueried,
    repeaters_updated_with_coords: repeatersUpdated,
    aprs_nodes_found: aprsNodesFound,
    private_nodes_saved: nodesSaved,
    brandmeister_links: brandmeisterLinks,
    bbox_queries: bboxQueries,
    bbox_stations_found: bboxStationsFound,
    duration_ms: Date.now() - startTime,
  };
}