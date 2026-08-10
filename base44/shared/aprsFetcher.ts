// Shared APRS fetch logic — used by fetchAprsFi (admin-triggered) and refreshAllData (scheduled).
// Data source: aprs.fi API (callsign-based lookup).
// The aprs.fi API does NOT support area/wildcard queries — only specific callsign lookups
// (max 20 per request). We query ALL known callsigns: repeaters from the DB + QSO partners
// from the Log entity. Every station returned is stored (fixed AND mobile), classified by APRS symbol.
// APRS is NOT the same as repeaters — this layer shows every station reporting to APRS.

const APRS_API_BASE = 'https://api.aprs.fi/api/get';

// APRS symbol classification — maps APRS symbol codes to node types.
// Reference: https://aprs.org/symbols/symbolsX.txt
const SYMBOL_MAP: Record<string, string> = {
  // Digipeater / repeater / node (fixed)
  '#': 'repeater_node', 'R': 'repeater_node', 'r': 'simplex_node',
  'T': 'repeater_node', 'N': 'repeater_node', 'n': 'allstar_node',
  'S': 'repeater_node',
  // IGate
  'I': 'echolink_node', 'i': 'echolink_node',
  // Weather
  'W': 'weather_station', '_': 'weather_station',
  // House / Ham / Home (fixed)
  'H': 'hotspot', 'h': 'hotspot',
  // Cars / vehicles (mobile)
  '>': 'car', 'J': 'car', 'j': 'car', 'K': 'car', 'k': 'car',
  'U': 'car', 'u': 'car', 'V': 'car', 'v': 'car',
  'Q': 'car', 'q': 'car', 'F': 'car', 'f': 'car',
  'a': 'car', 'm': 'car', 'P': 'car', 'p': 'car',
  // Bikes
  '<': 'bike', 'b': 'bike', 'M': 'bike',
  // Boats / ships
  's': 'boat', 'Y': 'boat', 'y': 'boat', 'C': 'boat',
  // Aircraft
  'A': 'aircraft', 'G': 'aircraft', 'g': 'aircraft',
  'X': 'aircraft', 'x': 'aircraft', 'B': 'aircraft',
  'O': 'aircraft', 'o': 'aircraft',
  // Walker / person
  '/': 'walker', '[': 'walker', 'Z': 'walker',
};

function classifyAprsStation(entry: any): { node_type: string; network: string; mode: string } {
  const symbol = entry.symbol || '';
  const comment = (entry.comment || '').toLowerCase();
  const type = entry.type || '';

  // Comment-based detection (network/mode)
  if (comment.includes('echolink')) return { node_type: 'echolink_node', network: 'EchoLink', mode: 'EchoLink' };
  if (comment.includes('allstar') || comment.includes('all star')) return { node_type: 'allstar_node', network: 'AllStar', mode: 'AllStar' };
  if (comment.includes('dmr') || comment.includes('brandmeister')) return { node_type: 'repeater_node', network: 'Brandmeister', mode: 'DMR' };
  if (comment.includes('d-star') || comment.includes('dstar')) return { node_type: 'repeater_node', network: 'D-STAR', mode: 'D-STAR' };
  if (comment.includes('fusion') || comment.includes('c4fm') || comment.includes('ysf')) return { node_type: 'repeater_node', network: 'Fusion', mode: 'Fusion' };
  if (comment.includes('hotspot') || comment.includes('pi-star') || comment.includes('pistar')) return { node_type: 'hotspot', network: 'Hotspot', mode: 'DMR' };

  // Weather
  if (type === 'w' || symbol === '/W' || symbol === '/_' || comment.includes('weather')) {
    return { node_type: 'weather_station', network: 'APRS Weather', mode: 'APRS' };
  }
  // IGate
  if (type === 'i' || symbol === '/I' || symbol === '/i' || comment.includes('igate')) {
    return { node_type: 'echolink_node', network: 'APRS IGate', mode: 'APRS' };
  }

  // Symbol-based classification
  if (symbol && symbol.length >= 2) {
    const symChar = symbol[symbol.length - 1];
    const mapped = SYMBOL_MAP[symChar];
    if (mapped) {
      const isMobile = ['car', 'bike', 'boat', 'aircraft', 'walker'].includes(mapped);
      return { node_type: mapped, network: isMobile ? 'APRS Mobile' : 'APRS', mode: 'APRS' };
    }
  }

  // Type-based fallback
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

// Query aprs.fi API for a batch of callsigns (max 20 per request — API limit).
// Returns array of entries with lat/lng. Does NOT filter by symbol/type — all stations stored.
// Strip repeater suffixes (-R, -L, -D, -P, -M, -B) to get the base APRS callsign.
// APRS uses base callsigns or numeric SSIDs (HB9GL, HB9GL-1), not repeater suffixes.
function toAprsCallsign(callsign: string): string {
  return callsign.replace(/-(R|L|D|P|M|B)$/i, '').toUpperCase();
}

async function queryAprsFiBatch(callsigns: string[], apiKey: string): Promise<any[]> {
  const names = callsigns.filter(Boolean).join(',');
  if (!names) return [];
  const url = `${APRS_API_BASE}?name=${encodeURIComponent(names)}&what=loc&apikey=${apiKey}&format=json`;
  // Retry on rate-limit with exponential backoff (aprs.fi returns code "ratelimit")
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'HB9OM-OnField/1.0', Accept: 'application/json' },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (data.code === 'ratelimit') {
      // Wait 5s / 10s before retrying
      await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    if (data.result !== 'ok' || !data.entries) return [];
    return data.entries.filter((e: any) => e.lat && e.lng);
  }
  return [];
}

// Core APRS fetch logic — takes a base44 service-role client and API key, returns result stats.
// INCREMENTAL: Existing APRS nodes are kept in the DB. Only NEW callsigns (not yet in DB) are
// queried from aprs.fi. Existing nodes are re-queried periodically to update positions.
// This grows the database incrementally — future queries only need to check for changes.
export async function fetchAprsData(base44: any, apiKey: string) {
  const startTime = Date.now();
  let repeatersUpdated = 0;
  let aprsNodesFound = 0;
  let nodesSaved = 0;
  let nodesUpdated = 0;
  let totalCallsignsQueried = 0;
  let brandmeisterLinks = 0;

  // Step 1: Collect ALL known callsigns to query:
  //   a) All repeater callsigns from the DB
  //   b) All QSO partner callsigns from the Log entity (users the operator has contacted)
  const repeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);
  const logs = await base44.asServiceRole.entities.Log.list("-created_date", 5000);

  // Map base callsign → array of repeaters (same base call on multiple bands)
  const repeatersByBaseCall = new Map<string, any[]>();
  const allCallsigns = new Set<string>();
  for (const r of repeaters) {
    if (r.callsign) {
      const base = toAprsCallsign(r.callsign);
      if (!repeatersByBaseCall.has(base)) repeatersByBaseCall.set(base, []);
      repeatersByBaseCall.get(base)!.push(r);
      allCallsigns.add(r.callsign);
    }
  }
  for (const log of logs) {
    if (log.callsign) allCallsigns.add(log.callsign);
  }

  // Step 1b: Load existing APRS nodes from DB to determine which callsigns are already known.
  // This is the incremental part — we only query NEW callsigns, not all of them every time.
  const existingNodes = await base44.asServiceRole.entities.PrivateNode.list("-updated_date", 10000);
  const existingByCallsign = new Map<string, any>();
  for (const n of existingNodes) {
    if (n.callsign) existingByCallsign.set(n.callsign.toUpperCase(), n);
  }

  // Step 2: Build APRS callsign list. Split into NEW (not in DB) and EXISTING (in DB).
  // NEW callsigns are always queried. EXISTING callsigns are re-queried to update positions
  // (but only a subset each time — those not updated in the last 7 days — to reduce API load).
  const aprsCallsigns = new Set<string>();
  for (const cs of allCallsigns) {
    const base = toAprsCallsign(cs);
    if (base) aprsCallsigns.add(base);
  }

  const newCallsigns: string[] = [];
  const existingCallsignsToRefresh: string[] = [];
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  for (const cs of aprsCallsigns) {
    const existing = existingByCallsign.get(cs.toUpperCase());
    if (!existing) {
      newCallsigns.push(cs);
    } else {
      // Re-query existing nodes if they haven't been updated in 7 days
      const lastUpdated = existing.updated_date ? new Date(existing.updated_date).getTime() : 0;
      if (Date.now() - lastUpdated > SEVEN_DAYS_MS) {
        existingCallsignsToRefresh.push(cs);
      }
    }
  }

  // Query NEW callsigns first (priority), then a subset of existing ones to refresh
  const callsignList = [...newCallsigns, ...existingCallsignsToRefresh];
  totalCallsignsQueried = callsignList.length;
  const BATCH_SIZE = 150;
  const BATCH_DELAY = 4000;
  const nodeRecords: any[] = [];
  const updatesByCallsign = new Map<string, any>(); // callsign → new entry data

  for (let i = 0; i < callsignList.length; i += BATCH_SIZE) {
    const batch = callsignList.slice(i, i + BATCH_SIZE);
    try {
      const entries = await queryAprsFiBatch(batch, apiKey);
      for (const entry of entries) {
        if (!entry.lat || !entry.lng) continue;
        const callsignUpper = entry.name.toUpperCase();
        const existing = existingByCallsign.get(callsignUpper);
        if (existing) {
          // Update existing node with new position/data
          updatesByCallsign.set(callsignUpper, entry);
        } else {
          // New node — will be bulk created
          nodeRecords.push(buildNodeRecord(entry));
          aprsNodesFound++;
        }

        // Update repeater coordinates if missing (match by base callsign)
        const matchingReps = repeatersByBaseCall.get(callsignUpper) || [];
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

  // Step 3: Update existing nodes with new positions (incremental update, no deletion)
  for (const [callsign, entry] of updatesByCallsign) {
    const existing = existingByCallsign.get(callsign);
    if (!existing) continue;
    try {
      const updatedData = buildNodeRecord(entry);
      await base44.asServiceRole.entities.PrivateNode.update(existing.id, {
        lat: parseFloat(entry.lat),
        lng: parseFloat(entry.lng),
        location_name: (entry.comment || '').substring(0, 100),
        description: entry.comment || '',
        aprs_symbol: entry.symbol || '',
        status: 'active',
      });
      nodesUpdated++;
    } catch {}
  }

  // Step 4: Bulk insert only NEW nodes (don't delete existing ones — incremental growth)
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
    total_callsigns_queried: totalCallsignsQueried,
    new_callsigns_queried: newCallsigns.length,
    existing_callsigns_refreshed: existingCallsignsToRefresh.length,
    repeaters_updated_with_coords: repeatersUpdated,
    aprs_nodes_found: aprsNodesFound,
    private_nodes_saved: nodesSaved,
    private_nodes_updated: nodesUpdated,
    brandmeister_links: brandmeisterLinks,
    duration_ms: Date.now() - startTime,
  };
}