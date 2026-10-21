import { jsPDF } from "jspdf";
import { CONTINENTS } from "@/lib/continents";
import { COUNTRIES } from "@/lib/countries";
import { APP_VERSION } from "@/lib/appVersion";

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

// Text shown when nothing is drawn on the map in the current section.
export const PDF_EMPTY_MESSAGE =
  "Im aktuellen Kartenausschnitt steht kein Relais. Karte verschieben oder zoomen — oder den Filter erweitern (Land, Modus, Radius, Suche).";

// Numbers may arrive as strings from the database — a single odd record must
// never abort the whole export.
function numOrNull(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatRow(r) {
  const modes = Array.isArray(r.modes) ? r.modes.join(", ") : (r.modes || "");
  const isDMR = Array.isArray(r.modes) && r.modes.includes("DMR");
  const lat = numOrNull(r.lat);
  const lng = numOrNull(r.lng);
  const freq = numOrNull(r.frequency);
  const offset = numOrNull(r.offset_mhz);
  const cov = numOrNull(r.coverage_radius_km);
  const coords = lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "---";
  return [
    r.callsign || "---",
    freq != null ? freq.toFixed(3) : "---",
    offset != null ? (offset > 0 ? "+" : "") + offset.toFixed(3) : "---",
    r.tone || "---",
    r.band || "---",
    modes || "---",
    r.location_name || "---",
    r.country || "---",
    r.status === "on-air" ? "Aktiv" : r.status === "off-air" ? "Inaktiv" : (r.status || "---"),
    r.echolink_node || "---",
    isDMR && r.source_id ? String(r.source_id) : "---",
    cov != null ? cov.toFixed(0) + " km" : "---",
    r.has_emergency_power ? "Ja" : "Nein",
    coords,
  ];
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function countryLabel(code) {
  const c = COUNTRIES.find(x => x.iso2 === code);
  return c ? c.name : code;
}

function continentLabel(id) {
  const c = CONTINENTS.find(x => x.id === id);
  return c ? c.name : id;
}

// Rough map section as readable text: "Nord 47.81 / Sued 45.67 / West 5.12 / Ost 11.24".
// bounds is a Leaflet LatLngBounds (already padded like the map). ASCII only — keeps
// the PDF text extractable and avoids font encoding issues.
function formatBounds(bounds) {
  try {
    if (!bounds || typeof bounds.getNorth !== "function") return "unbekannt";
    if (typeof bounds.isValid === "function" && !bounds.isValid()) return "unbekannt";
    const n = bounds.getNorth();
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const e = bounds.getEast();
    if (![n, s, w, e].every(Number.isFinite)) return "unbekannt";
    return `Nord ${n.toFixed(2)} / Sued ${s.toFixed(2)} / West ${w.toFixed(2)} / Ost ${e.toFixed(2)}`;
  } catch {
    return "unbekannt";
  }
}

// Trigger the download. Wrapped separately so a blocked download surfaces as an
// error instead of a silent no-op.
function downloadPdf(doc, filename) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Keep the object URL alive for a while — revoking too early aborts the download.
  window.setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60000);
}

/**
 * Export the repeaters that are currently drawn on the map.
 *
 * `repeaters` must already be the displayed list (same filter pipeline as the map +
 * viewport culling + marker cap) — see src/lib/repeaterDisplayPipeline.js.
 *
 * filters: { modes, exclusive, countries, continents, search, radiusKm, onlyLinked,
 *            bounds (Leaflet LatLngBounds), center ([lat, lng]) }
 * options: { onProgress(percent) } — called while the pages are drawn
 *
 * The pages are drawn in chunks (the browser stays responsive in between), and the
 * function never uses native browser dialogs: it resolves with
 *   { ok: true, count, pages, filename }
 * or
 *   { ok: false, reason: "empty" | "error", message }
 * so the caller can always show a visible message.
 */
export async function exportRepeatersPdf(repeaters, filters = {}, options = {}) {
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;
  const list = Array.isArray(repeaters) ? repeaters : [];

  if (list.length === 0) {
    return { ok: false, reason: "empty", count: 0, message: PDF_EMPTY_MESSAGE };
  }

  try {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 28;
    const footerY = pageHeight - 20;
    const rowHeight = 14;
    const tableHeaderHeight = 18;
    const maxTextWidth = pageWidth - 2 * margin;

    const center = Array.isArray(filters.center) && filters.center.length === 2 &&
      Number.isFinite(filters.center[0]) && Number.isFinite(filters.center[1])
      ? filters.center
      : null;

    // Sort: nearest to the map centre first (the list follows the map outwards from its
    // middle). Without a map centre the list is alphabetical by callsign.
    const sorted = list
      .map(r => {
        const lat = numOrNull(r.lat);
        const lng = numOrNull(r.lng);
        return {
          r,
          dist: center && lat != null && lng != null ? distanceKm(center[0], center[1], lat, lng) : null,
        };
      })
      .sort((a, b) => {
        if (a.dist != null && b.dist != null) return a.dist - b.dist;
        return String(a.r.callsign || "").localeCompare(String(b.r.callsign || ""));
      })
      .map(x => x.r);

    const dateStr = new Date().toLocaleString("de-CH");

    // Filter info string — the filters that decide what is on the map
    const filterParts = [];
    if (filters.continents?.length) {
      filterParts.push(`Kontinent: ${filters.continents.map(continentLabel).join(", ")}`);
    }
    if (filters.countries?.length) {
      filterParts.push(`Land: ${filters.countries.map(countryLabel).join(", ")}`);
    }
    if (filters.modes?.length) {
      filterParts.push(`Modus: ${filters.modes.join(", ")}${filters.exclusive ? " (nur)" : ""}`);
    }
    if (filters.onlyLinked) filterParts.push("Nur verlinkte Relais");
    if (filters.search) filterParts.push(`Suche: "${filters.search}"`);
    if (filters.radiusKm) filterParts.push(`Radius: ${filters.radiusKm} km`);
    const filterStr = filterParts.join("  |  ") || "Kein Filter aktiv";

    const boundsStr = `Kartenausschnitt: ${formatBounds(filters.bounds)}`;
    const sortStr = center
      ? `Sortierung: Entfernung zum Kartenzentrum (naechstes zuerst) - Zentrum ${center[0].toFixed(3)}, ${center[1].toFixed(3)}`
      : "Sortierung: Rufzeichen (A-Z)";

    // Header — title, timestamp, count, active filter, map section, sorting.
    // Long filter lists wrap onto several lines; the table starts below them.
    const headerLines = [
      { text: "HB9OM On Field — Relais-Liste (aktueller Kartenausschnitt)", size: 15, bold: true, color: [30, 30, 30] },
      { text: `Exportiert am ${dateStr}`, size: 10, color: [30, 30, 30] },
      { text: `Relais im Kartenausschnitt: ${sorted.length}`, size: 11, bold: true, color: [30, 30, 30] },
      { text: `Aktiver Filter: ${filterStr}`, size: 9, color: [80, 80, 80] },
      { text: boundsStr, size: 9, color: [80, 80, 80] },
      { text: sortStr, size: 9, color: [80, 80, 80] },
    ];

    const headerRenderLines = [];
    for (const line of headerLines) {
      doc.setFont("helvetica", line.bold ? "bold" : "normal");
      doc.setFontSize(line.size);
      for (const text of doc.splitTextToSize(String(line.text), maxTextWidth)) {
        headerRenderLines.push({ text, size: line.size, bold: line.bold, color: line.color });
      }
    }
    const lineStep = (l) => Math.max(11, l.size * 1.3);
    const headerTop = 30;
    const headerTotal = headerRenderLines.reduce((sum, l) => sum + lineStep(l), 0);
    const tableTop = Math.round(headerTop + headerTotal + 2);

    const usableHeight = pageHeight - tableTop - tableHeaderHeight - 40;
    const rowsPerPage = Math.max(1, Math.floor(usableHeight / rowHeight));
    const totalPages = Math.ceil(sorted.length / rowsPerPage) || 1;

    function drawPageHeader(pageNum) {
      let hy = headerTop;
      for (const line of headerRenderLines) {
        doc.setFontSize(line.size);
        doc.setFont("helvetica", line.bold ? "bold" : "normal");
        doc.setTextColor(line.color[0], line.color[1], line.color[2]);
        doc.text(line.text, margin, hy);
        hy += lineStep(line);
      }

      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `HB9OM On Field v${APP_VERSION}  ·  ${dateStr}  ·  Seite ${pageNum} von ${totalPages}`,
        pageWidth / 2, footerY, { align: "center" }
      );
    }

    function drawTableHeader(y) {
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, y, pageWidth - 2 * margin, tableHeaderHeight, "F");
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
      return y + tableHeaderHeight;
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

    // Draw all pages. Every 120 rows the browser gets a turn (progress paint +
    // responsive UI) — necessary for large sections on mobile devices.
    onProgress?.(0);
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
      if (i % 120 === 119) {
        onProgress?.(Math.round(((i + 1) / sorted.length) * 100));
        await new Promise(r => setTimeout(r, 0));
      }
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
    doc.text(`${sorted.length} Relais im Kartenausschnitt  ·  ${filterStr}`, margin, 70);
    doc.text(boundsStr, margin, 84);

    // Legend table header
    const legendTop = 104;
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
      const lines = doc.splitTextToSize(entry.explanation, colExplainWidth - 8);
      doc.text(lines, margin + colHeaderWidth + 5, ly + 14);

      ly += legendRowHeight;
    }

    // Footer on legend page
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `HB9OM On Field v${APP_VERSION}  ·  ${dateStr}  ·  Seite ${currentPage} von ${totalPages + 1}`,
      pageWidth / 2, footerY, { align: "center" }
    );

    onProgress?.(100);

    const filename = `repeaters_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;
    downloadPdf(doc, filename);

    return { ok: true, count: sorted.length, pages: totalPages + 1, filename };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: (err && (err.message || String(err))) || "Unbekannter Fehler",
    };
  }
}