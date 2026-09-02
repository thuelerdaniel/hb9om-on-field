// PDF-Export für Mobil-Route — PURE JavaScript, keine externe Library.
// v0.9028: OSM-Tiles direkt geladen (tile.openstreetmap.org, CORS-faehig) +
//          Relais-Nummerierung (R1, R2...) + Abschnitts-Empfehlungen + farbige Route.

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

function round3(v) {
  if (v == null) return null;
  return Math.round(Number(v) * 1000) / 1000;
}

// OSM Tile-Koordinaten
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

  // Repeater: Distanz + Offset runden + MAX 8 + NUMMERIERT als R1, R2...
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
        num: 0,
      };
    })
    .filter(rep => rep !== null && rep.distance <= RELEVANT_DIST)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_REPS)
    .map((rep, i) => ({ ...rep, num: i + 1 }));

  // --- OSM TILES LADEN ---
  const repWithCoords = relevantReps.filter(r => r.lat != null && r.lng != null);
  const allCoords = [...routePoints, ...repWithCoords];
  const minLat = Math.min(...allCoords.map(c => c.lat));
  const maxLat = Math.max(...allCoords.map(c => c.lat));
  const minLng = Math.min(...allCoords.map(c => c.lng));
  const maxLng = Math.max(...allCoords.map(c => c.lng));

  const range = Math.max(maxLat - minLat, maxLng - minLng);
  let zoom = 10;
  if (range < 0.05) zoom = 15;
  else if (range < 0.1) zoom = 14;
  else if (range < 0.2) zoom = 13;
  else if (range < 0.5) zoom = 12;
  else if (range < 1.0) zoom = 11;
  else if (range < 2.0) zoom = 10;
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

  // Tiles laden (tile.openstreetmap.org unterstuetzt CORS)
  const tilePromises = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const url = 'https://tile.openstreetmap.org/' + zoom + '/' + tx + '/' + ty + '.png';
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const px = (tx - tx0) * TILE;
      const py = (ty - ty0) * TILE;
      const p = new Promise((resolve) => {
        img.onload = () => { ctx.drawImage(img, px, py); resolve(); };
        img.onerror = () => {
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(px, py, TILE, TILE);
          resolve();
        };
        img.src = url;
      });
      tilePromises.push(p);
    }
  }
  await Promise.all(tilePromises);

  // Transformationsfunktion
  const minMapLng = tile2lon(tx0, zoom);
  const maxMapLng = tile2lon(tx1 + 1, zoom);
  const minMapLat = tile2lat(ty1 + 1, zoom);
  const maxMapLat = tile2lat(ty0, zoom);
  const mapLngRange = maxMapLng - minMapLng;
  const mapLatRange = maxMapLat - minMapLat;

  function toX(lng) { return ((lng - minMapLng) / mapLngRange) * canvasW; }
  function toY(lat) { return canvasH - ((lat - minMapLat) / mapLatRange) * canvasH; }

  // Abschnitts-Farben
  const segColors = ['#dc2626', '#16a34a', '#2563eb', '#ea580c', '#9333ea', '#0891b2'];

  // ROUTE FARBIG ZEICHNEN
  for (let i = 0; i < routePoints.length - 1; i++) {
    const color = segColors[i % segColors.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(toX(routePoints[i].lng), toY(routePoints[i].lat));
    ctx.lineTo(toX(routePoints[i + 1].lng), toY(routePoints[i + 1].lat));
    ctx.stroke();

    // Abschnitt-Label A1, A2...
    const mx = (toX(routePoints[i].lng) + toX(routePoints[i + 1].lng)) / 2;
    const my = (toY(routePoints[i].lat) + toY(routePoints[i + 1].lat)) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A' + (i + 1), mx, my);
  }

  // WAYPOINTS
  routePoints.forEach((wp, i) => {
    const x = toX(wp.lng);
    const y = toY(wp.lat);
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, y);
  });

  // RELAIS — NUMMERIERT R1, R2...
  relevantReps.forEach(rep => {
    const x = toX(rep.lng);
    const y = toY(rep.lat);

    // Gruen = in Reichweite, Rot = nah
    ctx.fillStyle = rep.inRange ? '#16a34a' : '#dc2626';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // R-Nummer weiss im Kreis
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R' + rep.num, x, y);

    // Callsign Label daneben
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const text = rep.callsign || '?';
    ctx.font = '9px Arial';
    const tw = ctx.measureText(text).width;
    ctx.fillRect(x + 12, y - 6, tw + 4, 12);
    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 14, y);
  });

  // LEGENDE
  const legX = canvasW - 200, legY = 10, legW = 190, legH = 100;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(legX, legY, legW, legH);
  ctx.strokeStyle = '#888';
  ctx.strokeRect(legX, legY, legW, legH);
  ctx.fillStyle = 'black';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Legende', legX + 8, legY + 14);

  ctx.fillStyle = 'white';
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(legX + 15, legY + 32, 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'black'; ctx.font = '9px Arial';
  ctx.fillText('Waypoint (1, 2...)', legX + 28, legY + 32);

  ctx.fillStyle = '#16a34a';
  ctx.strokeStyle = 'white';
  ctx.beginPath(); ctx.arc(legX + 15, legY + 50, 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'black';
  ctx.fillText('R = Reichweite (<20km)', legX + 28, legY + 50);

  ctx.fillStyle = '#dc2626';
  ctx.strokeStyle = 'white';
  ctx.beginPath(); ctx.arc(legX + 15, legY + 68, 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'black';
  ctx.fillText('R = Nah (20-35km)', legX + 28, legY + 68);

  // Canvas als JPEG
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const jpegBase64 = jpegDataUrl.split(',')[1];
  const jpegBytes = atob(jpegBase64);
  const jpegLen = jpegBytes.length;

  // --- PDF BAUEN ---
  const PW = 595, PH = 842;

  let enc;
  if (typeof TextEncoder !== 'undefined') {
    enc = new TextEncoder();
  } else {
    enc = {
      encode: function (s) {
        const arr = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
        return arr;
      }
    };
  }
  function str(s) { return enc.encode(s); }
  function bin(s) {
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
    return arr;
  }

  const imgW = 535;
  const imgH = Math.round(imgW * (canvasH / canvasW));
  const imgX = 30, imgY = 90;

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
  t1('Version: v0.9028', 30, 78, 9);

  cs1 += 'q\n';
  cs1 += imgW + ' 0 0 ' + imgH + ' ' + imgX + ' ' + (PH - imgY - imgH) + ' cm\n';
  cs1 += '/Im1 Do\n';
  cs1 += 'Q\n';

  // ABSCHNITTS-TABELLE MIT EMPFOHLENEN RELAIS
  let ty = imgY + imgH + 15;
  t1('Abschnitt', 30, ty, 9);
  t1('Strecke', 80, ty, 9);
  t1('Distanz', 230, ty, 9);
  t1('Empfohlene Relais', 300, ty, 9);
  l1(30, ty + 3, 565, ty + 3, 0.7, 0.7, 0.7, 0.3);
  ty += 13;

  for (let i = 0; i < routePoints.length - 1; i++) {
    if (ty > 800) break;
    const d = haversine(routePoints[i], routePoints[i + 1]).toFixed(1);

    // Empfohlene Relais fuer diesen Abschnitt: in Reichweite zum Abschnitt
    const segReps = relevantReps.filter(r => {
      if (r.lat == null) return false;
      const minD = Math.min(
        haversine(routePoints[i], { lat: r.lat, lng: r.lng }),
        haversine(routePoints[i + 1], { lat: r.lat, lng: r.lng })
      );
      return minD <= IN_RANGE_DIST;
    });
    let repStr;
    if (segReps.length > 0) {
      repStr = segReps.map(r => 'R' + r.num).join(', ');
    } else {
      const nearReps = relevantReps.filter(r => {
        if (r.lat == null) return false;
        const minD = Math.min(
          haversine(routePoints[i], { lat: r.lat, lng: r.lng }),
          haversine(routePoints[i + 1], { lat: r.lat, lng: r.lng })
        );
        return minD <= RELEVANT_DIST;
      }).slice(0, 2);
      repStr = nearReps.length > 0 ? nearReps.map(r => 'R' + r.num + ' (nah)').join(', ') : '-';
    }

    t1('A' + (i + 1), 30, ty, 8);
    t1((routePoints[i].name || 'WP' + (i + 1)) + '->' + (routePoints[i + 1].name || 'WP' + (i + 2)), 80, ty, 8);
    t1(d + ' km', 230, ty, 8);
    t1(repStr, 300, ty, 8);
    ty += 12;
  }

  // Content Stream Seite 2: Repeater-Liste NUMMERIERT
  let cs2 = '';
  function t2(s, x, y, sz) {
    cs2 += '0 0 0 rg BT /F1 ' + sz + ' Tf ' + x + ' ' + (PH - y) + ' Td (' + esc(s) + ') Tj ET\n';
  }
  function l2(x1, y1, x2, y2, r, g, b, w) {
    cs2 += r + ' ' + g + ' ' + b + ' RG ' + w + ' w ' + x1 + ' ' + (PH - y1) + ' m ' + x2 + ' ' + (PH - y2) + ' l S\n';
  }

  t2('Repeater-Liste (max. ' + MAX_REPS + ')', 30, 30, 12);
  t2('R-Nummer entspricht Karte  |  Gruen = Reichweite  |  Rot = Nah', 30, 46, 8);
  l2(30, 52, 565, 52, 0.4, 0.4, 0.4, 0.5);

  if (relevantReps.length === 0) {
    t2('Keine Repeater innerhalb 35km.', 30, 70, 10);
  } else {
    let ry = 64;
    t2('Nr', 30, ry, 8);
    t2('Callsign', 55, ry, 8);
    t2('Freq', 140, ry, 8);
    t2('Offset', 185, ry, 8);
    t2('Tone', 235, ry, 8);
    t2('Standort', 280, ry, 8);
    t2('Status', 430, ry, 8);
    t2('Distanz', 510, ry, 8);
    l2(30, ry + 4, 565, ry + 4, 0.7, 0.7, 0.7, 0.3);
    ry += 14;

    relevantReps.forEach(rep => {
      if (ry > 820) return;
      t2('R' + rep.num, 30, ry, 8);
      t2(rep.callsign, 55, ry, 7);
      t2(rep.frequency != null ? rep.frequency + ' MHz' : '-', 140, ry, 7);
      t2(rep.offset != null ? String(rep.offset) : '-', 185, ry, 7);
      t2(rep.tone, 235, ry, 7);
      const loc = rep.location || '-';
      t2(loc.length > 22 ? loc.substring(0, 22) : loc, 280, ry, 7);
      t2(rep.inRange ? 'Reichweite' : 'Nah', 430, ry, 7);
      t2(rep.distance.toFixed(1) + ' km', 510, ry, 7);
      ry += 11;
    });
  }

  t2('HB9OM On Field - v0.9028', 30, 835, 6);

  // --- PDF ALS Uint8Array BAUEN ---
  const cs1Bytes = str(cs1);
  const cs2Bytes = str(cs2);
  const imgBin = bin(jpegBytes);

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

  const off6 = totalLen(parts);
  parts.push(str('6 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + canvasW + ' /Height ' + canvasH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + imgBin.length + ' >>\nstream\n'));
  parts.push(imgBin);
  parts.push(str('\nendstream\nendobj\n'));

  const off7 = totalLen(parts);
  parts.push(str('7 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 4 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 6 0 R >> >> >>\nendobj\n'));

  const off8 = totalLen(parts);
  parts.push(str('8 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Contents 5 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n'));

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

  // Zusammenfuegen
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