import { jsPDF } from "jspdf";
import { MARKER_SHAPES } from "@/lib/markerShapes";
import { SECTIONS, MARKER_SYMBOLS, UI_ICONS, LINKS, SCREENSHOTS } from "@/lib/helpPdfContent";
import { getIconSvg } from "@/lib/helpPdfIcons";

// Farben
const NAVY = [11, 30, 51];
const GOLD = [217, 119, 6];
const GREEN = [5, 150, 105];
const RED = [220, 38, 38];
const BLUE = [59, 130, 246];
const GRAY = [100, 116, 139];
const LIGHT_GRAY = [245, 247, 250];
const TIP_BG = [236, 253, 245];
const TIP_BORDER = [5, 150, 105];
const WARN_BG = [254, 242, 242];
const WARN_BORDER = [220, 38, 38];
const WHITE = [255, 255, 255];

// ─── Bild-Helfer ───

async function loadImageData(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function svgToPng(svgString, size) {
  return new Promise((resolve) => {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ─── Zeichnungs-Helfer ───

function drawStepBox(doc, x, y, w, stepNum, stepData, color, iconImgs) {
  const text = typeof stepData === "string" ? stepData : stepData.text;
  const iconName = typeof stepData === "string" ? null : stepData.icon;
  const iconImg = iconName && iconImgs ? iconImgs[iconName] : null;

  const iconSpace = iconImg ? 10 : 0;
  const maxLineW = w - 14 - iconSpace;
  doc.setFontSize(7.5);
  const lines = doc.splitTextToSize(text, maxLineW);
  const h = Math.max(8, lines.length * 3.5 + 5);

  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(x, y, w, h, 1, 1, "F");
  doc.setFillColor(...color);
  doc.circle(x + 4, y + h / 2, 2.5, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(String(stepNum), x + 4, y + h / 2 + 0.7, { align: "center" });

  // App-Icon neben der Schritt-Nummer
  if (iconImg) {
    const iconSize = 7;
    const iconX = x + 7.5;
    const iconY = y + (h - iconSize) / 2;
    // Heller Kreis hinter dem Icon fuer bessere Sichtbarkeit
    doc.setFillColor(255, 255, 255);
    doc.circle(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2 + 0.5, "F");
    try {
      doc.addImage(iconImg, "PNG", iconX, iconY, iconSize, iconSize);
    } catch (e) {}
  }

  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const textX = x + 9 + iconSpace;
  for (let li = 0; li < lines.length; li++) {
    doc.text(lines[li], textX, y + 4 + li * 3.5);
  }
  return y + h + 1.5;
}

function drawTipBox(doc, x, y, w, text) {
  doc.setFontSize(7.5);
  const lines = doc.splitTextToSize(text, w - 8);
  const h = lines.length * 3.5 + 5;

  doc.setFillColor(...TIP_BG);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  doc.setDrawColor(...TIP_BORDER);
  doc.setLineWidth(0.3);
  doc.line(x, y + 1, x, y + h - 1);

  doc.setTextColor(...TIP_BORDER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Tipp", x + 3, y + 3.5);

  doc.setTextColor(30, 80, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  for (let li = 0; li < lines.length; li++) {
    doc.text(lines[li], x + 3, y + 6.5 + li * 3.5);
  }
  return y + h + 3;
}

function drawWarningBox(doc, x, y, w, text) {
  doc.setFontSize(7.5);
  const lines = doc.splitTextToSize(text, w - 8);
  const h = lines.length * 3.5 + 5;

  doc.setFillColor(...WARN_BG);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  doc.setDrawColor(...WARN_BORDER);
  doc.setLineWidth(0.3);
  doc.line(x, y + 1, x, y + h - 1);

  doc.setTextColor(...WARN_BORDER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Achtung", x + 3, y + 3.5);

  doc.setTextColor(120, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  for (let li = 0; li < lines.length; li++) {
    doc.text(lines[li], x + 3, y + 6.5 + li * 3.5);
  }
  return y + h + 3;
}

function drawClickableLink(doc, x, y, text, url, color) {
  doc.setTextColor(...color);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.textWithLink(text, x, y, { url: url });
  const textWidth = doc.getTextWidth(text);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(x, y + 0.5, x + textWidth, y + 0.5);
  return y + 4;
}

function drawMockup(doc, x, y, w, type, color) {
  const h = 30;
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "normal");

  if (type === "search") {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x + 2, y + 2, w - 4, 5, 1, 1, "F");
    doc.setTextColor(...GRAY);
    doc.setFontSize(6);
    doc.text("Referenz suchen... (HB/AG-001)", x + 3, y + 5.5);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(x + 2, y + 8, w - 4, 4, 0.5, 0.5, "F");
    doc.setTextColor(...color);
    doc.text("HB/AG-001  Uetliberg  (2.1 km)", x + 3, y + 11);
    doc.roundedRect(x + 2, y + 13, w - 4, 4, 0.5, 0.5, "F");
    doc.text("HB/AG-002  Buechberg  (5.3 km)", x + 3, y + 16);
    doc.setTextColor(...GRAY);
    doc.setFontSize(5);
    doc.text("Tipp: Nach Code, Name oder Ort suchen", x + 2, y + 22);
  } else if (type === "layers") {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x + 2, y + 2, w - 4, 24, 1, 1, "F");
    doc.setTextColor(...color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("Ebenen", x + 3, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const layers = [
      { label: "SOTA", checked: true },
      { label: "POTA", checked: true },
      { label: "HBFF", checked: false },
      { label: "Burgen", checked: true },
      { label: "IOTA", checked: false }
    ];
    layers.forEach((l, i) => {
      const ly = y + 9 + i * 3;
      if (l.checked) { doc.setTextColor(...color); } else { doc.setTextColor(...GRAY); }
      doc.text(l.checked ? "[x]" : "[ ]", x + 3, ly);
      doc.setTextColor(60, 60, 60);
      doc.text(l.label, x + 8, ly);
    });
  } else if (type === "gps") {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x + 2, y + 2, w - 4, 24, 1, 1, "F");
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("GPS-Position", x + 3, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Locator: JN36af", x + 3, y + 9);
    doc.text("WGS84: 47.3769 N, 8.5417 E", x + 3, y + 12);
    doc.text("LV95: E 2683000, N 1248000", x + 3, y + 15);
    doc.setTextColor(...GRAY);
    doc.text("Radius: [====o====] 2.5 km", x + 3, y + 18);
    doc.setFillColor(...BLUE);
    doc.roundedRect(x + 3, y + 20, 18, 4, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(5);
    doc.text("Navigieren zu", x + 5, y + 22.5);
  } else if (type === "qso") {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x + 2, y + 2, w - 4, 24, 1, 1, "F");
    doc.setTextColor(...color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("Neues QSO-Log", x + 3, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    const fields = [
      ["Rufzeichen:", "HB9XYZ", 8],
      ["Datum:", "2026-07-10", 13],
      ["Freq:", "144.500 MHz", 18],
      ["Band:", "2m  Mode: FM", 23]
    ];
    fields.forEach((f) => {
      const label = f[0], val = f[1], ly = f[2];
      doc.setTextColor(...GRAY);
      doc.text(label, x + 3, y + ly);
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(x + 14, y + ly - 3, w - 18, 4, 0.5, 0.5, "F");
      doc.setTextColor(60, 60, 60);
      doc.text(val, x + 15, y + ly - 0.3);
    });
    doc.setFillColor(...color);
    doc.roundedRect(x + 3, y + 25, 20, 4, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(5);
    doc.text("QSO speichern und weiter", x + 5, y + 27.5);
  } else if (type === "webdav") {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x + 2, y + 2, w - 4, 24, 1, 1, "F");
    doc.setTextColor(...color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("WebDAV (erweitert)", x + 3, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...GRAY);
    doc.text("WebDAV-URL:", x + 3, y + 9);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(x + 18, y + 7, w - 22, 3.5, 0.5, 0.5, "F");
    doc.text("https://cloud.../dav/", x + 19, y + 9.3);
    doc.text("Benutzer:", x + 3, y + 13);
    doc.roundedRect(x + 18, y + 11, w - 22, 3.5, 0.5, 0.5, "F");
    doc.text("Passwort:", x + 3, y + 17);
    doc.roundedRect(x + 18, y + 15, w - 22, 3.5, 0.5, 0.5, "F");
    doc.text("........", x + 19, y + 17.3);
    doc.setFillColor(...color);
    doc.roundedRect(x + 3, y + 20, 10, 4, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.text("Testen", x + 5, y + 22.5);
    doc.roundedRect(x + 14, y + 20, 10, 4, 1, 1, "F");
    doc.text("Speichern", x + 16, y + 22.5);
  }
  return y + h + 3;
}

function drawScreenLayout(doc, x, y, w, screenshotImg, labels) {
  const imgW = 50;
  const imgH = imgW * 1.78; // 9:16
  const labelX = x + imgW + 6;
  const labelW = w - imgW - 6;

  // Screenshot mit Rahmen
  doc.setFillColor(...NAVY);
  doc.roundedRect(x - 1.5, y - 1.5, imgW + 3, imgH + 5, 2, 2, "F");
  if (screenshotImg) {
    try {
      doc.addImage(screenshotImg, "JPEG", x, y, imgW, imgH);
    } catch (e) {
      doc.setFillColor(240, 240, 240);
      doc.rect(x, y, imgW, imgH, "F");
    }
  } else {
    doc.setFillColor(240, 240, 240);
    doc.rect(x, y, imgW, imgH, "F");
  }

  // Labels neben dem Screenshot
  let ly = y;
  for (const lbl of labels) {
    if (ly + 12 > y + imgH) break;
    // Nummern-Kreis
    doc.setFillColor(...NAVY);
    doc.circle(labelX + 3, ly + 2, 3, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(String(lbl.num), labelX + 3, ly + 3, { align: "center" });

    // Label-Text
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(lbl.label, labelX + 8, ly + 1);

    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const descLines = doc.splitTextToSize(lbl.desc, labelW - 8);
    for (let di = 0; di < Math.min(descLines.length, 2); di++) {
      doc.text(descLines[di], labelX + 8, ly + 5 + di * 3);
    }
    ly += 12;
  }

  return y + imgH + 4;
}

// ─── Hauptfunktion ───

export async function generateHelpPdf() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const MARGIN = 18;
  const CONTENT_W = W - 2 * MARGIN;
  let y = 0;

  const sectionPageMap = {};
  const tocEntries = [];
  const extraTocEntries = [];

  // Bilder vorab laden
  const screenshotImgs = {};
  for (const key of Object.keys(SCREENSHOTS)) {
    screenshotImgs[key] = await loadImageData(SCREENSHOTS[key]);
  }

  // Marker-Symbole als PNG laden
  const markerImgs = {};
  for (const ms of MARKER_SYMBOLS) {
    const shape = MARKER_SHAPES[ms.shape];
    if (shape) {
      markerImgs[ms.shape] = await svgToPng(shape.svg(ms.color), 120);
    }
  }

  // Lucide-App-Icons als PNG laden
  const iconImgs = {};      // Navy-Version fuer Schritt-fuer-Schritt
  const iconImgsWhite = {}; // Weiss-Version fuer farbige Buttons
  const allIconNames = new Set();
  for (const ms of MARKER_SYMBOLS) allIconNames.add(ms.icon);
  for (const ic of UI_ICONS) allIconNames.add(ic.icon);
  for (const sec of SECTIONS) {
    for (const item of sec.items) {
      if (item.steps) {
        for (const s of item.steps) {
          if (typeof s === "object" && s.icon) allIconNames.add(s.icon);
        }
      }
    }
  }
  for (const name of allIconNames) {
    const svgNavy = getIconSvg(name, "#0b1e33");
    iconImgs[name] = await svgToPng(svgNavy, 96);
    const svgWhite = getIconSvg(name, "#ffffff");
    iconImgsWhite[name] = await svgToPng(svgWhite, 96);
  }

  const checkPage = (needed) => {
    if (y + needed > H - 20) {
      addFooter();
      doc.addPage();
      y = 20;
      addHeader();
    }
  };

  const addHeader = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 12, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("HB9OM On Field - Interaktive Hilfe", MARGIN, 8);
    doc.setTextColor(...GOLD);
    doc.textWithLink("hb9om.ch", W - MARGIN - 15, 8, { url: "https://hb9om.ch" });
  };

  const addFooter = () => {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(...NAVY);
    doc.rect(0, pageHeight - 12, W, 12, "F");
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const pageNum = doc.internal.getNumberOfPages();
    doc.text("hb9om.ch  -  Interaktive Hilfe und Anleitung", W / 2, pageHeight - 5, { align: "center" });
    doc.text("Seite " + pageNum, W - MARGIN, pageHeight - 5, { align: "right" });
  };

  // ─── COVER SEITE ───
  if (screenshotImgs.hero) {
    try {
      doc.addImage(screenshotImgs.hero, "JPEG", 0, 0, W, 85);
    } catch (e) {
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 85, "F");
    }
  } else {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 85, "F");
  }
  // Navy-Band fuer Textlesbarkeit
  doc.setFillColor(...NAVY);
  doc.rect(0, 25, W, 60, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.text("HB9OM", MARGIN, 35);
  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD);
  doc.text("On Field", MARGIN + 60, 35);

  doc.setTextColor(220, 220, 220);
  doc.setFontSize(11);
  doc.text("Interaktive Hilfe und Anleitung", MARGIN, 48);
  doc.setFontSize(9);
  doc.text("Die exklusive Amateurfunk-App für Referenzen und QSO-Logbuch", MARGIN, 55);
  doc.text("SOTA - POTA - HBFF - WWBOTA - Burgen - Leuchttürme - IOTA", MARGIN, 61);

  doc.setFillColor(...GOLD);
  doc.roundedRect(W - 65, 10, 47, 10, 1.5, 1.5, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("INTERAKTIVE HILFE", W - 41.5, 16, { align: "center" });

  // Tipp-Box auf Cover
  y = 95;
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Klickbare Elemente", MARGIN + 3, y + 4);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Diese PDF enthält klickbare Links zu externen Ressourcen (blau unterstrichen).", MARGIN + 3, y + 8);
  doc.text("Im Inhaltsverzeichnis springen die Einträge direkt zur jeweiligen Seite.", MARGIN + 3, y + 11);

  // Inhaltsverzeichnis
  y = 120;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Inhalt dieser Anleitung", MARGIN, y);
  y += 3;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, MARGIN + 55, y);
  y += 8;

  // Hauptabschnitte
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    tocEntries.push({ index: i, y: y });

    doc.setFillColor(...s.color);
    doc.circle(MARGIN + 3, y + 2, 3.5, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(s.letter, MARGIN + 3, y + 3.5, { align: "center" });

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(s.title, MARGIN + 10, y + 1);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(s.items.length + " Themen mit Schritt-für-Schritt Anleitungen", MARGIN + 10, y + 6);

    y += 12;
  }

  // Zusaetzliche Seiten
  const extraPages = [
    { title: "Symbole und Icons", desc: "Alle Marker-Symbole und UI-Icons", color: NAVY, icon: "S" },
    { title: "App-Eindrücke", desc: "Echte Screenshots aus der App", color: GOLD, icon: "A" }
  ];
  for (const ep of extraPages) {
    extraTocEntries.push({ y: y });
    doc.setFillColor(...ep.color);
    doc.circle(MARGIN + 3, y + 2, 3.5, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(ep.icon, MARGIN + 3, y + 3.5, { align: "center" });

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(ep.title, MARGIN + 10, y + 1);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(ep.desc, MARGIN + 10, y + 6);
    y += 12;
  }

  // Quick Links
  y += 4;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Direktlinks zu Referenz-Listen:", MARGIN, y);
  y += 6;

  const quickLinks = [
    { label: "SOTA-Gipfel", url: LINKS.sota },
    { label: "POTA-Parks", url: LINKS.pota },
    { label: "HBFF-Referenzen", url: LINKS.hbff },
    { label: "WWBOTA-Bunker", url: LINKS.wwbota },
    { label: "Burgen und Schlösser", url: LINKS.wca },
    { label: "IOTA-Inseln", url: LINKS.iota },
    { label: "Leuchttürme (ARLHS)", url: LINKS.arlhs },
    { label: "BAKOM-Frequenzplan", url: LINKS.bakom }
  ];
  let colX = MARGIN;
  let linkY = y;
  quickLinks.forEach((ql, i) => {
    if (i === 4) { colX = MARGIN + 90; linkY = y; }
    linkY = drawClickableLink(doc, colX, linkY, "> " + ql.label, ql.url, [30, 64, 175]);
  });
  y = linkY + 4;

  addFooter();

  // ─── SYMBOLE & ICONS SEITE ───
  doc.addPage();
  const symbolsPageNum = doc.internal.getNumberOfPages();
  y = 20;
  addHeader();

  doc.setFillColor(...NAVY);
  doc.rect(0, 12, W, 16, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Symbole und Icons in der App", MARGIN, 23);
  y = 38;

  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const symIntro = "Jeder Referenz-Typ hat in der App zwei Darstellungen: das App-Icon (Lucide-Icon, sichtbar im Ebenen-Menü und in der Legende) und das Karten-Marker-Symbol (sichtbar auf der Karte). Beide werden hier nebeneinander gezeigt:";
  const symIntroLines = doc.splitTextToSize(symIntro, CONTENT_W);
  for (const line of symIntroLines) {
    doc.text(line, MARGIN, y);
    y += 4;
  }
  y += 4;

  // Spalten-Header
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("App-Icon  /  Karten-Marker  -  Referenz-Typ und Beschreibung", MARGIN, y);
  y += 5;

  // Symbol-Tabelle: 2 Spalten, 4 Zeilen
  // Zeigt Lucide-Icon (App) + Marker-Shape (Karte) nebeneinander
  const symColW = (CONTENT_W - 6) / 2;
  const symRowH = 26;
  const iconSz = 10;
  const shapeSz = 10;

  for (let i = 0; i < MARKER_SYMBOLS.length; i++) {
    const ms = MARKER_SYMBOLS[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = MARGIN + col * (symColW + 6);
    const sy = y + row * (symRowH + 2);

    if (i === 0 || i === 2 || i === 4 || i === 6) {
      checkPage(symRowH * 2 + 6);
    }

    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(sx, sy, symColW, symRowH, 1.5, 1.5, "F");

    // Lucide-App-Icon (links)
    if (iconImgs[ms.icon]) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(sx + 2, sy + 3, iconSz + 2, iconSz + 2, 1, 1, "F");
        doc.addImage(iconImgs[ms.icon], "PNG", sx + 3, sy + 4, iconSz, iconSz);
      } catch (e) {}
    }
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.text("App", sx + 3 + iconSz / 2, sy + 2.5, { align: "center" });

    // Marker-Shape (Karte) daneben
    if (markerImgs[ms.shape]) {
      try {
        doc.addImage(markerImgs[ms.shape], "PNG", sx + 3 + iconSz + 3, sy + 4, shapeSz, shapeSz);
      } catch (e) {}
    }
    doc.text("Karte", sx + 3 + iconSz + 3 + shapeSz / 2, sy + 2.5, { align: "center" });

    // Name und Beschreibung rechts daneben
    const textX = sx + 3 + iconSz + 3 + shapeSz + 4;
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(ms.name, textX, sy + 7);

    // Farb-Farbblatt
    const rgb = hexToRgb(ms.color);
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(sx + symColW - 8, sy + 4, 5, 5, 0.5, 0.5, "F");

    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const descLines = doc.splitTextToSize(ms.desc, symColW - (textX - sx) - 10);
    for (let dl = 0; dl < Math.min(descLines.length, 3); dl++) {
      doc.text(descLines[dl], textX, sy + 11 + dl * 3.2);
    }
  }

  y += 4 * (symRowH + 2) + 4;

  // UI-Icons mit echten App-Icons
  checkPage(60);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Werkzeug-Icons (wie in der App):", MARGIN, y);
  y += 5;
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Diese Icons sehen Sie auf der Karte und in den Bedienelementen - exakt wie in der App:", MARGIN, y);
  y += 5;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, MARGIN + 50, y);
  y += 5;

  // UI-Icons: 2 Spalten mit echten App-Icons in farbigen Buttons
  const uiColW = (CONTENT_W - 6) / 2;
  const uiRowH = 16;
  for (let i = 0; i < UI_ICONS.length; i++) {
    const ic = UI_ICONS[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = MARGIN + col * (uiColW + 6);
    const sy = y + row * (uiRowH + 1.5);

    if (i % 4 === 0) {
      checkPage(uiRowH * 2 + 6);
    }

    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(sx, sy, uiColW, uiRowH, 1.5, 1.5, "F");

    // Farbiger Button mit weissem Icon (wie in der App)
    const btnSize = 10;
    doc.setFillColor(...ic.color);
    doc.roundedRect(sx + 2, sy + 3, btnSize, btnSize, 1.5, 1.5, "F");
    if (iconImgsWhite[ic.icon]) {
      try {
        doc.addImage(iconImgsWhite[ic.icon], "PNG", sx + 3, sy + 4, btnSize - 2, btnSize - 2);
      } catch (e) {}
    }

    // Name und Beschreibung
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(ic.name, sx + 2 + btnSize + 3, sy + 6);
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const icDescLines = doc.splitTextToSize(ic.desc, uiColW - btnSize - 8);
    for (let dl = 0; dl < Math.min(icDescLines.length, 2); dl++) {
      doc.text(icDescLines[dl], sx + 2 + btnSize + 3, sy + 10 + dl * 3);
    }
  }
  y += Math.ceil(UI_ICONS.length / 2) * (uiRowH + 1.5) + 4;

  addFooter();

  // ─── SCREENSHOT-GALERIE ───
  doc.addPage();
  const screenshotsPageNum = doc.internal.getNumberOfPages();
  y = 20;
  addHeader();

  doc.setFillColor(...NAVY);
  doc.rect(0, 12, W, 16, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("App-Eindrücke", MARGIN, 23);
  y = 38;

  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Hier sehen Sie echte Screenshots aus der App:", MARGIN, y);
  y += 6;

  // Erste Reihe: 3 Screenshots
  const sw = 52, sh = 93;
  const gap = 6;
  const startX = (W - 3 * sw - 2 * gap) / 2;
  const screens1 = [
    { img: screenshotImgs.map, label: "Karte und Referenzen" },
    { img: screenshotImgs.qso, label: "QSO-Formular" },
    { img: screenshotImgs.stats, label: "Statistik" }
  ];

  for (let i = 0; i < screens1.length; i++) {
    const sx = startX + i * (sw + gap);
    doc.setFillColor(...NAVY);
    doc.roundedRect(sx - 1.5, y - 1.5, sw + 3, sh + 8, 2, 2, "F");
    if (screens1[i].img) {
      try {
        doc.addImage(screens1[i].img, "JPEG", sx, y, sw, sh);
      } catch (e) {
        doc.setFillColor(240, 240, 240);
        doc.rect(sx, y, sw, sh, "F");
      }
    } else {
      doc.setFillColor(240, 240, 240);
      doc.rect(sx, y, sw, sh, "F");
    }
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(screens1[i].label, sx + sw / 2, y + sh + 4, { align: "center" });
  }

  y += sh + 12;

  // Zweite Reihe: Settings + Map Overview
  const sw2 = 52, sh2 = 93;
  const startX2 = (W - 2 * sw2 - gap) / 2;
  const screens2 = [
    { img: screenshotImgs.settings, label: "Einstellungen" },
    { img: screenshotImgs.mapOverview, label: "Karten-Übersicht" }
  ];

  for (let i = 0; i < screens2.length; i++) {
    const sx = startX2 + i * (sw2 + gap);
    doc.setFillColor(...NAVY);
    doc.roundedRect(sx - 1.5, y - 1.5, sw2 + 3, sh2 + 8, 2, 2, "F");
    if (screens2[i].img) {
      try {
        doc.addImage(screens2[i].img, "JPEG", sx, y, sw2, sh2);
      } catch (e) {
        doc.setFillColor(240, 240, 240);
        doc.rect(sx, y, sw2, sh2, "F");
      }
    } else {
      doc.setFillColor(240, 240, 240);
      doc.rect(sx, y, sw2, sh2, "F");
    }
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(screens2[i].label, sx + sw2 / 2, y + sh2 + 4, { align: "center" });
  }

  y += sh2 + 12;

  doc.setTextColor(...GRAY);
  doc.setFontSize(7.5);
  doc.text("Tipp: Die Screenshots zeigen die Hauptansichten der App - Karte, QSO-Formular, Statistik und Einstellungen.", MARGIN, y);

  addFooter();

  // ─── INHALT SEITEN ───
  for (let si = 0; si < SECTIONS.length; si++) {
    const section = SECTIONS[si];
    doc.addPage();
    const sectionPageNum = doc.internal.getNumberOfPages();
    sectionPageMap[si] = sectionPageNum;
    y = 20;
    addHeader();

    // Abschnitts-Header
    doc.setFillColor(...section.color);
    doc.rect(0, 12, W, 16, "F");
    doc.setFillColor(...NAVY);
    doc.circle(MARGIN + 5, 20, 4, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(section.letter, MARGIN + 5, 21.5, { align: "center" });
    doc.setTextColor(...WHITE);
    doc.setFontSize(13);
    doc.text(section.title, MARGIN + 12, 23);
    y = 38;

    for (const item of section.items) {
      checkPage(35);

      // Item-Titel
      doc.setTextColor(...section.color);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      const titleLines = doc.splitTextToSize(item.title, CONTENT_W);
      for (const tl of titleLines) {
        checkPage(6);
        doc.text(tl, MARGIN, y);
        y += 4;
      }

      // Trennlinie
      doc.setDrawColor(...section.color);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 0.5, MARGIN + CONTENT_W, y + 0.5);
      y += 4;

      // Body-Text
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const bodyLines = doc.splitTextToSize(item.body, CONTENT_W);
      for (const line of bodyLines) {
        checkPage(6);
        doc.text(line, MARGIN, y);
        y += 4;
      }
      y += 3;

      // Screen-Layout
      if (item.screenLayout && screenshotImgs[item.screenLayout]) {
        checkPage(100);
        y = drawScreenLayout(doc, MARGIN, y, CONTENT_W, screenshotImgs[item.screenLayout], item.layoutLabels || []);
        y += 4;
      }

      // Schritt-für-Schritt
      if (item.steps && item.steps.length > 0) {
        checkPage(item.steps.length * 9 + 5);
        doc.setTextColor(...section.color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Schritt-für-Schritt:", MARGIN, y);
        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.text("(Icons = App-Buttons)", MARGIN + 32, y);
        y += 4;

        for (let i = 0; i < item.steps.length; i++) {
          checkPage(12);
          y = drawStepBox(doc, MARGIN, y, CONTENT_W, i + 1, item.steps[i], section.color, iconImgs);
        }
        y += 2;
      }

      // Mockup
      if (item.mockup) {
        checkPage(35);
        y = drawMockup(doc, MARGIN, y, CONTENT_W, item.mockup, section.color);
      }

      // Echter Screenshot
      if (item.screenshot && screenshotImgs[item.screenshot] && !item.screenLayout) {
        checkPage(60);
        const scrW = CONTENT_W * 0.45;
        const scrH = scrW * 1.78;
        const scrX = MARGIN + (CONTENT_W - scrW) / 2;
        doc.setFillColor(...NAVY);
        doc.roundedRect(scrX - 1.5, y - 1.5, scrW + 3, scrH + 5, 2, 2, "F");
        try {
          doc.addImage(screenshotImgs[item.screenshot], "JPEG", scrX, y, scrW, scrH);
        } catch (e) {
          doc.setFillColor(240, 240, 240);
          doc.rect(scrX, y, scrW, scrH, "F");
        }
        doc.setTextColor(...GRAY);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text("Screenshot aus der App", scrX + scrW / 2, y + scrH + 3.5, { align: "center" });
        y += scrH + 6;
      }

      // Links
      if (item.links && item.links.length > 0) {
        checkPage(item.links.length * 5 + 4);
        doc.setTextColor(...section.color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Weiterführende Links:", MARGIN, y);
        y += 4;
        for (const link of item.links) {
          checkPage(6);
          y = drawClickableLink(doc, MARGIN + 2, y, "-> " + link.label, link.url, [30, 64, 175]);
        }
        y += 2;
      }

      // Tipp-Box
      if (item.tip) {
        checkPage(15);
        y = drawTipBox(doc, MARGIN, y, CONTENT_W, item.tip);
      }

      // Warn-Box
      if (item.warning) {
        checkPage(15);
        y = drawWarningBox(doc, MARGIN, y, CONTENT_W, item.warning);
      }

      // Trennlinie zwischen Items
      checkPage(5);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
      y += 5;
    }

    addFooter();
  }

  // ─── KONTAKT SEITE ───
  doc.addPage();
  y = 20;
  addHeader();

  doc.setFillColor(...NAVY);
  doc.rect(0, 12, W, 16, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Kontakt und Informationen", MARGIN, 23);
  y = 40;

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Club HB9OM", MARGIN, y);
  y += 6;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + 35, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.textWithLink("E-Mail: hb9om@hb9om.ch", MARGIN, y, { url: LINKS.email });
  y += 6;
  doc.textWithLink("Web: hb9om.ch", MARGIN, y, { url: "https://hb9om.ch" });
  y += 10;

  // Spenden-Box
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 2, 2, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Diese App unterstützen", MARGIN + 3, y + 5);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Wenn Ihnen diese App gefällt, freuen wir uns über eine kleine Spende.", MARGIN + 3, y + 9);
  doc.text("Jeder Beitrag hilft, die App weiterzuentwickeln und zu verbessern.", MARGIN + 3, y + 12.5);
  y += 16;
  doc.textWithLink("-> Über PayPal spenden (paypal.me/Thueler)", MARGIN + 3, y, { url: LINKS.paypal });
  y += 12;

  // Rechtlicher Hinweis - Eigenverantwortung
  checkPage(40);
  doc.setFillColor(...WARN_BG);
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 2, 2, "F");
  doc.setDrawColor(...WARN_BORDER);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y + 1, MARGIN, y + 27);
  doc.setTextColor(...WARN_BORDER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Keine rechtliche Grundlage - Eigenverantwortung", MARGIN + 3, y + 5);
  doc.setTextColor(120, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const legalText1 = "Du bist lizenzierter Funkamateur und du musst selber wissen, was du machst und was du machen darfst. Darum hast du ja eine Pruefung gemacht. Also heule nicht, wenn du was falsch machst - du bist erwachsen.";
  const legalLines1 = doc.splitTextToSize(legalText1, CONTENT_W - 6);
  for (const line of legalLines1) {
    doc.text(line, MARGIN + 3, y + 10);
    y += 3.5;
  }
  y -= legalLines1.length * 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 30, 30);
  const legalText2 = "Diese App und der enthaltene Bandplan dienen ausschliesslich als praktische Orientierungshilfe und stellen keine rechtsverbindliche Grundlage dar. Massgeblich ist stets der offizielle Frequenzplan des BAKOM (Bundesamt fuer Kommunikation). Die USKA hat lediglich eine visuelle Aufbereitung erstellt.";
  const legalLines2 = doc.splitTextToSize(legalText2, CONTENT_W - 6);
  for (let li = 0; li < legalLines2.length; li++) {
    doc.text(legalLines2[li], MARGIN + 3, y + 14 + li * 3.2);
  }
  y += 28 + 4;

  // Haftungsausschluss
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Haftungsausschluss", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const disclaimer = "Diese App wird ohne jegliche Gewährleistung bereitgestellt. Es wird keine Haftung für Fehler, Datenverluste oder andere Probleme übernommen. Die Daten stammen aus öffentlichen Quellen (SOTA, POTA, HBFF, WWBOTA, WCA, ARLHS, BFE, BAKOM, BAFU) und können unvollständig oder veraltet sein.";
  const dLines = doc.splitTextToSize(disclaimer, CONTENT_W);
  for (const line of dLines) {
    checkPage(6);
    doc.text(line, MARGIN, y);
    y += 4;
  }

  addFooter();

  // ─── KLICKBARE TOC LINKS ───
  for (let i = 0; i < SECTIONS.length; i++) {
    const entry = tocEntries[i];
    const targetPage = sectionPageMap[i];
    if (targetPage) {
      doc.link(MARGIN, entry.y - 2, CONTENT_W, 10, { pageNumber: targetPage });
    }
  }
  if (extraTocEntries[0] && symbolsPageNum) {
    doc.link(MARGIN, extraTocEntries[0].y - 2, CONTENT_W, 10, { pageNumber: symbolsPageNum });
  }
  if (extraTocEntries[1] && screenshotsPageNum) {
    doc.link(MARGIN, extraTocEntries[1].y - 2, CONTENT_W, 10, { pageNumber: screenshotsPageNum });
  }

  doc.save("HB9OM_On_Field_Hilfe.pdf");
}