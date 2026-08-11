import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Parses a linked_callsigns string like "HB9ZF 145.7625 MHz (2m)" into callsign + frequency
function parseLinkedString(str) {
  const match = str.match(/^([A-Z0-9][A-Z0-9/-]*)\s+([\d.]+)\s*MHz/i);
  if (!match) return null;
  return { callsign: match[1].toUpperCase(), frequency: parseFloat(match[2]) };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden – Admin only' }, { status: 403 });
    }

    const startTime = Date.now();

    // Load all repeaters (paginated — up to 10000)
    const allRepeaters = await base44.asServiceRole.entities.Repeater.list("-created_date", 10000);

    // Build lookup: callsign+frequency → repeater (only those with coordinates)
    const repeaterLookup = new Map();
    for (const r of allRepeaters) {
      if (r.lat == null || r.lng == null) continue;
      const key = `${(r.callsign || '').toUpperCase()}_${r.frequency}`;
      if (!repeaterLookup.has(key)) repeaterLookup.set(key, r);
    }

    // Get existing approved links to deduplicate
    const existingLinks = await base44.asServiceRole.entities.RepeaterLink.filter({ status: 'approved' });
    const existingKeys = new Set();
    for (const l of existingLinks) {
      const key = `${(l.from_callsign || '').toUpperCase()}_${l.from_frequency || 0}_${(l.to_callsign || '').toUpperCase()}_${l.to_frequency || 0}`;
      existingKeys.add(key);
    }

    // Scan all repeaters with linked_callsigns
    const repeatersWithLinks = allRepeaters.filter(r => r.linked_callsigns && r.linked_callsigns.length > 0 && r.lat != null && r.lng != null);
    const newLinks = [];
    let skippedNoTarget = 0;
    let skippedDuplicate = 0;

    for (const rep of repeatersWithLinks) {
      for (const linkedStr of rep.linked_callsigns) {
        const parsed = parseLinkedString(linkedStr);
        if (!parsed) continue;

        // Find target repeater by callsign + frequency
        const targetKey = `${parsed.callsign}_${parsed.frequency}`;
        const target = repeaterLookup.get(targetKey);
        if (!target) {
          // Try matching by base callsign (strip suffixes like -R, -L)
          const baseCall = parsed.callsign.split(/[-/]/)[0];
          let found = null;
          for (const [k, v] of repeaterLookup) {
            if (k.startsWith(baseCall + '_') && Math.abs(v.frequency - parsed.frequency) < 0.001) {
              found = v;
              break;
            }
          }
          if (!found) {
            skippedNoTarget++;
            continue;
          }
          // Use found target
          const linkKey = `${(rep.callsign || '').toUpperCase()}_${rep.frequency}_${found.callsign.toUpperCase()}_${found.frequency}`;
          if (existingKeys.has(linkKey)) {
            skippedDuplicate++;
            continue;
          }
          existingKeys.add(linkKey);
          newLinks.push({
            from_callsign: rep.callsign,
            from_frequency: rep.frequency,
            from_lat: rep.lat,
            from_lng: rep.lng,
            to_callsign: found.callsign,
            to_frequency: found.frequency,
            to_lat: found.lat,
            to_lng: found.lng,
            link_type: 'permanent',
            color: '#3b82f6',
            line_style: 'dashed',
            status: 'approved',
            description: 'Auto-erkannt aus RepeaterBook Crosslink-Daten',
            network: 'RepeaterBook',
            reviewed_by_name: user.full_name || user.email || 'Admin',
          });
          continue;
        }

        // Skip self-links
        if (target.callsign === rep.callsign && Math.abs(target.frequency - rep.frequency) < 0.001) continue;

        const linkKey = `${(rep.callsign || '').toUpperCase()}_${rep.frequency}_${parsed.callsign}_${parsed.frequency}`;
        if (existingKeys.has(linkKey)) {
          skippedDuplicate++;
          continue;
        }
        existingKeys.add(linkKey);

        newLinks.push({
          from_callsign: rep.callsign,
          from_frequency: rep.frequency,
          from_lat: rep.lat,
          from_lng: rep.lng,
          to_callsign: target.callsign,
          to_frequency: target.frequency,
          to_lat: target.lat,
          to_lng: target.lng,
          link_type: 'permanent',
          color: '#3b82f6',
          line_style: 'dashed',
          status: 'approved',
          description: 'Auto-erkannt aus RepeaterBook Crosslink-Daten',
          network: 'RepeaterBook',
          reviewed_by_name: user.full_name || user.email || 'Admin',
        });
      }
    }

    // Bulk create new links in batches of 100
    let created = 0;
    for (let i = 0; i < newLinks.length; i += 100) {
      const batch = newLinks.slice(i, i + 100);
      await base44.asServiceRole.entities.RepeaterLink.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({
      status: 'success',
      repeaters_scanned: repeatersWithLinks.length,
      links_found: newLinks.length,
      links_created: created,
      skipped_no_target: skippedNoTarget,
      skipped_duplicate: skippedDuplicate,
      duration_ms: Date.now() - startTime,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}