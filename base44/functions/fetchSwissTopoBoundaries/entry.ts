import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from "../../shared/internalAuth.ts";
import {
  isInSwitzerland,
  lv95ToWgs84,
  searchSwissNames,
  simplifyPolygon,
  findSotaActivationContour,
  SWISSTOPO_LAYERS,
} from "../../shared/swissTopoApi.ts";

// Fetches boundary/point data from SwissTopo for Swiss references.
//
// Supported types:
//   - "bln":   BLN protected landscape boundary (polygon) — for POTA/WWFF park contours
//   - "sota":  SwissNames3D peak data (point + elevation) — for SOTA summit enrichment
//   - "lake":  Water body polygon — for LLOTA lake contours
//
// For "bln" and "lake": returns { success, polygon, name, source: 'swisstopo' }
// For "sota": returns { success, peaks: [{ name, lat, lng, elevation, objectclass }] }
//
// SwissTopo API: https://api3.geo.admin.ch/rest/services/ech/

const API_BASE = 'https://api3.geo.admin.ch/rest/services/ech';

// Identify features at a point via SwissTopo MapServer identify API.
// Uses a bounding box (envelope) around the point for reliable polygon intersection.
async function identifyAtPoint(
  lat: number,
  lng: number,
  layers: string[],
  toleranceM: number,
): Promise<any[]> {
  const delta = toleranceM / 111000;
  const bBox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const url = `${API_BASE}/MapServer/identify` +
    `?geometryType=esriGeometryEnvelope` +
    `&geometry=${bBox}` +
    `&layers=all:${layers.join(',')}` +
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
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// Extract polygon [lat, lng][] from a feature's geometry.
function extractPolygon(feature: any): [number, number][] | null {
  if (!feature?.geometry) return null;

  let coords: number[][] | null = null;

  if (feature.geometry.type === 'Polygon') {
    coords = feature.geometry.coordinates?.[0] || null;
  } else if (feature.geometry.type === 'MultiPolygon') {
    const polygons = feature.geometry.coordinates || [];
    if (polygons.length === 0) return null;
    coords = polygons.reduce(
      (largest, poly) =>
        (poly[0]?.length || 0) > (largest?.length || 0) ? poly[0] : largest,
      null as number[][] | null,
    );
  } else if (feature.geometry.rings) {
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
    return coords.map((c) => {
      const { lat, lng } = lv95ToWgs84(c[0], c[1]);
      return [lat, lng] as [number, number];
    });
  }

  // WGS84 GeoJSON [lng, lat] → [lat, lng]
  return coords.map((c) => [c[1], c[0]] as [number, number]);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, lat, lng, name, radius, elevation } = body;
    if (!type) {
      return Response.json(
        { error: "Missing 'type' parameter (bln, sota, sota_contour, or lake)" },
        { status: 400 },
      );
    }

    if (lat == null || lng == null || !isInSwitzerland(lat, lng)) {
      return Response.json({
        success: false,
        error: 'Coordinates not in Switzerland or missing lat/lng',
        type,
      }, { status: 400 });
    }

    // --- BLN: Protected landscape boundary (polygon) ---
    if (type === 'bln') {
      const tolerance = radius || 2000;
      // Query BLN only — multiple layers can cause the API to return 0 results
      const features = await identifyAtPoint(
        lat, lng,
        [SWISSTOPO_LAYERS.BLN],
        tolerance,
      );
      for (const feature of features) {
        const poly = extractPolygon(feature);
        if (poly && poly.length >= 3) {
          const simplified = simplifyPolygon(poly);
          const featureName =
            feature.properties?.bln_name ||
            feature.properties?.label ||
            feature.properties?.name ||
            '';
          return Response.json({
            success: true,
            type: 'bln',
            polygon: simplified,
            name: featureName,
            layer: feature.layerBodId || '',
            source: 'swisstopo',
          });
        }
      }
      return Response.json({
        success: false,
        error: 'No BLN/biotope/moor boundary found at coordinates',
        type: 'bln',
        lat,
        lng,
      }, { status: 404 });
    }

    // --- Lake: Water body polygon ---
    if (type === 'lake') {
      const tolerance = radius || 500;
      const features = await identifyAtPoint(
        lat, lng,
        [SWISSTOPO_LAYERS.WATER],
        tolerance,
      );
      for (const feature of features) {
        const poly = extractPolygon(feature);
        if (poly && poly.length >= 3) {
          const simplified = simplifyPolygon(poly);
          const featureName =
            feature.properties?.label ||
            feature.properties?.name ||
            '';
          return Response.json({
            success: true,
            type: 'lake',
            polygon: simplified,
            name: featureName,
            layer: feature.layerBodId || '',
            source: 'swisstopo',
          });
        }
      }
      return Response.json({
        success: false,
        error: 'No water body polygon found at coordinates',
        type: 'lake',
        lat,
        lng,
      }, { status: 404 });
    }

    // --- SOTA Contour: Activation zone boundary from elevation data ---
    // SOTA rule: activation zone = area within 25 vertical metres of summit.
    // Uses SwissTopo height API to sample elevations radially and find the
    // contour line at (summitElevation - 25m).
    if (type === 'sota_contour') {
      const dropMeters = body.drop_meters || 25;
      const summitElev = elevation || 0;

      const polygon = await findSotaActivationContour(lat, lng, summitElev, dropMeters);
      if (polygon && polygon.length >= 3) {
        return Response.json({
          success: true,
          type: 'sota_contour',
          polygon,
          name: name || '',
          source: 'swisstopo-height',
          drop_meters: dropMeters,
        });
      }

      return Response.json({
        success: false,
        error: 'Could not determine SOTA activation contour from elevation data',
        type: 'sota_contour',
        lat,
        lng,
      }, { status: 404 });
    }

    // --- SOTA: SwissNames3D peak data ---
    if (type === 'sota') {
      if (name) {
        const results = await searchSwissNames(name, 30);
        if (results.length === 0) {
          return Response.json({
            success: false,
            error: 'SearchServer returned 0 results',
            type: 'sota',
            name,
          }, { status: 404 });
        }

        // Filter for point features (TLM_NAME_PKT) — these include peaks,
        // passes, hills, ridges. Also include area names (TLM_GEBIETSNAME)
        // as fallback for broader searches.
        const peaks = results
          .map((r: any) => ({
            name: (r.attrs?.label || r.label || '').replace(/<[^>]*>/g, ''),
            lat: r.attrs?.lat || r.attrs?.y,
            lng: r.attrs?.lon || r.attrs?.x,
            elevation: r.attrs?.height || r.attrs?.alt || null,
            objectclass: r.attrs?.objectclass || '',
          }))
          .filter((p: any) => p.lat != null && p.lng != null)
          .filter((p: any) => {
            const oc = (p.objectclass || '').toUpperCase();
            // Point features: peaks, passes, hills, ridges
            if (oc === 'TLM_NAME_PKT') return true;
            // Area names as fallback (e.g., "Gebiet Eiger-Nordwand")
            if (oc === 'TLM_GEBIETSNAME') return true;
            return false;
          });

        // Sort by distance to given coordinates (closest first)
        if (lat != null && lng != null && peaks.length > 0) {
          peaks.sort((a: any, b: any) => {
            const da = Math.hypot(a.lat - lat, a.lng - lng);
            const db = Math.hypot(b.lat - lat, b.lng - lng);
            return da - db;
          });
        }

        if (peaks.length > 0) {
          return Response.json({
            success: true,
            type: 'sota',
            peaks,
            source: 'swisstopo',
          });
        }
      }

      // Fallback: identify features at the given coordinates
      const tolerance = radius || 2000;
      const features = await identifyAtPoint(
        lat, lng,
        [SWISSTOPO_LAYERS.SWISSNAMES],
        tolerance,
      );
      const peaks = features
        .filter((f: any) => {
          const objclass =
            f.properties?.objectclass || f.attrs?.objectclass || '';
          return (
            objclass.includes('BERG') ||
            objclass.includes('GIPFEL') ||
            objclass.includes('PASS') ||
            objclass.includes('HUEGEL') ||
            objclass.includes('KAMM') ||
            objclass.includes('RUECKEN')
          );
        })
        .map((f: any) => ({
          name:
            f.properties?.label?.replace(/<[^>]*>/g, '') ||
            f.properties?.name ||
            '',
          lat: f.properties?.lat || f.geometry?.coordinates?.[1],
          lng: f.properties?.lon || f.geometry?.coordinates?.[0],
          elevation: f.properties?.height || f.properties?.alt || null,
          objectclass: f.properties?.objectclass || '',
        }))
        .filter((p: any) => p.lat != null && p.lng != null);

      if (peaks.length > 0) {
        return Response.json({
          success: true,
          type: 'sota',
          peaks,
          source: 'swisstopo',
        });
      }

      return Response.json({
        success: false,
        error: 'No peak found in SwissNames3D',
        type: 'sota',
        lat,
        lng,
      }, { status: 404 });
    }

    return Response.json(
      { error: `Unknown type: ${type}. Use 'bln', 'sota', 'sota_contour', or 'lake'.` },
      { status: 400 },
    );
  } catch (error: any) {
    return Response.json(
      { error: error.message || 'Unknown error' },
      { status: 500 },
    );
  }
}