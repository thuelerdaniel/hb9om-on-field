import { jsPDF } from "jspdf";

const NAVY = [11, 30, 51];
const GOLD = [217, 119, 6];
const GREEN = [5, 150, 105];
const RED = [220, 38, 38];
const GRAY = [100, 116, 139];
const WHITE = [255, 255, 255];
const LIGHT_GRAY = [245, 247, 250];

const SECTIONS = [
  {
    title: "KARTE & REFERENZEN",
    color: [59, 130, 246],
    icon: "📍",
    items: [
      { title: "Karte navigieren", body: "Verschieben Sie die Karte per Drag-and-Drop, zoomen Sie mit dem Mausrad oder mit zwei Fingern auf dem Handy. Die Karte merkt sich die letzte Position." },
      { title: "Referenzen suchen", body: "Im Suchfeld oben können Sie nach Referenz-Codes (z.B. HB/AG-001), Namen (z.B. Uetliberg) oder Orten suchen. Die Ergebnisse erscheinen als Dropdown-Liste." },
      { title: "Layer ein-/ausschalten", body: "Über das Ebenen-Menü (rechts oben) können Sie verschiedene Referenz-Typen ein- und ausschalten: SOTA, POTA, HBFF, WWBOTA, Burgen, IOTA, Leuchttürme und Bundesinventare. Ausserdem können Sie die Hintergrundkarte wechseln (Strassenkarte, Satellit, SwissTopo)." },
      { title: "Kartenmassstab wählen", body: "Im Ebenen-Menü unter «Kartenmassstab» können Sie einen festen Massstab auswählen: 1:10'000, 1:25'000, 1:50'000 oder 1:100'000. Bei SwissTopo-Karte wird automatisch die entsprechende offizielle Landeskarte verwendet." },
      { title: "GPS-Position", body: "Klicken Sie auf den GPS-Button, um Ihre aktuelle GPS-Position anzuzeigen. Die Karte zoomt automatisch heraus. Im Popup sehen Sie Maidenhead-Locator, WGS84- und LV95-Koordinaten. Sie können Koordinaten manuell eingeben und den Radius anpassen." },
      { title: "Position fixieren", body: "Wenn Sie kein GPS haben, können Sie die Position frei auf der Karte festlegen: Pin-Button klicken, dann auf die gewünschte Stelle tippen." },
      { title: "Marker anklicken", body: "Klicken Sie auf einen Marker, um Details zu sehen: Referenz-Code, Name, Höhe, Punkte, Aktivierungsanzahl und einen externen Link." },
      { title: "Marker verschieben", body: "Alle Benutzer können Marker per Drag & Drop verschieben. Administratoren: sofort gespeichert. Normale Benutzer: Antrag an Admin." },
      { title: "Offline-Modus", body: "Klicken Sie auf das Wifi-Icon, um den Offline-Modus zu aktivieren. Referenzdaten und QRZ-Abfragen werden lokal gespeichert. QSOs können offline erfasst und später synchronisiert werden." },
      { title: "Offline-Karten", body: "Mit dem Download-Icon können Sie Kartenausschnitte für die Offline-Nutzung herunterladen." },
      { title: "Gefahren & Störquellen", body: "Der Layer «Gefahren & Störquellen» zeigt Hochspannungsleitungen, Mobilfunkantennen, Richtfunkstrecken und Radio-/Fernsehsender von map.geo.admin.ch. Tippen Sie auf die Karte, um Details zu sehen." },
      { title: "Referenz-Typen", body: "SOTA (Berge), POTA (Parks), HBFF (Flora/Fauna), WWBOTA (Bunker), WCA/COTA (Burgen), IOTA (Inseln), WLOTA/ARLHS (Leuchttürme), BLN/Moor (Bundesinventare)." }
    ]
  },
  {
    title: "QSO-LOGBUCH",
    color: [16, 185, 129],
    icon: "📻",
    items: [
      { title: "Neues QSO erfassen", body: "Klicken Sie auf «Neues QSO» unten rechts. Geben Sie Rufzeichen, Datum, Zeit, Frequenz, Band, Mode und RST-Werte ein. Nach dem Speichern bleibt das Formular offen für das nächste QSO." },
      { title: "QRZ.com-Abfrage", body: "Wenn Sie ein Rufzeichen eingeben, werden automatisch Name, Adresse, Land, Grid-Locator und E-Mail von QRZ.com geladen. Klicken Sie auf den «QRZ»-Button für eine manuelle Abfrage." },
      { title: "Band & Frequenz automatisch", body: "Das Band passt sich automatisch an die Frequenz an (z.B. 144.500 MHz → 2m). Bei manueller Band-Auswahl springt die Frequenz in die Bandmitte." },
      { title: "Sendeleistung (Power)", body: "Im QSO-Formular können Sie die Sendeleistung in Watt eingeben. Der Wert bleibt für das nächste QSO erhalten." },
      { title: "Standort / Referenz erfassen", body: "Wählen Sie den Referenz-Typ (SOTA, POTA, etc.), geben Sie den Code ein oder wählen Sie aus den in der Nähe befindlichen Referenzen (5-km-Umkreis)." },
      { title: "Suffix verwenden", body: "/P = portable, /M = mobil, /AM = mobilflug, /MM = Seefahrt." },
      { title: "Clubstation loggen", body: "Aktivieren Sie «Clubstation», wenn Sie mit einem abweichenden Stations-Rufzeichen funken (z.B. HB9OM)." },
      { title: "QSO bearbeiten", body: "Klicken Sie auf das Stift-Symbol neben einem Eintrag, um ihn zu bearbeiten." },
      { title: "Einträge filtern & sortieren", body: "Oben im Logbuch können Sie nach Referenz-Typ filtern und die Sortierung ändern." },
      { title: "ADIF-Export", body: "Klicken Sie auf «Export (ADIF)», um alle gefilterten Einträge als ADIF-Datei herunterzuladen." },
      { title: "Statistik-Ansicht", body: "Über das Balken-Diagramm-Icon wechseln Sie zur Statistik-Ansicht mit Diagrammen zu QSOs pro Band, Mode und Referenz-Typ." }
    ]
  },
  {
    title: "EINSTELLUNGEN & DATENSICHERUNG",
    color: [245, 158, 11],
    icon: "⚙️",
    items: [
      { title: "Mein Profil", body: "Geben Sie Ihr persönliches Rufzeichen ein. Dieses wird beim Clubstation-Modus als Standard-Operator vorausgefüllt." },
      { title: "QRZ.com Abfrage", body: "Jeder Benutzer kann seine eigenen QRZ.com-Zugangsdaten hinterlegen. Admins und Demo-Benutzer nutzen die Club-XML-Subscription." },
      { title: "Cloud-Backup mit Google Drive", body: "Klicken Sie unter «Datensicherung» auf «Mit Google Drive verbinden». Es öffnet sich ein Fenster, in dem Sie Ihr Google-Konto auswählen und der App Zugriff gewähren. Danach können Sie Backups direkt in Ihr Google Drive hochladen, alte Backups auflisten, wiederherstellen oder löschen. Aktivieren Sie «Automatisches Backup», damit bei jedem neuen QSO automatisch gesichert wird." },
      { title: "Cloud-Backup mit OneDrive", body: "Genauso einfach verbinden Sie Ihr OneDrive: Klicken Sie auf «Mit OneDrive verbinden», wählen Sie Ihr Microsoft-Konto und gewähren Sie Zugriff. Danach stehen Ihnen die gleichen Funktionen wie bei Google Drive zur Verfügung: Backup erstellen, Dateien auflisten, wiederherstellen und löschen." },
      { title: "Cloud-Daten löschen", body: "In der Datei-Liste jedes Cloud-Anbieters (Google Drive, OneDrive oder WebDAV) können Sie einzelne Backups mit dem Mülleimer-Symbol dauerhaft löschen. Tippen Sie auf «Dateien», um alle gespeicherten Backups anzuzeigen." },
      { title: "Cloud-Backup mit WebDAV", body: "Für fortgeschrittene Benutzer: Klicken Sie auf «WebDAV (erweitert)» und geben Sie URL, Benutzername und Passwort Ihres WebDAV-Servers ein (Nextcloud, ownCloud, Synology, Strato HiDrive). Auch hier ist ein automatisches Backup verfügbar." },
      { title: "Verbindung trennen", body: "Sie können die Verbindung zu Google Drive oder OneDrive jederzeit mit «Verbindung trennen» entfernen. Die bereits in der Cloud gespeicherten Backups bleiben erhalten." },
      { title: "Manuelles Backup", body: "Neben dem Cloud-Backup können Sie weiterhin ein manuelles Backup als JSON-Datei herunterladen und wiederherstellen." },
      { title: "Offline-Modus & Bereitschaft", body: "Beim Aktivieren des Offline-Modus werden alle Referenzdaten, Overrides und QRZ-Abfragen lokal gespeichert. Die App zeigt an, ob sie bereit für die Offline-Nutzung ist." },
      { title: "Änderungsanträge", body: "Unter «Meine Änderungsanträge» sehen Sie alle Ihre eingereichten Positions-Korrekturen mit Status." },
      { title: "Benutzerverwaltung (Admin)", body: "Administratoren können alle Benutzer einsehen, Passwörter zurücksetzen und Rollen ändern." }
    ]
  },
  {
    title: "TIPPS & TRICKS",
    color: [139, 92, 246],
    icon: "💡",
    items: [
      { title: "Wake-Lock (Bildschirm an)", body: "Beim Erfassen eines QSOs bleibt der Bildschirm aktiviert, damit er nicht während des Funkens ausgeht." },
      { title: "Formulardaten bleiben erhalten", body: "Häufige Eingaben (Frequenz, Band, Mode, RST, Referenz) werden nach dem Speichern gespeichert und beim nächsten QSO vorausgefüllt." },
      { title: "Maidenhead-Locator", body: "Der Maidenhead-Locator ist ein geografisches Koordinatensystem. 4 Stellen = ca. 100×100 km, 6 Stellen = ca. 5×5 km." }
    ]
  }
];

export async function generateHelpPdf() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const MARGIN = 18;
  const CONTENT_W = W - 2 * MARGIN;
  let y = 0;

  // Helper: check if we need a new page
  const checkPage = (needed = 10) => {
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
    doc.text("HB9OM On Field – Hilfe & Anleitung", MARGIN, 8);
    doc.setTextColor(...GOLD);
    doc.text("v0.8", W - MARGIN, 8, { align: "right" });
  };

  const addFooter = () => {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(...NAVY);
    doc.rect(0, pageHeight - 12, W, 12, "F");
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const pageNum = doc.internal.getNumberOfPages();
    doc.text("hb9om.ch  ·  Amateurfunk Referenzkarte & QSO-Logbuch", W / 2, pageHeight - 5, { align: "center" });
    doc.text(`Seite ${pageNum}`, W - MARGIN, pageHeight - 5, { align: "right" });
  };

  // ========== COVER PAGE ==========
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 80, "F");

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
  doc.text("Hilfe & Anleitung", MARGIN, 48);
  doc.setFontSize(9);
  doc.text("Die exklusive Amateurfunk-App für Referenzen & QSO-Logbuch", MARGIN, 55);
  doc.text("SOTA · POTA · HBFF · WWBOTA · Burgen · Leuchttürme · IOTA", MARGIN, 61);

  doc.setFillColor(...GOLD);
  doc.roundedRect(W - 60, 10, 42, 10, 1.5, 1.5, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("INTERAKTIVE HILFE", W - 39, 16, { align: "center" });

  // Quick navigation
  y = 95;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Inhalt dieser Anleitung", MARGIN, y);
  y += 3;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, MARGIN + 55, y);
  y += 8;

  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    doc.setFillColor(...s.color);
    doc.circle(MARGIN + 3, y + 2, 3.5, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(String(i + 1), MARGIN + 3, y + 3.5, { align: "center" });

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(s.title, MARGIN + 10, y + 1);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${s.items.length} Themen`, MARGIN + 10, y + 6);

    y += 12;
  }

  addFooter();

  // ========== CONTENT PAGES ==========
  for (const section of SECTIONS) {
    doc.addPage();
    y = 20;
    addHeader();

    // Section header
    doc.setFillColor(...section.color);
    doc.rect(0, 12, W, 16, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${section.icon}  ${section.title}`, MARGIN, 23);
    y = 38;

    for (const item of section.items) {
      checkPage(25);

      // Item title
      doc.setTextColor(...section.color);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(item.title, MARGIN, y);

      // Divider line
      doc.setDrawColor(...section.color);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 1.5, MARGIN + CONTENT_W, y + 1.5);

      y += 5;

      // Body text
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(item.body, CONTENT_W);
      for (const line of lines) {
        checkPage(6);
        doc.text(line, MARGIN, y);
        y += 4;
      }

      y += 4;

      // Light separator
      checkPage(5);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
      y += 4;
    }

    addFooter();
  }

  // ========== CONTACT PAGE ==========
  doc.addPage();
  y = 20;
  addHeader();

  doc.setFillColor(...NAVY);
  doc.rect(0, 12, W, 16, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Kontakt & Informationen", MARGIN, 23);
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
  doc.setTextColor(...GRAY);
  doc.text("E-Mail: hb9om@hb9om.ch", MARGIN, y);
  y += 6;
  doc.text("Web: hb9om.ch", MARGIN, y);
  y += 10;

  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Haftungsausschluss", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const disclaimer = "Diese App wird ohne jegliche Gewaehrleistung bereitgestellt. Es wird keine Haftung fuer Fehler, Datenverluste oder andere Probleme uebernommen. Die Daten stammen aus oeffentlichen Quellen (SOTA, POTA, HBFF, WWBOTA, WCA, ARLHS, BFE, BAKOM, BAFU) und koennen unvollstaendig oder veraltet sein.";
  const dLines = doc.splitTextToSize(disclaimer, CONTENT_W);
  for (const line of dLines) {
    doc.text(line, MARGIN, y);
    y += 4;
  }

  addFooter();

  doc.save("HB9OM_On_Field_Hilfe.pdf");
}