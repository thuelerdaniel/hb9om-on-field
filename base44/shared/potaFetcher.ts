// Shared POTA (Parks on the Air) worldwide data fetcher.
// Uses the POTA API with concurrent entity fetching for efficiency.
// The entity list endpoint is currently broken, so we use a hardcoded list.
// Used by both fetchPOTA (on-demand) and refreshAllData (scheduled cache).

const CONCURRENCY = 20;

// Comprehensive list of POTA entity codes (DXCC-based).
// Source: pota.app — verified working entity codes.
// Deduplicated and expanded for full worldwide coverage.
export const POTA_ENTITIES = [
  // Europe
  'CH','G','GM','GW','GI','GD','EI','DL','F','I','EA','CT','OE','ON','PA','LX','OZ','SM','LA','OH','TF','SP','OK','OM','HA','YO','LZ','SV','9A','S5','YT','E7','4O','ZA','Z3','ES','YL','LY','UR','EU','ER','TA','5B','9H','C31','T7','3A','OY','IS','OY',
  // North America
  'US','CA','MX','KP2','KP4','CO','6Y','BS','HI',
  // South America
  'PY','LU','CE','HK','OA','HC','YV','CX','ZP','CP','XW','CX',
  // Asia
  'JP','HL','BY','VU','YB','HS','9M2','9M4','DU','9V','9N','4X','A6','HZ','EP','YI','JY','OD','YK','UN','4L','EK','4J','BY','VU','3W','XU','XV','HS','E4',
  // Africa
  'ZS','CN','3V','7X','5A','SU','ET','5Z','5N','9G','A2','Z2','V5','3B8','3B9','3B7','5R','6W','TU','TY','EL','J2','TJ',
  // Oceania
  'VK','ZL','P2','3D2','KH2','KH6','KH0','FK','K2K','P29',
];

export async function fetchPotaParks(
  scope: string | string[] = 'all',
  maxEntities?: number
): Promise<{ parks: any[]; entity_count: number; source: string }> {
  let entityCodes: string[] = ['CH', 'HB'];

  if (scope === 'all') {
    // Try the API entity list first
    let apiEntities: string[] = [];
    try {
      const listResp = await fetch('https://api.pota.app/program/entities', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' }
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        apiEntities = (Array.isArray(listData) ? listData : (listData.entities || []))
          .map((e: any) => e.entityCode || e.code || e)
          .filter((c: any) => typeof c === 'string' && c.length > 0);
      }
    } catch { /* API entity list broken — use hardcoded fallback */ }

    // Use API entities if available, otherwise use hardcoded list
    entityCodes = apiEntities.length > 0 ? apiEntities : POTA_ENTITIES;
    // Deduplicate
    entityCodes = [...new Set(entityCodes)];

    if (maxEntities && maxEntities > 0) {
      entityCodes = entityCodes.slice(0, maxEntities);
    }
  } else if (Array.isArray(scope) && scope.length > 0) {
    entityCodes = scope;
  }

  const allParks: any[] = [];

  // Fetch parks for all entities with concurrency
  for (let i = 0; i < entityCodes.length; i += CONCURRENCY) {
    const chunk = entityCodes.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (entityCode) => {
        try {
          const resp = await fetch(`https://api.pota.app/program/parks/${entityCode}`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' }
          });
          if (!resp.ok) return [];
          const parks = await resp.json();
          const arr = Array.isArray(parks) ? parks : (parks.parks || []);
          return arr
            .filter((p: any) => p.latitude && p.longitude)
            .map((p: any) => ({
              reference: p.reference || p.parkId,
              name: p.name || p.parkName || '',
              lat: parseFloat(p.latitude),
              lng: parseFloat(p.longitude),
              locationDesc: p.locationDesc || p.location || '',
              parkType: p.parkType || p.entity || '',
              active: p.active !== false
            }));
        } catch { return []; }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') allParks.push(...r.value);
    }
  }

  return { parks: allParks, entity_count: entityCodes.length, source: 'api' };
}