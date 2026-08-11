import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchWwffDataForCountries } from '../../shared/referenceFetchers.ts';

// Fetches WWFF (World Wide Flora & Fauna) data directly from the wwff.co CSV API
// for offline caching. Bypasses the SDK's 6500-record database read limit.
// Accepts: { countries: "all" | string[] } — array of ISO2 country codes (e.g., ["CH","DE"]).
// Returns: { refs: [...], count, source }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { countries } = body;

    let iso2Codes: string[];
    if (!countries || countries === 'all' || (Array.isArray(countries) && countries.length === 0)) {
      iso2Codes = []; // empty = fetch all
    } else if (Array.isArray(countries)) {
      iso2Codes = countries;
    } else {
      iso2Codes = [countries];
    }

    const refs = await fetchWwffDataForCountries(iso2Codes);

    return Response.json({
      refs: refs,
      count: refs.length,
      source: iso2Codes.length > 0 ? `WWFF CSV (filtered: ${iso2Codes.join(', ')})` : 'WWFF CSV (worldwide)'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}