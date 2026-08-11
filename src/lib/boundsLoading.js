// Bounds-based reference loading helpers — only load references visible on the map.

export const REF_TYPES = ['sota', 'pota', 'hbff', 'wwbota', 'castle', 'iota', 'lighthouse', 'tota'];

/**
 * Convert a Leaflet LatLngBounds to a plain object {north, south, east, west}.
 */
export function boundsToObj(bounds) {
  if (!bounds) return null;
  try {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    return { north: ne.lat, south: sw.lat, east: ne.lng, west: sw.lng };
  } catch {
    return null;
  }
}

/**
 * Check if `inner` bounds are fully contained within `outer` bounds.
 */
export function boundsContained(inner, outer) {
  if (!inner || !outer) return false;
  return inner.north <= outer.north && inner.south >= outer.south &&
         inner.east <= outer.east && inner.west >= outer.west;
}

/**
 * Compute the union of two bounds (smallest rectangle containing both).
 */
export function unionBounds(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    north: Math.max(a.north, b.north),
    south: Math.min(a.south, b.south),
    east: Math.max(a.east, b.east),
    west: Math.min(a.west, b.west),
  };
}

/**
 * Merge two arrays of references, deduplicating by code/reference field.
 */
export function mergeRefs(existing, incoming) {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;
  const map = new Map();
  for (const r of existing) map.set(r.code || r.reference, r);
  for (const r of incoming) map.set(r.code || r.reference, r);
  return Array.from(map.values());
}