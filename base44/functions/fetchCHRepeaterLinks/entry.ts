import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchWithRetry } from '../../shared/syncHelpers.ts';

// --- USKA HB Voice Repeater List ---
// v0.955: USKA-Website-Relaunch am 16.09.2026 — alte URL (/hb-repeater-voice-list/) liefert 404.
// NEU: JSON-API-Endpunkt https://uska.ch/wp-json/uska/v1/repeaters (308 Repeater, verifiziert 25.09.2026).
// HTML-Parsing als Fallback falls JSON-Endpunkt nicht erreichbar.
//
// JSON-Felder: tx, rx, call, qrz, qth, kanton, locator, alt, remarks, type,
//              bandwidth, rx_tone, tx_tone, dmr, dstar, c4fm, c4fm_node, notes, status
// Status: qrv=on-air, qrx=testing, planned=testing, qrt=off-air

const USKA_JSON_URL = 'https://uska.ch/wp-json/uska/v1/repeaters';
const USKA_HTML_URL = 'https://uska.ch/de/funkamateure/repeater-liste-und-bandplaene/hb-voice-repeater-list/';

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[a-zA-Z/][^>]*>/g, '')
    .trim();
}

// HTML Fallback parser — 16-column format (neue USKA-Tabelle)
function parseUSKATable(html: string): USKARepeater[] {
  const repeaters: USKARepeater[] = [];
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
      rx: parseFloat(cells[1]) || tx,
      call: callsign,
      qth: cells[3] || '',
      kanton: cells[4] || '',
      locator: cells[5] || '',
      alt: parseInt(cells[6]) || null,
      type: cells[7] || 'Analog',
      dmr: cells[8] === 'Y',
      dstar: cells[9] === 'Y',
      c4fm: cells[10] === 'Y',
      bandwidth: cells[11] || '',
      rx_tone: cells[12] || '',
      tx_tone: cells[13] || '',
      status: cells[14] || '',
      notes: cells[15] || '',
      remarks: cells[15] || '',
    });
  }
  return repeaters;
}

interface USKARepeater {
  tx: number;
  rx: number;
  call: string;
  qth: string;
  kanton: string;
  locator: string;
  alt: number | null;
  type: string;
  dmr: boolean;
  dstar: boolean;
  c4fm: boolean;
  bandwidth: string;
  rx_tone: string;
  tx_tone: string;
  status: string;
  notes: string;
  remarks: string;
}

function extractEcholink(remarks: string): string | null {
  const m = String(remarks).match(/EL#(\d+)/);
  return m ? m[1] : null;
}

function mapStatus(status: string): string | null {
  const s = String(status).trim().toLowerCase();
  if (s === 'qrv') return 'on-air';
  if (s === 'qrt') return 'off-air';
  if (s === 'qrx' || s === 'planned') return 'testing';
  return null;
}

function extractModes(rep: USKARepeater): string[] {
  const modes: string[] = [];
  // v0.955: Nutze strukturierte Felder (dmr/dstar/c4fm) statt Remarks-Parsing
  if (rep.dmr) modes.push('DMR');
  if (rep.dstar) modes.push('D-STAR');
  if (rep.c4fm) modes.push('C4FM');
  // FM aus Type oder Remarks ableiten
  const r = String(rep.remarks || '') + ' ' + String(rep.type || '');
  if (/\bNFM\b|\bFM\b/.test(r) && !modes.includes('FM')) modes.push('FM');
  if (/NXDN/.test(r) && !modes.includes('NXDN')) modes.push('NXDN');
  if (/P25/.test(r) && !modes.includes('P25')) modes.push('P25');
  if (/M17/.test(r) && !modes.includes('M17')) modes.push('M17');
  if (/EL#/.test(r) && !modes.includes('EchoLink')) modes.push('EchoLink');
  // Wenn keine Modi erkannt aber Type=Mixed/Analog → FM als Default
  if (modes.length === 0 && (rep.type === 'Analog' || rep.type === 'Mixed')) modes.push('FM');
  return modes;
}

const BAND_NAMES = /^(2m|70cm|23cm|10m|6m|4m|3cm|33cm|1\.2m|13cm)$/i;
const NON_TARGETS = new Set([
  'RX', 'TX', 'NFM', 'FM', 'EL', 'CCS', 'C4FM', 'DMR', 'MM', 'T', 'QSY',
  'from', 'project', 'prov', 'WSPR', 'HAMNET', 'DAPNET', 'LoRa', 'APRS',
  'Winlink', 'Gateway', 'Hotspot', 'Relais', 'Bake', 'ID', 'CC', 'DCS',
  'Echo', 'CCS', 'Wires', 'SVX', 'SVXlink', 'Digipeater', 'iGate',
]);

function extractLinkTargets(notes: string): string[] {
  const targets: string[] = [];
  const seen = new Set();
  const r = String(notes || '');

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

function detectNetwork(remarks: string): string {
  const r = String(remarks);
  if (/EL#/.test(r)) return 'EchoLink';
  if (/CCS#/.test(r)) return 'D-STAR';
  if (/C4FM/.test(r)) return 'C4FM/Wires-X';
  if (/DMR/.test(r)) return 'DMR';
  if (/SVX/i.test(r)) return 'SVXLink';
  return 'FM-Crosslink';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try { user = await base44.auth.me(); } catch {}
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Scheduled automation runs have no user context — allow if scheduled flag is set.
    if (body.scheduled !== true) {
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // v0.955: JSON-API als Primärquelle (stabil, strukturiert, keine HTML-Parsing-Anfälligkeit)
    let uskaRepeaters: USKARepeater[] = [];
    let dataSource = 'json';

    const jsonResult = await fetchWithRetry(USKA_JSON_URL, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; HB9OM-OnField/1.0)' },
    }, 15000);

    if (jsonResult.ok && jsonResult.json && Array.isArray(jsonResult.json.rows)) {
      uskaRepeaters = jsonResult.json.rows.map((r: any) => ({
        tx: parseFloat(r.tx) || 0,
        rx: parseFloat(r.rx) || 0,
        call: r.call || '',
        qth: r.qth || '',
        kanton: r.kanton || '',
        locator: r.locator || '',
        alt: r.alt ? parseInt(r.alt) : null,
        type: r.type || 'Analog',
        dmr: !!r.dmr,
        dstar: !!r.dstar,
        c4fm: !!r.c4fm,
        bandwidth: r.bandwidth || '',
        rx_tone: r.rx_tone || '',
        tx_tone: r.tx_tone || '',
        status: r.status || '',
        notes: r.notes || '',
        remarks: r.remarks || r.notes || '',
      })).filter((r: USKARepeater) => r.call && r.call.length >= 3 && !isNaN(r.tx));
    } else {
      // Fallback: HTML-Parsing (neue URL, 16-Spalten-Format)
      dataSource = 'html';
      const htmlResult = await fetchWithRetry(USKA_HTML_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HB9OM-OnField/1.0)' },
      }, 30000);
      if (!htmlResult.ok) {
        return Response.json({ error: `USKA fetch failed (JSON+HTML): ${jsonResult.error || ''} / ${htmlResult.error || ''}` }, { status: 502 });
      }
      uskaRepeaters = parseUSKATable(htmlResult.text);
    }

    if (uskaRepeaters.length === 0) {
      return Response.json({ error: 'No repeaters found in USKA data' }, { status: 502 });
    }

    // Get all existing repeaters — filter for CH/LI since USKA only lists Swiss repeaters.
    const allRepeaters = await base44.asServiceRole.entities.Repeater.filter({ country_code: 'CH' });
    const liRepeaters = await base44.asServiceRole.entities.Repeater.filter({ country_code: 'LI' }).catch(() => []);
    const swissRepeaters = [...(allRepeaters || []), ...(liRepeaters || [])];

    // Match and update
    let updatedCount = 0;
    const linksToCreate: any[] = [];
    const unmatched: any[] = [];

    for (const uska of uskaRepeaters) {
      const matches = swissRepeaters.filter(r =>
        r.callsign === uska.call &&
        Math.abs(r.frequency - uska.tx) < 0.001
      );

      if (matches.length === 0) {
        unmatched.push({ callsign: uska.call, tx: uska.tx, qth: uska.qth });
        continue;
      }

      for (const rep of matches) {
        const update: any = {};

        // Echolink aus Remarks
        const el = extractEcholink(uska.remarks);
        if (el && !rep.echolink_node) update.echolink_node = el;

        // Höhe
        if (uska.alt && !rep.elevation_m) update.elevation_m = uska.alt;

        // Status
        const st = mapStatus(uska.status);
        if (st && rep.status === 'unknown') update.status = st;

        // CTCSS/DCS-Ton aus rx_tone Feld (v0.955: strukturiert statt Remarks-Parsing)
        if (uska.rx_tone && !rep.tone) {
          const tone = uska.rx_tone.replace(/^DCS#?/i, 'D');
          if (tone) update.tone = tone;
        }

        // Modi aus strukturierten Feldern
        const newModes = extractModes(uska);
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

        // Extract cross-links from notes
        const linkTargets = extractLinkTargets(uska.notes);
        for (const target of linkTargets) {
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

    // Create RepeaterLink entries (deduped)
    const existingLinks = await base44.asServiceRole.entities.RepeaterLink.list("-created_date", 500);
    const existingLinkKeys = new Set<string>();
    for (const l of existingLinks) {
      const key = [l.from_callsign + (l.from_frequency || ''), l.to_callsign + (l.to_frequency || '')].sort().join('→');
      existingLinkKeys.add(key);
    }

    const createdLinks: any[] = [];
    const seenNewKeys = new Set<string>();
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
        description: 'USKA HB Voice Repeater List',
        network,
      });
      createdLinks.push({
        from: `${link.from.callsign} ${link.from.frequency}`,
        to: `${link.to.callsign} ${link.to.frequency}`,
        network,
      });
    }

    const matchedCount = uskaRepeaters.length - unmatched.length;
    return Response.json({
      status: 'success',
      count: matchedCount,
      uskaCount: uskaRepeaters.length,
      matchedCount,
      updatedCount,
      linksCreated: createdLinks.length,
      links: createdLinks,
      unmatchedCount: unmatched.length,
      unmatchedSample: unmatched.slice(0, 15),
      dataSource,
    });
  } catch (error: any) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}