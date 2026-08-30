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
  // LV95 → LV03: E_LV03 = E_LV95 - 2000000, N_LV03 = N_LV95 - 1000000
  const y = n - 1000000;
  const x = e - 2000000;

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

  // Construct URL manually — SwissTopo API expects raw commas in geometry/layers,
  // URLSearchParams encodes them as %2C which the API doesn't recognize.
  const url = `${API_BASE}/MapServer/identify` +
    `?geometryType=esriGeometryEnvelope` +
    `&geometry=${geometry}` +
    `&layers=${layersParam}` +
    `&geometryFormat=geojson` +
    `&sr=4326` +
    `&tolerance=0` +
    `&imageDisplay=0,0,0` +
    `&mapExtent=0,0,0,0` +
    `&returnGeometry=true`;
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
// Constructs URL manually — URLSearchParams encodes spaces as + which the
// SwissTopo SearchServer API doesn't handle correctly for searchText.
export async function searchSwissNames(
  name: string,
  limit: number = 10,
): Promise<any[]> {
  if (!name) return [];
  const encodedName = encodeURIComponent(name);
  const url = `${API_BASE}/SearchServer` +
    `?searchText=${encodedName}` +
    `&type=locations` +
    `&origins=gazetteer` +
    `&sr=4326`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      console.warn(`[SwissTopo] SearchServer returned ${resp.status}`);
      return [];
    }
    const data = await resp.json();
    const results = data.results || [];
    if (results.length === 0) {
      console.warn(`[SwissTopo] SearchServer returned 0 results for "${name}"`);
    }
    return results.slice(0, limit);
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[SwissTopo] SearchServer fetch failed:`, err?.message || err);
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

// WGS84 → LV95 (CH1903+) conversion
// Formula: https://www.swisstopo.admin.ch/en/conversion-coordinates
export function wgs84ToLv95(lat: number, lng: number): { e: number; n: number } {
  const phi = (lat * 3600 - 169028.66) / 10000;
  const lambda = (lng * 3600 - 26782.5) / 10000;

  const e = 2600072.377
    + 211455.93 * lambda
    - 10938.51 * lambda * phi
    - 0.36 * lambda * phi * phi
    - 44.54 * lambda * lambda * lambda;
  const n = 1200147.077
    + 308807.95 * phi
    + 3745.25 * lambda * lambda
    - 76.83 * phi * phi
    - 0.003 * lambda * lambda * phi * phi;

  return { e: Math.round(e), n: Math.round(n) };
}

// Get elevation at an LV95 point from SwissTopo height REST API.
// API: https://api3.geo.admin.ch/rest/services/height?easting=...&northing=...
// Returns elevation in meters above sea level, or null on failure.
export async function getElevation(e: number, n: number): Promise<number | null> {
  const url = `https://api3.geo.admin.ch/rest/services/height?easting=${e}&northing=${n}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.height != null) return parseFloat(String(data.height));
    return null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// Find the SOTA activation zone contour using radial elevation sampling.
//
// SOTA rule: the activation zone is the area bounded by the contour line that
// is no more than 25 vertical metres below the summit. We sample elevations
// along radial directions from the summit and find where the elevation crosses
// the target contour (summitElevation - dropMeters) using linear interpolation.
//
// Returns a polygon [lat, lng][] or null if insufficient data.
export async function findSotaActivationContour(
  lat: number,
  lng: number,
  summitElevation: number,
  dropMeters: number = 25,
): Promise<[number, number][] | null> {
  const center = wgs84ToLv95(lat, lng);

  // If summit elevation not provided, get it from the API
  let summitElev = summitElevation;
  if (!summitElev || summitElev <= 0) {
    const elev = await getElevation(center.e, center.n);
    if (elev == null) return null;
    summitElev = elev;
  }

  const target = summitElev - dropMeters;

  // 16 radial directions (every 22.5°)
  const numDirections = 16;
  // Sample distances in meters — covers typical activation zone sizes
  const sampleDistances = [15, 30, 60, 120, 250];

  // Batch all elevation queries for parallel execution
  const queries: { dirIdx: number; distIdx: number; e: number; n: number; dist: number }[] = [];
  for (let i = 0; i < numDirections; i++) {
    const angleRad = (i * 360 * Math.PI) / (numDirections * 180);
    for (let d = 0; d < sampleDistances.length; d++) {
      const dist = sampleDistances[d];
      const e = Math.round(center.e + dist * Math.sin(angleRad));
      const n = Math.round(center.n + dist * Math.cos(angleRad));
      queries.push({ dirIdx: i, distIdx: d, e, n, dist });
    }
  }

  // Execute in batches of 20 to avoid overwhelming the API
  const results: { dirIdx: number; distIdx: number; dist: number; elevation: number }[] = [];
  const batchSize = 20;
  for (let start = 0; start < queries.length; start += batchSize) {
    const batch = queries.slice(start, start + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (q) => {
        const elev = await getElevation(q.e, q.n);
        return { dirIdx: q.dirIdx, distIdx: q.distIdx, dist: q.dist, elevation: elev ?? -1 };
      }),
    );
    results.push(...batchResults);
  }

  // Group results by direction
  const contourPoints: [number, number][] = [];
  for (let i = 0; i < numDirections; i++) {
    const dirSamples = results
      .filter((r) => r.dirIdx === i && r.elevation >= 0)
      .sort((a, b) => a.dist - b.dist);

    if (dirSamples.length === 0) continue;

    // Find where elevation crosses target (going from above to below)
    let foundDist: number | null = null;
    let foundE: number | null = null;
    let foundN: number | null = null;

    for (let j = 0; j < dirSamples.length - 1; j++) {
      const s1 = dirSamples[j];
      const s2 = dirSamples[j + 1];
      if (s1.elevation >= target && s2.elevation < target) {
        // Linear interpolation between s1 and s2
        const t = (s1.elevation - target) / (s1.elevation - s2.elevation);
        const angleRad = (i * 360 * Math.PI) / (numDirections * 180);
        const d = s1.dist + t * (s2.dist - s1.dist);
        foundE = Math.round(center.e + d * Math.sin(angleRad));
        foundN = Math.round(center.n + d * Math.cos(angleRad));
        foundDist = d;
        break;
      }
    }

    // Fallback: if no crossing found
    if (foundE == null) {
      const angleRad = (i * 360 * Math.PI) / (numDirections * 180);
      const last = dirSamples[dirSamples.length - 1];
      const first = dirSamples[0];
      if (last.elevation >= target) {
        // All above target — use farthest sample (broad summit)
        foundE = Math.round(center.e + last.dist * Math.sin(angleRad));
        foundN = Math.round(center.n + last.dist * Math.cos(angleRad));
      } else if (first.elevation < target) {
        // All below target — very sharp summit, use 15m
        foundE = Math.round(center.e + 15 * Math.sin(angleRad));
        foundN = Math.round(center.n + 15 * Math.cos(angleRad));
      } else {
        foundE = Math.round(center.e + last.dist * Math.sin(angleRad));
        foundN = Math.round(center.n + last.dist * Math.cos(angleRad));
      }
    }

    const { lat: pLat, lng: pLng } = lv95ToWgs84(foundE, foundN);
    contourPoints.push([pLat, pLng]);
  }

  if (contourPoints.length < 3) return null;

  // Close the polygon
  contourPoints.push(contourPoints[0]);

  return contourPoints;
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