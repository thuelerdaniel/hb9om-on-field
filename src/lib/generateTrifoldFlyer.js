import { jsPDF } from "jspdf";

const HERO_IMAGE_URL = "https://media.base44.com/images/public/6a4a64185561a655062a41bf/b2f8036bf_generated_image.png";
const SCREEN_MAP = "https://media.base44.com/images/public/6a4a64185561a655062a41bf/51001fde7_generated_image.png";
const SCREEN_QSO = "https://media.base44.com/images/public/6a4a64185561a655062a41bf/f63bcb32e_generated_image.png";
const SCREEN_STATS = "https://media.base44.com/images/public/6a4a64185561a655062a41bf/9dd11427e_generated_image.png";

const NAVY = [11, 30, 51];
const GOLD = [217, 119, 6];
const GREEN = [5, 150, 105];
const RED = [220, 38, 38];
const GRAY = [100, 116, 139];
const WHITE = [255, 255, 255];

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
      try { resolve(canvas.toDataURL("image/jpeg", 0.82)); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function generateTrifoldFlyer(options = {}) {
  const { returnBlob = false } = options;
  // A4 Landscape: 297 × 210 mm, 3 panels of 99mm each
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = 297, H = 210;
  const PW = 99; // panel width

  const [heroImg, screenMap, screenQso, screenStats] = await Promise.all([
    loadImageData(HERO_IMAGE_URL),
    loadImageData(SCREEN_MAP),
    loadImageData(SCREEN_QSO),
    loadImageData(SCREEN_STATS),
  ]);

  // Helper: draw panel divider (folding line)
  const drawFoldLine = (x) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(x, 0, x, H);
    doc.setLineDashPattern([], 0);
  };

  // ========================================================
  // PAGE 1 (OUTSIDE): [Back | Front Cover | Right Fold-in]
  // ========================================================

  // --- PANEL 1 (x=0-99): BACK OF BROCHURE ---
  // Contact info + CTA
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, H, "F");

  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("HB9OM", PW / 2, 20, { align: "center" });
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("On Field", PW / 2, 27, { align: "center" });

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(30, 33, 69, 33);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Amateurfunk\nReferenzkarte\n& QSO-Logbuch", PW / 2, 42, { align: "center", lineHeightFactor: 1.4 });

  // Contact block
  let yc = 70;
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("KONTAKT", PW / 2, yc, { align: "center" });
  yc += 6;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(35, yc, 64, yc);
  yc += 8;
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Club HB9OM", PW / 2, yc, { align: "center" });
  yc += 5;
  doc.text("hb9om@hb9om.ch", PW / 2, yc, { align: "center" });
  yc += 5;
  doc.text("hb9om.online", PW / 2, yc, { align: "center" });

  // CTA box
  yc = 110;
  doc.setFillColor(...GOLD);
  doc.roundedRect(12, yc, 75, 28, 2, 2, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Jetzt", PW / 2, yc + 9, { align: "center" });
  doc.text("durchstarten!", PW / 2, yc + 15, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Kostenlos registrieren", PW / 2, yc + 22, { align: "center" });

  // Version footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(6);
  doc.text("v0.9004 · Made in Switzerland", PW / 2, H - 8, { align: "center" });

  drawFoldLine(PW);

  // --- PANEL 2 (x=99-198): FRONT COVER ---
  const cx = PW; // panel start x
  if (heroImg) {
    doc.addImage(heroImg, "JPEG", cx, 0, PW, 70);
  } else {
    doc.setFillColor(...NAVY);
    doc.rect(cx, 0, PW, 70, "F");
  }

  // Navy overlay on lower part of cover
  doc.setFillColor(...NAVY);
  doc.rect(cx, 50, PW, 50, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("HB9OM", cx + PW / 2, 68, { align: "center" });
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD);
  doc.text("On Field", cx + PW / 2, 76, { align: "center" });

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text("Die exklusive Amateurfunk-App", cx + PW / 2, 84, { align: "center" });
  doc.text("für Referenzen & QSO-Logbuch", cx + PW / 2, 89, { align: "center" });

  // Gold badge
  doc.setFillColor(...GOLD);
  doc.roundedRect(cx + 22, 6, 55, 10, 1.5, 1.5, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("EXKLUSIV IN DER SCHWEIZ", cx + PW / 2, 12.5, { align: "center" });

  // Key features teaser on cover lower half
  let yf = 100;
  const coverUsps = [
    { icon: "★", color: GOLD, text: "SOTA · POTA · WWFF · WWBOTA" },
    { icon: "◈", color: GREEN, text: "SwissTopo-Karten" },
    { icon: "◉", color: RED, text: "QRZ.com-Integration" },
    { icon: "▼", color: NAVY, text: "Offline-Fähig" },
  ];
  for (const u of coverUsps) {
    doc.setFillColor(...u.color);
    doc.circle(cx + 12, yf + 2, 3, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(u.icon, cx + 12, yf + 3.2, { align: "center" });
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(u.text, cx + 18, yf + 3);
    yf += 8;
  }

  // QR-like placeholder box
  yf += 4;
  doc.setFillColor(...NAVY);
  doc.roundedRect(cx + 15, yf, 69, 25, 1.5, 1.5, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("hb9om.online", cx + PW / 2, yf + 10, { align: "center" });
  doc.setTextColor(180, 180, 180);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("Referenzen · Logbuch · Hunting", cx + PW / 2, yf + 16, { align: "center" });
  doc.text("Offline-Karten · Propagation", cx + PW / 2, yf + 20, { align: "center" });

  drawFoldLine(PW * 2);

  // --- PANEL 3 (x=198-297): RIGHT FOLD-IN (visible when opening) ---
  const rx = PW * 2;
  doc.setFillColor(248, 250, 252);
  doc.rect(rx, 0, PW, H, "F");

  // Header
  doc.setFillColor(...GREEN);
  doc.rect(rx, 0, PW, 14, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Warum diese App?", rx + PW / 2, 9, { align: "center" });

  let yr = 22;
  const reasons = [
    { t: "Alle Referenzen vereint", d: "SOTA, POTA, WWFF, WWBOTA, Burgen, Leuchttürme, IOTA & Bundesinventare in einer App." },
    { t: "SwissTopo-Karten", d: "Offizielle Landeskarten in 4 Massstäben direkt in der App." },
    { t: "QRZ.com-Integration", d: "Persönliche Zugangsdaten pro Benutzer. Club-Subscription für Admins." },
    { t: "Offline-Fähig", d: "Karten herunterladen, QSOs lokal speichern, im Feld ohne Empfang." },
    { t: "Hunting & DX-Spots", d: "Live DX-Spots, Propagation, Fox Hunting mit Peilung." },
  ];

  for (const r of reasons) {
    doc.setFillColor(...GOLD);
    doc.circle(rx + 10, yr + 2, 2.5, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("▸", rx + 10, yr + 3, { align: "center" });
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(r.t, rx + 16, yr + 3);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const lines = doc.splitTextToSize(r.d, 78);
    doc.text(lines, rx + 16, yr + 7);
    yr += 7 + lines.length * 3.2 + 5;
  }

  // Screenshot on fold-in
  if (screenMap) {
    const sw = 50, sh = 35;
    const sx = rx + (PW - sw) / 2;
    doc.setFillColor(...NAVY);
    doc.roundedRect(sx - 1, yr, sw + 2, sh + 5, 1, 1, "F");
    doc.addImage(screenMap, "JPEG", sx, yr + 1, sw, sh);
    doc.setTextColor(...GRAY);
    doc.setFontSize(5.5);
    doc.text("Karte & Referenzen", rx + PW / 2, yr + sh + 4, { align: "center" });
  }

  // ========================================================
  // PAGE 2 (INSIDE): [Left | Center | Right]
  // ========================================================
  doc.addPage();

  // --- PANEL 4 (x=0-99): FEATURES PART 1 ---
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, PW, 12, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("KARTE & REFERENZEN", PW / 2, 8, { align: "center" });

  let y4 = 18;
  const mapFeatures = [
    "SOTA · POTA · WWFF · WWBOTA",
    "Burgen & Schlösser · TOTA",
    "Leuchttürme (ARLHS WLOL)",
    "IOTA Inseln weltweit",
    "Bundesinventare (Auen, Moore)",
    "SwissTopo-Karten: 4 Massstäbe",
    "GPS mit Radius-Suche (100m–10km)",
    "Layer ein-/ausschalten",
    "Offline-Karten für den Feldeinsatz",
    "Gefahren & Störquellen (map.admin.ch)",
    "GPS-Tracking (30s–1h Intervall)",
    "Eigene Abdeckung: Terrain-LOS (SRTM)",
    "Öffentliche Position teilen",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  for (const item of mapFeatures) {
    doc.setTextColor(...GREEN);
    doc.text("▸", 6, y4);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(item, 84);
    doc.text(lines, 10, y4);
    y4 += lines.length * 3.2 + 1.5;
  }

  // QSO-Logbuch section
  y4 += 3;
  doc.setFillColor(...RED);
  doc.rect(0, y4 - 3, PW, 8, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("QSO-LOGBUCH", PW / 2, y4 + 2, { align: "center" });
  y4 += 8;
  const logFeatures = [
    "QSO-Erfassung mit allen ADIF-Feldern",
    "QRZ.com-Abfrage pro Benutzer",
    "Band & Frequenz automatisch synchron",
    "Clubstation-Modus mit Operator",
    "ADIF-Export (HRDLog, N1MM, Log4OM)",
    "Statistik: QSOs pro Band/Mode/Monat",
    "Cloud-Backup: WebDAV (Nextcloud)",
    "Wake-Lock: Bildschirm bleibt an",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  for (const item of logFeatures) {
    doc.setTextColor(...RED);
    doc.text("▸", 6, y4);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(item, 84);
    doc.text(lines, 10, y4);
    y4 += lines.length * 3.2 + 1.5;
  }

  drawFoldLine(PW);

  // --- PANEL 5 (x=99-198): HUNTING + SCREENSHOTS ---
  const cx2 = PW;
  doc.setFillColor(245, 158, 11);
  doc.rect(cx2, 0, PW, 12, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("HUNTING & DX-SPOTS", cx2 + PW / 2, 8, { align: "center" });

  let y5 = 18;
  const huntFeatures = [
    "Live DX-Spots (DX-Cluster + Spothole)",
    "SOTA/POTA/WWFF/WWBOTA Aktivierungen",
    "Propagation: Solar Flux, K-Index, MUF",
    "Fox Hunting mit Peilung & Triangulation",
    "3D-Weltkugel mit ISS & Mond",
    "QSO direkt aus Spot loggen",
    "QRZ-Lookup aus Spot-Tabelle",
    "GPS-basierte Distanz & Azimuth",
    "Alerts: SOTA-Alerts + WWFF-Agendas",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  for (const item of huntFeatures) {
    doc.setTextColor(...GOLD);
    doc.text("▸", cx2 + 6, y5);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(item, 84);
    doc.text(lines, cx2 + 10, y5);
    y5 += lines.length * 3.2 + 1.5;
  }

  // Screenshots
  y5 += 2;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("App-Eindrücke", cx2 + PW / 2, y5, { align: "center" });
  y5 += 3;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(cx2 + 35, y5, cx2 + 64, y5);
  y5 += 4;

  const sw2 = 26, sh2 = 46;
  const gap2 = 4;
  const startX2 = cx2 + (PW - 3 * sw2 - 2 * gap2) / 2;
  const screens2 = [
    { img: screenQso, label: "QSO-Formular" },
    { img: screenStats, label: "Statistik" },
    { img: screenMap, label: "Karte" },
  ];
  for (let i = 0; i < 3; i++) {
    const sx = startX2 + i * (sw2 + gap2);
    doc.setFillColor(...NAVY);
    doc.roundedRect(sx - 0.8, y5 - 0.8, sw2 + 1.6, sh2 + 4, 1, 1, "F");
    if (screens2[i].img) {
      doc.addImage(screens2[i].img, "JPEG", sx, y5, sw2, sh2);
    }
    doc.setTextColor(...WHITE);
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.text(screens2[i].label, sx + sw2 / 2, y5 + sh2 + 2.5, { align: "center" });
  }

  drawFoldLine(PW * 2);

  // --- PANEL 6 (x=198-297): EXCLUSIVITY + CTA ---
  const rx2 = PW * 2;
  doc.setFillColor(...NAVY);
  doc.rect(rx2, 0, PW, 14, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("EINZIGARTIG", rx2 + PW / 2, 9, { align: "center" });

  let y6 = 20;
  const exclusives2 = [
    "Alle Schweizer Referenzprogramme in einer App",
    "SwissTopo-Karten in 4 Massstäben",
    "Gefahren-Layer über map.geo.admin.ch",
    "QRZ.com pro Benutzer + Club-Subscription",
    "BrandMeister API: DMR-Relais weltweit",
    "RepeaterBook API-Token Sync",
    "Terrain-LOS Abdeckung (SRTM 30m)",
    "Wavelog-Integration (LAN/WAN)",
    "Vollständig offline-fähig",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  for (const item of exclusives2) {
    doc.setTextColor(...GREEN);
    doc.setFont("helvetica", "bold");
    doc.text("✓", rx2 + 6, y6);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(item, 82);
    doc.text(lines, rx2 + 10, y6);
    y6 += lines.length * 3.2 + 2;
  }

  // CTA
  y6 += 3;
  doc.setFillColor(...GOLD);
  doc.roundedRect(rx2 + 10, y6, 79, 22, 2, 2, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Kostenlos starten", rx2 + PW / 2, y6 + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Registrieren unter hb9om.online", rx2 + PW / 2, y6 + 14, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("hb9om.online", rx2 + PW / 2, y6 + 19, { align: "center" });

  // Footer
  doc.setFillColor(...NAVY);
  doc.rect(rx2, H - 10, PW, 10, "F");
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("HB9OM On Field · v0.9004", rx2 + PW / 2, H - 4, { align: "center" });

  if (returnBlob) {
    return doc.output("blob");
  }
  doc.save("HB9OM_On_Field_Faltflyer.pdf");
}