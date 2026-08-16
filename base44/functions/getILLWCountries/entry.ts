import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Returns all countries with ILLW-active lighthouses and their counts.
// Redeploy after shared module fix.
// Used for the country filter in the frontend.
//
// Parameters:
//   year (number, default = current year)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const year = body.year || new Date().getFullYear();

    const lighthouses = await base44.asServiceRole.entities.Lighthouse.filter({ illw_active: true, illw_year_active: year }, '-updated_date', 2000);

    const countryCounts: Record<string, number> = {};
    for (const l of (lighthouses || [])) {
      const c = l.illw_country || l.country || 'Unknown';
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    }

    const countries = Object.entries(countryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return Response.json({
      countries,
      totalCountries: countries.length,
      totalActive: (lighthouses || []).length,
      year,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});