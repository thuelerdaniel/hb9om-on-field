import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from '../../shared/internalAuth.ts';

// Fetches POTA park boundary polygons from OpenStreetMap.
// Used for POTA parks OUTSIDE Switzerland (Swiss parks use SwissTopo BLN).
//
// Strategy:
//   1. Nominatim API — search by park name, returns GeoJSON polygon
//   2. Overpass API fallback — search by coordinates (boundary=national_park,
//      leisure=nature_reserve, boundary=protected_area)
//
// Matching: Nominatim results are filtered by distance to park coordinates (<50km).
// Point-in-polygon test for Overpass results ensures correct association.
//
// Returns: { success, polygon: [lat, lng][], name, source }

function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [piLat, piLng] = polygon[i];
    const [pjLat, pjLng] = polygon[j];
    const intersect = ((piLng > lng) !== (pjLng > lng)) &&
      (lat < ((pjLat - piLat) * (lng - piLng)) / (pjLng - piLng) + piLat);
    if (intersect) inside = !inside;
  }
  return inside;
}

function simplifyPolygon(polygon: [number, number][], maxPoints = 200): [number, number][] {
  if (polygon.length <= maxPoints) return polygon;
  const step = Math.ceil(polygon.length / maxPoints);
  const simplified = polygon.filter((_, i) => i % step === 0);
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first);
  return simplified;
}

function extractPolygonFromGeoJSON(geojson: any): [number, number][] | null {
  if (!geojson) return null;
  let coords: number[][] | null = null;
  if (geojson.type === 'Polygon') {
    coords = geojson.coordinates?.[0] || null;
  } else if (geojson.type === 'MultiPolygon') {
    const polygons = geojson.coordinates || [];
    coords = polygons.reduce((largest: number[][] | null, poly: number[][][]) =>
      (poly[0]?.length || 0) > (largest?.length || 0) ? poly[0] : largest, null);
  }
  if (!coords || coords.length < 3) return null;
  // GeoJSON is [lng, lat] → convert to [lat, lng]
  return coords.map(c => [c[1], c[0]] as [number, number]);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lat, lng, name, reference } = body;
    if (lat == null || lng == null) {
      return Response.json({ error: 'Missing lat/lng' }, { status: 400 });
    }

    // 1. Nominatim API — search by park name (most reliable for worldwide parks)
    if (name) {
      try {
        const searchName = encodeURIComponent(name);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${searchName}&format=json&limit=5&polygon_geojson=1`,
          {
            headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' },
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);
        if (resp.ok) {
          const results = await resp.json();
          // Find the result closest to the park's coordinates (within 50km)
          let bestResult: any = null;
          let bestDist = Infinity;
          for (const r of results) {
            if (!r.geojson) continue;
            const rLat = parseFloat(r.lat);
            const rLng = parseFloat(r.lon);
            const dist = haversineKm(lat, lng, rLat, rLng);
            if (dist < bestDist && dist < 50) {
              bestDist = dist;
              bestResult = r;
            }
          }
          if (bestResult) {
            const polygon = extractPolygonFromGeoJSON(bestResult.geojson);
            if (polygon && polygon.length >= 3) {
              const simplified = simplifyPolygon(polygon);
              // Persist polygon to PotaPoint record for future instant loading
              if (reference) {
                try {
                  const existing = await base44.entities.PotaPoint.filter({ code: reference }, undefined, 1, 0);
                  if (existing && existing.length > 0) {
                    await base44.entities.PotaPoint.update(existing[0].id, {
                      boundary: simplified,
                      boundary_source: 'openstreetmap-nominatim',
                    });
                  }
                } catch {}
              }
              return Response.json({
                success: true,
                polygon: simplified,
                name: bestResult.name || name,
                source: 'openstreetmap-nominatim',
                osm_id: bestResult.osm_id,
                osm_type: bestResult.osm_type,
                reference,
                distance_km: bestDist.toFixed(2),
              });
            }
          }
        }
      } catch {
        // Nominatim failed — try Overpass fallback
      }
    }

    // 2. Overpass API fallback — search by coordinates within ~5km
    const delta = 0.05; // ~5km radius
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    const query = `
      [out:json][timeout:15];
      (
        way["boundary"="national_park"](${bbox});
        way["leisure"="nature_reserve"](${bbox});
        way["boundary"="protected_area"](${bbox});
        relation["boundary"="national_park"](${bbox});
        relation["leisure"="nature_reserve"](${bbox});
        relation["boundary"="protected_area"](${bbox});
      );
      out geom;
    `;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) continue;
        const data = await resp.json();

        const polygons: { polygon: [number, number][]; tags: any }[] = [];
        for (const el of data.elements || []) {
          let polygon: [number, number][] | null = null;
          if (el.type === 'way' && el.geometry) {
            polygon = el.geometry.map((g: any) => [g.lat, g.lon] as [number, number]);
          } else if (el.type === 'relation' && el.members) {
            const outerMembers = el.members.filter((m: any) => m.role === 'outer' && m.geometry);
            if (outerMembers.length > 0) {
              const largest = outerMembers.reduce((best: any, m: any) =>
                (m.geometry?.length || 0) > (best?.geometry?.length || 0) ? m : best, outerMembers[0]);
              polygon = largest.geometry.map((g: any) => [g.lat, g.lon] as [number, number]);
            }
          }
          if (polygon && polygon.length >= 3) {
            const first = polygon[0];
            const last = polygon[polygon.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) polygon.push(first);
            polygons.push({ polygon, tags: el.tags || {} });
          }
        }

        // Find polygon containing the park point (strict matching)
        for (const p of polygons) {
          if (pointInPolygon(lat, lng, p.polygon)) {
            const simplified = simplifyPolygon(p.polygon);
            // v0.952: Persist polygon to PotaPoint
            if (reference) {
              try {
                const existing = await base44.entities.PotaPoint.filter({ code: reference }, undefined, 1, 0);
                if (existing && existing.length > 0) {
                  await base44.entities.PotaPoint.update(existing[0].id, {
                    boundary: simplified,
                    boundary_source: 'openstreetmap-overpass',
                  });
                }
              } catch {}
            }
            return Response.json({
              success: true,
              polygon: simplified,
              name: p.tags.name || '',
              source: 'openstreetmap-overpass',
              reference,
            });
          }
        }

        // Fallback: nearest polygon
        if (polygons.length > 0) {
          let nearest = polygons[0];
          let minDist = Infinity;
          for (const p of polygons) {
            const cx = p.polygon.reduce((s, pt) => s + pt[0], 0) / p.polygon.length;
            const cy = p.polygon.reduce((s, pt) => s + pt[1], 0) / p.polygon.length;
            const d = Math.hypot(cx - lat, cy - lng);
            if (d < minDist) { minDist = d; nearest = p; }
          }
          const simplified = simplifyPolygon(nearest.polygon);
          // v0.952: Persist nearest polygon to PotaPoint
          if (reference) {
            try {
              const existing = await base44.entities.PotaPoint.filter({ code: reference }, undefined, 1, 0);
              if (existing && existing.length > 0) {
                await base44.entities.PotaPoint.update(existing[0].id, {
                  boundary: simplified,
                  boundary_source: 'openstreetmap-overpass-nearest',
                });
              }
            } catch {}
          }
          return Response.json({
            success: true,
            polygon: simplified,
            name: nearest.tags.name || '',
            source: 'openstreetmap-overpass-nearest',
            reference,
          });
        }
      } catch { continue; }
    }

    return Response.json({
      success: false,
      error: 'No park boundary found in OpenStreetMap',
      lat, lng, reference,
    }, { status: 404 });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}