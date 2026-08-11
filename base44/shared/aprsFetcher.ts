// Shared APRS fetch logic — used by fetchAprsFi (admin-triggered) and refreshAllData (scheduled).
// Data source: aprs.fi API (callsign-based lookup, max 20 per request — API hard limit).
// The aprs.fi API does NOT support area/wildcard queries — only specific callsign lookups.
//
// DATA SOURCES:
// 1. BrandMeister API (api.brandmeister.network/v2/device/) — 33k+ DMR devices with lat/lng.
//    PRIMARY source: stored directly as PrivateNodes (full refresh: delete + re-create).
// 2. aprs.fi API (api.aprs.fi/api/get) — callsign-based lookup (max 20 per request).
//    Used to find APRS stations for repeater/log callsigns not in BrandMeister.

const APRS_API_BASE = 'https://api.aprs.fi/api/get';

// APRS symbol classification — maps APRS symbol codes to node types.
const SYMBOL_MAP: Record<string, string> = {
  '#': 'repeater_node', 'R': 'repeater_node', 'r': 'simplex_node',
  'T': 'repeater_node', 'N': 'repeater_node', 'n': 'allstar_node',
  'S': 'repeater_node',
  'I': 'echolink_node', 'i': 'echolink_node',
  'W': 'weather_station', '_': 'weather_station',
  'H': 'hotspot', 'h': 'hotspot',
  '>': 'car', 'J': 'car', 'j': 'car', 'K': 'car', 'k': 'car',
  'U': 'car', 'u': 'car', 'V': 'car', 'v': 'car',
  'Q': 'car', 'q': 'car', 'F': 'car', 'f': 'car',
  'a': 'car', 'm': 'car', 'P': 'car', 'p': 'car',
  '<': 'bike', 'b': 'bike', 'M': 'bike',
  's': 'boat', 'Y': 'boat', 'y': 'boat', 'C': 'boat',
  'A': 'aircraft', 'G': 'aircraft', 'g': 'aircraft',
  'X': 'aircraft', 'x': 'aircraft', 'B': 'aircraft',
  'O': 'aircraft', 'o': 'aircraft',
  '/': 'walker', '[': 'walker', 'Z': 'walker',
};

function classifyAprsStation(entry: any): { node_type: string; network: string; mode: string } {
  const symbol = entry.symbol || '';
  const comment = (entry.comment || '').toLowerCase();
  const type = entry.type || '';

  if (comment.includes('echolink')) return { node_type: 'echolink_node', network: 'EchoLink', mode: 'EchoLink' };
  if (comment.includes('allstar') || comment.includes('all star')) return { node_type: 'allstar_node', network: 'AllStar', mode: 'AllStar' };
  if (comment.includes('dmr') || comment.includes('brandmeister')) return { node_type: 'repeater_node', network: 'Brandmeister', mode: 'DMR' };
  if (comment.includes('d-star') || comment.includes('dstar')) return { node_type: 'repeater_node', network: 'D-STAR', mode: 'D-STAR' };
  if (comment.includes('fusion') || comment.includes('c4fm') || comment.includes('ysf')) return { node_type: 'repeater_node', network: 'Fusion', mode: 'Fusion' };
  if (comment.includes('hotspot') || comment.includes('pi-star') || comment.includes('pistar')) return { node_type: 'hotspot', network: 'Hotspot', mode: 'DMR' };

  if (type === 'w' || symbol === '/W' || symbol === '/_' || comment.includes('weather')) {
    return { node_type: 'weather_station', network: 'APRS Weather', mode: 'APRS' };
  }
  if (type === 'i' || symbol === '/I' || symbol === '/i' || comment.includes('igate')) {
    return { node_type: 'echolink_node', network: 'APRS IGate', mode: 'APRS' };
  }

  if (symbol && symbol.length >= 2) {
    const symChar = symbol[symbol.length - 1];
    const mapped = SYMBOL_MAP[symChar];
    if (mapped) {
      const isMobile = ['car', 'bike', 'boat', 'aircraft', 'walker'].includes(mapped);
      return { node_type: mapped, network: isMobile ? 'APRS Mobile' : 'APRS', mode: 'APRS' };
    }
  }

  if (type === 'd') return { node_type: 'repeater_node', network: 'APRS', mode: 'APRS' };
  if (type === 'l' || type === 'o' || type === 's') return { node_type: 'mobile', network: 'APRS', mode: 'APRS' };

  return { node_type: 'other', network: 'APRS', mode: 'APRS' };
}

function buildNodeRecord(entry: any, source: string = 'aprs.fi'): any {
  const { node_type, network, mode } = classifyAprsStation(entry);
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
    aprs_symbol: entry.symbol || '',
    source,
    status: 'active',
  };
}

function toAprsCallsign(callsign: string): string {
  return callsign.replace(/-(R|L|D|P|M|B)$/i, '').toUpperCase();
}

// Query aprs.fi API for a batch of callsigns — MAX 20 per request (API hard limit).
// Previous code used BATCH_SIZE=150, but the API only returns 20 — 87% of queries were lost!
async function queryAprsFiBatch(callsigns: string[], apiKey: string): Promise<any[]> {
  const names = callsigns.filter(Boolean).join(',');
  if (!names) return [];
  const url = `${APRS_API_BASE}?name=${encodeURIComponent(names)}&what=loc&apikey=${apiKey}&format=json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      if (data.code === 'ratelimit') {
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (data.result !== 'ok' || !data.entries) return [];
      return data.entries.filter((e: any) => e.lat && e.lng);
    } catch {
      return [];
    }
  }
  return [];
}

// Fetch ALL BrandMeister DMR devices worldwide — primary source for APRS nodes.
async function fetchBrandMeisterDevices(): Promise<any[]> {
  try {
    const resp = await fetch('https://api.brandmeister.network/v2/device/', {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data)) return [];
    return data.filter((d: any) => d.lat != null && d.lng != null).map((d: any) => ({
      callsign: d.callsign,
      node_type: 'repeater_node',
      frequency: parseFloat(d.tx) || 0,
      mode: 'DMR',
      network: 'BrandMeister',
      node_number: String(d.id || ''),
      location_name: (d.city || '').substring(0, 100),
      country: '',
      country_code: '',
      lat: d.lat,
      lng: d.lng,
      description: `BrandMeister DMR ${d.hardware || ''} TX:${d.tx || ''} RX:${d.rx || ''}`.trim(),
      aprs_symbol: '',
      source: 'brandmeister',
      status: d.status === 1 ? 'active' : 'inactive',
    }));
  } catch {
    return [];
  }
}

// Core APRS fetch — optimized to avoid platform timeout.
// Strategy: full refresh for BrandMeister (delete + re-create), enrichment via aprs.fi
// for repeater/log callsigns only (not BM — they already have coordinates).
export async function fetchAprsData(base44: any, apiKey: string) {
  const startTime = Date.now();
  let aprsNodesFound = 0;
  let nodesSaved = 0;
  let repeatersUpdated = 0;
  let bmDevicesSaved = 0;
  let brandmeisterLinks = 0;

  // Step 1: Fetch BrandMeister devices (primary source — 33k+ devices)
  const bmDevices = await fetchBrandMeisterDevices();

  // Step 2: Full refresh of BrandMeister nodes — delete all BM-source nodes, re-create.
  // Much faster than loading 55k existing nodes to dedup (which caused 99s timeout).
  try {
    await base44.asServiceRole.entities.PrivateNode.deleteMany({ source: 'brandmeister' });
  } catch {}

  // Bulk create all BM devices in batches of 500
  for (let i = 0; i < bmDevices.length; i += 500) {
    const batch = bmDevices.slice(i, i + 500);
    try {
      await base44.asServiceRole.entities.PrivateNode.bulkCreate(batch);
      bmDevicesSaved += batch.length;
    } catch {}
  }

  // Step 3: Query aprs.fi for repeater + log callsigns ONLY (not BM — already have coords).
  // This is the enrichment step: finds APRS stations not in BrandMeister.
  const repeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);
  const logs = await base44.asServiceRole.entities.Log.list("-created_date", 5000);

  const allCallsigns = new Set<string>();
  const repeatersByBaseCall = new Map<string, any[]>();
  for (const r of repeaters) {
    if (r.callsign) {
      const base = toAprsCallsign(r.callsign);
      if (!repeatersByBaseCall.has(base)) repeatersByBaseCall.set(base, []);
      repeatersByBaseCall.get(base)!.push(r);
      allCallsigns.add(base);
    }
  }
  for (const log of logs) {
    if (log.callsign) allCallsigns.add(toAprsCallsign(log.callsign));
  }

  // Load existing aprs.fi-source nodes to avoid duplicates (only aprs.fi source, not BM)
  let existingAprsByCallsign = new Set<string>();
  try {
    const existingAprs = await base44.asServiceRole.entities.PrivateNode.filter({ source: 'aprs.fi' }, "-updated_date", 10000);
    for (const n of existingAprs) {
      if (n.callsign) existingAprsByCallsign.add(n.callsign.toUpperCase());
    }
  } catch {}

  // Only query callsigns NOT already in the DB as aprs.fi-source nodes
  const newCallsigns = [...allCallsigns].filter(cs => !existingAprsByCallsign.has(cs.toUpperCase()));

  // Query aprs.fi in batches of 20 (API hard limit) with 500ms delay.
  // Previous code used BATCH_SIZE=150 (API returns only 20!) and 2000ms delay (40s total).
  const BATCH_SIZE = 20; // API hard limit — DO NOT increase
  const BATCH_DELAY = 500;
  const MAX_QUERIES = 500; // Limit to stay within platform timeout
  const callsignList = newCallsigns.slice(0, MAX_QUERIES);

  const nodeRecords: any[] = [];
  for (let i = 0; i < callsignList.length; i += BATCH_SIZE) {
    const batch = callsignList.slice(i, i + BATCH_SIZE);
    try {
      const entries = await queryAprsFiBatch(batch, apiKey);
      for (const entry of entries) {
        if (!entry.lat || !entry.lng) continue;
        nodeRecords.push(buildNodeRecord(entry));
        aprsNodesFound++;

        // Update repeater coordinates if missing (match by base callsign)
        const cs = entry.name.toUpperCase();
        const matchingReps = repeatersByBaseCall.get(cs) || [];
        for (const rep of matchingReps) {
          if (rep.lat == null || rep.lng == null) {
            try {
              await base44.asServiceRole.entities.Repeater.update(rep.id, {
                lat: parseFloat(entry.lat),
                lng: parseFloat(entry.lng),
              });
              repeatersUpdated++;
            } catch {}
          }
        }
      }
    } catch {}
    if (i + BATCH_SIZE < callsignList.length) await new Promise(r => setTimeout(r, BATCH_DELAY));
  }

  // Bulk insert new aprs.fi nodes
  for (let i = 0; i < nodeRecords.length; i += 100) {
    const batch = nodeRecords.slice(i, i + 100);
    try {
      await base44.asServiceRole.entities.PrivateNode.bulkCreate(batch);
      nodesSaved += batch.length;
    } catch {}
  }

  // Step 4: Fetch DMR repeater linking data from BrandMeister API
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
    repeaters_queried: repeaters.length,
    log_callsigns_queried: logs.length,
    total_callsigns_queried: callsignList.length,
    new_callsigns_queried: newCallsigns.length,
    repeaters_updated_with_coords: repeatersUpdated,
    aprs_nodes_found: aprsNodesFound,
    private_nodes_saved: nodesSaved,
    brandmeister_links: brandmeisterLinks,
    brandmeister_devices_found: bmDevices.length,
    brandmeister_devices_saved: bmDevicesSaved,
    duration_ms: Date.now() - startTime,
  };
}