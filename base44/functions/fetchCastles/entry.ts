import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchCastleDataComplete } from '../../shared/castleFetcher.ts';

// WCA castles worldwide — uses shared castleFetcher module (also used by refreshAllData).
// Parses ALL country tables from the WCA ODS file, geocodes with Swiss-specific methods
// for HB- entries and worldwide Nominatim for non-Swiss, plus OSM/Wikidata worldwide.

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

    // Count by country prefix
    const byCountry: Record<string, number> = {};
    const byMatchSource: Record<string, number> = {};
    for (const c of allCastles) {
      const prefix = c.code?.split('-')[0] || 'OSM';
      byCountry[prefix] = (byCountry[prefix] || 0) + 1;
      const ms = c.matchSource || 'unmatched';
      byMatchSource[ms] = (byMatchSource[ms] || 0) + 1;
    }

    // Return summary stats only — the full array (23MB+) is too large for the response.
    // The actual data is stored in the ReferenceData entity by refreshAllData.
    return Response.json({
      count: allCastles.length,
      matchedWithCoords: withCoords,
      byCountry,
      byMatchSource,
      source: 'WCA list (worldwide) + OSM + Wikidata'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});