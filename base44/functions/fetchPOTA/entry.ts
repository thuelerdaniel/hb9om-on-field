import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { entities, maxEntities } = body;

    // Determine which entity codes to fetch:
    // - Default: CH, HB (Switzerland) for backward compatibility
    // - If `entities` is an array, fetch those codes
    // - If `entities` is "all", fetch all entities worldwide
    let entityCodes: string[] = ['CH', 'HB'];
    if (entities === 'all') {
      try {
        const listResp = await fetch('https://api.pota.app/program/entities', {
          headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' }
        });
        if (listResp.ok) {
          const listData = await listResp.json();
          const allCodes = (Array.isArray(listData) ? listData : (listData.entities || []))
            .map(e => e.entityCode || e.code || e)
            .filter(c => typeof c === 'string' && c.length > 0);
          if (allCodes.length > 0) {
            entityCodes = allCodes;
            if (maxEntities && maxEntities > 0) {
              entityCodes = entityCodes.slice(0, maxEntities);
            }
          }
        }
      } catch {
        // fallback to CH, HB
      }
    } else if (Array.isArray(entities) && entities.length > 0) {
      entityCodes = entities;
    }

    const allParks: any[] = [];

    for (const entityCode of entityCodes) {
      try {
        const resp = await fetch(`https://api.pota.app/program/parks/${entityCode}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' }
        });
        if (!resp.ok) continue;
        const parks = await resp.json();
        const arr = Array.isArray(parks) ? parks : (parks.parks || []);
        const valid = arr.filter(p => p.latitude && p.longitude).map(p => ({
          reference: p.reference || p.parkId,
          name: p.name || p.parkName || '',
          lat: parseFloat(p.latitude),
          lng: parseFloat(p.longitude),
          locationDesc: p.locationDesc || p.location || '',
          parkType: p.parkType || p.entity || '',
          active: p.active !== false
        }));
        allParks.push(...valid);
      } catch {
        // skip failed entities
      }
    }

    if (allParks.length > 0) {
      return Response.json({ parks: allParks, source: 'api', entity_count: entityCodes.length });
    }

    // Fallback: curated Swiss POTA parks
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
      { reference: "HB-0011", name: "Parc Chasseral", lat: 47.1300, lng: 7.0600, parkType: "Regional Park" },
      { reference: "HB-0012", name: "Naturpark Diemtigtal", lat: 46.6300, lng: 7.5000, parkType: "Regional Park" },
      { reference: "HB-0013", name: "Naturpark Thal", lat: 47.3200, lng: 7.5900, parkType: "Regional Park" },
      { reference: "HB-0014", name: "Parc Gruyère Pays-d'Enhaut", lat: 46.5000, lng: 7.0900, parkType: "Regional Park" },
      { reference: "HB-0015", name: "Biosfera Val Müstair", lat: 46.6200, lng: 10.3600, parkType: "Biosphere Reserve" },
      { reference: "HB-0016", name: "Naturpark Schaffhausen", lat: 47.7200, lng: 8.5600, parkType: "Regional Park" },
      { reference: "HB-0017", name: "Regionaler Naturpark Jura", lat: 47.3500, lng: 7.3500, parkType: "Regional Park" },
      { reference: "HB-0018", name: "Parc Adula", lat: 46.5100, lng: 9.0800, parkType: "Regional Park" },
      { reference: "HB-0019", name: "Naturerlebnispark Jorat", lat: 46.5700, lng: 6.7100, parkType: "Nature Park" },
      { reference: "HB-0020", name: "Naturpark Neckertal", lat: 47.3100, lng: 9.1200, parkType: "Regional Park" },
    ];
    return Response.json({ parks: swissParks, source: 'curated' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});