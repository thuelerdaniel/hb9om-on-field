import { jsPDF } from "jspdf";

const COLUMNS = [
  { header: "Rufzeichen", width: 65, key: "callsign" },
  { header: "Frequenz", width: 50, key: "frequency" },
  { header: "Offset", width: 42, key: "offset" },
  { header: "Tone", width: 38, key: "tone" },
  { header: "Band", width: 32, key: "band" },
  { header: "Modi", width: 75, key: "modes" },
  { header: "Standort", width: 85, key: "location" },
  { header: "Land", width: 42, key: "country" },
  { header: "Status", width: 38, key: "status" },
  { header: "EchoLink", width: 45, key: "echolink" },
  { header: "DMR-ID", width: 45, key: "dmr" },
  { header: "Versorg.", width: 42, key: "coverage" },
  { header: "Notstrom", width: 38, key: "emergency" },
  { header: "Koordinaten", width: 80, key: "coords" },
];

// Column explanations for the legend at the end of the PDF
const COLUMN_LEGEND = [
  { header: "Rufzeichen", explanation: "Offizielles Amateurfunk-Rufzeichen des Relais" },
  { header: "Frequenz", explanation: "Empfangsfrequenz in MHz (Sende-/Empfangsfrequenz des Relais)" },
  { header: "Offset", explanation: "Sende-Offset in MHz (negativ = unterhalb, positiv = oberhalb der Empfangsfrequenz)" },
  { header: "Tone", explanation: "Zugangston (CTCSS / DCS / CC) fuer den Zugang zum Relais" },
  { header: "Band", explanation: "Amateurfunkband (z.B. 2m, 70cm, 23cm)" },
  { header: "Modi", explanation: "Unterstuetzte Modulationsarten (FM, DMR, C4FM, D-STAR, etc.)" },
  { header: "Standort", explanation: "Geografische Standortbeschreibung / Ortsname" },
  { header: "Land", explanation: "Land des Relaisstandorts" },
  { header: "Status", explanation: "Betriebsstatus: Aktiv (on-air), Inaktiv (off-air), Test, Unbekannt" },
  { header: "EchoLink", explanation: "EchoLink-Knotennummer (falls verfuegbar)" },
  { header: "DMR-ID", explanation: "RepeaterBook-ID (nur bei DMR-Relais)" },
  { header: "Versorg.", explanation: "Geschaetzte Abdeckung in km (Radius um den Standort)" },
  { header: "Notstrom", explanation: "Notstromversorgung vorhanden (Ja/Nein)" },
  { header: "Koordinaten", explanation: "Geografische Koordinaten (Breite, Laenge) in Dezimalgrad" },
];

function formatRow(r) {
  const modes = Array.isArray(r.modes) ? r.modes.join(", ") : (r.modes || "");
  const isDMR = Array.isArray(r.modes) && r.modes.includes("DMR");
  const coords = (r.lat != null && r.lng != null)
    ? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`
    : "---";
  return [
    r.callsign || "---",
    r.frequency != null ? r.frequency.toFixed(3) : "---",
    r.offset_mhz != null ? (r.offset_mhz > 0 ? "+" : "") + r.offset_mhz.toFixed(3) : "---",
    r.tone || "---",
    r.band || "---",
    modes || "---",
    r.location_name || "---",
    r.country || "---",
    r.status === "on-air" ? "Aktiv" : r.status === "off-air" ? "Inaktiv" : (r.status || "---"),
    r.echolink_node || "---",
    isDMR && r.source_id ? String(r.source_id) : "---",
    r.coverage_radius_km != null ? r.coverage_radius_km.toFixed(0) + " km" : "---",
    r.has_emergency_power ? "Ja" : "Nein",
    coords,
  ];
}

export function exportRepeatersPdf(repeaters, filters = {}) {
  if (!repeaters || repeaters.length === 0) {
    alert("Keine Relais fuer diesen Filter — PDF-Export nicht moeglich.");
    return;
  }

  if (repeaters.length > 1000) {
    if (!confirm(`Grosse Liste: ${repeaters.length} Relais. Download kann mehrere Sekunden dauern. Fortfahren?`)) {
      return;
    }
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 28;
  const tableTop = 82;
  const footerY = pageHeight - 20;
  const rowHeight = 14;
  const headerHeight = 18;
  const usableHeight = pageHeight - tableTop - headerHeight - 40;
  const rowsPerPage = Math.floor(usableHeight / rowHeight);

  const sorted = [...repeaters].sort((a, b) => (a.frequency || 0) - (b.frequency || 0));
  const totalPages = Math.ceil(sorted.length / rowsPerPage) || 1;
  const dateStr = new Date().toLocaleString("de-CH");

  // Filter info string
  const filterParts = [];
  if (filters.modes?.length) {
    filterParts.push(`Modus: ${filters.modes.join(", ")}${filters.exclusive ? " (nur)" : ""}`);
  }
  if (filters.countries?.length) filterParts.push(`Land: ${filters.countries.join(", ")}`);
  if (filters.search) filterParts.push(`Suche: "${filters.search}"`);
  if (filters.radiusKm) filterParts.push(`Radius: ${filters.radiusKm} km`);
  const filterStr = filterParts.join("  |  ") || "Kein Filter aktiv";

  function drawPageHeader(pageNum) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("HB9OM On Field — Relais-Liste", margin, 28);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Exportiert am ${dateStr}`, margin, 44);
    doc.text(filterStr, margin, 58);
    doc.text(`${sorted.length} Relais`, margin, 72);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `HB9OM On Field v0.87  ·  ${dateStr}  ·  Seite ${pageNum} von ${totalPages}`,
      pageWidth / 2, footerY, { align: "center" }
    );
  }

  function drawTableHeader(y) {
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, y, pageWidth - 2 * margin, headerHeight, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    let x = margin;
    for (const col of COLUMNS) {
      let headerText = col.header;
      const maxWidth = col.width - 4;
      if (doc.getTextWidth(headerText) > maxWidth) {
        while (headerText.length > 0 && doc.getTextWidth(headerText + "…") > maxWidth) {
          headerText = headerText.slice(0, -1);
        }
        headerText = headerText ? headerText + "…" : "";
      }
      doc.text(headerText, x + 3, y + 13);
      x += col.width;
    }
    return y + headerHeight;
  }

  function drawRow(rowData, y, rowIndex) {
    if (rowIndex % 2 === 1) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, pageWidth - 2 * margin, rowHeight, "F");
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    let x = margin;
    for (let i = 0; i < COLUMNS.length; i++) {
      const col = COLUMNS[i];
      let text = String(rowData[i] || "");
      const maxWidth = col.width - 4;
      if (doc.getTextWidth(text) > maxWidth) {
        while (text.length > 0 && doc.getTextWidth(text + "…") > maxWidth) {
          text = text.slice(0, -1);
        }
        text = text ? text + "…" : "";
      }
      doc.text(text, x + 3, y + 10);
      x += col.width;
    }
    return y + rowHeight;
  }

  // Draw all pages
  let y = tableTop;
  let currentPage = 1;
  drawPageHeader(currentPage);
  y = drawTableHeader(y);

  for (let i = 0; i < sorted.length; i++) {
    if (y + rowHeight > pageHeight - 40) {
      doc.addPage();
      currentPage++;
      drawPageHeader(currentPage);
      y = tableTop;
      y = drawTableHeader(y);
    }
    y = drawRow(formatRow(sorted[i]), y, i);
  }

  // === Legend page at the end ===
  doc.addPage();
  currentPage++;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("HB9OM On Field — Spalten-Legende", margin, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Relais-Liste vom ${dateStr}`, margin, 56);
  doc.text(`${sorted.length} Relais  ·  ${filterStr}`, margin, 70);

  // Legend table header
  const legendTop = 90;
  const legendHeaderHeight = 20;
  const legendRowHeight = 22;
  const colHeaderWidth = 90;
  const colExplainWidth = pageWidth - 2 * margin - colHeaderWidth;

  doc.setFillColor(59, 130, 246);
  doc.rect(margin, legendTop, pageWidth - 2 * margin, legendHeaderHeight, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Spalte", margin + 5, legendTop + 14);
  doc.text("Erklaerung", margin + colHeaderWidth + 5, legendTop + 14);

  let ly = legendTop + legendHeaderHeight;
  for (let i = 0; i < COLUMN_LEGEND.length; i++) {
    const entry = COLUMN_LEGEND[i];

    // Zebra stripe
    if (i % 2 === 1) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, ly, pageWidth - 2 * margin, legendRowHeight, "F");
    }

    // Column name
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    let headerText = entry.header;
    if (doc.getTextWidth(headerText) > colHeaderWidth - 8) {
      while (headerText.length > 0 && doc.getTextWidth(headerText + "…") > colHeaderWidth - 8) {
        headerText = headerText.slice(0, -1);
      }
      headerText = headerText ? headerText + "…" : "";
    }
    doc.text(headerText, margin + 5, ly + 14);

    // Explanation — wrap text if too long
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    const explainText = entry.explanation;
    const maxExplainWidth = colExplainWidth - 8;
    const lines = doc.splitTextToSize(explainText, maxExplainWidth);
    doc.text(lines, margin + colHeaderWidth + 5, ly + 14);

    ly += legendRowHeight;
  }

  // Footer on legend page
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `HB9OM On Field v0.87  ·  ${dateStr}  ·  Seite ${currentPage} von ${totalPages + 1}`,
    pageWidth / 2, footerY, { align: "center" }
  );

  const filename = `repeaters_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;
  doc.save(filename);
}