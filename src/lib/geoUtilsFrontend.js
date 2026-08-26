// Frontend Geo-Utilities für Maidenhead-Locator, Distanz, Peilung.
// JS-Version der backend geoUtils.ts (für React-Komponenten).

export function maidenheadToLatLon(locator) {
  if (!locator || locator.length < 4) return null;
  const loc = locator.toUpperCase().trim();

  const c1 = loc.charCodeAt(0) - 65;
  const c2 = loc.charCodeAt(1) - 65;
  if (c1 < 0 || c1 > 17 || c2 < 0 || c2 > 17) return null;

  const c3 = parseInt(loc[2]);
  const c4 = parseInt(loc[3]);
  if (isNaN(c3) || isNaN(c4)) return null;

  let lon = c1 * 20 - 180 + c3 * 2 + 1;
  let lat = c2 * 10 - 90 + c4 + 0.5;

  if (loc.length >= 6) {
    const c5 = loc.charCodeAt(4) - 65;
    const c6 = loc.charCodeAt(5) - 65;
    if (c5 >= 0 && c5 <= 23 && c6 >= 0 && c6 <= 23) {
      lon += (c5 + 0.5) * (2 / 24);
      lat += (c6 + 0.5) * (1 / 24);
    }
  }

  return { lat, lon };
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return Math.round((θ * 180 / Math.PI + 360) % 360);
}

export function destinationPoint(lat, lon, azimuth, distanceKm) {
  const R = 6371;
  const δ = distanceKm / R;
  const θ = azimuth * Math.PI / 180;
  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));

  return {
    lat: φ2 * 180 / Math.PI,
    lon: λ2 * 180 / Math.PI,
  };
}

export function signalToDistance(sMeter) {
  const map = { 9: 1, 8: 2, 7: 5, 6: 10, 5: 20, 4: 50, 3: 100, 2: 200, 1: 500 };
  return map[sMeter] || 500;
}

export function latLngToGrid(lat, lng) {
  const adjLng = lng + 180;
  const adjLat = lat + 90;
  const fieldLng = Math.floor(adjLng / 20);
  const fieldLat = Math.floor(adjLat / 10);
  const squareLng = Math.floor((adjLng % 20) / 2);
  const squareLat = Math.floor(adjLat % 10);
  const subSqLng = Math.floor((adjLng % 20 % 2) * 12);
  const subSqLat = Math.floor((adjLat % 10 % 1) * 24);
  return (
    String.fromCharCode(65 + fieldLng) +
    String.fromCharCode(65 + fieldLat) +
    squareLng + squareLat +
    String.fromCharCode(97 + subSqLng) +
    String.fromCharCode(97 + subSqLat)
  );
}