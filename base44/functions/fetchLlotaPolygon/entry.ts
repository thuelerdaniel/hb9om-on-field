import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isInternalCall } from "../../shared/internalAuth.ts";

// Fetches the actual lake outline (polygon) from OpenStreetMap.
// Strategy:
//   1. Try Overpass API (multiple endpoints) — queries water bodies near coordinates
//   2. If Overpass fails, fall back to Nominatim search (by name) + OSM API (get geometry by OSM ID)
// The polygon is cached in the LlotaRef entity for subsequent requests.
// The polygon is simplified (max ~100 points) to keep entity field size manageable.

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

function simplifyPolygon(geom: any[], maxPoints = 100): [number, number][] {
  const step = Math.max(1, Math.floor(geom.length / maxPoints));
  const polygon: [number, number][] = [];
  for (let i = 0; i < geom.length; i += step) {
    polygon.push([
      Math.round(geom[i].lat * 1e6) / 1e6,
      Math.round(geom[i].lon * 1e6) / 1e6,
    ]);
  }
  // Ensure closed polygon
  if (polygon.length > 0) {
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      polygon.push([first[0], first[1]]);
    }
  }
  return polygon;
}

// Try Overpass API — queries water bodies near coordinates
async function tryOverpass(lat: number, lng: number, name: string): Promise<any | null> {
  const query = `[out:json][timeout:25];
(
  way(around:1000,${lat},${lng})["natural"="water"];
  way(around:1000,${lat},${lng})["water"="lake"];
  relation(around:1000,${lat},${lng})["natural"="water"];
);
out geom;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        const data = await resp.json();
        const elements = data.elements || [];
        // Find best match
        let best: any = null;
        let bestScore = -Infinity;
        for (const el of elements) {
          if (el.type !== 'way' && el.type !== 'relation') continue;
          const geom = el.geometry || [];
          if (geom.length < 3) continue;
          const cLat = geom.reduce((s: number, p: any) => s + p.lat, 0) / geom.length;
          const cLng = geom.reduce((s: number, p: any) => s + p.lon, 0) / geom.length;
          const dist = Math.sqrt((cLat - lat) ** 2 + (cLng - lng) ** 2);
          let score = 1000 - dist * 10000;
          const elName = el.tags?.name || '';
          if (name && elName) {
            const nl = name.toLowerCase().trim();
            const el2 = elName.toLowerCase().trim();
            if (el2 === nl) score += 3000;
            else if (el2.includes(nl) || nl.includes(el2)) score += 1500;
          }
          score += Math.min(geom.length, 200);
          if (score > bestScore) { bestScore = score; best = el; }
        }
        if (best) return best;
      }
    } catch {}
  }
  return null;
}

// Fallback: Nominatim search by name, then OSM API for geometry
async function tryNominatim(lat: number, lng: number, name: string): Promise<any | null> {
  if (!name) return null;
  try {
    // Search Nominatim for the lake by name
    const controller1 = new AbortController();
    const timeout1 = setTimeout(() => controller1.abort(), 10000);
    const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=5&addressdetails=0`;
    const resp1 = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' },
      signal: controller1.signal,
    });
    clearTimeout(timeout1);
    if (!resp1.ok) return null;

    const results = await resp1.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    // Find the result closest to our coordinates and with an OSM way/relation type
    let bestResult: any = null;
    let bestDist = Infinity;
    for (const r of results) {
      if (r.osm_type !== 'way' && r.osm_type !== 'relation') continue;
      const rLat = parseFloat(r.lat);
      const rLng = parseFloat(r.lon);
      const dist = Math.sqrt((rLat - lat) ** 2 + (rLng - lng) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestResult = r;
      }
    }
    if (!bestResult) return null;

    // Fetch full geometry from OSM API
    const osmType = bestResult.osm_type; // 'way' or 'relation'
    const osmId = bestResult.osm_id;
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 10000);
    const osmUrl = `https://api.openstreetmap.org/api/0.6/${osmType}/${osmId}/full.json`;
    const resp2 = await fetch(osmUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'HB9OM-OnField/1.0' },
      signal: controller2.signal,
    });
    clearTimeout(timeout2);
    if (!resp2.ok) return null;

    const osmData = await resp2.json();
    const elements = osmData.elements || [];

    // Build geometry from OSM elements
    if (osmType === 'way') {
      // Way: find the way element, then resolve node coordinates
      const wayEl = elements.find((e: any) => e.type === 'way' && e.id === osmId);
      if (!wayEl || !wayEl.nodes) return null;
      const nodeMap = new Map<number, [number, number]>();
      for (const el of elements) {
        if (el.type === 'node') {
          nodeMap.set(el.id, [el.lat, el.lon]);
        }
      }
      const geom = wayEl.nodes
        .map((nid: number) => nodeMap.get(nid))
        .filter((p: any) => p != null);
      if (geom.length < 3) return null;
      return { geometry: geom.map((p: any) => ({ lat: p[0], lon: p[1] })), tags: wayEl.tags || {} };
    } else {
      // Relation: collect all outer way members and merge their nodes
      const relEl = elements.find((e: any) => e.type === 'relation' && e.id === osmId);
      if (!relEl || !relEl.members) return null;
      const nodeMap = new Map<number, [number, number]>();
      for (const el of elements) {
        if (el.type === 'node') {
          nodeMap.set(el.id, [el.lat, el.lon]);
        }
      }
      // Collect all outer ways
      const outerWays = relEl.members
        .filter((m: any) => m.role === 'outer' || m.role === '')
        .map((m: any) => elements.find((e: any) => e.type === 'way' && e.id === m.ref))
        .filter((w: any) => w && w.nodes);

      // Merge all outer way nodes into one polygon (simplified — doesn't handle multiple outer rings)
      const allNodes: [number, number][] = [];
      for (const w of outerWays) {
        for (const nid of w.nodes) {
          const p = nodeMap.get(nid);
          if (p) allNodes.push(p);
        }
      }
      if (allNodes.length < 3) return null;
      return { geometry: allNodes.map((p) => ({ lat: p[0], lon: p[1] })), tags: relEl.tags || {} };
    }
  } catch {
    return null;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let body: any = {};
    try { body = await req.json(); } catch {}

    if (!isInternalCall(body)) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, lat, lng, name } = body;
    if (!code || lat == null || lng == null) {
      return Response.json({ error: 'Missing code, lat, or lng' }, { status: 400 });
    }

    // Check if polygon is already cached in the entity
    let existingId: string | null = null;
    try {
      const existing = await base44.asServiceRole.entities.LlotaRef.filter({ code });
      if (existing && existing.length > 0) {
        existingId = existing[0].id;
        if (existing[0].polygon && Array.isArray(existing[0].polygon) && existing[0].polygon.length > 2) {
          return Response.json({
            success: true,
            code,
            polygon: existing[0].polygon,
            cached: true,
          });
        }
      }
    } catch {}

    // Strategy 1: Try Overpass API
    let bestElement = await tryOverpass(lat, lng, name);

    // Strategy 2: Fallback to Nominatim + OSM API
    if (!bestElement) {
      bestElement = await tryNominatim(lat, lng, name);
    }

    if (!bestElement || !bestElement.geometry || bestElement.geometry.length < 3) {
      return Response.json({
        success: false,
        error: 'No water body found near coordinates',
        code, lat, lng,
      }, { status: 404 });
    }

    // Simplify and close the polygon
    const polygon = simplifyPolygon(bestElement.geometry);

    // Cache the polygon in the entity
    if (existingId) {
      try {
        await base44.asServiceRole.entities.LlotaRef.update(existingId, { polygon });
      } catch {}
    }

    return Response.json({
      success: true,
      code,
      polygon,
      osm_name: bestElement.tags?.name || '',
      cached: false,
    });
  } catch (error: any) {
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}