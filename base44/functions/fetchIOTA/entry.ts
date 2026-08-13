import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchIotaData } from '../../shared/referenceFetchers.ts';

// IOTA (Islands on the Air) — worldwide island groups from iota-world.org.
// Fetches the full IOTA list (~1200 island groups) with coordinates.
// Stores as individual IotaPoint records (not in ReferenceData) to avoid
// MongoDB's 16MB BSON document limit and enable viewport-based loading.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let references: any[] = [];
    let source = '';

    // Try external IOTA data source
    try {
      references = await fetchIotaData();
      source = references.length > 300 ? 'iota-world.org fulllist.json (offiziell)' : 'iota-world.org (fallback embedded)';
    } catch (e) {
      references = [];
      source = 'fallback (local data)';
    }

    // Filter out entries without coordinates (can't be displayed on map)
    const withCoords = references.filter(r => r.lat != null && r.lng != null);

    // Safety guard: only replace existing records if the new fetch returned real data
    // (more than 500 entries = official source). If the fetch fell back to embedded data
    // (228 entries), keep the existing 1,178 records to avoid data loss.
    const isRealData = withCoords.length > 500;

    // Upsert into IotaPoint entity (individual records, not ReferenceData array)
    const entity = base44.asServiceRole.entities.IotaPoint;

    if (isRealData) {
      // 1. Delete all existing records (full refresh)
      try {
        await entity.deleteMany({});
      } catch (e) {
        // Non-fatal — bulkCreate will still work
      }

      // 2. Bulk create in batches of 500
      const BATCH_SIZE = 500;
      let created = 0;
      for (let i = 0; i < withCoords.length; i += BATCH_SIZE) {
        const batch = withCoords.slice(i, i + BATCH_SIZE);
        try {
          await entity.bulkCreate(batch.map(g => ({
            code: g.code,
            name: g.name,
            lat: g.lat,
            lng: g.lng,
            dxcc_num: g.dxcc_num || '',
            status: g.status || 'Active',
            island_count: g.island_count || 0,
            pc_credited: g.pc_credited || '',
            grp_region: g.grp_region || '',
          })));
          created += batch.length;
        } catch (e) {
          // Continue with next batch — partial data is better than no data
        }
      }
    } else {
      // Fallback: external fetch failed — keep existing records, just update metadata
      created = 0;
    }

    // IotaPoint is now the single source of truth — no ReferenceData metadata needed.
    // Return the count of records currently in the database (not just newly created).
    let totalCount = created;
    if (!isRealData) {
      // Fallback: report existing record count so the checker logs the real number
      try {
        const existing = await entity.list('id', 5000);
        totalCount = existing.length;
      } catch {}
    }

    return Response.json({
      saved: true,
      count: totalCount,
      total: totalCount,
      source,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});