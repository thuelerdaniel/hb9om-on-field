import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// mergeCastleData — Merges old WCA castle ReferenceData (Swiss HB-XXXX codes) with
// new OSM castle ReferenceData (worldwide OSM-XXXXX codes). WCA entries have priority.
// Updates the NEW entry with merged references, deletes the OLD entry.
// Also cleans up other old duplicate ReferenceData entries (sota, wwbota, hbff, lighthouse).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const OLD_CASTLE_ID = '6a72defd185aa535ed604f9a';
    const NEW_CASTLE_ID = '6a4fdfcb1193100d2cb06da7';

    const OLD_DUPLICATE_IDS = [
      '6a72defd185aa535ed604f9a', // castle alt (after merge)
      '6a72defd185aa535ed604fa7', // sota alt
      '6a72defd185aa535ed604fa8', // wwbota alt
      '6a72defd185aa535ed604fa6', // hbff alt
      '6a72defd185aa535ed604faa', // lighthouse alt
    ];

    // 1. Load both castle entries
    const oldEntry = await base44.asServiceRole.entities.ReferenceData.get(OLD_CASTLE_ID).catch(() => null);
    const newEntry = await base44.asServiceRole.entities.ReferenceData.get(NEW_CASTLE_ID).catch(() => null);

    if (!oldEntry) return Response.json({ error: 'Old castle entry not found', oldId: OLD_CASTLE_ID }, { status: 404 });
    if (!newEntry) return Response.json({ error: 'New castle entry not found', newId: NEW_CASTLE_ID }, { status: 404 });

    const oldRefs = Array.isArray(oldEntry.references) ? oldEntry.references : [];
    const newRefs = Array.isArray(newEntry.references) ? newEntry.references : [];

    console.log(`[mergeCastleData] Old (WCA): ${oldRefs.length} entries`);
    console.log(`[mergeCastleData] New (OSM): ${newRefs.length} entries`);

    // 2. Merge: WCA entries first (priority), then OSM entries (skip if same lat/lng to 4 decimals)
    const merged = [];
    const seenCoords = new Set();

    // Add old WCA entries first
    for (const ref of oldRefs) {
      if (ref.lat == null || ref.lng == null) continue;
      const key = `${ref.lat.toFixed(4)},${ref.lng.toFixed(4)}`;
      if (!seenCoords.has(key)) {
        seenCoords.add(key);
        merged.push(ref);
      }
    }

    // Add new OSM entries (skip duplicates by lat/lng)
    let skipped = 0;
    for (const ref of newRefs) {
      if (ref.lat == null || ref.lng == null) continue;
      const key = `${ref.lat.toFixed(4)},${ref.lng.toFixed(4)}`;
      if (seenCoords.has(key)) {
        skipped++;
        continue;
      }
      seenCoords.add(key);
      merged.push(ref);
    }

    console.log(`[mergeCastleData] Merged: ${merged.length} entries (skipped ${skipped} duplicates)`);

    // 3. Verify: search for WATTWIL
    const wattwil = merged.filter(c =>
      (c.name || '').toUpperCase().includes('WATTWIL') ||
      (c.name || '').toUpperCase().includes('IBERG')
    );
    console.log(`[mergeCastleData] WATTWIL/IBERG entries found: ${wattwil.length}`);
    for (const w of wattwil) {
      console.log(`  - ${w.code} | ${w.name} | ${w.lat}, ${w.lng}`);
    }

    // Count by country prefix
    const byCountry: Record<string, number> = {};
    for (const c of merged) {
      const prefix = (c.code || '').split('-')[0] || 'OSM';
      byCountry[prefix] = (byCountry[prefix] || 0) + 1;
    }

    if (dryRun) {
      return Response.json({
        dry_run: true,
        old_count: oldRefs.length,
        new_count: newRefs.length,
        merged_count: merged.length,
        skipped_duplicates: skipped,
        wattwil_found: wattwil.length,
        wattwil_entries: wattwil,
        byCountry,
      });
    }

    // 4. Update the NEW entry with merged references
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.ReferenceData.update(NEW_CASTLE_ID, {
      references: merged,
      total_count: merged.length,
      source: 'WCA list (Swiss HB-XXXX) + OSM worldwide (merged)',
      last_updated: now,
    });

    console.log(`[mergeCastleData] Updated NEW entry ${NEW_CASTLE_ID} with ${merged.length} references`);

    // 5. Delete old duplicate entries
    const deletedIds = [];
    for (const id of OLD_DUPLICATE_IDS) {
      try {
        await base44.asServiceRole.entities.ReferenceData.delete(id);
        deletedIds.push(id);
        console.log(`[mergeCastleData] Deleted ${id}`);
      } catch (e) {
        console.log(`[mergeCastleData] Could not delete ${id}: ${e.message}`);
      }
    }

    // 6. Verify no duplicate castle entries remain
    const remainingCastles = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'castle' });
    console.log(`[mergeCastleData] Remaining castle entries: ${remainingCastles.length}`);

    return Response.json({
      success: true,
      old_count: oldRefs.length,
      new_count: newRefs.length,
      merged_count: merged.length,
      skipped_duplicates: skipped,
      wattwil_found: wattwil.length,
      wattwil_entries: wattwil.map(w => ({ code: w.code, name: w.name, lat: w.lat, lng: w.lng })),
      byCountry,
      deleted_ids: deletedIds,
      remaining_castle_entries: remainingCastles.length,
      remaining_castle_ids: remainingCastles.map(c => ({ id: c.id, total_count: c.total_count })),
    });
  } catch (error) {
    console.error('[mergeCastleData] ERROR:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});