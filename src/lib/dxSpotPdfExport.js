// DX-Spot Referenz-PDF-Export mit jsPDF.
// Erstellt ein PDF mit DX-Spots gefiltert nach Referenz-Typ.

import { jsPDF } from "jspdf";

const REF_LABELS = {
  'SOTA': 'SOTA – Berggipfel',
  'POTA': 'POTA – Parks',
  'WWFF': 'WWFF – Flora & Fauna',
  'WWBOTA': 'WWBOTA – Bunker',
  'WCA': 'WCA – Burgen & Schlösser',
  'TOTA': 'TOTA – Türme & Antennen',
  'IOTA': 'IOTA – Inseln',
  'WLOTA': 'WLOTA – Leuchttürme',
};

export function generateDxSpotPdf(spots, refFilter = 'All') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const colW = pageW - 2 * margin;

  // === Header ===
  doc.setFillColor(10, 20, 30);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(0, 229, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('HB9OM On Field — DX-Spot Referenzen', margin, 13);

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleString('de-CH'), pageW - margin, 13, { align: 'right' });

  // === Filter-Info ===
  let y = 26;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Referenz-Filter: ${refFilter === 'All' ? 'Alle Referenzen' : (REF_LABELS[refFilter] || refFilter)}`, margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Anzahl Spots: ${spots.length} · Quelle: jo30.de + Spothole API · Stand: ${new Date().toLocaleString('de-CH')}`, margin, y);
  y += 6;

  // === Legende ===
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Spalten: Call | Referenz | Ref-Code | Frequenz | Band | Mode | Land | Distanz | Azimuth | Spotter | Quelle | Alter', margin, y);
  y += 6;

  // === Tabelle Header ===
  const headers = ['Call', 'Ref', 'Ref-Code', 'Freq (MHz)', 'Band', 'Mode', 'Land', 'Dist', 'Az', 'Spotter', 'Quelle', 'Age'];
  const colWidths = [22, 16, 28, 18, 12, 14, 30, 14, 12, 20, 22, 12];
  const rowH = 5;

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 3, colW, rowH, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  let x = margin;
  headers.forEach((h, i) => {
    doc.text(h, x + 1, y);
    x += colWidths[i];
  });
  y += rowH;

  // === Tabelle Daten ===
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  spots.forEach((spot, i) => {
    if (y > pageH - 15) {
      doc.addPage();
      y = 20;
      // Header auf neuer Seite
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 3, colW, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      let xh = margin;
      headers.forEach((h, j) => {
        doc.text(h, xh + 1, y);
        xh += colWidths[j];
      });
      y += rowH;
      doc.setFont('helvetica', 'normal');
    }

    // Zebra-Streifen
    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 3, colW, rowH, 'F');
    }

    const row = [
      spot.call || '—',
      spot.activity || '—',
      spot.activity_ref || '—',
      spot.frequency ? (spot.frequency / 1000).toFixed(3) : '—',
      spot.band || '—',
      spot.mode || '—',
      `${spot.countryCode || ''} ${spot.country || ''}`.trim() || '—',
      spot.distance > 0 ? `${spot.distance} km` : '—',
      spot.azimuth > 0 ? `${spot.azimuth}°` : '—',
      spot.spotter || '—',
      spot.source || '—',
      spot.age_seconds != null ? `${spot.age_seconds}s` : '—',
    ];

    x = margin;
    row.forEach((val, j) => {
      const truncated = String(val).length > 20 ? String(val).substring(0, 18) + '…' : String(val);
      doc.text(truncated, x + 1, y);
      x += colWidths[j];
    });
    y += rowH;
  });

  // === Footer ===
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Seite ${p} / ${pageCount}`, pageW - margin, pageH - 5, { align: 'right' });
    doc.text('HB9OM On Field — DX-Spot Referenzen (jo30.de + Spothole API)', margin, pageH - 5);
  }

  const filename = `dx-spot-referenzen-${refFilter === 'All' ? 'alle' : refFilter.toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}