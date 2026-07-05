import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { region } = await req.json();
    
    // Fetch SOTA summits for HB region (Switzerland)
    const associationCode = region || 'HB';
    const resp = await fetch(`https://api2.sota.org.uk/api/associations/${associationCode}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!resp.ok) {
      return Response.json({ error: 'Failed to fetch SOTA data' }, { status: 502 });
    }
    
    const data = await resp.json();
    
    // Now fetch summits for each region
    const summits = [];
    if (data.regions) {
      for (const region of data.regions) {
        try {
          const regionResp = await fetch(`https://api2.sota.org.uk/api/regions/${associationCode}/${region.regionCode}`, {
            headers: { 'Accept': 'application/json' }
          });
          if (regionResp.ok) {
            const regionData = await regionResp.json();
            if (regionData.summits) {
              for (const s of regionData.summits) {
                summits.push({
                  code: s.summitCode,
                  name: s.name,
                  lat: s.latitude,
                  lng: s.longitude,
                  alt: s.altM,
                  points: s.points,
                  activationCount: s.activationCount,
                  region: region.regionName
                });
              }
            }
          }
        } catch (e) {
          // skip failed regions
        }
      }
    }
    
    return Response.json({ summits, association: data.associationName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});