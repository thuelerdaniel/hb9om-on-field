import { jsPDF } from "jspdf";

const HERO_IMAGE_URL = "https://media.base44.com/images/public/6a4a64185561a655062a41bf/b2f8036bf_generated_image.png";
const SCREEN_MAP = "https://media.base44.com/images/public/6a4a64185561a655062a41bf/51001fde7_generated_image.png";
const SCREEN_QSO = "https://media.base44.com/images/public/6a4a64185561a655062a41bf/f63bcb32e_generated_image.png";
const SCREEN_STATS = "https://media.base44.com/images/public/6a4a64185561a655062a41bf/9dd11427e_generated_image.png";

// Colors
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
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function generateFlyer() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;

  const [heroImg, screenMap, screenQso, screenStats] = await Promise.all([
    loadImageData(HERO_IMAGE_URL),
    loadImageData(SCREEN_MAP),
    loadImageData(SCREEN_QSO),
    loadImageData(SCREEN_STATS),
  ]);

  // ========== PAGE 1: COVER ==========
  if (heroImg) {
    doc.addImage(heroImg, "JPEG", 0, 0, W, 95);
  } else {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 95, "F");
  }

  doc.setFillColor(...NAVY);
  doc.rect(0, 60, W, 35, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text("HB9OM", 20, 78);
  doc.setFontSize(20);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GOLD);
  doc.text("On Field", 78, 78);

  doc.setTextColor(220, 220, 220);
  doc.setFontSize(12);
  doc.text("Die exklusive Amateurfunk-App für Referenzen & QSO-Logbuch", 20, 88);

  doc.setFillColor(...GOLD);
  doc.roundedRect(150, 8, 52, 12, 2, 2, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("EXKLUSIV IN DER SCHWEIZ", 176, 15.5, { align: "center" });

  // USP section
  let y = 110;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Warum HB9OM On Field?", 20, y);

  y += 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(20, y, 60, y);

  y += 10;
  const usps = [
    { icon: "★", color: GOLD, title: "Alle Referenzen vereint", desc: "SOTA, POTA, HBFF, WWBOTA, Burgen, Leuchttürme, IOTA & Bundesinventare – alles in einer App. Kein anderes Tool bietet diese Vollständigkeit." },
    { icon: "◈", color: GREEN, title: "SwissTopo-Kartenintegration", desc: "Offizielle Schweizer Landeskarten in 4 Massstäben (1:10'000 bis 1:100'000) direkt in der App." },
    { icon: "◉", color: RED, title: "QRZ.com-Integration", desc: "Jeder Benutzer kann seine eigenen QRZ.com-Zugangsdaten hinterlegen. Admins nutzen die Club-Subscription." },
    { icon: "▼", color: NAVY, title: "Offline-Fähig", desc: "Karten herunterladen und im Feld ohne Empfang nutzen. QSOs werden lokal gespeichert und synchronisiert." },
  ];

  for (const usp of usps) {
    doc.setFillColor(...usp.color);
    doc.circle(24, y + 3, 4, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(usp.icon, 24, y + 4.5, { align: "center" });

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(usp.title, 32, y + 2);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(usp.desc, 165);
    doc.text(lines, 32, y + 7);

    y += 7 + lines.length * 4 + 6;
  }

  // Footer
  doc.setFillColor(...NAVY);
  doc.rect(0, H - 18, W, 18, "F");
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("hb9om.ch  ·  Amateurfunk Referenzkarte & QSO-Logbuch  ·  v0.8", W / 2, H - 8, { align: "center" });

  // ========== PAGE 2: FEATURES + SCREENSHOTS ==========
  doc.addPage();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Alle Funktionen im Überblick", 20, 14);
  doc.setTextColor(...GOLD);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Entwickelt von Funkern, für Funker", 20, 19);

  y = 30;
  const sections = [
    {
      title: "KARTE & REFERENZEN",
      color: GREEN,
      items: [
        "Interaktive Karte mit allen Schweizer Amateurfunk-Referenzen",
        "SOTA · POTA · HBFF · WWBOTA · Burgen & Schlösser · Leuchttürme (ARLHS WLOL) · IOTA",
        "Bundesinventare: Auengebiete, Moore & weitere Naturzonen",
        "SwissTopo-Karten: Strassenkarte, Satellit & offizielle Landeskarten",
        "GPS-Positionierung mit Radius-Suche (100 m – 10 km)",
        "Layer ein-/ausschalten – nur sehen, was Sie brauchen",
        "Offline-Karten für den Feldeinsatz herunterladen",
        "Gefahren & Störquellen: Hochspannungsleitungen von map.geo.admin.ch",
        "GPS-Standort-Tracking mit einstellbarem Intervall (30 s – 1 h)",
      ],
    },
    {
      title: "QSO-LOGBUCH",
      color: RED,
      items: [
        "Professionelle QSO-Erfassung mit allen ADIF-Feldern",
        "QRZ.com-Abfrage mit persönlichen Zugangsdaten pro Benutzer",
        "Band & Frequenz werden automatisch synchronisiert",
        "Clubstation-Modus mit Operator-Erfassung",
        "ADIF-Export für HRDLog, N1MM, Log4OM & Co.",
        "Statistik-Ansicht: QSOs pro Band, Mode, Referenz & Monat",
        "Lokale Speicherung & Cloud-Synchronisation",
        "Cloud-Backup: WebDAV (Nextcloud, ownCloud, Synology)",
        "Wake-Lock: Bildschirm bleibt beim Loggen an",
      ],
    },
    {
      title: "EINSTELLUNGEN & EXTRAS",
      color: GOLD,
      items: [
        "Bandplan-Referenz (IARU Region 1 / USKA) direkt in der App",
        "Maidenhead-Locator-Anzeige (WGS84 & LV95)",
        "Persönliche QRZ.com-Zugangsdaten sicher hinterlegt",
        "Navigation zu Google Maps mit einem Klick",
        "Funktionsvorschläge einreichen & Status verfolgen",
        "WebDAV-Cloud-Backup für Nextcloud, ownCloud & Synology",
        "Demo-Benutzer zum Ausprobieren verfügbar",
      ],
    },
  ];

  for (const section of sections) {
    doc.setFillColor(...section.color);
    doc.roundedRect(20, y - 4, W - 40, 7, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(section.title, 22, y + 0.8);
    y += 8;

    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    for (const item of section.items) {
      doc.setTextColor(...section.color);
      doc.text("▸", 22, y);
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(item, 165);
      doc.text(lines, 26, y);
      y += lines.length * 4 + 1.5;
    }
    y += 4;
  }

  // Screenshots row
  y += 2;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("App-Eindrücke", 20, y);
  y += 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(20, y, 50, y);
  y += 6;

  const sw = 50, sh = 89;
  const gap = 7;
  const startX = (W - 3 * sw - 2 * gap) / 2;
  const screens = [
    { img: screenMap, label: "Karte & Referenzen" },
    { img: screenQso, label: "QSO-Formular" },
    { img: screenStats, label: "Statistik" },
  ];

  for (let i = 0; i < screens.length; i++) {
    const x = startX + i * (sw + gap);
    // Phone frame
    doc.setFillColor(...NAVY);
    doc.roundedRect(x - 1.5, y - 1.5, sw + 3, sh + 8, 2, 2, "F");
    if (screens[i].img) {
      doc.addImage(screens[i].img, "JPEG", x, y, sw, sh);
    } else {
      doc.setFillColor(240, 240, 240);
      doc.rect(x, y, sw, sh, "F");
    }
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(screens[i].label, x + sw / 2, y + sh + 4, { align: "center" });
  }

  // Footer
  doc.setFillColor(...NAVY);
  doc.rect(0, H - 18, W, 18, "F");
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.text("hb9om.ch  ·  Alle Schweizer Referenzprogramme in einer App", W / 2, H - 8, { align: "center" });

  // ========== PAGE 3: EXCLUSIVITY & CTA ==========
  doc.addPage();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Einzigartig. Exklusiv. Schweizerisch.", 20, 14);

  y = 36;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Was diese App einzigartig macht", 20, y);
  y += 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(20, y, 90, y);
  y += 10;

  const exclusives = [
    "Einziges Tool, das SOTA, POTA, HBFF, WWBOTA, Burgen, Leuchttürme & IOTA für die Schweiz vereint",
    "Offizielle ARLHS WLOL Leuchtturm-Referenzen (SWI-001 bis SWI-006) verifiziert",
    "SwissTopo-Karten in 4 offiziellen Massstäben integriert",
    "Gefahren & Störquellen-Layer über map.geo.admin.ch (Bundesamt für Energie)",
    "QRZ.com-Integration: jeder Benutzer nutzt seine eigenen Zugangsdaten",
    "Bundesinventare (Auen, Moore) als eigene Referenz-Kategorie",
    "Speziell für Schweizer Amateurfunker entwickelt – von einem Funker",
    "Vollständig offline-fähig für den Einsatz auf dem Gipfel",
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const item of exclusives) {
    doc.setTextColor(...GREEN);
    doc.setFont("helvetica", "bold");
    doc.text("✓", 22, y);
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(item, 168);
    doc.text(lines, 27, y);
    y += lines.length * 5 + 3;
  }

  // CTA box
  y += 6;
  doc.setFillColor(...GOLD);
  doc.roundedRect(20, y, W - 40, 40, 3, 3, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Jetzt durchstarten!", W / 2, y + 12, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Registrieren Sie sich kostenlos und starten Sie heute", W / 2, y + 20, { align: "center" });
  doc.text("mit dem Aktivieren von Schweizer Referenzen.", W / 2, y + 26, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("hb9om.ch", W / 2, y + 34, { align: "center" });

  // Contact
  y += 50;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Kontakt & Informationen", 20, y);
  y += 6;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.line(20, y, 70, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text("Club HB9OM", 20, y);
  y += 5;
  doc.text("E-Mail: hb9om@hb9om.ch", 20, y);
  y += 5;
  doc.text("Web: hb9om.ch", 20, y);

  // Footer
  doc.setFillColor(...NAVY);
  doc.rect(0, H - 18, W, 18, "F");
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.text("HB9OM On Field  ·  Made in Switzerland", W / 2, H - 8, { align: "center" });

  doc.save("HB9OM_On_Field_Flyer.pdf");
}