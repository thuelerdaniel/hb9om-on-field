// Continent definitions with rough bounding boxes for geographic filtering of overlay layers.

export const CONTINENTS = [
  { id: 'eu', name: 'Europa', latMin: 35, latMax: 72, lngMin: -15, lngMax: 45 },
  { id: 'na', name: 'Nordamerika', latMin: 15, latMax: 75, lngMin: -170, lngMax: -50 },
  { id: 'sa', name: 'Südamerika', latMin: -60, latMax: 15, lngMin: -90, lngMax: -30 },
  { id: 'as', name: 'Asien', latMin: -10, latMax: 75, lngMin: 45, lngMax: 180 },
  { id: 'af', name: 'Afrika', latMin: -40, latMax: 40, lngMin: -20, lngMax: 55 },
  { id: 'oc', name: 'Ozeanien', latMin: -50, latMax: 0, lngMin: 110, lngMax: 180 },
];

// Returns continent id for a lat/lng, or null if outside all boxes.
export function getContinent(lat, lng) {
  if (lat == null || lng == null) return null;
  for (const c of CONTINENTS) {
    if (lat >= c.latMin && lat <= c.latMax && lng >= c.lngMin && lng <= c.lngMax) {
      return c.id;
    }
  }
  return null;
}

// Returns true if the lat/lng is in one of the selected continents.
// Empty/null continentIds = no filter (show all).
export function isInContinents(lat, lng, continentIds) {
  if (!continentIds || continentIds.length === 0) return true;
  const cont = getContinent(lat, lng);
  return cont ? continentIds.includes(cont) : false;
}