// PDF-Export für Mobil-Route — generiert eine strukturierte PDF zum Abtippen
// von Repeater-Daten für Funkgerät-Programmierung.
// v0.9020: Route-Tabelle (Abschnitte) + Repeater pro Abschnitt + Header/Footer aktualisiert.

import { jsPDF } from "jspdf";
import { getModeLabel } from "./repeaterModes";
import { haversine } from "./geoUtilsFrontend";

export function generateMobilRoutePdf(routeName, date, totalDistance, modeFilter, repeaters, waypoints) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  let y = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("HB9OM On Field", margin, y);
  y += 7;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Mobil-Route — Repeater-Liste`, margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.text(`Route: ${routeName || "Unbenannt"}`, margin, y);
  y += 4;
  doc.text(`Datum: ${date}`, margin, y);
  y += 4;
  doc.text(`Gesamtdistanz: ${totalDistance} km`, margin, y);
  y += 4;
  if (waypoints && waypoints.length > 0) {
    doc.text(`Anzahl Wegpunkte: ${waypoints.length}`, margin, y);
    y += 4;
  }
  doc.text(`Anzahl Repeater: ${repeaters.length}`, margin, y);
  y += 4;
  if (modeFilter && modeFilter.length > 0) {
    doc.text(`Modus-Filter: ${modeFilter.map(getModeLabel).join(", ")}`, margin, y);
    y += 4;
  }
  y += 4;

  // Linie unter Header
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Route-Tabelle (Abschnitte) — v0.9020
  if (waypoints && waypoints.length >= 2) {
    if (y > pageH - 30) { doc.addPage(); y = margin; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 80, 160);
    doc.text("Routen-Abschnitte", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 6;

    // Tabellen-Header
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 3, pageW - 2 * margin, 5, "F");
    doc.text("Abschn.", margin + 1, y);
    doc.text("Start", margin + 18, y);
    doc.text("→", margin + 75, y);
    doc.text("Ziel", margin + 82, y);
    doc.text("Distanz", margin + 150, y);
    y += 5;

    // Abschnitte
    doc.setFont("helvetica", "normal");
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (y > pageH - 15) { doc.addPage(); y = margin; }
      const wpA = waypoints[i];
      const wpB = waypoints[i + 1];
      const segDist = haversine(wpA.lat, wpA.lon, wpB.lat, wpB.lon);
      const nameA = (wpA.name || `${wpA.lat.toFixed(4)}, ${wpA.lon.toFixed(4)}`).substring(0, 50);
      const nameB = (wpB.name || `${wpB.lat.toFixed(4)}, ${wpB.lon.toFixed(4)}`).substring(0, 50);

      doc.text(`#${i + 1}`, margin + 1, y);
      doc.text(nameA, margin + 18, y);
      doc.text("→", margin + 75, y);
      doc.text(nameB, margin + 82, y);
      doc.text(`${segDist.toFixed(1)} km`, margin + 150, y);
      y += 4.5;
    }
    y += 6;
  }

  // Repeater nach Abschnitt gruppieren — v0.9020
  const segmentGroups = {};
  for (const r of repeaters) {
    const segIdx = r._segmentIdx != null ? r._segmentIdx : -1;
    if (!segmentGroups[segIdx]) segmentGroups[segIdx] = [];
    segmentGroups[segIdx].push(r);
  }

  // Sortierte Abschnitte
  const sortedSegments = Object.keys(segmentGroups).map(Number).sort((a, b) => a - b);

  for (const segIdx of sortedSegments) {
    const groupRepeaters = segmentGroups[segIdx];
    groupRepeaters.sort((a, b) => (a._distToRoute || 0) - (b._distToRoute || 0));

    // Abschnitt-Überschrift
    if (y > pageH - 30) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 80, 160);

    if (waypoints && waypoints.length >= 2 && segIdx >= 0 && segIdx < waypoints.length - 1) {
      const wpA = waypoints[segIdx];
      const wpB = waypoints[segIdx + 1];
      const nameA = (wpA.name || `${wpA.lat.toFixed(4)}, ${wpA.lon.toFixed(4)}`).substring(0, 30);
      const nameB = (wpB.name || `${wpB.lat.toFixed(4)}, ${wpB.lon.toFixed(4)}`).substring(0, 30);
      doc.text(`Abschnitt ${segIdx + 1}: ${nameA} → ${nameB} (${groupRepeaters.length} Repeater)`, margin, y);
    } else if (segIdx === -1) {
      doc.text(`Allgemein (${groupRepeaters.length} Repeater)`, margin, y);
    } else {
      doc.text(`Abschnitt ${segIdx + 1} (${groupRepeaters.length} Repeater)`, margin, y);
    }
    doc.setTextColor(0, 0, 0);
    y += 6;

    // Tabellen-Header
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 3, pageW - 2 * margin, 5, "F");
    doc.text("Rufzeichen", margin + 1, y);
    doc.text("TX-Freq", margin + 35, y);
    doc.text("RX-Freq", margin + 52, y);
    doc.text("Offset", margin + 69, y);
    doc.text("Tone", margin + 85, y);
    doc.text("Band", margin + 100, y);
    doc.text("Mode", margin + 112, y);
    doc.text("Standort", margin + 130, y);
    doc.text("Entf.", margin + 175, y);
    y += 5;

    // Repeater-Zeilen
    doc.setFont("helvetica", "normal");
    for (const r of groupRepeaters) {
      if (y > pageH - 15) { doc.addPage(); y = margin; }

      const callsign = r.callsign || "---";
      const txFreq = r.frequency != null ? r.frequency.toFixed(4) : "---";
      const rxFreq = r.frequency != null && r.offset_mhz != null ? (r.frequency + r.offset_mhz).toFixed(4) : "---";
      const offset = r.offset_mhz != null ? (r.offset_mhz > 0 ? "+" : "") + r.offset_mhz.toFixed(3) : "---";
      const tone = r.tone || "---";
      const band = r.band || "---";
      const mode = getModeLabel(r.primary_mode || (Array.isArray(r.modes) && r.modes[0]) || "Other");
      const location = (r.location_name || "---").substring(0, 40);
      const dist = r._distToRoute != null ? `${r._distToRoute.toFixed(1)} km` : "---";

      doc.text(callsign, margin + 1, y);
      doc.text(txFreq, margin + 35, y);
      doc.text(rxFreq, margin + 52, y);
      doc.text(offset, margin + 69, y);
      doc.text(tone, margin + 85, y);
      doc.text(band, margin + 100, y);
      doc.text(mode, margin + 112, y);
      doc.text(location, margin + 130, y);
      doc.text(dist, margin + 175, y);
      y += 4.5;
    }
    y += 4;
  }

  // Footer auf jeder Seite
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128);
    doc.text(`HB9OM On Field v0.9022 — ${routeName || "Unbenannt"} — Seite ${i}/${pageCount}`, pageW / 2, pageH - 5, { align: "center" });
    doc.setTextColor(0);
  }

  const filename = `Route_${(routeName || "Unbenannt").replace(/[^a-zA-Z0-9_-]/g, "_")}_${date}.pdf`;
  doc.save(filename);
}