import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fetchWwffDataForCountries } from '../../shared/referenceFetchers.ts';
import { upsertPointsByCode } from '../../shared/pointUpsert.ts';

// Fetches WWFF (World Wide Flora & Fauna) data from the wwff.co CSV API
// and SAVES it to the WwffPoint entity (full refresh: delete all + bulk create).
// This ensures getReferencesInBounds can return WWFF references from the entity
// (same pattern as SOTA/POTA/LLOTA).
//
// Accepts: { countries: "all" | string[], save: boolean }
// Returns: { refs: [...], count, saved, source }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { countries, save = true } = body;

    let iso2Codes: string[];
    if (!countries || countries === 'all' || (Array.isArray(countries) && countries.length === 0)) {
      iso2Codes = []; // empty = fetch all
    } else if (Array.isArray(countries)) {
      iso2Codes = countries;
    } else {
      iso2Codes = [countries];
    }

    const refs = await fetchWwffDataForCountries(iso2Codes);

    // Enrich refs with country_code derived from the WWFF code (e.g. "DLFF-0123" → "DE")
    const enriched = refs.map(r => {
      const refPart = (r.code || '').split('-')[0].toUpperCase();
      const dxcc = refPart.replace(/FF$/, '');
      // Reverse lookup from ISO2_TO_Dxcc is complex — use a simple prefix map
      const DXCC_TO_ISO2: Record<string, string> = {
        'DL': 'DE', 'OE': 'AT', 'F': 'FR', 'I': 'IT', 'EA': 'ES', 'CT': 'PT',
        'G': 'GB', 'GM': 'GB', 'GW': 'GB', 'GI': 'GB', 'GD': 'GB', 'EI': 'IE',
        'ON': 'BE', 'PA': 'NL', 'LX': 'LU', 'OZ': 'DK', 'SM': 'SE', 'LA': 'NO',
        'OH': 'FI', 'TF': 'IS', 'SP': 'PL', 'OK': 'CZ', 'OM': 'SK', 'HA': 'HU',
        'S5': 'SI', '9A': 'HR', 'YU': 'RS', 'E7': 'BA', '4O': 'ME', 'ZA': 'AL',
        'Z3': 'MK', 'ES': 'EE', 'YL': 'LV', 'LY': 'LT', 'SV': 'GR', 'LZ': 'BG',
        'YO': 'RO', 'TA': 'TR', '5B': 'CY', '9H': 'MT', 'HB': 'CH', 'HB0': 'LI',
        'W': 'US', 'K': 'US', 'VE': 'CA', 'VY': 'CA', 'JA': 'JP', 'HL': 'KR',
        'BY': 'CN', 'VU': 'IN', 'VK': 'AU', 'ZL': 'NZ', 'ZS': 'ZA',
        'PY': 'BR', 'PP': 'BR', 'PQ': 'BR', 'LU': 'AR', 'AY': 'AR',
        'CE': 'CL', 'CA': 'CL',
      };
      return {
        ...r,
        country_code: DXCC_TO_ISO2[dxcc] || dxcc,
        park_type: r.parkType || 'WWFF',
        last_synced: new Date().toISOString(),
      };
    });

    let saved = 0;
    let updatedCount = 0;
    if (save && enriched.length > 0) {
      // Use upsertPointsByCode: loads existing by code, updates matches, creates new.
      // No delete step — prevents duplicates even if the function times out mid-save.
      const result = await upsertPointsByCode(base44, 'WwffPoint', 'hbff', enriched, 'WWFF CSV (worldwide)');
      saved = result.created;
      updatedCount = result.updated;
    }

    return Response.json({
      refs: enriched,
      count: enriched.length,
      saved,
      updated: updatedCount,
      source: iso2Codes.length > 0 ? `WWFF CSV (filtered: ${iso2Codes.join(', ')})` : 'WWFF CSV (worldwide)'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}