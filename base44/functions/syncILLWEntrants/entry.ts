import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { fetchIllwLighthouses } from '../../shared/illwFetcher.ts';
import { fetchIllwEntrants } from '../../shared/illwEntrantsFetcher.ts';

// Synchronizes ILLW entrants for a given year.
// Uses bulk operations to avoid rate limiting.
// 1. Fetches the master list (all lighthouses with coordinates) from wllw.org
// 2. Fetches the entrants list (active participants) from lighthouse-weekend.international
// 3. Matches by ILLW number
// 4. Bulk upserts into the Lighthouse entity (bulkCreate for new, bulkUpdate for existing)
// 5. Marks entrants as illw_active = true, all others as false

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins can sync
    const me = await base44.auth.me();
    if (me?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const year = body.year || new Date().getFullYear();

    // 1. Fetch master list (all lighthouses with coordinates)
    const masterList = await fetchIllwLighthouses();

    // 2. Fetch entrants list (active participants for the given year)
    const entrants = await fetchIllwEntrants(year);
    const entrantMap = new Map(entrants.map(e => [e.illw_number, e]));

    // 3. Fetch existing Lighthouse records (paginated — up to 2000)
    const existing = await base44.asServiceRole.entities.Lighthouse.list('-updated_date', 2000);
    const existingMap = new Map((existing || []).map((l: any) => [l.illw_number, l]));

    // 4. Separate into new records (bulkCreate) and existing records (bulkUpdate)
    const toCreate: any[] = [];
    const toUpdate: any[] = [];
    let activeCount = 0;

    for (const lh of masterList) {
      const illwNo = lh.illw_no || lh.code;
      if (!illwNo) continue;

      const entrant = entrantMap.get(illwNo);
      const isActive = !!entrant;
      if (isActive) activeCount++;

      const existingRecord = existingMap.get(illwNo);
      const data: any = {
        name: lh.name,
        lat: lh.lat,
        lng: lh.lng,
        country: lh.country,
        continent: lh.continent,
        illw_number: illwNo,
        illw_active: isActive,
        illw_year_active: isActive ? year : (existingRecord?.illw_year_active || null),
        illw_callsign: entrant?.callsigns || (existingRecord?.illw_callsign || ''),
        illw_country: lh.country,
        dxcc: lh.dxcc,
        source: 'ILLW (wllw.org) + Entrants (lighthouse-weekend.international)',
        link: lh.link || 'https://wllw.org/',
      };

      if (existingRecord) {
        toUpdate.push({ id: existingRecord.id, ...data });
      } else {
        toCreate.push(data);
      }
    }

    // 5. Bulk create new records (up to 500 per call)
    let newCount = 0;
    for (let i = 0; i < toCreate.length; i += 500) {
      const batch = toCreate.slice(i, i + 500);
      try {
        await base44.asServiceRole.entities.Lighthouse.bulkCreate(batch);
        newCount += batch.length;
      } catch {}
    }

    // 6. Bulk update existing records (up to 500 per call)
    let updatedCount = 0;
    for (let i = 0; i < toUpdate.length; i += 500) {
      const batch = toUpdate.slice(i, i + 500);
      try {
        await base44.asServiceRole.entities.Lighthouse.bulkUpdate(batch);
        updatedCount += batch.length;
      } catch {}
    }

    // 7. Mark lighthouses not in the entrants list as inactive (bulk)
    const toDeactivate = (existing || [])
      .filter((l: any) => !entrantMap.has(l.illw_number) && l.illw_active)
      .map((l: any) => ({ id: l.id, illw_active: false }));

    for (let i = 0; i < toDeactivate.length; i += 500) {
      const batch = toDeactivate.slice(i, i + 500);
      try {
        await base44.asServiceRole.entities.Lighthouse.bulkUpdate(batch);
      } catch {}
    }

    return Response.json({
      success: true,
      year,
      totalLighthouses: masterList.length,
      activeCount,
      newCount,
      updatedCount,
      entrantsCount: entrants.length,
      deactivatedCount: toDeactivate.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});