import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Wikidata SPARQL query for Swiss castles, fortresses, and fortifications
    const sparqlQuery = `
SELECT ?item ?itemLabel ?coord ?cantonLabel WHERE {
  {
    ?item wdt:P31/wdt:P279* wd:Q23413 .
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q57821 .
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q1763828 .
  }
  ?item wdt:P17 wd:Q39 .
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P131 ?canton . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en,fr,it" . }
} LIMIT 2000`;

    const resp = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparqlQuery)}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HB9OM-OnField/1.0 (amateur radio mapping app)'
        }
      }
    );

    if (!resp.ok) {
      return Response.json({ error: 'Failed to fetch from Wikidata' }, { status: 502 });
    }

    const data = await resp.json();
    const bindings = data.results?.bindings || [];

    // Deduplicate by Wikidata item URI
    const seen = new Set();
    const castles = [];
    let codeNum = 1;

    for (const b of bindings) {
      const uri = b.item?.value || '';
      if (seen.has(uri)) continue;
      seen.add(uri);

      // Parse WKT Point: "Point(lng lat)"
      const coordStr = b.coord?.value || '';
      const match = coordStr.match(/Point\(([\d.-]+)\s+([\d.-]+)\)/);
      if (!match) continue;
      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      if (isNaN(lat) || isNaN(lng)) continue;

      castles.push({
        code: `HB-W${String(codeNum).padStart(4, '0')}`,
        name: b.itemLabel?.value || `Castle ${uri.split('/').pop()}`,
        lat: lat,
        lng: lng,
        canton: b.cantonLabel?.value || '',
        link: uri
      });
      codeNum++;
    }

    return Response.json({
      castles,
      count: castles.length,
      source: 'Wikidata SPARQL'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});