import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// --- FM-Funknetz Talkgroup (TG) fetcher ---
// Fetches ALL nodes from FM-Funknetz reflector JSON endpoints and matches them
// to repeaters worldwide by callsign.
//
// Data sources:
// 1. https://dashboard.fm-funknetz.de/reflector1.json
//    → ALL nodes on reflector 1: { nodes: { "CALLSIGN": { DefaultTG, monitoredTGs, LAT, LONG, Type, ... } } }
// 2. https://dashboard.fm-funknetz.de/reflector2.json
//    → ALL nodes on reflector 2 (same structure)
// 3. https://nc1.fm-funknetz.de/dashtt/tgdb_proxy.php
//    → TG number → name mapping (PHP array)
//
// Node Type: 1=Repeater, 2=Simplex Link, 3=Hotspot
// DefaultTG: the TG the node defaults to (static config)
// monitoredTGs: array of TG numbers the node monitors

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Parse the TG database PHP array: 'TG_NUMBER' => 'TG Name'
function parseTgDb(phpText) {
  const tgMap = new Map();
  const re = /'(\d+)'\s*=>\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(phpText)) !== null) {
    const tgNumber = parseInt(m[1], 10);
    const tgName = decodeHtml(m[2]).trim();
    if (!isNaN(tgNumber) && tgName) {
      tgMap.set(tgNumber, tgName);
    }
  }
  return tgMap;
}

// Strip SvxLink suffixes to get the base callsign for matching.
// Examples: "DG7BST-APP" → "DG7BST", "DO3DT-P50" → "DO3DT", "DK1DP-HS" → "DK1DP"
function getBaseCallsigns(call) {
  const bases = new Set([call]);
  const dashIdx = call.indexOf('-');
  if (dashIdx > 0) {
    bases.add(call.substring(0, dashIdx));
  }
  return [...bases];
}

// Extract TG info from a node object — DefaultTG first, then monitoredTGs (max 5 total)
function extractNodeTgs(node) {
  const tgs = [];
  const seen = new Set();
  const defaultTg = parseInt(String(node.DefaultTG || ''), 10);
  if (!isNaN(defaultTg) && defaultTg > 0) {
    tgs.push(defaultTg);
    seen.add(defaultTg);
  }
  if (Array.isArray(node.monitoredTGs)) {
    for (const tg of node.monitoredTGs) {
      const tgNum = parseInt(String(tg), 10);
      if (!isNaN(tgNum) && tgNum > 0 && !seen.has(tgNum)) {
        tgs.push(tgNum);
        seen.add(tgNum);
      }
      if (tgs.length >= 5) break;
    }
  }
  return tgs;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Scheduled automation runs have no user context — allow if scheduled flag is set.
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // 1. Fetch TG database (PHP array with TG number → name mapping)
    let tgDb = new Map();
    try {
      const tgResp = await fetch('https://nc1.fm-funknetz.de/dashtt/tgdb_proxy.php', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HB9OM-OnField/1.0)' },
      });
      if (tgResp.ok) {
        const tgText = await tgResp.text();
        tgDb = parseTgDb(tgText);
      }
    } catch (e) {
      // TG DB is optional — TG numbers without names are still useful
    }

    // 2. Fetch reflector JSON files (ALL nodes with their TG config)
    const reflectorUrls = [
      'https://dashboard.fm-funknetz.de/reflector1.json',
      'https://dashboard.fm-funknetz.de/reflector2.json',
    ];
    const allNodes = new Map(); // baseCallsign → { tgs, type, lat, lng, location, fullCall }
    let totalNodesParsed = 0;

    for (const url of reflectorUrls) {
      try {
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HB9OM-OnField/1.0)' },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const nodes = data.nodes || {};
        for (const [callKey, node] of Object.entries(nodes)) {
          const call = String(callKey || '').trim();
          if (!call || call.length < 3) continue;
          totalNodesParsed++;

          const tgs = extractNodeTgs(node);
          if (tgs.length === 0) continue;

          // Parse TX frequency (output freq) for precise matching — avoids
          // matching all repeaters sharing a callsign but on different bands.
          const txFreq = node.TXFREQ ? parseFloat(node.TXFREQ) : null;
          const rxFreq = node.RXFREQ ? parseFloat(node.RXFREQ) : null;
          const nodeFreq = txFreq || rxFreq; // prefer TX, fall back to RX

          const bases = getBaseCallsigns(call);
          for (const base of bases) {
            if (!allNodes.has(base) || tgs.length > (allNodes.get(base).tgs?.length || 0)) {
              allNodes.set(base, {
                tgs,
                type: String(node.Type || ''),
                freq: nodeFreq,
                lat: node.LAT ? parseFloat(node.LAT) : null,
                lng: node.LONG ? parseFloat(node.LONG) : null,
                location: node.Location || node.nodeLocation || '',
                fullCall: call,
              });
            }
          }
        }
      } catch (e) {
        // Continue with next reflector
      }
    }

    if (totalNodesParsed === 0) {
      return Response.json({
        status: 'success',
        label: 'FM-Funknetz TGs',
        count: 0,
        withCoords: 0,
        withoutCoords: 0,
        timestamp: new Date().toISOString(),
        message: 'Keine Nodes im FM-Funknetz-Reflector gefunden',
      });
    }

    // 3. Get all existing repeaters — paginated to load ALL 31k+ records
    //    A single list() call caps at 5000, which would miss most repeaters.
    const allRepeaters: any[] = [];
    {
      const LIMIT = 5000;
      const MAX_PAGES = 20; // 20 × 5000 = 100k max
      for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await base44.asServiceRole.entities.Repeater.list("id", LIMIT, page * LIMIT);
        if (!batch || batch.length === 0) break;
        allRepeaters.push(...batch);
        if (batch.length < LIMIT) break;
      }
    }

    // 4. Match and update — match by callsign AND frequency (within 25 kHz tolerance)
    // to avoid matching all repeaters sharing a callsign but on different bands/sites.
    const FREQ_TOLERANCE = 0.025; // 25 kHz
    let updatedCount = 0;
    let clearedCount = 0;
    let matchedRepeaters = 0;
    const matchedIds = new Set();
    const matchedCallsigns = new Set();
    const now = new Date().toISOString();

    for (const rep of allRepeaters) {
      const nodeData = allNodes.get(rep.callsign);
      if (!nodeData) continue;

      // If the node has a frequency, require a match within tolerance.
      // If the node has no frequency (hotspots/apps), match by callsign only.
      if (nodeData.freq != null && rep.frequency != null) {
        if (Math.abs(nodeData.freq - rep.frequency) > FREQ_TOLERANCE) continue;
      }

      matchedRepeaters++;
      matchedIds.add(rep.id);
      matchedCallsigns.add(rep.callsign);

      // Build TG array with names from TG database
      const fmFunknetTgs = nodeData.tgs.map(tgNumber => ({
        tg_number: tgNumber,
        tg_name: tgDb.get(tgNumber) || '',
        last_seen: now,
      }));

      await base44.asServiceRole.entities.Repeater.update(rep.id, {
        fm_funknetz: true,
        fm_funknetz_tgs: fmFunknetTgs,
      });
      updatedCount++;
    }

    // 5. Clear FM-Funknetz data for repeaters that were previously flagged but no longer match
    const toClear = allRepeaters.filter(r => r.fm_funknetz === true && !matchedIds.has(r.id));
    for (const rep of toClear) {
      await base44.asServiceRole.entities.Repeater.update(rep.id, {
        fm_funknetz: false,
        fm_funknetz_tgs: [],
      });
      clearedCount++;
    }

    return Response.json({
      status: 'success',
      label: 'FM-Funknetz TGs',
      count: matchedRepeaters,
      withCoords: matchedRepeaters,
      withoutCoords: 0,
      timestamp: new Date().toISOString(),
      duration_ms: 0,
      totalNodesParsed,
      uniqueBaseCallsigns: allNodes.size,
      tgDbSize: tgDb.size,
      matchedRepeaterCallsigns: [...matchedCallsigns],
      updatedCount,
      clearedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}