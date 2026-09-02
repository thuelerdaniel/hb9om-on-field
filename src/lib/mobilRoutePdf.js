// PDF-Export für Mobil-Route — PURE JavaScript, keine externe Library.
// v0.9024: Raw PDF string → Blob → Download. Kein jsPDF, kein pdfkit, kein CDN.
// Seite 1: Routen-Karte + Abschnitts-Tabelle. Seite 2: Repeater-Konfiguration.

function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Escape + ASCII-Normalisierung (Umlaute → ASCII, damit xref-Offsets stimmen)
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

export function generateMobilRoutePdf(routeName, date, totalDistance, modeFilter, repeaters, waypoints) {
  const routePoints = (waypoints || []).map(wp => ({
    lat: wp.lat,
    lng: wp.lon != null ? wp.lon : wp.lng,
    name: wp.name || 'WP',
  }));

  if (routePoints.length === 0) {
    alert('Keine Route geladen. Bitte zuerst eine Route importieren.');
    return;
  }

  const MAX_DIST = 25; // km

  // Repeater normalisieren + Distanz zur Route berechnen
  const allReps = (repeaters || []).map(r => ({
    callsign: r.callsign || '-',
    frequency: r.frequency || r.tx_frequency || '-',
    mode: r.mode || r.primary_mode || 'FM',
    offset: r.offset != null ? `${r.offset}` : (r.offset_mhz != null ? `${r.offset_mhz}` : '-'),
    tone: r.tone || r.ctcss || '-',
    lat: r.lat,
    lng: r.lng,
    location: r.location || r.location_name || r.qth || r.name || '-',
    distance: r._distToRoute != null ? r._distToRoute : (r.distance != null ? r.distance : 9999),
  }));

  // Relevante Repeater (< 25km zur Route)
  const relevantReps = allReps
    .filter(rep => {
      if (rep.lat == null || rep.lng == null) return false;
      const minD = Math.min(...routePoints.map(wp =>
        haversine({ lat: wp.lat, lng: wp.lng }, { lat: rep.lat, lng: rep.lng })
      ));
      rep.distance = minD;
      return minD <= MAX_DIST;
    })
    .sort((a, b) => a.distance - b.distance);

  // PDF Parameter (A4: 595x842 pt)
  const PW = 595, PH = 842;

  // ===== Content Stream 1 (Seite 1: Karte + Tabelle) =====
  let cs1 = '';
  function t1(s, x, y, sz) {
    cs1 += 'BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  function l1(x1, y1, x2, y2, r, g, b, w) {
    cs1 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }
  function c1(cx, cy, rad, r, g, b) {
    const k = 0.5523, cy2 = PH - cy;
    cs1 += r + ' ' + g + ' ' + b + ' rg ' + cx + ' ' + (cy2 + rad) + ' m ';
    cs1 += (cx + rad * k) + ' ' + (cy2 + rad) + ' ' + (cx + rad) + ' ' + (cy2 + rad * k) + ' ' + (cx + rad) + ' ' + cy2 + ' c ';
    cs1 += (cx + rad) + ' ' + (cy2 - rad * k) + ' ' + (cx + rad * k) + ' ' + (cy2 - rad) + ' ' + cx + ' ' + (cy2 - rad) + ' c ';
    cs1 += (cx - rad * k) + ' ' + (cy2 - rad) + ' ' + (cx - rad) + ' ' + (cy2 - rad * k) + ' ' + (cx - rad) + ' ' + cy2 + ' c ';
    cs1 += (cx - rad) + ' ' + (cy2 + rad * k) + ' ' + (cx - rad * k) + ' ' + (cy2 + rad) + ' ' + cx + ' ' + (cy2 + rad) + ' c f\n';
  }

  t1('HB9OM On Field - Routenplan', 30, 30, 16);
  t1('Route: ' + (routeName || 'Unbenannt'), 30, 50, 10);
  t1('Datum: ' + (date || new Date().toLocaleDateString('de-CH')), 30, 64, 10);
  t1('Gesamtdistanz: ' + (totalDistance || '0') + ' km', 30, 78, 10);
  if (modeFilter && modeFilter.length > 0) {
    t1('Modus-Filter: ' + modeFilter.join(', '), 30, 92, 9);
  }
  t1('Version: v0.9024', 30, 106, 9);

  // Bounding Box
  const repWithCoords = relevantReps.filter(r => r.lat != null && r.lng != null);
  const allCoords = [...routePoints, ...repWithCoords];
  if (allCoords.length === 0) {
    t1('Keine Koordinaten verfuegbar.', 30, 130, 10);
  } else {
    const minLat = Math.min(...allCoords.map(c => c.lat));
    const maxLat = Math.max(...allCoords.map(c => c.lat));
    const minLng = Math.min(...allCoords.map(c => c.lng));
    const maxLng = Math.max(...allCoords.map(c => c.lng));
    const latR = Math.max(maxLat - minLat, 0.01);
    const lngR = Math.max(maxLng - minLng, 0.01);

    const mX = 30, mY = 120, mW = 535, mH = 250;
    const sc = Math.min(mW / lngR, mH / latR);
    const oX = mX + (mW - lngR * sc) / 2;
    const oY = mY + (mH - latR * sc) / 2;
    const toX = (lng) => oX + (lng - minLng) * sc;
    const toY = (lat) => oY + mH - (lat - minLat) * sc;

    // Karten-Rahmen
    l1(mX, mY, mX + mW, mY, 0.7, 0.7, 0.7, 0.5);
    l1(mX, mY + mH, mX + mW, mY + mH, 0.7, 0.7, 0.7, 0.5);
    l1(mX, mY, mX, mY + mH, 0.7, 0.7, 0.7, 0.5);
    l1(mX + mW, mY, mX + mW, mY + mH, 0.7, 0.7, 0.7, 0.5);

    // Route zeichnen
    for (let i = 0; i < routePoints.length - 1; i++) {
      l1(toX(routePoints[i].lng), toY(routePoints[i].lat),
        toX(routePoints[i + 1].lng), toY(routePoints[i + 1].lat), 0.145, 0.388, 0.922, 1.5);
    }

    // Waypoints als Kreise
    routePoints.forEach((wp, i) => {
      c1(toX(wp.lng), toY(wp.lat), 5, 0.145, 0.388, 0.922);
      t1(String(i + 1), toX(wp.lng) + 7, toY(wp.lat) + 3, 8);
    });

    // Repeater als rote Kreise
    repWithCoords.forEach(rep => {
      c1(toX(rep.lng), toY(rep.lat), 3, 0.863, 0.149, 0.149);
      t1(rep.callsign, toX(rep.lng) + 5, toY(rep.lat), 6);
    });

    // Legende
    c1(mX + 5, mY + mH + 15, 4, 0.145, 0.388, 0.922);
    t1('Waypoint', mX + 15, mY + mH + 18, 8);
    c1(mX + 95, mY + mH + 15, 3, 0.863, 0.149, 0.149);
    t1('Repeater (< 25km)', mX + 105, mY + mH + 18, 8);

    // Abschnitts-Tabelle
    let ty = mY + mH + 35;
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
        ) <= MAX_DIST;
      }).length;
      t1('A' + (i + 1), 30, ty, 8);
      t1((routePoints[i].name || 'WP' + (i + 1)).substring(0, 20), 100, ty, 8);
      t1((routePoints[i + 1].name || 'WP' + (i + 2)).substring(0, 20), 200, ty, 8);
      t1(d + ' km', 300, ty, 8);
      t1(rc + ' Stk', 380, ty, 8);
      ty += 12;
    }
  }

  // ===== Content Stream 2 (Seite 2: Repeater-Konfiguration) =====
  let cs2 = '';
  function t2(s, x, y, sz) {
    cs2 += 'BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  function l2(x1, y1, x2, y2, r, g, b, w) {
    cs2 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }

  t2('Repeater-Konfiguration (< 25km zur Route)', 30, 30, 12);
  l2(30, 36, 565, 36, 0.4, 0.4, 0.4, 0.5);

  if (relevantReps.length === 0) {
    t2('Keine Repeater innerhalb 25km der Route gefunden.', 30, 55, 10);
  } else {
    let ry = 50;
    t2('Callsign', 30, ry, 8);
    t2('Frequenz', 120, ry, 8);
    t2('Mode', 190, ry, 8);
    t2('Offset', 240, ry, 8);
    t2('Tone', 290, ry, 8);
    t2('Standort', 330, ry, 8);
    t2('Entfern.', 480, ry, 8);
    l2(30, ry + 4, 565, ry + 4, 0.7, 0.7, 0.7, 0.3);
    ry += 14;
    relevantReps.forEach(rep => {
      if (ry > 820) return;
      t2(rep.callsign, 30, ry, 7);
      t2(rep.frequency + ' MHz', 120, ry, 7);
      t2(rep.mode, 190, ry, 7);
      t2(rep.offset, 240, ry, 7);
      t2(rep.tone, 290, ry, 7);
      t2(rep.location.substring(0, 28), 330, ry, 7);
      t2(rep.distance.toFixed(1) + ' km', 480, ry, 7);
      ry += 11;
    });
  }
  t2('HB9OM On Field App - v0.9024', 30, 835, 6);

  // ===== PDF zusammenbauen =====
  let pdf = '%PDF-1.4\n';
  const o1 = pdf.length;
  pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const o2 = pdf.length;
  pdf += '2 0 obj\n<< /Type /Pages /Kids [6 0 R 7 0 R] /Count 2 >>\nendobj\n';
  const o3 = pdf.length;
  pdf += '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  const o4 = pdf.length;
  pdf += '4 0 obj\n<< /Length ' + cs1.length + ' >>\nstream\n' + cs1 + 'endstream\nendobj\n';
  const o5 = pdf.length;
  pdf += '5 0 obj\n<< /Length ' + cs2.length + ' >>\nstream\n' + cs2 + 'endstream\nendobj\n';
  const o6 = pdf.length;
  pdf += '6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 4 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n';
  const o7 = pdf.length;
  pdf += '7 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 5 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n';
  const xr = pdf.length;
  pdf += 'xref\n0 8\n';
  pdf += '0000000000 65535 f \n';
  pdf += String(o1).padStart(10, '0') + ' 00000 n \n';
  pdf += String(o2).padStart(10, '0') + ' 00000 n \n';
  pdf += String(o3).padStart(10, '0') + ' 00000 n \n';
  pdf += String(o4).padStart(10, '0') + ' 00000 n \n';
  pdf += String(o5).padStart(10, '0') + ' 00000 n \n';
  pdf += String(o6).padStart(10, '0') + ' 00000 n \n';
  pdf += String(o7).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF';

  // Blob erstellen und Download ausloesen
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