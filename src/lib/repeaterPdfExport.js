import { jsPDF } from "jspdf";

const COLUMNS = [
  { header: "Rufzeichen", width: 70 },
  { header: "Frequenz", width: 55 },
  { header: "Offset", width: 45 },
  { header: "Tone", width: 40 },
  { header: "Band", width: 35 },
  { header: "Modi", width: 80 },
  { header: "Standort", width: 100 },
  { header: "Land", width: 50 },
  { header: "Status", width: 40 },
  { header: "EchoLink", width: 50 },
  { header: "DMR-ID", width: 50 },
  { header: "Versorgung", width: 45 },
  { header: "Notstrom", width: 40 },
  { header: "Quelle", width: 70 },
];

function formatRow(r) {
  const modes = Array.isArray(r.modes) ? r.modes.join(", ") : (r.modes || "");
  const isDMR = Array.isArray(r.modes) && r.modes.includes("DMR");
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
    r.source_id ? String(r.source_id) : "---",
  ];
}

export function exportRepeatersPdf(repeaters, filters = {}) {
  if (!repeaters || repeaters.length === 0) {
    alert("Keine Relais für diesen Filter — PDF-Export nicht möglich.");
    return;
  }

  if (repeaters.length > 1000) {
    if (!confirm(`Große Liste: ${repeaters.length} Relais. Download kann mehrere Sekunden dauern. Fortfahren?`)) {
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
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    let x = margin;
    for (const col of COLUMNS) {
      doc.text(col.header, x + 3, y + 13);
      x += col.width;
    }
    return y + headerHeight;
  }

  function drawRow(rowData, y, rowIndex) {
    if (rowIndex % 2 === 1) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, pageWidth - 2 * margin, rowHeight, "F");
    }
    doc.setFontSize(9);
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

  const filename = `repeaters_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;
  doc.save(filename);
}