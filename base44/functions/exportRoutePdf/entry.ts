// exportRoutePdf — Generiert ein 2-Seiten PDF (Karte + Repeater-Liste) im Backend.
// Empfängt waypoints + repeaters, gibt Base64-codiertes PDF als JSON zurück.
// v0.9023: jsPDF im Backend (nicht Frontend) — verhindert App-Crash.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { jsPDF } from 'npm:jspdf@4.2.1';

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function minDistanceToRouteKm(lat, lng, routeCoords) {
  let min = Infinity;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const [lat1, lng1] = routeCoords[i];
    const [lat2, lng2] = routeCoords[i + 1];
    const dx = lng2 - lng1, dy = lat2 - lat1;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = ((lng - lng1) * dx + (lat - lat1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const projLat = lat1 + t * dy;
    const projLng = lng1 + t * dx;
    const d = haversineKm({ lat, lng }, { lat: projLat, lng: projLng });
    if (d < min) min = d;
  }
  return min === Infinity ? 0 : min;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const waypoints = body.waypoints || [];
    const repeaters = body.repeaters || [];

    if (waypoints.length === 0) {
      return Response.json({ error: 'Keine Wegpunkte' }, { status: 400 });
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297, margin = 15;

    // ===== SEITE 1: Karte + Abschnittstabelle =====
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('HB9OM On Field — Routenplan', margin, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Datum: ${new Date().toLocaleDateString('de-CH')}`, margin, 25);

    // Route-Koordinaten für Distanzberechnung
    const routeCoords = waypoints.map(wp => [wp.lat, wp.lon]);

    // Repeater-Distanzen berechnen (falls nicht mitgeliefert)
    const repeatersWithDist = repeaters.map(r => ({
      ...r,
      distance: r.distance != null ? r.distance :
        (r.lat != null && r.lng != null ? minDistanceToRouteKm(r.lat, r.lng, routeCoords) : 9999),
    }));

    // Bounding Box über alle Punkte
    const repWithCoords = repeatersWithDist.filter(r => r.lat != null && r.lng != null);
    const allCoords = [
      ...waypoints.map(w => ({ lat: w.lat, lng: w.lon })),
      ...repWithCoords.map(r => ({ lat: r.lat, lng: r.lng })),
    ];
    if (allCoords.length === 0) {
      return Response.json({ error: 'Keine Koordinaten' }, { status: 400 });
    }
    const minLat = Math.min(...allCoords.map(c => c.lat));
    const maxLat = Math.max(...allCoords.map(c => c.lat));
    const minLng = Math.min(...allCoords.map(c => c.lng));
    const maxLng = Math.max(...allCoords.map(c => c.lng));
    const latRange = Math.max(maxLat - minLat, 0.01);
    const lngRange = Math.max(maxLng - minLng, 0.01);

    // Kartenbereich
    const mapX = margin, mapY = 32, mapW = pageW - 2 * margin, mapH = 130;
    const scale = Math.min(mapW / lngRange, mapH / latRange);
    const offsetX = mapX + (mapW - lngRange * scale) / 2;
    const offsetY = mapY + (mapH - latRange * scale) / 2;

    function toX(lng) { return offsetX + (lng - minLng) * scale; }
    function toY(lat) { return offsetY + mapH - (lat - minLat) * scale; }

    // Rahmen
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.3);
    doc.rect(mapX, mapY, mapW, mapH);

    // Route zeichnen (Abschnitte in verschiedenen Farben)
    const colors = [[37, 99, 235], [22, 163, 74], [220, 38, 38], [147, 51, 234], [234, 88, 12], [6, 182, 212]];
    doc.setLineWidth(1.2);
    for (let i = 0; i < waypoints.length - 1; i++) {
      const c = colors[i % colors.length];
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.line(toX(waypoints[i].lon), toY(waypoints[i].lat), toX(waypoints[i + 1].lon), toY(waypoints[i + 1].lat));
    }

    // Waypoints als nummerierte Kreise
    waypoints.forEach((wp, i) => {
      const x = toX(wp.lon), y = toY(wp.lat);
      doc.setFillColor(37, 99, 235);
      doc.circle(x, y, 3.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}`, x - 1.2, y + 1);
    });
    doc.setFont('helvetica', 'normal');

    // Repeater als rote Dreiecke
    repWithCoords.forEach(rep => {
      const x = toX(rep.lng), y = toY(rep.lat);
      doc.setFillColor(220, 38, 38);
      doc.triangle(x, y - 2.5, x - 2.5, y + 1.5, x + 2.5, y + 1.5, 'F');
      if (rep.callsign) {
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(5);
        doc.text(rep.callsign, x + 3, y + 0.5);
      }
    });

    // Legende
    let legY = mapY + mapH + 5;
    doc.setFillColor(37, 99, 235);
    doc.circle(mapX + 2, legY, 1.5, 'F');
    doc.setTextColor(90, 90, 90);
    doc.setFontSize(6);
    doc.text('Waypoint', mapX + 6, legY + 0.5);
    doc.setFillColor(220, 38, 38);
    doc.triangle(mapX + 32, legY - 1.5, mapX + 30, legY + 0.5, mapX + 34, legY + 0.5, 'F');
    doc.text('Repeater', mapX + 37, legY + 0.5);

    // Abschnitts-Tabelle
    let tableY = legY + 8;
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Abschn.', mapX, tableY);
    doc.text('Start', mapX + 22, tableY);
    doc.text('Ende', mapX + 75, tableY);
    doc.text('Distanz', mapX + 128, tableY);
    doc.text('Repeater', mapX + 162, tableY);
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.3);
    doc.line(mapX, tableY + 2.5, mapX + 180, tableY + 2.5);
    tableY += 6;
    doc.setFont('helvetica', 'normal');

    for (let i = 0; i < waypoints.length - 1; i++) {
      if (tableY > pageH - 25) break;
      const dist = haversineKm(
        { lat: waypoints[i].lat, lng: waypoints[i].lon },
        { lat: waypoints[i + 1].lat, lng: waypoints[i + 1].lon }
      ).toFixed(1);
      const repsInRange = repeatersWithDist.filter(r => r.distance <= 50).length;
      doc.text(`A${i + 1}`, mapX, tableY);
      doc.text((waypoints[i].name || `WP${i + 1}`).substring(0, 22), mapX + 22, tableY);
      doc.text((waypoints[i + 1].name || `WP${i + 2}`).substring(0, 22), mapX + 75, tableY);
      doc.text(`${dist} km`, mapX + 128, tableY);
      doc.text(`${repsInRange}`, mapX + 162, tableY);
      tableY += 5;
    }

    // ===== SEITE 2: Repeater-Konfiguration =====
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Repeater-Konfiguration', margin, 18);
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.4);
    doc.line(margin, 22, pageW - margin, 22);

    let repY = 30;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Callsign', margin, repY);
    doc.text('Frequenz', margin + 28, repY);
    doc.text('Mode', margin + 56, repY);
    doc.text('Offset', margin + 76, repY);
    doc.text('Tone', margin + 100, repY);
    doc.text('Standort', margin + 122, repY);
    doc.text('Entfern.', margin + 172, repY);
    doc.line(margin, repY + 2.5, pageW - margin, repY + 2.5);
    repY += 7;
    doc.setFont('helvetica', 'normal');

    const sortedReps = [...repeatersWithDist].sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
    sortedReps.forEach(rep => {
      if (repY > pageH - 15) return;
      doc.setFontSize(7);
      doc.text((rep.callsign || '-').substring(0, 12), margin, repY);
      const freq = rep.frequency || rep.tx_frequency || '-';
      doc.text(`${freq}`, margin + 28, repY);
      doc.text((rep.mode || 'FM').substring(0, 8), margin + 56, repY);
      const off = rep.offset != null ? `${rep.offset}` : '-';
      doc.text(off.substring(0, 10), margin + 76, repY);
      doc.text((rep.tone || rep.ctcss || '-').substring(0, 10), margin + 100, repY);
      doc.text((rep.location || rep.qth || rep.name || '-').substring(0, 28), margin + 122, repY);
      doc.text(`${(rep.distance || 0).toFixed(1)} km`, margin + 172, repY);
      repY += 5.5;
    });

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(130, 130, 130);
    doc.text('HB9OM On Field App — v0.9023', margin, pageH - 8);

    const pdfBytes = doc.output('arraybuffer');
    const pdfBase64 = arrayBufferToBase64(pdfBytes);

    return Response.json({
      success: true,
      pdf: pdfBase64,
      filename: 'hb9om-route.pdf',
      repeaterCount: sortedReps.length,
      waypointCount: waypoints.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}