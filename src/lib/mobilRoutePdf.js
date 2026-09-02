// PDF-Export für Mobil-Route — PURE JavaScript, keine externe Library.
// v0.9026: Vektor-PDF mit farbigen Abschnitten + Offset-Rundung. Keine OSM-Tiles.

function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function esc(s) {
  return String(s || '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e')
    .replace(/á/g, 'a').replace(/à/g, 'a').replace(/â/g, 'a')
    .replace(/í/g, 'i').replace(/ì/g, 'i').replace(/î/g, 'i')
    .replace(/ó/g, 'o').replace(/ò/g, 'o').replace(/ô/g, 'o')
    .replace(/ú/g, 'u').replace(/ù/g, 'u').replace(/û/g, 'u')
    .replace(/ñ/g, 'n').replace(/ç/g, 'c')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Rundet auf 3 Nachkommastellen (fixt Floating-Point Bugs wie -0.5999999 → -0.6)
function round3(v) {
  if (v == null) return null;
  return Math.round(Number(v) * 1000) / 1000;
}

// Farben für Abschnitte (RGB 0-1)
const SEGMENT_COLORS = [
  [0.863, 0.149, 0.149], // rot
  [0.086, 0.639, 0.290], // grün
  [0.145, 0.388, 0.922], // blau
  [0.918, 0.349, 0.047], // orange
  [0.576, 0.200, 0.918], // lila
  [0.031, 0.565, 0.698], // türkis
];

export async function generateMobilRoutePdf(routeName, date, totalDistance, modeFilter, repeaters, waypoints) {
  const routePoints = (waypoints || []).map(wp => ({
    lat: wp.lat,
    lng: wp.lon != null ? wp.lon : wp.lng,
    name: wp.name || 'WP',
  }));

  if (routePoints.length === 0) {
    alert('Keine Route geladen. Bitte zuerst eine Route importieren.');
    return;
  }

  const RELEVANT_DIST = 35;
  const IN_RANGE_DIST = 20;

  // Repeater normalisieren + Distanz zur Route + Offset/Frequenz runden
  const relevantReps = (repeaters || [])
    .map(r => {
      if (r.lat == null || r.lng == null) return null;
      const minD = Math.min(...routePoints.map(wp =>
        haversine({ lat: wp.lat, lng: wp.lng }, { lat: r.lat, lng: r.lng })
      ));
      return {
        callsign: r.callsign || '-',
        frequency: round3(r.frequency != null ? r.frequency : r.tx_frequency),
        offset: round3(r.offset != null ? r.offset : r.offset_mhz),
        tone: r.tone || r.ctcss || '-',
        lat: r.lat,
        lng: r.lng,
        location: r.location || r.location_name || r.qth || r.name || '-',
        distance: minD,
        inRange: minD <= IN_RANGE_DIST,
      };
    })
    .filter(rep => rep !== null && rep.distance <= RELEVANT_DIST)
    .sort((a, b) => a.distance - b.distance);

  // --- VEKTOR-KARTE ---
  const PW = 595, PH = 842;
  const MAP_X = 30, MAP_Y = 80, MAP_W = 535, MAP_H = 400;

  const repWithCoords = relevantReps.filter(r => r.lat != null && r.lng != null);
  const allCoords = [...routePoints, ...repWithCoords];

  const minLat = Math.min(...allCoords.map(c => c.lat));
  const maxLat = Math.max(...allCoords.map(c => c.lat));
  const minLng = Math.min(...allCoords.map(c => c.lng));
  const maxLng = Math.max(...allCoords.map(c => c.lng));
  const latRange = Math.max(maxLat - minLat, 0.001);
  const lngRange = Math.max(maxLng - minLng, 0.001);
  const padLat = latRange * 0.1;
  const padLng = lngRange * 0.1;
  const minLatP = minLat - padLat;
  const maxLatP = maxLat + padLat;
  const minLngP = minLng - padLng;
  const maxLngP = maxLng + padLng;

  function toPdfX(lng) { return MAP_X + ((lng - minLngP) / (maxLngP - minLngP)) * MAP_W; }
  function toPdfY(lat) { return PH - MAP_Y - ((maxLatP - lat) / (maxLatP - minLatP)) * MAP_H; }

  // Content stream Seite 1
  let cs1 = '';

  // Text-Funktion (top-down Koordinaten, immer schwarz)
  function t1(s, x, y, sz) {
    cs1 += '0 0 0 rg BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  // Linie (top-down Koordinaten)
  function l1(x1, y1, x2, y2, r, g, b, w) {
    cs1 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }

  // Titel
  t1('HB9OM On Field - Routenplan', 30, 30, 16);
  t1('Route: ' + (routeName || 'Unbenannt'), 30, 50, 10);
  t1('Datum: ' + (date || new Date().toLocaleDateString('de-CH')), 30, 64, 10);
  t1('Version: v0.9026', 30, 78, 9);

  // Karten-Rahmen
  cs1 += '0.7 0.7 0.7 RG 0.5 w ' + MAP_X + ' ' + (PH - MAP_Y - MAP_H) + ' ' + MAP_W + ' ' + MAP_H + ' re S\n';

  // === FARBIGE ROUTEN-ABSCHNITTE ===
  for (let i = 0; i < routePoints.length - 1; i++) {
    const [r, g, b] = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
    const x1 = toPdfX(routePoints[i].lng);
    const y1 = toPdfY(routePoints[i].lat);
    const x2 = toPdfX(routePoints[i + 1].lng);
    const y2 = toPdfY(routePoints[i + 1].lat);
    cs1 += r + ' ' + g + ' ' + b + ' RG 2.5 w ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' m ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' l S\n';

    // Abschnitt-Label in der Mitte (farbiges Quadrat + weisse Nummer)
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    cs1 += r + ' ' + g + ' ' + b + ' rg ' + (mx - 9).toFixed(1) + ' ' + (my - 9).toFixed(1) + ' 18 18 re f\n';
    cs1 += '1 1 1 rg BT /F1 8 Tf ' + (mx - 3).toFixed(1) + ' ' + (my - 3).toFixed(1) + ' Td (A' + (i + 1) + ') Tj ET\n';
  }

  // === WAYPOINTS (weisse Quadrate mit Nummer) ===
  routePoints.forEach((wp, i) => {
    const x = toPdfX(wp.lng);
    const y = toPdfY(wp.lat);
    cs1 += '1 1 1 rg ' + (x - 5).toFixed(1) + ' ' + (y - 5).toFixed(1) + ' 10 10 re f\n';
    cs1 += '0 0 0 RG 0.5 w ' + (x - 5).toFixed(1) + ' ' + (y - 5).toFixed(1) + ' 10 10 re S\n';
    cs1 += '0 0 0 rg BT /F1 7 Tf ' + (x - 2).toFixed(1) + ' ' + (y - 3).toFixed(1) + ' Td (' + (i + 1) + ') Tj ET\n';
  });

  // === RELAIS (grün/orange Quadrate) ===
  relevantReps.forEach(rep => {
    if (!rep.lat || !rep.lng) return;
    const x = toPdfX(rep.lng);
    const y = toPdfY(rep.lat);
    const [r, g, b] = rep.inRange ? [0.086, 0.639, 0.290] : [0.976, 0.451, 0.094];
    cs1 += r + ' ' + g + ' ' + b + ' rg ' + (x - 3).toFixed(1) + ' ' + (y - 3).toFixed(1) + ' 6 6 re f\n';
  });

  // === LEGENDE ===
  let legY = MAP_Y + MAP_H + 10;
  // Grün
  cs1 += '0.086 0.639 0.290 rg 30 ' + (PH - legY - 3).toFixed(1) + ' 6 6 re f\n';
  t1('Relais < 20km', 42, legY, 8);
  // Orange
  cs1 += '0.976 0.451 0.094 rg 140 ' + (PH - legY - 3).toFixed(1) + ' 6 6 re f\n';
  t1('Relais 20-35km', 152, legY, 8);
  // Farbige Segmente
  t1('Abschnitte in verschiedenen Farben', 250, legY, 8);

  // === ABSCHNITTS-TABELLE ===
  let ty = legY + 20;
  t1('Abschn.', 30, ty, 9);
  t1('Von', 100, ty, 9);
  t1('Nach', 200, ty, 9);
  t1('Distanz', 300, ty, 9);
  t1('Relais', 380, ty, 9);
  l1(30, ty + 4, 565, ty + 4, 0.7, 0.7, 0.7, 0.5);
  ty += 14;

  for (let i = 0; i < routePoints.length - 1; i++) {
    if (ty > 800) break;
    const d = haversine(routePoints[i], routePoints[i + 1]).toFixed(1);
    const rc = relevantReps.filter(r => {
      if (r.lat == null) return false;
      return Math.min(
        haversine(routePoints[i], { lat: r.lat, lng: r.lng }),
        haversine(routePoints[i + 1], { lat: r.lat, lng: r.lng })
      ) <= RELEVANT_DIST;
    }).length;
    t1('A' + (i + 1), 30, ty, 8);
    t1((routePoints[i].name || 'WP' + (i + 1)).substring(0, 20), 100, ty, 8);
    t1((routePoints[i + 1].name || 'WP' + (i + 2)).substring(0, 20), 200, ty, 8);
    t1(d + ' km', 300, ty, 8);
    t1(rc + ' Relais', 380, ty, 8);
    ty += 12;
  }

  // === SEITE 2: REPEATER-LISTE ===
  let cs2 = '';
  function t2(s, x, y, sz) {
    cs2 += '0 0 0 rg BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  function l2(x1, y1, x2, y2, r, g, b, w) {
    cs2 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }

  t2('Repeater-Konfiguration', 30, 30, 12);
  t2('Gruen = in Reichweite (< 20km)  |  Orange = fast (20-35km)', 30, 46, 8);
  l2(30, 52, 565, 52, 0.4, 0.4, 0.4, 0.5);

  if (relevantReps.length === 0) {
    t2('Keine Repeater innerhalb 35km der Route gefunden.', 30, 70, 10);
  } else {
    let ry = 64;
    t2('Callsign', 30, ry, 8);
    t2('Frequenz', 120, ry, 8);
    t2('Offset', 190, ry, 8);
    t2('Tone', 240, ry, 8);
    t2('Standort', 290, ry, 8);
    t2('Status', 390, ry, 8);
    t2('Abschn.', 440, ry, 8);
    t2('Entfern.', 500, ry, 8);
    l2(30, ry + 4, 565, ry + 4, 0.7, 0.7, 0.7, 0.3);
    ry += 14;

    relevantReps.forEach(rep => {
      if (ry > 820) return;

      // Nächsten Abschnitt finden
      let nearestSeg = 0;
      let minDist = Infinity;
      for (let i = 0; i < routePoints.length - 1; i++) {
        const midLat = (routePoints[i].lat + routePoints[i + 1].lat) / 2;
        const midLng = (routePoints[i].lng + routePoints[i + 1].lng) / 2;
        const d = haversine({ lat: midLat, lng: midLng }, { lat: rep.lat, lng: rep.lng });
        if (d < minDist) { minDist = d; nearestSeg = i; }
      }

      t2(rep.callsign, 30, ry, 7);
      t2(rep.frequency != null ? rep.frequency + ' MHz' : '-', 120, ry, 7);
      t2(rep.offset != null ? String(rep.offset) : '-', 190, ry, 7);
      t2(rep.tone, 240, ry, 7);
      t2(rep.location.substring(0, 28), 290, ry, 7);
      t2(rep.inRange ? 'Reichweite' : 'Fast', 390, ry, 7);
      t2('A' + (nearestSeg + 1), 440, ry, 7);
      t2(rep.distance.toFixed(1) + ' km', 500, ry, 7);
      ry += 11;
    });
  }

  t2('HB9OM On Field App - v0.9026', 30, 835, 6);

  // --- PDF ALS STRING BAUEN ---
  let pdf = '%PDF-1.4\n';
  const offsets = [];

  offsets[0] = pdf.length;
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

  offsets[1] = pdf.length;
  pdf += '2 0 obj\n<< /Type /Pages /Kids [6 0 R 7 0 R] /Count 2 >>\nendobj\n';

  offsets[2] = pdf.length;
  pdf += '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  offsets[3] = pdf.length;
  pdf += '4 0 obj\n<< /Length ' + cs1.length + ' >>\nstream\n' + cs1 + '\nendstream\nendobj\n';

  offsets[4] = pdf.length;
  pdf += '5 0 obj\n<< /Length ' + cs2.length + ' >>\nstream\n' + cs2 + '\nendstream\nendobj\n';

  offsets[5] = pdf.length;
  pdf += '6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 4 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n';

  offsets[6] = pdf.length;
  pdf += '7 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 5 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n';

  const xrefPos = pdf.length;
  pdf += 'xref\n0 8\n';
  pdf += '0000000000 65535 f \n';
  for (let i = 0; i < 7; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF';

  // Download
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Route_' + (routeName || 'Unbenannt').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + (date || '') + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}