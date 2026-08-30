// SwissTopo API utilities — api3.geo.admin.ch
// Used for Swiss reference data: lake contours (LLOTA), protected area
// boundaries (POTA/BLN), and summit points (SOTA).
// API docs: https://docs.geo.admin.ch/

const API_BASE = 'https://api3.geo.admin.ch/rest/services/ech';

// Swiss bounding box (WGS84)
const CH_BBOX = { minLat: 45.8, maxLat: 47.9, minLng: 5.9, maxLng: 10.6 };

export function isInSwitzerland(lat: number, lng: number): boolean {
  return lat >= CH_BBOX.minLat && lat <= CH_BBOX.maxLat &&
         lng >= CH_BBOX.minLng && lng <= CH_BBOX.maxLng;
}

// LV95 (CH1903+) → WGS84 conversion
// Formula: https://www.swisstopo.admin.ch/en/conversion-coordinates
export function lv95ToWgs84(e: number, n: number): { lat: number; lng: number } {
  // LV95 → LV03 offsets
  const y = n - 2000000;
  const x = e - 1000000;

  const yStrich = (x - 600000) / 1000000;
  const xStrich = (y - 200000) / 1000000;

  const lambdaStrich = 2.6779094
    + 4.728982 * yStrich
    + 0.791504 * xStrich * yStrich
    + 0.1306 * xStrich * yStrich ** 2
    - 0.0436 * yStrich ** 3;

  const phiStrich = 16.902389
    + 3.238272 * xStrich
    - 0.270978 * xStrich ** 2
    + 0.0025 * xStrich ** 3
    - 0.0447 * xStrich ** 2 * yStrich
    - 0.0053 * xStrich * yStrich ** 3;

  const lng = lambdaStrich * 100 / 36;
  const lat = phiStrich * 100 / 36;

  return { lat, lng };
}

// Identify features at a point using SwissTopo MapServer identify API.
// Uses a small bounding box (envelope) around the point for reliable polygon
// intersection — the point-based identify with tolerance can miss polygon
// features when imageDisplay is 0,0,0.
// layers: array of layerBodIds (e.g., ['ch.bafu.bundesinventare-bln']).
// Returns array of feature objects with geometry.
export async function identifyAtPoint(
  lat: number,
  lng: number,
  layers: string[],
  tolerance: number = 50,
): Promise<any[]> {
  // Build a small bounding box around the point (~tolerance meters)
  // 1 degree lat ≈ 111km, so tolerance meters ≈ tolerance/111000 degrees
  const delta = tolerance / 111000;
  const minX = lng - delta;
  const minY = lat - delta;
  const maxX = lng + delta;
  const maxY = lat + delta;
  const geometry = `${minX},${minY},${maxX},${maxY}`;
  const layersParam = `all:${layers.join(',')}`;
  const params = new URLSearchParams({
    geometryType: 'esriGeometryEnvelope',
    geometry,
    layers: layersParam,
    geometryFormat: 'geojson',
    sr: '4326',
    tolerance: '0',
    imageDisplay: '0,0,0',
    mapExtent: '0,0,0,0',
    returnGeometry: 'true',
  });

  const url = `${API_BASE}/MapServer/identify?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      console.warn(`[SwissTopo] identify API returned ${resp.status}: ${resp.statusText}`);
      return [];
    }
    const data = await resp.json();
    const results = data.results || [];
    if (results.length === 0) {
      console.warn(`[SwissTopo] identify returned 0 results for layers=${layers.join(',')} at ${lat},${lng}`);
    }
    return results;
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[SwissTopo] identify fetch failed:`, err?.message || err);
    return [];
  }
}

// Search SwissNames3D by name — returns point features with lat/lng.
export async function searchSwissNames(
  name: string,
  limit: number = 10,
): Promise<any[]> {
  if (!name) return [];
  const params = new URLSearchParams({
    searchText: name,
    type: 'locations',
    origins: 'gazetteer',
    sr: '4326',
  });
  const url = `${API_BASE}/SearchServer?${params.toString()}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.results || []).slice(0, limit);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// Extract polygon [lat, lng][] from a feature's geometry.
// Handles GeoJSON Polygon/MultiPolygon and ESRI ring formats.
// Auto-detects LV95 vs WGS84 coordinate systems.
export function extractPolygon(feature: any): [number, number][] | null {
  if (!feature?.geometry) return null;

  let coords: number[][] | null = null;

  // GeoJSON Polygon
  if (feature.geometry.type === 'Polygon') {
    coords = feature.geometry.coordinates?.[0] || null;
  }
  // GeoJSON MultiPolygon — take the largest ring
  else if (feature.geometry.type === 'MultiPolygon') {
    const polygons = feature.geometry.coordinates || [];
    if (polygons.length === 0) return null;
    coords = polygons.reduce(
      (largest, poly) =>
        (poly[0]?.length || 0) > (largest?.length || 0) ? poly[0] : largest,
      null as number[][] | null,
    );
  }
  // ESRI rings — take the largest ring
  else if (feature.geometry.rings) {
    const rings = feature.geometry.rings;
    if (rings.length === 0) return null;
    coords = rings.reduce(
      (largest, ring) =>
        (ring?.length || 0) > (largest?.length || 0) ? ring : largest,
      null as number[][] | null,
    );
  }

  if (!coords || coords.length < 3) return null;

  // Detect coordinate system: LV95 has values > 1000, WGS84 < 360
  const isLV95 = Math.abs(coords[0][0]) > 1000;

  if (isLV95) {
    // LV95 [E, N] → [lat, lng]
    return coords.map((c) => {
      const { lat, lng } = lv95ToWgs84(c[0], c[1]);
      return [lat, lng] as [number, number];
    });
  }

  // WGS84 GeoJSON [lng, lat] → [lat, lng]
  return coords.map((c) => [c[1], c[0]] as [number, number]);
}

// Simplify polygon to max points (for entity storage).
export function simplifyPolygon(
  geom: [number, number][],
  maxPoints = 100,
): [number, number][] {
  const step = Math.max(1, Math.floor(geom.length / maxPoints));
  const polygon: [number, number][] = [];
  for (let i = 0; i < geom.length; i += step) {
    polygon.push([
      Math.round(geom[i][0] * 1e6) / 1e6,
      Math.round(geom[i][1] * 1e6) / 1e6,
    ]);
  }
  if (polygon.length > 0) {
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      polygon.push([first[0], first[1]]);
    }
  }
  return polygon;
}

// SwissTopo layers relevant for amateur radio references
export const SWISSTOPO_LAYERS = {
  // Protected areas (for POTA/WWFF boundaries)
  BLN: 'ch.bafu.bundesinventare-bln', // Bundesinventar der Landschaften und Naturdenkmäler
  BIOTOP: 'ch.bafu.biotop', // Biotope
  MOOR: 'ch.bafu.moorlandschaften', // Moor landscapes
  AUEN: 'ch.bafu.bundesinventare-auen', // Auen (floodplains)
  // Geographic names (for SOTA summits, lake names)
  SWISSNAMES: 'ch.swisstopo.swissnames3d',
  // Water bodies (for LLOTA lake polygons)
  WATER: 'ch.swisstopo.swisstlm3d-gewaesser',
};