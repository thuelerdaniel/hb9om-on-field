// Route-Distanz-Utilities — Punkt-zu-Linie-Segment-Distanz und Routen-Bounding-Box.
// Verwendet Euklidische Approximation (für Distanzen < 200km ausreichend genau).

import { haversine } from "./geoUtilsFrontend";

// Konvertiert lat/lon in approximative Meter-Koordinaten für Distanzberechnungen.
function toMeters(lat, lon, refLat) {
  const latM = lat * 111000;
  const lonM = lon * 111000 * Math.cos((refLat * Math.PI) / 180);
  return { x: lonM, y: latM };
}

// Distanz von Punkt P zum Liniensegment A-B (in km).
function distanceToSegment(pLat, pLon, aLat, aLon, bLat, bLon) {
  const refLat = (aLat + bLat) / 2;
  const p = toMeters(pLat, pLon, refLat);
  const a = toMeters(aLat, aLon, refLat);
  const b = toMeters(bLat, bLon, refLat);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // A == B — Distanz zum Punkt
    const ddx = p.x - a.x;
    const ddy = p.y - a.y;
    return Math.sqrt(ddx * ddx + ddy * ddy) / 1000;
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const distM = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
  return distM / 1000;
}

// Minimale Distanz von Punkt zur gesamten Route (Polyline).
// routeCoords: Array von [lat, lon] Paaren.
export function minDistanceToRoute(lat, lon, routeCoords) {
  if (!routeCoords || routeCoords.length === 0) return Infinity;
  if (routeCoords.length === 1) {
    return haversine(lat, lon, routeCoords[0][0], routeCoords[0][1]);
  }

  let minDist = Infinity;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [aLat, aLon] = routeCoords[i];
    const [bLat, bLon] = routeCoords[i + 1];
    const dist = distanceToSegment(lat, lon, aLat, aLon, bLat, bLon);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

// Findet den nächsten Streckenabschnitt (Segment-Index) für einen Punkt.
export function nearestSegmentIndex(lat, lon, routeCoords) {
  if (!routeCoords || routeCoords.length < 2) return 0;

  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [aLat, aLon] = routeCoords[i];
    const [bLat, bLon] = routeCoords[i + 1];
    const dist = distanceToSegment(lat, lon, aLat, aLon, bLat, bLon);
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }
  return minIdx;
}

// Bounding-Box der Route + Reichweite-Korridor.
// Gibt { north, south, east, west } zurück.
export function routeBounds(routeCoords, rangeKm) {
  if (!routeCoords || routeCoords.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const [lat, lon] of routeCoords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  // Reichweite in Grad approximieren (1 Grad ≈ 111km)
  const latDeg = rangeKm / 111;
  const midLat = (minLat + maxLat) / 2;
  const lonDeg = rangeKm / (111 * Math.cos((midLat * Math.PI) / 180));

  return {
    north: maxLat + latDeg,
    south: minLat - latDeg,
    east: maxLon + lonDeg,
    west: minLon - lonDeg,
  };
}

// Bounding-Box um einen Punkt + Reichweite.
export function pointBounds(lat, lon, rangeKm) {
  const latDeg = rangeKm / 111;
  const lonDeg = rangeKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    north: lat + latDeg,
    south: lat - latDeg,
    east: lon + lonDeg,
    west: lon - lonDeg,
  };
}

// Gesamtdistanz der Route (Summe der Segment-Distanzen in km).
export function totalRouteDistance(routeCoords) {
  if (!routeCoords || routeCoords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    total += haversine(routeCoords[i][0], routeCoords[i][1], routeCoords[i + 1][0], routeCoords[i + 1][1]);
  }
  return Math.round(total);
}

// Ruft OSRM Routing API auf und gibt GeoJSON-Koordinaten zurück.
// Fallback: direkte Linien zwischen Wegpunkten.
export async function fetchOsmRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) {
    return waypoints.map((wp) => [wp.lat, wp.lon]);
  }

  const coords = waypoints.map((wp) => `${wp.lon},${wp.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);

    const data = await resp.json();
    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      const geometry = data.routes[0].geometry;
      if (geometry && geometry.coordinates) {
        // GeoJSON Koordinaten sind [lon, lat] — umdrehen zu [lat, lon]
        return geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      }
    }
    throw new Error("OSRM: keine Route gefunden");
  } catch (err) {
    // Fallback: direkte Linien zwischen Wegpunkten
    return waypoints.map((wp) => [wp.lat, wp.lon]);
  }
}