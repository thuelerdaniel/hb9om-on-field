// Vereinfachte Mond-Positionsberechnung nach Jean Meeus ("Astronomical Algorithms").
// Berechnet ekliptische Länge/Breite des Mondes und die Mondphase aus dem Julianischen Datum.
// Hinreichend genau für Visualisierung — nicht für Navigationszwecke.

function toJulian(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Berechnet die Mond-Position relativ zur Erde.
 * @param {Date} date - Aktuelles Datum/Uhrzeit
 * @returns {{ eclipticLon: number, eclipticLat: number, distance: number, phase: number, illumination: number }}
 *   - eclipticLon/Breite in Grad (0-360)
 *   - distance in Erdhalbmessern (mittl. 60.4)
 *   - phase: 0=Neumond, 0.5=Vollmond, 1=Neumond (zyklisch)
 *   - illumination: 0-1 (beleuchteter Anteil)
 */
export function getMoonPosition(date = new Date()) {
  const J = toJulian(date);
  const T = (J - 2451545.0) / 36525; // Julianische Jahrhunderte seit J2000

  // Mittlere Länge des Mondes
  const L0 = (218.316 + 481267.8813 * T) % 360;
  // Mittlere Anomalie des Mondes
  const M = (134.963 + 477198.8676 * T) % 360;
  // Argument der Breite
  const F = (93.272 + 483202.0175 * T) % 360;
  // Mittlere Elongation des Mondes (Sonne-Mond)
  const D = (297.850 + 445267.1112 * T) % 360;

  // Ekliptische Länge (vereinfacht — Hauptterme)
  const M_rad = M * Math.PI / 180;
  const F_rad = F * Math.PI / 180;
  const D_rad = D * Math.PI / 180;

  let lambda = L0
    + 6.289 * Math.sin(M_rad)            // Hauptgleichung (Evektion)
    - 1.274 * Math.sin(M_rad - 2 * D_rad) // Große Ungleichheit
    + 0.658 * Math.sin(2 * D_rad)        // Variation
    - 0.186 * Math.sin(M_rad) * 0;       // (vereinfacht)

  // Ekliptische Breite (vereinfacht)
  const beta = 5.128 * Math.sin(F_rad);

  // Mondphase: Elongation D → Phase-Anteil
  // phase 0 = Neumond, 0.25 = erstes Viertel, 0.5 = Vollmond, 0.75 = letztes Viertel
  const elongation = ((D % 360) + 360) % 360;
  const phase = elongation / 360;

  // Beleuchteter Anteil (Illumination): (1 - cos(elongation)) / 2
  const illumination = (1 - Math.cos(D_rad)) / 2;

  return {
    eclipticLon: ((lambda % 360) + 360) % 360,
    eclipticLat: beta,
    distance: 60.4, // Mittlere Entfernung in Erdradien (für Visualisierung konstant)
    phase,
    illumination: Math.max(0, Math.min(1, illumination)),
  };
}

/**
 * Konvertiert Mond-Position in 3D-Koordinaten relativ zur Erde (im Welt-Nullpunkt).
 * @param {Date} date
 * @param {number} radius - Skalierte Entfernung in Globe-Einheiten (z.B. 1.8)
 * @returns {{ x: number, y: number, z: number, phase: number, illumination: number }}
 */
export function getMoon3DPosition(date = new Date(), radius = 1.8) {
  const moon = getMoonPosition(date);
  const lonRad = moon.eclipticLon * Math.PI / 180;
  const latRad = moon.eclipticLat * Math.PI / 180;

  // Ekliptik-Koordinaten → 3D: x = R*cos(lat)*cos(lon), z = R*cos(lat)*sin(lon), y = R*sin(lat)
  return {
    x: radius * Math.cos(latRad) * Math.cos(lonRad),
    y: radius * Math.sin(latRad),
    z: radius * Math.cos(latRad) * Math.sin(lonRad),
    phase: moon.phase,
    illumination: moon.illumination,
  };
}

/**
 * Berechnet die Sonnen-Position (vereinfacht) für die Mondphasen-Beleuchtung.
 * @param {Date} date
 * @returns {{ x: number, y: number, z: number }} in Globe-Einheiten
 */
export function getSunDirection(date = new Date()) {
  const J = toJulian(date);
  const T = (J - 2451545.0) / 36525;
  // Mittlere Länge der Sonne
  const L0 = (280.466 + 36000.7698 * T) % 360;
  // Mittlere Anomalie der Sonne
  const M = (357.529 + 35999.050 * T) % 360;
  const M_rad = M * Math.PI / 180;
  // Ekliptische Länge der Sonne (vereinfacht)
  const lambda = (L0 + 1.915 * Math.sin(M_rad) + 0.020 * Math.sin(2 * M_rad)) * Math.PI / 180;
  // Sonne ist in der Ekliptik (Breite ≈ 0)
  const radius = 5; // Weit weg für gerichtetes Licht
  return {
    x: radius * Math.cos(lambda),
    y: 0,
    z: radius * Math.sin(lambda),
  };
}