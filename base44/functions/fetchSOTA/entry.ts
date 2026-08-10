import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { region, associations, maxAssociations } = body;

    // Determine which associations to fetch:
    // - Default: HB (Switzerland) for backward compatibility
    // - If `associations` is an array, fetch those codes
    // - If `associations` is "all", fetch all associations worldwide
    let associationCodes: string[] = ['HB'];
    if (associations === 'all') {
      try {
        const listResp = await fetch('https://api2.sota.org.uk/api/associations', {
          headers: { 'Accept': 'application/json' }
        });
        if (listResp.ok) {
          const listData = await listResp.json();
          const allCodes = (Array.isArray(listData) ? listData : (listData.associations || []))
            .map(a => a.associationCode || a.code)
            .filter(Boolean);
          if (allCodes.length > 0) {
            associationCodes = allCodes;
            if (maxAssociations && maxAssociations > 0) {
              associationCodes = associationCodes.slice(0, maxAssociations);
            }
          }
        }
      } catch {
        // fallback to HB
      }
    } else if (Array.isArray(associations) && associations.length > 0) {
      associationCodes = associations;
    } else if (region) {
      associationCodes = [region];
    }

    const allSummits: any[] = [];
    const associationNames: string[] = [];

    for (const associationCode of associationCodes) {
      try {
        const resp = await fetch(`https://api2.sota.org.uk/api/associations/${associationCode}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        associationNames.push(data.associationName || associationCode);

        if (data.regions) {
          for (const regionData of data.regions) {
            try {
              const regionResp = await fetch(`https://api2.sota.org.uk/api/regions/${associationCode}/${regionData.regionCode}`, {
                headers: { 'Accept': 'application/json' }
              });
              if (regionResp.ok) {
                const regionJson = await regionResp.json();
                if (regionJson.summits) {
                  for (const s of regionJson.summits) {
                    allSummits.push({
                      code: s.summitCode,
                      name: s.name,
                      lat: s.latitude,
                      lng: s.longitude,
                      alt: s.altM,
                      points: s.points,
                      activationCount: s.activationCount,
                      region: regionData.regionName
                    });
                  }
                }
              }
            } catch {
              // skip failed regions
            }
          }
        }
      } catch {
        // skip failed associations
      }
    }

    return Response.json({
      summits: allSummits,
      associations: associationNames,
      association_count: associationCodes.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});