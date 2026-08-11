import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchSotaSummitsForCountries } from '../../shared/sotaFetcher.ts';

// Fetches SOTA summit data directly from the sotadata.org.uk CSV API for offline caching.
// Bypasses the SDK's 6500-record database read limit by going straight to the source API.
// Accepts: { countries: "all" | string[] } — array of ISO2 country codes (e.g., ["CH","DE"]).
// Returns: { summits: [...], count, source }

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

    const result = await fetchSotaSummitsForCountries(iso2Codes);

    return Response.json({
      summits: result.summits,
      count: result.summits.length,
      source: result.source
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}