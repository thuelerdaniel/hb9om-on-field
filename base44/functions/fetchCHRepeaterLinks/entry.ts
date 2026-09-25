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

// v0.957: Cleanup RepeaterLink table — backup, remove duplicates and self-connections
async function cleanupRepeaterLinks(base44: any): Promise<{ backedUp: number; duplicatesDeleted: number; selfConnectionsDeleted: number; remaining: number }> {
  const sr = base44.asServiceRole;
  let allLinks: any[] = [];
  try {
    allLinks = await sr.entities.RepeaterLink.list("created_date", 1000);
  } catch (e: any) {
    console.log('[RepeaterLink] Load for cleanup failed:', e.message);
    return { backedUp: 0, duplicatesDeleted: 0, selfConnectionsDeleted: 0, remaining: 0 };
  }

  // Backup to AppSetting (full export before any deletion)
  try {
    const backupValue = JSON.stringify(allLinks.map(l => ({
      id: l.id,
      from_callsign: l.from_callsign,
      from_frequency: l.from_frequency,
      to_callsign: l.to_callsign,
      to_frequency: l.to_frequency,
      link_type: l.link_type,
      network: l.network,
      description: l.description,
      created_date: l.created_date,
    })));
    const existingBackup = await base44.entities.AppSetting.filter({ key: 'repeater_link_backup' });
    if (existingBackup && existingBackup.length > 0) {
      await base44.entities.AppSetting.update(existingBackup[0].id, { value: backupValue });
    } else {
      await base44.entities.AppSetting.create({ key: 'repeater_link_backup', value: backupValue });
    }
  } catch (e: any) {
    console.log('[RepeaterLink] Backup failed:', e.message);
  }

  // Find duplicates and self-connections
  const seenKeys = new Set<string>();
  const toDelete: string[] = [];
  let duplicatesDeleted = 0;
  let selfConnectionsDeleted = 0;

  for (const link of allLinks) {
    // Self-connection: from === to (case-insensitive, callsign only — no frequency check)
    if (link.from_callsign && link.to_callsign &&
        link.from_callsign.toLowerCase() === link.to_callsign.toLowerCase()) {
      toDelete.push(link.id);
      selfConnectionsDeleted++;
      continue;
    }

    // Duplicate: same from→to pair (case-insensitive, callsign only, no frequency)
    const key = [link.from_callsign?.toLowerCase() || '',
                 link.to_callsign?.toLowerCase() || ''].sort().join('→');
    if (seenKeys.has(key)) {
      toDelete.push(link.id);
      duplicatesDeleted++;
      continue;
    }
    seenKeys.add(key);
  }

  // Delete individually (SDK may not support $in operator in deleteMany)
  for (const id of toDelete) {
    try {
      await sr.entities.RepeaterLink.delete(id);
    } catch (e: any) {
      console.log('[RepeaterLink] Delete failed for', id, ':', e.message);
    }
  }

  console.log(`[RepeaterLink] Cleanup: ${allLinks.length} total, ${duplicatesDeleted} duplicates, ${selfConnectionsDeleted} self-connections deleted, ${allLinks.length - toDelete.length} remaining`);
  return {
    backedUp: allLinks.length,
    duplicatesDeleted,
    selfConnectionsDeleted,
    remaining: allLinks.length - toDelete.length,
  };
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

    // v0.957: Delete old USKA-source links to refresh from latest USKA data
    let oldUskaLinksDeleted = 0;
    try {
      const allExistingLinks = await base44.asServiceRole.entities.RepeaterLink.list("-created_date", 500);
      const uskaLinks = (allExistingLinks || []).filter(l =>
        l.description === 'USKA HB Repeater Voice List' ||
        l.description === 'USKA HB Voice Repeater List'
      );
      for (const l of uskaLinks) {
        try {
          await base44.asServiceRole.entities.RepeaterLink.delete(l.id);
          oldUskaLinksDeleted++;
        } catch (e: any) {
          console.log('[RepeaterLink] Delete old USKA link failed:', e.message);
        }
      }
    } catch (e: any) {
      console.log('[RepeaterLink] Load for USKA deletion failed:', e.message);
    }

    // v0.957: Cleanup RepeaterLink table (backup + remove duplicates + self-connections)
    const cleanupResult = await cleanupRepeaterLinks(base44);

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

    // v0.957: Build QTH → USKA repeater map for reliable link target matching.
    // USKA remarks contain location names (e.g. "HochYbrig", "Tamaro", "Chestenberg"),
    // not callsigns. Map normalized QTH names to USKA repeater entries for lookup.
    const normalizeQth = (qth: string) => (qth || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const qthToUska = new Map<string, USKARepeater>();
    for (const u of uskaRepeaters) {
      const norm = normalizeQth(u.qth);
      if (norm && norm.length >= 3) qthToUska.set(norm, u);
    }

    // Get all existing repeaters — filter for CH/LI since USKA only lists Swiss repeaters.
    const allRepeaters = await base44.asServiceRole.entities.Repeater.filter({ country_code: 'CH' });
    const liRepeaters = await base44.asServiceRole.entities.Repeater.filter({ country_code: 'LI' }).catch(() => []);
    const swissRepeaters = [...(allRepeaters || []), ...(liRepeaters || [])];

    // Match and update
    let updatedCount = 0;
    const linksToCreate: any[] = [];
    const unmatched: any[] = [];

    // v0.957 DIAG: Link extraction diagnostics
    let remarksWithLinkInfo = 0;
    let totalTargetsExtracted = 0;
    let targetsMatchedToDb = 0;
    const linkDiagExamples: any[] = [];

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

        // v0.957 DIAG: Track link extraction
        if (linkTargets.length > 0) {
          remarksWithLinkInfo++;
          totalTargetsExtracted += linkTargets.length;
          if (linkDiagExamples.length < 5) {
            linkDiagExamples.push({
              uska_call: uska.call,
              uska_tx: uska.tx,
              uska_qth: uska.qth,
              notes: uska.notes,
              remarks: uska.remarks,
              targets: linkTargets,
              matchedRep: rep.callsign,
              matchResults: [] as any[],
            });
          }
        }

        for (const target of linkTargets) {
          const targetUpper = target.toUpperCase();
          // 1. Try callsign match (for targets that are callsigns)
          let targetReps = swissRepeaters.filter(r =>
            r.callsign === targetUpper &&
            !(r.callsign === rep.callsign && Math.abs(r.frequency - rep.frequency) < 0.001)
          );
          // 2. Try QTH map with substring matching (for location names like "Tamaro" matching "Monte Tamaro")
          if (targetReps.length === 0) {
            const targetNorm = normalizeQth(target);
            if (targetNorm.length >= 3) {
              for (const [qthNorm, targetUska] of qthToUska) {
                if (qthNorm.includes(targetNorm) || targetNorm.includes(qthNorm)) {
                  const matched = swissRepeaters.filter(r =>
                    r.callsign === targetUska.call &&
                    Math.abs(r.frequency - targetUska.tx) < 0.001 &&
                    r.callsign !== rep.callsign
                  );
                  if (matched.length > 0) {
                    targetReps = matched;
                    break;
                  }
                }
              }
            }
          }
          // 3. Fallback: location_name match (case-insensitive)
          if (targetReps.length === 0) {
            const targetLower = target.toLowerCase();
            targetReps = swissRepeaters.filter(r =>
              r.location_name &&
              r.location_name.toLowerCase().includes(targetLower) &&
              r.callsign !== rep.callsign
            );
          }
          if (targetReps.length === 0) {
            // v0.957 DIAG: Record failed match
            if (linkDiagExamples.length > 0 && linkDiagExamples[linkDiagExamples.length - 1].matchedRep === rep.callsign) {
              linkDiagExamples[linkDiagExamples.length - 1].matchResults.push({
                target,
                matched: false,
                reason: 'no DB repeater found',
              });
            }
            continue;
          }
          targetsMatchedToDb++;
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

    // Create RepeaterLink entries (deduped — callsign only, case-insensitive)
    const existingLinks = await base44.asServiceRole.entities.RepeaterLink.list("-created_date", 500);
    const existingLinkKeys = new Set<string>();
    for (const l of existingLinks) {
      const key = [l.from_callsign?.toLowerCase() || '', l.to_callsign?.toLowerCase() || ''].sort().join('→');
      existingLinkKeys.add(key);
    }

    const createdLinks: any[] = [];
    const seenNewKeys = new Set<string>();
    for (const link of linksToCreate) {
      if (!link.from.lat || !link.from.lng || !link.to.lat || !link.to.lng) continue;
      // v0.957: Skip self-connections (same callsign, case-insensitive — even cross-band)
      if (link.from.callsign?.toLowerCase() === link.to.callsign?.toLowerCase()) continue;
      // v0.957: Dedup by callsign only (case-insensitive) — matches cleanup logic
      const key = [link.from.callsign?.toLowerCase() || '', link.to.callsign?.toLowerCase() || ''].sort().join('→');
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
      cleanup: cleanupResult,
      oldUskaLinksDeleted,
      linkDiagnostics: {
        remarksWithLinkInfo,
        totalTargetsExtracted,
        targetsMatchedToDb,
        examples: linkDiagExamples,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}