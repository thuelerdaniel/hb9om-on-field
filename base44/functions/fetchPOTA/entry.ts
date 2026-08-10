import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { fetchPotaParks } from '../../shared/potaFetcher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { entities, maxEntities } = body;

    const result = await fetchPotaParks(entities || 'all', maxEntities);

    // Fallback: curated Swiss POTA parks if API returns nothing
    if (result.parks.length === 0) {
      const swissParks = [
        { reference: "HB-0001", name: "Schweizerischer Nationalpark", lat: 46.6600, lng: 10.1700, parkType: "National Park" },
        { reference: "HB-0002", name: "UNESCO Biosphäre Entlebuch", lat: 46.9400, lng: 8.0400, parkType: "Biosphere Reserve" },
        { reference: "HB-0003", name: "Parc Ela", lat: 46.5800, lng: 9.6800, parkType: "Regional Park" },
        { reference: "HB-0004", name: "Naturpark Gantrisch", lat: 46.7300, lng: 7.4200, parkType: "Regional Park" },
        { reference: "HB-0005", name: "Jurapark Aargau", lat: 47.4200, lng: 7.9800, parkType: "Regional Park" },
        { reference: "HB-0006", name: "Parc Jura Vaudois", lat: 46.5600, lng: 6.2800, parkType: "Regional Park" },
        { reference: "HB-0007", name: "Naturpark Pfyn-Finges", lat: 46.3100, lng: 7.6000, parkType: "Regional Park" },
        { reference: "HB-0008", name: "Naturpark Beverin", lat: 46.7000, lng: 9.3100, parkType: "Regional Park" },
        { reference: "HB-0009", name: "Landschaftspark Binntal", lat: 46.3700, lng: 8.2200, parkType: "Regional Park" },
        { reference: "HB-0010", name: "Wildnispark Zürich Sihlwald", lat: 47.2700, lng: 8.5500, parkType: "Wilderness Park" },
      ];
      return Response.json({ parks: swissParks, source: 'curated', entity_count: 1 });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});