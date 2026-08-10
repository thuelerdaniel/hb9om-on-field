// Shared POTA (Parks on the Air) worldwide data fetcher.
// Uses the POTA API with concurrent entity fetching for efficiency.
// The entity list endpoint is currently broken, so we use a hardcoded list.
// Used by both fetchPOTA (on-demand) and refreshAllData (scheduled cache).

const CONCURRENCY = 20;

// Comprehensive list of POTA entity codes (ISO 3166-1 alpha-2 country codes).
// Source: pota.app/#/parklist — verified working entity codes with park counts > 0.
// NOTE: POTA uses ISO country codes, NOT DXCC prefixes (e.g. AU not VK, ZA not ZS, BR not PY).
export const POTA_ENTITIES = [
  // Europe (ISO codes)
  'CH','GB','IE','DE','FR','IT','ES','PT','AT','BE','NL','LU','DK','SE','NO','FI','IS','PL','CZ','SK','HU','RO','BG','GR','TR','HR','SI','RS','BA','MK','ME','AL','EE','LV','LT','UA','BY','MD','RU','MT','CY','AD','LI','MC','SM','VA','JE','GG','IM','FO','AX','GL',
  // North America
  'US','CA','MX','PR','VI','BS','BM','KY','TC','MS','AI','AG','GD','LC','VC','DM','HT','DO','CU','JM','TT','KN','BQ','CW','AW','GP','MQ','BL','MF','PM','GT','BZ','SV','HN','NI','CR','PA',
  // South America
  'BR','AR','CL','CO','PE','EC','VE','BO','PY','UY','SR','GY','GF','FK',
  // Asia
  'JP','KR','CN','IN','ID','TH','MY','PH','SG','IL','AE','SA','IR','IQ','JO','KW','QA','BH','OM','YE','AF','AM','AZ','GE','KZ','KG','TJ','UZ','TM','MN','TW','HK','MO','KH','LA','VN','MM','BD','LK','MV','NP','BT','PK',
  // Africa
  'ZA','EG','MA','DZ','TN','LY','ET','KE','UG','TZ','RW','BI','ZM','ZW','BW','NA','MZ','AO','CM','CG','CD','CF','TD','ML','BF','NE','NG','GH','CI','SN','GM','GW','SL','LR','TG','BJ','CV','ST','KM','DJ','ER','SS','SD','SO','MU','SC','RE','YT','MG','LS','SZ','GQ','GA',
  // Oceania
  'AU','NZ','PG','FJ','SB','VU','NC','PF','WS','TO','KI','TV','NR','PW','CK','NU','NF','CX','CC','UM','AS','GU','MP','FM','MH','TK',
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