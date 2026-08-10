import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchCastleDataComplete } from '../../shared/castleFetcher.ts';

// WCA castles worldwide — uses shared castleFetcher module (also used by refreshAllData).
// Parses ALL country tables from the WCA ODS file, uses Maidenhead locators for coordinates.
// Stores the full dataset in ReferenceData entity.

Deno.serve(async (req) => {
  try {
    console.log('[fetchCastles] START');
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    console.log('[fetchCastles] Auth checked:', isAuthed);
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch admin overrides
    const allOverrides = await base44.asServiceRole.entities.ReferenceOverride.list("-created_date", 500);
    const castleOverrides = new Map();
    for (const ov of (allOverrides || [])) {
      if (ov.reference_type === 'castle') {
        castleOverrides.set(ov.original_code, ov);
      }
    }

    console.log('[fetchCastles] Calling fetchCastleDataComplete...');
    const allCastles = await fetchCastleDataComplete(castleOverrides);
    console.log('[fetchCastles] fetchCastleDataComplete done:', allCastles.length, 'castles');
    const withCoords = allCastles.filter(c => c.lat !== null).length;

    // Strip to essential fields to avoid MongoDB 16MB document size limit
    const stripped = allCastles
      .filter(c => c.lat !== null && c.lng !== null)
      .map(c => ({
        code: c.code,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        canton: c.canton || '',
        link: c.link || 'https://wcagroup.org/?page_id=207',
        countryPrefix: c.countryPrefix || '',
      }));

    console.log(`[fetchCastles] Storing ${stripped.length} castles in ReferenceData...`);

    // Upsert into ReferenceData
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.ReferenceData.filter({ type: 'castle' });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ReferenceData.update(existing[0].id, {
        references: stripped,
        total_count: stripped.length,
        source: 'WCA list (worldwide) + Maidenhead locators',
        last_updated: now
      });
    } else {
      await base44.asServiceRole.entities.ReferenceData.create({
        type: 'castle',
        references: stripped,
        total_count: stripped.length,
        source: 'WCA list (worldwide) + Maidenhead locators',
        last_updated: now
      });
    }

    // Count by country prefix
    const byCountry: Record<string, number> = {};
    for (const c of stripped) {
      const prefix = c.code?.split('-')[0] || 'OSM';
      byCountry[prefix] = (byCountry[prefix] || 0) + 1;
    }

    console.log('[fetchCastles] DONE:', stripped.length, 'castles stored');

    return Response.json({
      saved: true,
      count: stripped.length,
      totalParsed: allCastles.length,
      matchedWithCoords: withCoords,
      byCountry,
      source: 'WCA list (worldwide) + Maidenhead locators'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});