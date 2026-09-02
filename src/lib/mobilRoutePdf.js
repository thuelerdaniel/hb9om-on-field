// PDF-Export für Mobil-Route — PURE JavaScript, keine externe Library.
// v0.9025: Echte OSM-Karte im PDF (Tiles → Canvas → JPEG → PDF).
// Seite 1: Karten-Bild + Abschnitts-Tabelle. Seite 2: Repeater-Konfiguration.

function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// ASCII-Normalisierung (Umlaute → ASCII) + PDF-Escape
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

function totalLen(parts) {
  return parts.reduce((sum, p) => sum + p.length, 0);
}

function lon2tile(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
function lat2tile(lat, z) {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
}
function tile2lon(x, z) { return x / Math.pow(2, z) * 360 - 180; }
function tile2lat(y, z) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
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

  // Repeater normalisieren + Distanz zur Route berechnen
  const relevantReps = (repeaters || [])
    .map(r => {
      if (r.lat == null || r.lng == null) return null;
      const minD = Math.min(...routePoints.map(wp =>
        haversine({ lat: wp.lat, lng: wp.lng }, { lat: r.lat, lng: r.lng })
      ));
      return {
        callsign: r.callsign || '-',
        frequency: r.frequency || r.tx_frequency || '-',
        mode: r.mode || r.primary_mode || 'FM',
        offset: r.offset != null ? `${r.offset}` : (r.offset_mhz != null ? `${r.offset_mhz}` : '-'),
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

  // --- KARTEN-BILD GENERIEREN ---
  const repWithCoords = relevantReps.filter(r => r.lat != null && r.lng != null);
  const allCoords = [...routePoints, ...repWithCoords];
  const minLat = Math.min(...allCoords.map(c => c.lat));
  const maxLat = Math.max(...allCoords.map(c => c.lat));
  const minLng = Math.min(...allCoords.map(c => c.lng));
  const maxLng = Math.max(...allCoords.map(c => c.lng));
  const latRange = Math.max(maxLat - minLat, 0.001);
  const lngRange = Math.max(maxLng - minLng, 0.001);

  // Zoom-Level berechnen
  let zoom = 10;
  if (latRange < 0.05 && lngRange < 0.05) zoom = 15;
  else if (latRange < 0.1 && lngRange < 0.1) zoom = 14;
  else if (latRange < 0.2 && lngRange < 0.2) zoom = 13;
  else if (latRange < 0.5 && lngRange < 0.5) zoom = 12;
  else if (latRange < 1.0 && lngRange < 1.0) zoom = 11;
  else if (latRange < 2.0 && lngRange < 2.0) zoom = 10;
  else zoom = 9;

  const minTileX = lon2tile(minLng, zoom);
  const maxTileX = lon2tile(maxLng, zoom);
  const minTileY = lat2tile(maxLat, zoom);
  const maxTileY = lat2tile(minLat, zoom);

  const padX = 1, padY = 1;
  const tx0 = minTileX - padX;
  const tx1 = maxTileX + padX;
  const ty0 = minTileY - padY;
  const ty1 = maxTileY + padY;
  const numTilesX = tx1 - tx0 + 1;
  const numTilesY = ty1 - ty0 + 1;

  const TILE = 256;
  const canvasW = numTilesX * TILE;
  const canvasH = numTilesY * TILE;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // Tiles laden und zeichnen
  const tilePromises = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const url = 'https://tile.openstreetmap.org/' + zoom + '/' + tx + '/' + ty + '.png';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const px = (tx - tx0) * TILE;
      const py = (ty - ty0) * TILE;

      const p = new Promise((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, px, py);
          resolve();
        };
        img.onerror = () => {
          ctx.fillStyle = '#e0e0e0';
          ctx.fillRect(px, py, TILE, TILE);
          resolve();
        };
        img.src = url;
      });
      tilePromises.push(p);
    }
  }

  await Promise.all(tilePromises);

  // Koordinaten-Transformation
  const minMapLng = tile2lon(tx0, zoom);
  const maxMapLng = tile2lon(tx1 + 1, zoom);
  const minMapLat = tile2lat(ty1 + 1, zoom);
  const maxMapLat = tile2lat(ty0, zoom);
  const mapLngRange = maxMapLng - minMapLng;
  const mapLatRange = maxMapLat - minMapLat;

  function toCanvasX(lng) { return ((lng - minMapLng) / mapLngRange) * canvasW; }
  function toCanvasY(lat) { return canvasH - ((lat - minMapLat) / mapLatRange) * canvasH; }

  // Route zeichnen (blaue Linie)
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 4;
  ctx.beginPath();
  routePoints.forEach((wp, i) => {
    const x = toCanvasX(wp.lng);
    const y = toCanvasY(wp.lat);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Waypoints als nummerierte Kreise
  routePoints.forEach((wp, i) => {
    const x = toCanvasX(wp.lng);
    const y = toCanvasY(wp.lat);
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, y);
  });

  // Repeater: grün = in Reichweite, orange = fast in Reichweite
  relevantReps.forEach(rep => {
    if (!rep.lat || !rep.lng) return;
    const x = toCanvasX(rep.lng);
    const y = toCanvasY(rep.lat);
    ctx.fillStyle = rep.inRange ? '#16a34a' : '#f97316';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(rep.callsign || '?', x + 10, y);
  });

  // Legende oben rechts
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(canvasW - 200, 10, 190, 80);
  ctx.strokeStyle = '#888';
  ctx.strokeRect(canvasW - 200, 10, 190, 80);
  ctx.fillStyle = '#2563eb';
  ctx.beginPath(); ctx.arc(canvasW - 185, 30, 6, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = 'black'; ctx.font = '12px Arial'; ctx.textAlign = 'left';
  ctx.fillText('Waypoint', canvasW - 170, 30);
  ctx.fillStyle = '#16a34a';
  ctx.beginPath(); ctx.arc(canvasW - 185, 50, 6, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = 'black';
  ctx.fillText('Relais < 20km', canvasW - 170, 50);
  ctx.fillStyle = '#f97316';
  ctx.beginPath(); ctx.arc(canvasW - 185, 70, 6, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = 'black';
  ctx.fillText('Relais 20-35km', canvasW - 170, 70);

  // Canvas als JPEG
  let jpegBytes = null;
  let jpegLen = 0;
  try {
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const jpegBase64 = jpegDataUrl.split(',')[1];
    jpegBytes = atob(jpegBase64);
    jpegLen = jpegBytes.length;
  } catch (err) {
    console.error('Canvas toDataURL failed:', err);
    alert('Karte konnte nicht generiert werden (CORS). PDF wird ohne Karte erstellt.');
  }

  // --- PDF BAUEN ---
  const PW = 595, PH = 842;

  // TextEncoder (mit Fallback)
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

  // Bild-Dimensionen für PDF (Seite 1, oberer Bereich)
  const maxImgH = 400;
  let imgW = PW - 60;
  let imgH = Math.round(imgW * (canvasH / canvasW));
  if (imgH > maxImgH) {
    imgH = maxImgH;
    imgW = Math.round(imgH * (canvasW / canvasH));
  }
  const imgX = 30, imgY = 80;

  let cs1 = '';
  function t1(s, x, y, sz) {
    cs1 += 'BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  function l1(x1, y1, x2, y2, r, g, b, w) {
    cs1 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }

  t1('HB9OM On Field - Routenplan', 30, 30, 16);
  t1('Route: ' + (routeName || 'Unbenannt'), 30, 50, 10);
  t1('Datum: ' + (date || new Date().toLocaleDateString('de-CH')), 30, 64, 10);
  t1('Version: v0.9025', 30, 78, 9);

  // Bild-Referenz im Content Stream (nur wenn JPEG verfügbar)
  if (jpegBytes) {
    cs1 += 'q\n';
    cs1 += imgW + ' 0 0 ' + imgH + ' ' + imgX + ' ' + (PH - imgY - imgH) + ' cm\n';
    cs1 += '/Im1 Do\n';
    cs1 += 'Q\n';
  } else {
    t1('Karte nicht verfuegbar', 30, 100, 10);
  }

  // Abschnitts-Tabelle
  let ty = jpegBytes ? (imgY + imgH + 15) : 120;
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
    t1(rc + ' Stk', 380, ty, 8);
    ty += 12;
  }

  // Seite 2: Repeater-Liste
  let cs2 = '';
  function t2(s, x, y, sz) {
    cs2 += 'BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  function l2(x1, y1, x2, y2, r, g, b, w) {
    cs2 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }

  t2('Repeater-Konfiguration', 30, 30, 12);
  t2('Gruen = in Reichweite (< 20km)  |  Orange = fast in Reichweite (20-35km)', 30, 46, 8);
  l2(30, 52, 565, 52, 0.4, 0.4, 0.4, 0.5);

  if (relevantReps.length === 0) {
    t2('Keine Repeater innerhalb 35km der Route gefunden.', 30, 70, 10);
  } else {
    let ry = 64;
    t2('Callsign', 30, ry, 8);
    t2('Frequenz', 120, ry, 8);
    t2('Mode', 190, ry, 8);
    t2('Offset', 240, ry, 8);
    t2('Tone', 290, ry, 8);
    t2('Standort', 330, ry, 8);
    t2('Status', 440, ry, 8);
    t2('Entfern.', 500, ry, 8);
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
      t2(rep.inRange ? 'Reichweite' : 'Fast', 440, ry, 7);
      t2(rep.distance.toFixed(1) + ' km', 500, ry, 7);
      ry += 11;
    });
  }

  t2('HB9OM On Field App - v0.9025', 30, 835, 6);

  // PDF als Uint8Array bauen
  const cs1Bytes = str(cs1);
  const cs2Bytes = str(cs2);
  const imgBytes = jpegBytes ? bin(jpegBytes) : null;

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

  let off6, off7, off8;
  if (imgBytes) {
    // Obj 6: Image XObject (JPEG)
    off6 = totalLen(parts);
    parts.push(str('6 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + canvasW + ' /Height ' + canvasH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegLen + ' >>\nstream\n'));
    parts.push(imgBytes);
    parts.push(str('\nendstream\nendobj\n'));

    // Obj 7: Page 1 (mit Bild)
    off7 = totalLen(parts);
    parts.push(str('7 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 4 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 6 0 R >> >> >>\nendobj\n'));
  } else {
    // Kein Bild — Platzhalter-Objekt
    off6 = totalLen(parts);
    parts.push(str('6 0 obj\n<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n'));
    parts.push(bin('AAA'));
    parts.push(str('\nendstream\nendobj\n'));

    off7 = totalLen(parts);
    parts.push(str('7 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 4 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 6 0 R >> >> >>\nendobj\n'));
  }

  // Obj 8: Page 2
  off8 = totalLen(parts);
  parts.push(str('8 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 5 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n'));

  // xref
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

  // Alle Parts zusammenfügen
  const totalSize = totalLen(parts);
  const pdfBytes = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of parts) {
    pdfBytes.set(part, offset);
    offset += part.length;
  }

  // Blob und Download
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