// Geo-Utilities für Maidenhead-Locator-Konvertierung, Distanz und Peilung.
// Wird von fetchDxSpots und FoxHunt-Features genutzt.

// Maidenhead Grid Locator → {lat, lon}
// Unterstützt 4- und 6-Zeichen Locator (z.B. JN36, JN36FL)
export function maidenheadToLatLon(locator: string): { lat: number; lon: number } | null {
  if (!locator || locator.length < 4) return null;
  const loc = locator.toUpperCase().trim();

  // Field (AA-RR): 10° lon, 10° lat
  const c1 = loc.charCodeAt(0) - 65; // A=0
  const c2 = loc.charCodeAt(1) - 65;
  if (c1 < 0 || c1 > 17 || c2 < 0 || c2 > 17) return null;

  // Square (00-99): 1° lon, 1° lat
  const c3 = parseInt(loc[2]);
  const c4 = parseInt(loc[3]);
  if (isNaN(c3) || isNaN(c4)) return null;

  let lon = c1 * 20 - 180 + c3 * 2 + 1;
  let lat = c2 * 10 - 90 + c4 + 0.5;

  // Subsquare (aa-xx): 2.5' lon, 2.5' lat (nur bei 6-Zeichen)
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

// Haversine-Distanz in km
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Erdradius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Bearing / Azimuth 0-360°
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return Math.round((θ * 180 / Math.PI + 360) % 360);
}

// Destination-Punkt von lat/lon + bearing + distanz in km
export function destinationPoint(lat: number, lon: number, azimuth: number, distanceKm: number): { lat: number; lon: number } {
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

// S-Meter → geschätzte Distanz in km (für Fox Hunting)
export function signalToDistance(sMeter: number): number {
  const map: Record<number, number> = { 9: 1, 8: 2, 7: 5, 6: 10, 5: 20, 4: 50, 3: 100, 2: 200, 1: 500 };
  return map[sMeter] || 500;
}