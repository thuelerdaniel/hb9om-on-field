import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

// Returns all ILLW-active lighthouses for a given year.
// Redeploy after shared module fix.
// Frontend uses this for markers, filters, and the ILLW weekend banner.
//
// Parameters:
//   year (number, default = current year)
//   country (string, optional — filter by country name)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const year = body.year || new Date().getFullYear();
    const country = body.country || null;

    let filter: any = { illw_active: true };
    if (year) filter.illw_year_active = year;
    if (country) filter.illw_country = country;

    const lighthouses = await base44.asServiceRole.entities.Lighthouse.filter(filter, '-updated_date', 2000);

    return Response.json({
      lighthouses: (lighthouses || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        lat: l.lat,
        lng: l.lng,
        illw_number: l.illw_number,
        illw_callsign: l.illw_callsign,
        illw_country: l.illw_country,
        illw_year_active: l.illw_year_active,
        country: l.country,
      })),
      count: (lighthouses || []).length,
      year,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});