// PDF-Export für Mobil-Route — PURE JavaScript, keine externe Library.
// v0.9030: OSM Standard Tiles + enger Zoom (15% Margin) + Farben auf Karte.

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
function lon2tileF(lon, z) { return (lon + 180) / 360 * Math.pow(2, z); }
function lat2tileF(lat, z) {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
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
  const INTERPOLATE_KM = 25;

  // --- AUTO-INTERPOLATION — Zwischenpunkte alle ~25km ---
  let expandedPoints = [];
  for (let i = 0; i < routePoints.length; i++) {
    expandedPoints.push({ ...routePoints[i], isMain: true });
    if (i < routePoints.length - 1) {
      const a = routePoints[i];
      const b = routePoints[i + 1];
      const segDist = haversine(a, b);
      const numSteps = Math.max(1, Math.floor(segDist / INTERPOLATE_KM));
      for (let s = 1; s < numSteps; s++) {
        const frac = s / numSteps;
        expandedPoints.push({
          lat: a.lat + (b.lat - a.lat) * frac,
          lng: a.lng + (b.lng - a.lng) * frac,
          name: 'i' + (expandedPoints.length + 1),
          isMain: false,
        });
      }
    }
  }
  const allPoints = expandedPoints;

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

  // --- ENGER ZOOM — Bounding Box mit 15% Margin ---
  const repWithCoords = relevantReps.filter(r => r.lat != null && r.lng != null);
  const allCoords = [...routePoints, ...repWithCoords];
  const minLat = Math.min(...allCoords.map(c => c.lat));
  const maxLat = Math.max(...allCoords.map(c => c.lat));
  const minLng = Math.min(...allCoords.map(c => c.lng));
  const maxLng = Math.max(...allCoords.map(c => c.lng));

  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  const marginLat = Math.max(latRange * 0.15, 0.01);
  const marginLng = Math.max(lngRange * 0.15, 0.01);

  const bMinLat = minLat - marginLat;
  const bMaxLat = maxLat + marginLat;
  const bMinLng = minLng - marginLng;
  const bMaxLng = maxLng + marginLng;

  // Zoom waehlen: groesster Zoom bei dem Bounding Box in 800x500 passt
  const CANVAS_W = 800;
  const CANVAS_H = 500;
  const TILE = 256;

  let zoom = 15;
  for (let z = 15; z >= 7; z--) {
    const txMin = lon2tileF(bMinLng, z);
    const txMax = lon2tileF(bMaxLng, z);
    const tyMin = lat2tileF(bMaxLat, z);
    const tyMax = lat2tileF(bMinLat, z);
    const tilesW = txMax - txMin;
    const tilesH = tyMax - tyMin;
    if (tilesW * TILE <= CANVAS_W && tilesH * TILE <= CANVAS_H) {
      zoom = z;
      break;
    }
  }

  // Tiles fuer diesen Zoom laden — nur die in der Bounding Box
  const tx0 = Math.floor(lon2tileF(bMinLng, zoom));
  const tx1 = Math.floor(lon2tileF(bMaxLng, zoom));
  const ty0 = Math.floor(lat2tileF(bMaxLat, zoom));
  const ty1 = Math.floor(lat2tileF(bMinLat, zoom));

  const numTilesX = tx1 - tx0 + 1;
  const numTilesY = ty1 - ty0 + 1;
  const canvasW = numTilesX * TILE;
  const canvasH = numTilesY * TILE;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  // --- OSM STANDARD TILES (mit Subdomain-Rotation) ---
  const subdomains = ['a', 'b', 'c'];
  const tilePromises = [];
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const sd = subdomains[(tx + ty) % 3];
      const url = 'https://' + sd + '.tile.openstreetmap.org/' + zoom + '/' + tx + '/' + ty + '.png';
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

  // Skalierte Linienstärken
  const lineScale = Math.min(canvasW / 1024, canvasH / 768, 1);
  const ROUTE_LINE_WIDTH = Math.max(3, 5 * lineScale);
  const WAYPOINT_RADIUS = Math.max(6, 11 * lineScale);
  const REPEATER_RADIUS = Math.max(5, 10 * lineScale);
  const SEG_LABEL_RADIUS = Math.max(8, 12 * lineScale);

  // Abschnitts-Farben
  const segColors = ['#dc2626', '#16a34a', '#2563eb', '#ea580c', '#9333ea', '#0891b2', '#ca8a04', '#be185d'];

  // ROUTE FARBIG ZEICHNEN — ueber interpolierte Abschnitte
  for (let i = 0; i < allPoints.length - 1; i++) {
    const color = segColors[i % segColors.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = ROUTE_LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(toX(allPoints[i].lng), toY(allPoints[i].lat));
    ctx.lineTo(toX(allPoints[i + 1].lng), toY(allPoints[i + 1].lat));
    ctx.stroke();

    // Abschnitt-Label A1, A2... in der Mitte
    const mx = (toX(allPoints[i].lng) + toX(allPoints[i + 1].lng)) / 2;
    const my = (toY(allPoints[i].lat) + toY(allPoints[i + 1].lat)) / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(1.5, 2 * lineScale);
    ctx.beginPath();
    ctx.arc(mx, my, SEG_LABEL_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.font = 'bold ' + Math.max(8, 10 * lineScale) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A' + (i + 1), mx, my);
  }

  // HAUPT-WAYPOINTS als nummerierte Kreise (nur isMain=true)
  let wpNum = 0;
  routePoints.forEach((wp) => {
    wpNum++;
    const x = toX(wp.lng);
    const y = toY(wp.lat);
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = Math.max(2, 3 * lineScale);
    ctx.beginPath();
    ctx.arc(x, y, WAYPOINT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold ' + Math.max(9, 12 * lineScale) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(wpNum), x, y);
  });

  // RELAIS — NUMMERIERT R1, R2... mit Farbe (gruen=Reichweite, rot=nah)
  relevantReps.forEach(rep => {
    const x = toX(rep.lng);
    const y = toY(rep.lat);

    ctx.fillStyle = rep.inRange ? '#16a34a' : '#dc2626';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = Math.max(1.5, 2 * lineScale);
    ctx.beginPath();
    ctx.arc(x, y, REPEATER_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'white';
    ctx.font = 'bold ' + Math.max(7, 9 * lineScale) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R' + rep.num, x, y);

    // Callsign Label daneben
    const text = rep.callsign || '?';
    ctx.font = Math.max(7, 9 * lineScale) + 'px Arial';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(x + REPEATER_RADIUS + 3, y - 6, tw + 4, 12);
    ctx.fillStyle = 'black';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + REPEATER_RADIUS + 5, y);
  });

  // LEGENDE auf der Karte
  const legW = 180, legH = 105;
  const legX = canvasW - legW - 10, legY = 8;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(legX, legY, legW, legH);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(legX, legY, legW, legH);
  ctx.fillStyle = 'black';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Legende', legX + 8, legY + 14);

  // Waypoint
  ctx.fillStyle = 'white';
  ctx.strokeStyle = '#1e40af';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(legX + 14, legY + 32, 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'black'; ctx.font = '9px Arial';
  ctx.fillText('Waypoint (1, 2...)', legX + 26, legY + 32);

  // Relais gruen
  ctx.fillStyle = '#16a34a';
  ctx.strokeStyle = 'white';
  ctx.beginPath(); ctx.arc(legX + 14, legY + 50, 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'black';
  ctx.fillText('Relais Reichweite <20km', legX + 26, legY + 50);

  // Relais rot
  ctx.fillStyle = '#dc2626';
  ctx.strokeStyle = 'white';
  ctx.beginPath(); ctx.arc(legX + 14, legY + 68, 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'black';
  ctx.fillText('Relais nah 20-35km', legX + 26, legY + 68);

  // Abschnitt
  ctx.strokeStyle = segColors[0];
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(legX + 8, legY + 88); ctx.lineTo(legX + 22, legY + 88); ctx.stroke();
  ctx.fillStyle = segColors[0];
  ctx.beginPath(); ctx.arc(legX + 15, legY + 88, 4, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = 'white'; ctx.font = 'bold 7px Arial'; ctx.textAlign = 'center';
  ctx.fillText('A1', legX + 15, legY + 88);
  ctx.fillStyle = 'black'; ctx.font = '9px Arial'; ctx.textAlign = 'left';
  ctx.fillText('Abschnitt (A1, A2...)', legX + 26, legY + 88);

  // JPEG-Qualitaet 0.92
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpegBase64 = jpegDataUrl.split(',')[1];
  const jpegBytes = atob(jpegBase64);

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
  t1('Version: v0.9030', 30, 78, 9);

  cs1 += 'q\n';
  cs1 += imgW + ' 0 0 ' + imgH + ' ' + imgX + ' ' + (PH - imgY - imgH) + ' cm\n';
  cs1 += '/Im1 Do\n';
  cs1 += 'Q\n';

  // ABSCHNITTS-TABELLE mit interpolierten Abschnitten
  let ty = imgY + imgH + 15;
  t1('Abschnitt', 30, ty, 9);
  t1('Strecke', 80, ty, 9);
  t1('Distanz', 230, ty, 9);
  t1('Empfohlene Relais', 300, ty, 9);
  l1(30, ty + 3, 565, ty + 3, 0.7, 0.7, 0.7, 0.3);
  ty += 13;

  const MAX_SECTIONS = 20;
  let sectionCount = 0;

  for (let i = 0; i < allPoints.length - 1; i++) {
    if (ty > 800) break;
    if (sectionCount >= MAX_SECTIONS) {
      t1('... (weitere Abschnitte gekuerzt)', 30, ty, 7);
      break;
    }
    sectionCount++;

    const d = haversine(allPoints[i], allPoints[i + 1]).toFixed(1);

    const segReps = relevantReps.filter(r => {
      if (r.lat == null) return false;
      const minD = Math.min(
        haversine(allPoints[i], { lat: r.lat, lng: r.lng }),
        haversine(allPoints[i + 1], { lat: r.lat, lng: r.lng })
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
          haversine(allPoints[i], { lat: r.lat, lng: r.lng }),
          haversine(allPoints[i + 1], { lat: r.lat, lng: r.lng })
        );
        return minD <= RELEVANT_DIST;
      }).slice(0, 2);
      repStr = nearReps.length > 0 ? nearReps.map(r => 'R' + r.num + '(nah)').join(', ') : '-';
    }

    const marker = (allPoints[i].isMain || allPoints[i + 1].isMain) ? '*' : '';
    t1('A' + (i + 1) + marker, 30, ty, 8);
    const nameA = allPoints[i].name || ('P' + (i + 1));
    const nameB = allPoints[i + 1].name || ('P' + (i + 2));
    const stretch = nameA + '->' + nameB;
    t1(stretch.length > 28 ? stretch.substring(0, 28) : stretch, 80, ty, 7);
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

  t2('HB9OM On Field - v0.9030', 30, 835, 6);

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