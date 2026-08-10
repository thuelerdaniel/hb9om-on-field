// Shared POTA (Parks on the Air) worldwide data fetcher.
// Used by both fetchPOTA (on-demand) and refreshAllData (scheduled cache).

export async function fetchPotaParks(
  scope: string | string[] = 'all',
  maxEntities?: number
): Promise<{ parks: any[]; entity_count: number; source: string }> {
  let entityCodes: string[] = ['CH', 'HB'];

  if (scope === 'all') {
    try {
      const listResp = await fetch('https://api.pota.app/program/entities', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' }
      });
      if (listResp.ok) {
        const listData = await listResp.json();
        const allCodes = (Array.isArray(listData) ? listData : (listData.entities || []))
          .map((e: any) => e.entityCode || e.code || e)
          .filter((c: any) => typeof c === 'string' && c.length > 0);
        if (allCodes.length > 0) {
          entityCodes = allCodes;
          if (maxEntities && maxEntities > 0) {
            entityCodes = entityCodes.slice(0, maxEntities);
          }
        }
      }
    } catch { /* fallback to CH, HB */ }
  } else if (Array.isArray(scope) && scope.length > 0) {
    entityCodes = scope;
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
      const valid = arr
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
      allParks.push(...valid);
    } catch { /* skip failed entities */ }
  }

  return { parks: allParks, entity_count: entityCodes.length, source: 'api' };
}