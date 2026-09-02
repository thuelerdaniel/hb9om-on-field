// PDF-Export für Mobil-Route — PURE JavaScript, keine externe Library.
// v0.9027: OSM Static Map API (echte Landeskarte) + max 8 Repeater + Offset-Rundung.

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

function totalLen(parts) {
  return parts.reduce((sum, p) => sum + p.length, 0);
}

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
  const MAX_REPS = 8;

  // Repeater normalisieren + Distanz + Offset runden + MAX 8
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
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_REPS);

  // --- OSM STATIC MAP BILD LADEN ---
  const repWithCoords = relevantReps.filter(r => r.lat != null && r.lng != null);
  const allCoords = [...routePoints, ...repWithCoords];
  const minLat = Math.min(...allCoords.map(c => c.lat));
  const maxLat = Math.max(...allCoords.map(c => c.lat));
  const minLng = Math.min(...allCoords.map(c => c.lng));
  const maxLng = Math.max(...allCoords.map(c => c.lng));
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const range = Math.max(maxLat - minLat, maxLng - minLng);
  let zoom = 10;
  if (range < 0.05) zoom = 15;
  else if (range < 0.1) zoom = 14;
  else if (range < 0.2) zoom = 13;
  else if (range < 0.5) zoom = 12;
  else if (range < 1.0) zoom = 11;
  else if (range < 2.0) zoom = 10;
  else zoom = 9;

  // Static Map URL mit Markern
  let markersParam = routePoints.map(wp =>
    wp.lat + ',' + wp.lng + ',blue-pushpin'
  ).join('|');
  if (repWithCoords.length > 0) {
    markersParam += '|' + repWithCoords.map(rep =>
      rep.lat + ',' + rep.lng + ',red-pushpin'
    ).join('|');
  }

  const staticMapUrl = 'https://staticmap.openstreetmap.de/staticmap.php?center=' +
    centerLat + ',' + centerLng +
    '&zoom=' + zoom +
    '&size=800x500&maptype=mapnik&markers=' + markersParam;

  // Bild laden
  const mapImg = new Image();
  mapImg.crossOrigin = 'anonymous';

  const mapLoaded = new Promise((resolve, reject) => {
    mapImg.onload = () => resolve();
    mapImg.onerror = () => reject(new Error('Kartenbild konnte nicht geladen werden'));
    mapImg.src = staticMapUrl;
    setTimeout(() => reject(new Error('Timeout')), 10000);
  });

  let hasMapImage = false;
  try {
    await mapLoaded;
  } catch (err) {
    console.error('Static map error:', err.message);
  }

  // Bild auf Canvas zeichnen → JPEG
  let mapImageBase64 = null;
  try {
    if (mapImg.complete && mapImg.naturalWidth > 0) {
      const mapCanvas = document.createElement('canvas');
      mapCanvas.width = 800;
      mapCanvas.height = 500;
      const mapCtx = mapCanvas.getContext('2d');
      mapCtx.drawImage(mapImg, 0, 0, 800, 500);
      const dataUrl = mapCanvas.toDataURL('image/jpeg', 0.85);
      mapImageBase64 = dataUrl.split(',')[1];
      hasMapImage = true;
    }
  } catch (err) {
    console.error('Canvas/toDataURL error:', err);
    hasMapImage = false;
  }

  // --- PDF BAUEN ---
  const PW = 595, PH = 842;

  let enc;
  if (typeof TextEncoder !== 'undefined') {
    enc = new TextEncoder();
  } else {
    enc = { encode: function(s) {
      const arr = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
      return arr;
    }};
  }
  function str(s) { return enc.encode(s); }
  function bin(s) {
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
    return arr;
  }

  // Content Stream Seite 1
  let cs1 = '';
  function t1(s, x, y, sz) {
    cs1 += '0 0 0 rg BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  function l1(x1, y1, x2, y2, r, g, b, w) {
    cs1 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }

  t1('HB9OM On Field - Routenplan', 30, 30, 16);
  t1('Route: ' + (routeName || 'Unbenannt'), 30, 50, 10);
  t1('Datum: ' + (date || new Date().toLocaleDateString('de-CH')), 30, 64, 10);
  t1('Version: v0.9027', 30, 78, 9);

  const imgW = 535;
  const imgH = Math.round(imgW * (500 / 800));
  const imgX = 30, imgY = 90;

  if (hasMapImage && mapImageBase64) {
    cs1 += 'q\n';
    cs1 += imgW + ' 0 0 ' + imgH + ' ' + imgX + ' ' + (PH - imgY - imgH) + ' cm\n';
    cs1 += '/Im1 Do\n';
    cs1 += 'Q\n';
  } else {
    t1('(Kartenbild nicht verfuegbar)', 200, 300, 12);
  }

  // Abschnitts-Tabelle
  let ty = imgY + imgH + 15;
  t1('Uebersicht', 30, ty, 10);
  ty += 16;

  t1('Abschn.', 30, ty, 8);
  t1('Strecke', 100, ty, 8);
  t1('Distanz', 250, ty, 8);
  t1('Relais (in/nah)', 350, ty, 8);
  l1(30, ty + 3, 565, ty + 3, 0.7, 0.7, 0.7, 0.3);
  ty += 12;

  for (let i = 0; i < routePoints.length - 1; i++) {
    if (ty > 790) break;
    const d = haversine(routePoints[i], routePoints[i + 1]).toFixed(1);
    const inRange = relevantReps.filter(r => {
      if (r.lat == null) return false;
      return Math.min(
        haversine(routePoints[i], { lat: r.lat, lng: r.lng }),
        haversine(routePoints[i + 1], { lat: r.lat, lng: r.lng })
      ) <= IN_RANGE_DIST;
    }).length;
    const near = relevantReps.filter(r => {
      if (r.lat == null) return false;
      return Math.min(
        haversine(routePoints[i], { lat: r.lat, lng: r.lng }),
        haversine(routePoints[i + 1], { lat: r.lat, lng: r.lng })
      ) <= RELEVANT_DIST;
    }).length;
    t1('A' + (i + 1), 30, ty, 8);
    t1((routePoints[i].name || 'WP' + (i + 1)) + ' -> ' + (routePoints[i + 1].name || 'WP' + (i + 2)), 100, ty, 8);
    t1(d + ' km', 250, ty, 8);
    t1(inRange + ' / ' + near, 350, ty, 8);
    ty += 11;
  }

  // Content Stream Seite 2: Repeater-Liste
  let cs2 = '';
  function t2(s, x, y, sz) {
    cs2 += '0 0 0 rg BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  function l2(x1, y1, x2, y2, r, g, b, w) {
    cs2 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }

  t2('Repeater-Konfiguration (max. ' + MAX_REPS + ' relevant)', 30, 30, 12);
  t2('Blau = Waypoint  |  Rot = Relais', 30, 46, 8);
  l2(30, 52, 565, 52, 0.4, 0.4, 0.4, 0.5);

  if (relevantReps.length === 0) {
    t2('Keine Repeater innerhalb 35km der Route gefunden.', 30, 70, 10);
  } else {
    let ry = 64;
    t2('Callsign', 30, ry, 8);
    t2('Freq', 120, ry, 8);
    t2('Offset', 165, ry, 8);
    t2('Tone', 215, ry, 8);
    t2('Standort', 260, ry, 8);
    t2('Status', 420, ry, 8);
    t2('Distanz', 500, ry, 8);
    l2(30, ry + 4, 565, ry + 4, 0.7, 0.7, 0.7, 0.3);
    ry += 14;

    relevantReps.forEach(rep => {
      if (ry > 820) return;
      t2(rep.callsign, 30, ry, 7);
      t2(rep.frequency != null ? rep.frequency + ' MHz' : '-', 120, ry, 7);
      t2(rep.offset != null ? String(rep.offset) : '-', 165, ry, 7);
      t2(rep.tone, 215, ry, 7);
      const loc = rep.location || '-';
      t2(loc.length > 25 ? loc.substring(0, 25) : loc, 260, ry, 7);
      t2(rep.inRange ? 'Reichweite' : 'Nah', 420, ry, 7);
      t2(rep.distance.toFixed(1) + ' km', 500, ry, 7);
      ry += 11;
    });
  }

  t2('HB9OM On Field App - v0.9027', 30, 835, 6);

  // --- PDF ALS Uint8Array BAUEN ---
  const cs1Bytes = str(cs1);
  const cs2Bytes = str(cs2);

  let parts = [];
  parts.push(str('%PDF-1.4\n'));

  const off1 = totalLen(parts);
  parts.push(str('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));

  const off2 = totalLen(parts);
  parts.push(str('2 0 obj\n<< /Type /Pages /Kids [7 0 R 8 0 R] /Count 2 >>\nendobj\n'));

  const off3 = totalLen(parts);
  parts.push(str('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'));

  const off4 = totalLen(parts);
  parts.push(str('4 0 obj\n<< /Length ' + cs1Bytes.length + ' >>\nstream\n'));
  parts.push(cs1Bytes);
  parts.push(str('\nendstream\nendobj\n'));

  const off5 = totalLen(parts);
  parts.push(str('5 0 obj\n<< /Length ' + cs2Bytes.length + ' >>\nstream\n'));
  parts.push(cs2Bytes);
  parts.push(str('\nendstream\nendobj\n'));

  // Obj 6: Image XObject (JPEG oder 1x1 weisser Pixel als Fallback)
  const off6 = totalLen(parts);
  if (hasMapImage && mapImageBase64) {
    const imgBin = bin(atob(mapImageBase64));
    parts.push(str('6 0 obj\n<< /Type /XObject /Subtype /Image /Width 800 /Height 500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + imgBin.length + ' >>\nstream\n'));
    parts.push(imgBin);
    parts.push(str('\nendstream\nendobj\n'));
  } else {
    parts.push(str('6 0 obj\n<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n'));
    parts.push(bin('AAA'));
    parts.push(str('\nendstream\nendobj\n'));
  }

  // Obj 7: Page 1 (mit Bild)
  const off7 = totalLen(parts);
  parts.push(str('7 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 4 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 6 0 R >> >> >>\nendobj\n'));

  // Obj 8: Page 2
  const off8 = totalLen(parts);
  parts.push(str('8 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 5 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n'));

  // xref — immer 9 Eintraege (0-8), gleiche Struktur mit/ohne Bild
  const xrefPos = totalLen(parts);
  let xref = 'xref\n0 9\n';
  xref += '0000000000 65535 f \n';
  xref += String(off1).padStart(10, '0') + ' 00000 n \n';
  xref += String(off2).padStart(10, '0') + ' 00000 n \n';
  xref += String(off3).padStart(10, '0') + ' 00000 n \n';
  xref += String(off4).padStart(10, '0') + ' 00000 n \n';
  xref += String(off5).padStart(10, '0') + ' 00000 n \n';
  xref += String(off6).padStart(10, '0') + ' 00000 n \n';
  xref += String(off7).padStart(10, '0') + ' 00000 n \n';
  xref += String(off8).padStart(10, '0') + ' 00000 n \n';
  parts.push(str(xref));

  parts.push(str('trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF'));

  // Zusammenfügen
  const totalSize = totalLen(parts);
  const pdfBytes = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    pdfBytes.set(part, offset);
    offset += part.length;
  }

  // Download
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Route_' + (routeName || 'Unbenannt').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + (date || '') + '.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}