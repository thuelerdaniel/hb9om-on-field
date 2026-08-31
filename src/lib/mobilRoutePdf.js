// PDF-Export für Mobil-Route — generiert eine strukturierte PDF zum Abtippen
// von Repeater-Daten für Funkgerät-Programmierung.
// Gruppiert nach Betriebsmodus, sortiert nach Teilstrecke.

import { jsPDF } from "jspdf";
import { getModeLabel } from "./repeaterModes";

export function generateMobilRoutePdf(routeName, date, totalDistance, modeFilter, repeaters) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 15;
  let y = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Mobil-Route — Repeater-Liste", margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Route: ${routeName || "Unbenannt"}`, margin, y);
  y += 5;
  doc.text(`Datum: ${date}`, margin, y);
  y += 5;
  doc.text(`Gesamtdistanz: ${totalDistance} km`, margin, y);
  y += 5;
  if (modeFilter && modeFilter.length > 0) {
    doc.text(`Modus-Filter: ${modeFilter.map(getModeLabel).join(", ")}`, margin, y);
    y += 5;
  }
  doc.text(`Anzahl Repeater: ${repeaters.length}`, margin, y);
  y += 8;

  // Linie unter Header
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Nach Betriebsmodus gruppieren
  const modeGroups = {};
  for (const r of repeaters) {
    const modes = Array.isArray(r.modes) && r.modes.length > 0 ? r.modes : [r.primary_mode || "Other"];
    for (const mode of modes) {
      if (!modeGroups[mode]) modeGroups[mode] = [];
      modeGroups[mode].push(r);
    }
  }

  // Sortierte Modus-Liste
  const sortedModes = Object.keys(modeGroups).sort();

  for (const mode of sortedModes) {
    const groupRepeaters = modeGroups[mode];
    // Nach Teilstrecke sortieren
    groupRepeaters.sort((a, b) => (a._segmentIdx || 0) - (b._segmentIdx || 0) || (a._distToRoute || 0) - (b._distToRoute || 0));

    // Modus-Überschrift
    if (y > pageH - 30) { doc.addPage(); y = margin; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 80, 160);
    doc.text(`${getModeLabel(mode)} (${groupRepeaters.length})`, margin, y);
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
    doc.text("Standort", margin + 112, y);
    doc.text("Teil", margin + 160, y);
    doc.text("Entf.", margin + 172, y);
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
      const location = (r.location_name || "---").substring(0, 40);
      const segment = r._segmentIdx != null ? `#${r._segmentIdx + 1}` : "---";
      const dist = r._distToRoute != null ? `${r._distToRoute.toFixed(1)} km` : "---";

      doc.text(callsign, margin + 1, y);
      doc.text(txFreq, margin + 35, y);
      doc.text(rxFreq, margin + 52, y);
      doc.text(offset, margin + 69, y);
      doc.text(tone, margin + 85, y);
      doc.text(band, margin + 100, y);
      doc.text(location, margin + 112, y);
      doc.text(segment, margin + 160, y);
      doc.text(dist, margin + 172, y);
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
    doc.text(`HB9OM On Field v0.9006 — Mobil-Route — ${routeName || "Unbenannt"} — Seite ${i}/${pageCount}`, pageW / 2, pageH - 5, { align: "center" });
    doc.setTextColor(0);
  }

  const filename = `Route_${(routeName || "Unbenannt").replace(/[^a-zA-Z0-9_-]/g, "_")}_${date}.pdf`;
  doc.save(filename);
}