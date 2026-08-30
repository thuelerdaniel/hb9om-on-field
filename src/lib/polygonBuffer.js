// Expand a polygon outward from its centroid by a given distance in meters.
// This is a simple radial expansion — not a true GIS buffer (which would handle
// concavities properly), but visually correct for most lake shapes.
//
// @param polygon: Array of [lat, lng] coordinate pairs (closed or open)
// @param bufferMeters: Distance to expand outward (e.g. 200 for 200m LLOTA buffer)
// @returns: New array of [lat, lng] coordinate pairs
export function expandPolygon(polygon, bufferMeters) {
  if (!polygon || polygon.length < 3 || bufferMeters <= 0) return polygon;

  // Calculate centroid
  const centroidLat = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
  const centroidLng = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;

  // Meters per degree at this latitude
  const latPerMeter = 1 / 111000;
  const lngPerMeter = 1 / (111000 * Math.cos(centroidLat * Math.PI / 180));

  // Convert polygon to local meters from centroid
  const localPoints = polygon.map(([lat, lng]) => [
    (lat - centroidLat) / latPerMeter, // y in meters (north positive)
    (lng - centroidLng) / lngPerMeter, // x in meters (east positive)
  ]);

  // Expand each point outward from origin (centroid) by bufferMeters
  const expandedPoints = localPoints.map(([y, x]) => {
    const dist = Math.sqrt(x * x + y * y);
    if (dist === 0) return [y, x];
    const factor = (dist + bufferMeters) / dist;
    return [y * factor, x * factor];
  });

  // Convert back to lat/lng
  return expandedPoints.map(([y, x]) => [
    centroidLat + y * latPerMeter,
    centroidLng + x * lngPerMeter,
  ]);
}