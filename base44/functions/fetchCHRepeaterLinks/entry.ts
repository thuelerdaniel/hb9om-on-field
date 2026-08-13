import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// --- USKA HTML table parser ---
// The USKA HB Repeater Voice List has 9 columns:
// QRG TX | QRG RX | Call | QTH | Kanton | Locator | Alt. m | Remarks | Status
// Status: 0=planned, 1=qrv (active), 2=qrx (standby), 3=qrt (silent)

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Only strip actual HTML tags (must start with a letter or /), NOT <> cross-link markers
    .replace(/<[a-zA-Z/][^>]*>/g, '')
    .trim();
}

function parseUSKATable(html) {
  const repeaters = [];
  const rowMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];
    const cellMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cellMatches.length < 9) continue;
    const cells = cellMatches.map(m => decodeHtml(m[1]));
    const tx = parseFloat(cells[0]);
    const callsign = cells[2];
    if (isNaN(tx) || !callsign || callsign.length < 3) continue;
    repeaters.push({
      tx,
      rx: parseFloat(cells[1]),
      callsign,
      qth: cells[3],
      kanton: cells[4],
      locator: cells[5],
      altitude: parseInt(cells[6]) || null,
      remarks: cells[7],
      status: cells[8],
    });
  }
  return repeaters;
}

function extractEcholink(remarks) {
  const m = String(remarks).match(/EL#(\d+)/);
  return m ? m[1] : null;
}

function mapStatus(status) {
  const s = String(status).trim();
  if (s === '1') return 'on-air';
  if (s === '3') return 'off-air';
  if (s === '0' || s === '2') return 'testing';
  return null;
}

function extractModes(remarks) {
  const modes = [];
  const r = String(remarks);
  if (/\bNFM\b|\bFM\b/.test(r) && !modes.includes('FM')) modes.push('FM');
  if (/C4FM/.test(r) && !modes.includes('C4FM')) modes.push('C4FM');
  if (/D-STAR/.test(r) && !modes.includes('D-STAR')) modes.push('D-STAR');
  if (/DMR/.test(r) && !modes.includes('DMR')) modes.push('DMR');
  if (/NXDN/.test(r) && !modes.includes('NXDN')) modes.push('NXDN');
  if (/P25/.test(r) && !modes.includes('P25')) modes.push('P25');
  if (/M17/.test(r) && !modes.includes('M17')) modes.push('M17');
  if (/EL#/.test(r) && !modes.includes('EchoLink')) modes.push('EchoLink');
  return modes;
}

const BAND_NAMES = /^(2m|70cm|23cm|10m|6m|4m|3cm|33cm|1\.2m|13cm)$/i;
const NON_TARGETS = new Set([
  'RX', 'TX', 'NFM', 'FM', 'EL', 'CCS', 'C4FM', 'DMR', 'MM', 'T', 'QSY',
  'from', 'project', 'prov', 'WSPR', 'HAMNET', 'DAPNET', 'LoRa', 'APRS',
  'Winlink', 'Gateway', 'Hotspot', 'Relais', 'Bake', 'ID', 'CC', 'DCS',
  'Echo', 'CCS', 'Wires', 'SVX', 'SVXlink', 'Digipeater', 'iGate',
]);

function extractLinkTargets(remarks) {
  const targets = [];
  const seen = new Set();
  const r = String(remarks);

  // <>Target (bidirectional cross-link)
  for (const m of r.matchAll(/<>([A-Za-z][A-Za-z0-9-]+)/g)) {
    const name = m[1];
    const key = name.toLowerCase();
    if (BAND_NAMES.test(name)) continue;
    if (NON_TARGETS.has(name)) continue;
    if (name.length < 3) continue;
    if (!seen.has(key)) { seen.add(key); targets.push(key); }
  }

  // >Target (directional) — remove <> patterns first to avoid double-matching
  const withoutBi = r.replace(/<>\w+/g, '');
  for (const m of withoutBi.matchAll(/>\s*(?:RX\s+|TX\s+)?([A-Za-z][A-Za-z0-9-]+)/g)) {
    const name = m[1];
    const key = name.toLowerCase();
    if (BAND_NAMES.test(name)) continue;
    if (NON_TARGETS.has(name)) continue;
    if (name.length < 3) continue;
    if (!seen.has(key)) { seen.add(key); targets.push(key); }
  }

  return targets;
}

function detectNetwork(remarks) {
  const r = String(remarks);
  if (/EL#/.test(r)) return 'EchoLink';
  if (/CCS#/.test(r)) return 'D-STAR';
  if (/C4FM/.test(r)) return 'C4FM/Wires-X';
  if (/DMR/.test(r)) return 'DMR';
  if (/SVX/i.test(r)) return 'SVXLink';
  return 'FM-Crosslink';
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

    // 1. Fetch USKA page
    const resp = await fetch('https://uska.ch/hb-repeater-voice-list/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HB9OM-OnField/1.0)' },
    });
    if (!resp.ok) return Response.json({ error: `USKA fetch failed: ${resp.status}` }, { status: 502 });
    const html = await resp.text();

    // 2. Parse table
    const uskaRepeaters = parseUSKATable(html);
    if (uskaRepeaters.length === 0) {
      return Response.json({ error: 'No repeaters found in USKA HTML table' }, { status: 502 });
    }

    // 3. Get all existing repeaters — filter for CH/LI since USKA only lists Swiss repeaters.
    // Using filter({ country_code: 'CH' }) avoids loading 30k+ worldwide repeaters and
    // ensures Swiss repeaters (which may have older created_date) are included.
    const allRepeaters = await base44.asServiceRole.entities.Repeater.filter({ country_code: 'CH' });
    const liRepeaters = await base44.asServiceRole.entities.Repeater.filter({ country_code: 'LI' }).catch(() => []);
    const swissRepeaters = [...(allRepeaters || []), ...(liRepeaters || [])];

    // 4. Match and update
    let updatedCount = 0;
    const linksToCreate = [];
    const unmatched = [];

    for (const uska of uskaRepeaters) {
      const matches = swissRepeaters.filter(r =>
        r.callsign === uska.callsign &&
        Math.abs(r.frequency - uska.tx) < 0.001
      );

      if (matches.length === 0) {
        unmatched.push({ callsign: uska.callsign, tx: uska.tx, qth: uska.qth });
        continue;
      }

      for (const rep of matches) {
        const update = {};
        const el = extractEcholink(uska.remarks);
        if (el && !rep.echolink_node) update.echolink_node = el;
        if (uska.altitude && !rep.elevation_m) update.elevation_m = uska.altitude;
        const st = mapStatus(uska.status);
        if (st && rep.status === 'unknown') update.status = st;

        const newModes = extractModes(uska.remarks);
        if (newModes.length > 0) {
          const existingModes = rep.modes || [];
          const merged = [...existingModes];
          for (const m of newModes) {
            if (!merged.includes(m)) merged.push(m);
          }
          if (merged.length > existingModes.length) update.modes = merged;
        }

        if (Object.keys(update).length > 0) {
          try {
            await base44.asServiceRole.entities.Repeater.update(rep.id, update);
            updatedCount++;
          } catch { /* repeater may have been deleted/re-created by a parallel sync */ }
        }

        // Extract cross-links from remarks
        const linkTargets = extractLinkTargets(uska.remarks);
        for (const target of linkTargets) {
          // Try callsign match first (e.g. <>HB9T, <>HB9BA)
          const targetUpper = target.toUpperCase();
          let targetReps = swissRepeaters.filter(r =>
            r.callsign === targetUpper &&
            !(r.callsign === rep.callsign && Math.abs(r.frequency - rep.frequency) < 0.001)
          );
          // If no callsign match, try location name (e.g. <>Tamaro, <>Bachtel)
          if (targetReps.length === 0) {
            targetReps = swissRepeaters.filter(r =>
              r.location_name &&
              r.location_name.toLowerCase().includes(target) &&
              r.callsign !== rep.callsign
            );
          }
          if (targetReps.length === 0) continue;
          // Prefer Swiss repeaters, then closest by frequency
          const swissTarget = targetReps.find(r => r.country_code === 'CH') || targetReps[0];
          linksToCreate.push({
            from: rep,
            to: swissTarget,
            remarks: uska.remarks,
          });
        }
      }
    }

    // 5. Create RepeaterLink entries (deduped)
    const existingLinks = await base44.asServiceRole.entities.RepeaterLink.list("-created_date", 500);
    const existingLinkKeys = new Set();
    for (const l of existingLinks) {
      const key = [l.from_callsign + (l.from_frequency || ''), l.to_callsign + (l.to_frequency || '')].sort().join('→');
      existingLinkKeys.add(key);
    }

    const createdLinks = [];
    const seenNewKeys = new Set();
    for (const link of linksToCreate) {
      if (!link.from.lat || !link.from.lng || !link.to.lat || !link.to.lng) continue;
      const key = [link.from.callsign + link.from.frequency, link.to.callsign + link.to.frequency].sort().join('→');
      if (existingLinkKeys.has(key) || seenNewKeys.has(key)) continue;
      seenNewKeys.add(key);

      const network = detectNetwork(link.remarks);
      await base44.asServiceRole.entities.RepeaterLink.create({
        from_callsign: link.from.callsign,
        from_frequency: link.from.frequency,
        from_lat: link.from.lat,
        from_lng: link.from.lng,
        to_callsign: link.to.callsign,
        to_frequency: link.to.frequency,
        to_lat: link.to.lat,
        to_lng: link.to.lng,
        link_type: 'permanent',
        status: 'approved',
        description: 'USKA HB Repeater Voice List',
        network,
      });
      createdLinks.push({
        from: `${link.from.callsign} ${link.from.frequency}`,
        to: `${link.to.callsign} ${link.to.frequency}`,
        network,
      });
    }

    return Response.json({
      uskaCount: uskaRepeaters.length,
      matchedCount: uskaRepeaters.length - unmatched.length,
      updatedCount,
      linksCreated: createdLinks.length,
      links: createdLinks,
      unmatchedCount: unmatched.length,
      unmatchedSample: unmatched.slice(0, 15),
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}