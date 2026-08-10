import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// --- FM-Funknetz Talkgroup (TG) fetcher ---
// Fetches live activity data from dashboard.fm-funknetz.de JSON endpoints
// and matches active TGs to repeaters worldwide.
//
// Data sources:
// 1. https://dashboard.fm-funknetz.de/data/lastheard.json
//    → JSON array: [{ call, tg, server, time, duration, ts }]
// 2. https://nc1.fm-funknetz.de/dashtt/tgdb_proxy.php
//    → PHP array: 'TG_NUMBER' => 'TG Name'

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
// Also try without suffix stripping (e.g., "DO0SOB" is already a repeater callsign)
function getBaseCallsigns(call) {
  const bases = new Set([call]);
  const dashIdx = call.indexOf('-');
  if (dashIdx > 0) {
    bases.add(call.substring(0, dashIdx));
  }
  return [...bases];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // 1. Fetch lastheard JSON
    const lhResp = await fetch('https://dashboard.fm-funknetz.de/data/lastheard.json', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HB9OM-OnField/1.0)' },
    });
    if (!lhResp.ok) return Response.json({ error: `lastheard.json fetch failed: ${lhResp.status}` }, { status: 502 });
    const lastHeard = await lhResp.json();
    if (!Array.isArray(lastHeard) || lastHeard.length === 0) {
      return Response.json({
        status: 'success',
        label: 'FM-Funknetz TGs',
        count: 0,
        withCoords: 0,
        withoutCoords: 0,
        timestamp: new Date().toISOString(),
        message: 'Keine aktiven Stationen im Dashboard gefunden',
      });
    }

    // 2. Fetch TG database (PHP array with TG number → name mapping)
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
      // TG DB is optional — we can still use TG numbers from lastheard
    }

    // 3. Aggregate TGs per base callsign
    // Map: baseCallsign → Map(tgNumber → { tg_name, last_seen })
    const callsignTgMap = new Map();
    for (const entry of lastHeard) {
      const call = String(entry.call || '').trim();
      const tgNumber = parseInt(String(entry.tg), 10);
      if (!call || call.length < 3 || isNaN(tgNumber)) continue;

      // Use ts (Unix timestamp) if available, otherwise fallback to now
      const tsVal = Number(entry.ts);
      const lastSeen = (Number.isFinite(tsVal) && tsVal > 0)
        ? new Date(tsVal * 1000).toISOString()
        : new Date().toISOString();

      // Get TG name from database, or use empty string
      const tgName = tgDb.get(tgNumber) || '';

      const bases = getBaseCallsigns(call);
      for (const base of bases) {
        if (!callsignTgMap.has(base)) callsignTgMap.set(base, new Map());
        const tgMap = callsignTgMap.get(base);
        if (!tgMap.has(tgNumber)) {
          tgMap.set(tgNumber, { tg_number: tgNumber, tg_name: tgName, last_seen: lastSeen });
        } else {
          // Update last_seen if more recent
          const existing = tgMap.get(tgNumber);
          if (lastSeen > existing.last_seen) {
            existing.last_seen = lastSeen;
          }
        }
      }
    }

    // 4. Get all existing repeaters
    const allRepeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 5000);

    // 5. Match and update
    let updatedCount = 0;
    let matchedRepeaters = 0;
    const matchedCallsigns = new Set();

    for (const rep of allRepeaters) {
      const tgMap = callsignTgMap.get(rep.callsign);
      if (!tgMap) continue;

      matchedRepeaters++;
      matchedCallsigns.add(rep.callsign);

      // Build TG array (max 5 TGs per repeater, sorted by most recent first)
      const tgs = [...tgMap.values()]
        .sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
        .slice(0, 5);

      const update = {
        fm_funknetz: true,
        fm_funknetz_tgs: tgs,
      };

      await base44.asServiceRole.entities.Repeater.update(rep.id, update);
      updatedCount++;
    }

    return Response.json({
      status: 'success',
      label: 'FM-Funknetz TGs',
      count: matchedRepeaters,
      withCoords: matchedRepeaters,
      withoutCoords: 0,
      timestamp: new Date().toISOString(),
      duration_ms: 0,
      dashboardStations: lastHeard.length,
      uniqueCallsigns: callsignTgMap.size,
      tgDbSize: tgDb.size,
      matchedRepeaterCallsigns: [...matchedCallsigns],
      updatedCount,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}