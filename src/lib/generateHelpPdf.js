import { jsPDF } from "jspdf";
import { MARKER_SHAPES } from "@/lib/markerShapes";

const NAVY = [11, 30, 51];
const GOLD = [217, 119, 6];
const GREEN = [5, 150, 105];
const RED = [220, 38, 38];
const BLUE = [59, 130, 246];
const GRAY = [100, 116, 139];
const LIGHT_GRAY = [245, 247, 250];
const WHITE = [255, 255, 255];

// External links
const LINKS = {
  sota: "https://www.sotadata.org.uk/summitlist.aspx",
  pota: "https://pota.app/#/park/CH",
  hbff: "https://hbff.ch/Refs/HBFFReferenceSlim.html",
  wwbota: "https://wwbota.net/map/",
  wca: "https://wcagroup.org/?page_id=207",
  iota: "https://www.iota-world.org/islands-on-the-air/iota-groups-islands.html",
  arlhs: "https://wlol.arlhs.com/",
  geoAdmin: "https://map.geo.admin.ch/",
  bafu: "https://www.bafu.admin.ch/bafu/de/home/themen/biodiversitaet/infospezialist/biodiversitaet--daten--und-instrumente.html",
  paypal: "https://paypal.me/Thueler",
  email: "mailto:hb9om@hb9om.ch"
};

// Screenshot URLs (echte App-Screenshots)
const SCREENSHOTS = {
  map: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/51001fde7_generated_image.png",
  qso: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/f63bcb32e_generated_image.png",
  stats: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/9dd11427e_generated_image.png",
  hero: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/b2f8036bf_generated_image.png"
};

// Marker-Symbole aus der App (Farben und Beschreibungen)
const MARKER_SYMBOLS = [
  { type: "sota", color: "#e74c3c", name: "SOTA", desc: "Berggipfel ab 150 m Prominenz" },
  { type: "pota", color: "#27ae60", name: "POTA", desc: "Nationalparks & Schutzgebiete" },
  { type: "hbff", color: "#8e44ad", name: "HBFF", desc: "Flora & Fauna Naturreservate" },
  { type: "wwbota", color: "#795548", name: "WWBOTA", desc: "Militärische Bunker" },
  { type: "castle", color: "#e67e22", name: "Burgen/Schlösser", desc: "WCA/COTA Referenzen" },
  { type: "iota", color: "#3498db", name: "IOTA", desc: "Inseln (Schweiz hat keine IOTA)" },
  { type: "lighthouse", color: "#f39c12", name: "Leuchttürme", desc: "ARLHS WLOL Referenzen" },
  { type: "swiss_protected", color: "#16a085", name: "BLN/Moor", desc: "Bundesinventare / Naturzonen" }
];

// Bild als Data-URL laden (für jsPDF addImage)
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

// SVG-String in PNG Data-URL umwandeln (für Marker-Symbole)
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

const SECTIONS = [
  {
    title: "KARTE & REFERENZEN",
    color: BLUE,
    icon: "📍",
    items: [
      {
        title: "Karte navigieren",
        body: "Verschieben Sie die Karte per Drag-and-Drop, zoomen Sie mit dem Mausrad oder mit zwei Fingern auf dem Handy. Die Karte merkt sich die letzte Position.",
        steps: [
          "Karte mit gedrueckter Maustaste (oder Finger) verschieben",
          "Mit Mausrad oder Zwei-Finger-Pinch zoomen",
          "Die letzte Position wird automatisch gespeichert"
        ],
        screenshot: "map"
      },
      {
        title: "Referenzen suchen",
        body: "Im Suchfeld oben koennen Sie nach Referenz-Codes (z.B. HB/AG-001), Namen (z.B. Uetliberg) oder Orten suchen.",
        steps: [
          "Auf das Suchfeld oben tippen",
          "Code, Namen oder Ort eingeben (z.B. «Uetli»)",
          "Ergebnis aus der Dropdown-Liste auswaehlen",
          "Karte springt zur ausgewaehlten Referenz"
        ],
        mockup: "search"
      },
      {
        title: "Layer ein-/ausschalten",
        body: "Ueber das Ebenen-Menue (rechts oben) koennen Sie Referenz-Typen ein- und ausschalten und die Hintergrundkarte wechseln.",
        steps: [
          "Auf das Layer-Icon (rechts oben) tippen",
          "Gewuenschte Referenz-Typen ein-/ausschalten (SOTA, POTA, HBFF, etc.)",
          "Hintergrundkarte waehlen (Strassenkarte, Satellit, SwissTopo)",
          "Menue schliessen – Aenderungen sind sofort sichtbar"
        ],
        mockup: "layers"
      },
      {
        title: "GPS-Position anzeigen",
        body: "Klicken Sie auf den GPS-Button, um Ihre aktuelle Position auf der Karte anzuzeigen.",
        steps: [
          "GPS-Button (Standort-Icon links) antippen",
          "Karte zoomt automatisch heraus, Radiuskreis wird sichtbar",
          "Pin-Nadel anklicken fuer Koordinaten-Popup",
          "Im Popup: Maidenhead-Locator, WGS84 und LV95 Koordinaten",
          "Radius mit Schieberegler anpassen (100m – 10km)",
          "«Navigieren zu» uebergibt Position an Google Maps"
        ],
        mockup: "gps"
      },
      {
        title: "Position fixieren (ohne GPS)",
        body: "Wenn Sie kein GPS haben, koennen Sie die Position frei auf der Karte festlegen.",
        steps: [
          "Pin-Button (links) antippen",
          "Auf die gewuenschte Stelle der Karte tippen",
          "Position erscheint blau, Karte zoomt heraus",
          "Popup mit Koordinaten und Radius-Steuerung"
        ]
      },
      {
        title: "Marker anklicken",
        body: "Klicken Sie auf einen Marker, um Details zu sehen: Referenz-Code, Name, Hoehe, Punkte und externe Links.",
        steps: [
          "Marker auf der Karte antippen",
          "Popup mit Details oeffnet sich",
          "«Mehr Infos» fuer externen Link antippen"
        ],
        links: [
          { label: "SOTA-Gipfel-Liste", url: LINKS.sota },
          { label: "POTA-Parks", url: LINKS.pota },
          { label: "HBFF-Referenzen", url: LINKS.hbff },
          { label: "WWBOTA-Bunker", url: LINKS.wwbota }
        ]
      },
      {
        title: "Marker verschieben / korrigieren",
        body: "Alle Benutzer koennen Marker per Drag & Drop verschieben. Administratoren: sofort gespeichert. Normale Benutzer: Antrag an Admin.",
        steps: [
          "Move-Icon (links neben der Karte) aktivieren",
          "Marker an die korrekte Position ziehen",
          "Als Admin: Position wird sofort gespeichert",
          "Als Benutzer: Dialog mit Kommentarfeld oeffnet sich",
          "«Einreichen» – Status unter «Meine Antraege» verfolgen"
        ]
      },
      {
        title: "Offline-Modus aktivieren",
        body: "Klicken Sie auf das Wifi-Icon, um den Offline-Modus zu aktivieren. Referenzdaten werden lokal gespeichert.",
        steps: [
          "Wifi-Icon (links neben der Karte) antippen",
          "Symbol wird gelb – Offline-Modus aktiv",
          "Referenzdaten werden lokal gespeichert",
          "QSOs koennen offline erfasst werden",
          "Bei Online-Verbindung wird synchronisiert"
        ]
      },
      {
        title: "Offline-Karten herunterladen",
        body: "Mit dem Download-Icon koennen Sie Kartenausschnitte fuer die Offline-Nutzung herunterladen.",
        steps: [
          "Download-Icon (links) antippen",
          "Gebiet auf der Karte auswaehlen",
          "Zoom-Stufen auswaehlen",
          "Download starten – Fortschritt wird angezeigt",
          "In Einstellungen → «Heruntergeladene Karten» verwalten"
        ]
      },
      {
        title: "Gefahren & Stoerquellen",
        body: "Der Layer «Gefahren & Stoerquellen» zeigt Hochspannungsleitungen und Starkstromanlagen von map.geo.admin.ch.",
        steps: [
          "Layer-Menue oeffnen",
          "«Gefahren & Stoerquellen» aktivieren",
          "Rote Linien zeigen Hochspannungsleitungen",
          "Auf Leitung tippen fuer Detail-Popup"
        ],
        links: [{ label: "geo.admin.ch Karte", url: LINKS.geoAdmin }]
      },
      {
        title: "Referenz-Typen Uebersicht",
        body: "Folgende Referenz-Typen werden unterstuetzt. Klicken Sie auf einen Link fuer die offizielle Referenzliste:",
        links: [
          { label: "SOTA – Berggipfel", url: LINKS.sota },
          { label: "POTA – Parks & Schutzgebiete", url: LINKS.pota },
          { label: "HBFF – Flora & Fauna", url: LINKS.hbff },
          { label: "WWBOTA – Bunker", url: LINKS.wwbota },
          { label: "WCA/COTA – Burgen & Schloesser", url: LINKS.wca },
          { label: "IOTA – Inseln", url: LINKS.iota },
          { label: "ARLHS WLOL – Leuchttuerme", url: LINKS.arlhs },
          { label: "BLN – Bundesinventare", url: LINKS.bafu }
        ]
      }
    ]
  },
  {
    title: "QSO-LOGBUCH",
    color: [16, 185, 129],
    icon: "📻",
    items: [
      {
        title: "Neues QSO erfassen",
        body: "Klicken Sie auf «Neues QSO» unten rechts. Geben Sie Rufzeichen, Datum, Zeit, Frequenz, Band, Mode und RST ein. Nach dem Speichern bleibt das Formular offen.",
        steps: [
          "Schwarzen Button «Neues QSO» (unten rechts) antippen",
          "Rufzeichen eingeben (z.B. HB9XYZ)",
          "QRZ-Button fuer automatische Datenabfrage",
          "Datum und Startzeit (UTC) bestaetigen",
          "Frequenz eingeben – Band wird automatisch erkannt",
          "RST gesendet/erhalten eingeben",
          "Eigenen Standort/Referenz waehlen",
          "«QSO speichern & weiter» – Formular bleibt offen"
        ],
        mockup: "qso",
        screenshot: "qso"
      },
      {
        title: "QRZ.com-Abfrage",
        body: "Wenn Sie ein Rufzeichen eingeben, werden automatisch Name, Adresse, Land, Grid-Locator und E-Mail von QRZ.com geladen.",
        steps: [
          "Rufzeichen in das Eingabefeld tippen",
          "Tab-Taste oder QRZ-Button fuer Abfrage",
          "Daten erscheinen im blauen Kasten",
          "Name, Adresse, Grid und E-Mail werden uebernommen"
        ]
      },
      {
        title: "Band & Frequenz automatisch",
        body: "Das Band passt sich automatisch an die Frequenz an (z.B. 144.500 MHz → 2m). Bei manueller Band-Auswahl springt die Frequenz in die Bandmitte.",
        steps: [
          "Frequenz eingeben (z.B. 144.500)",
          "Band wird automatisch auf «2m» gesetzt",
          "Oder: Band manuell waehlen → Frequenz springt in Bandmitte"
        ]
      },
      {
        title: "Standort / Referenz erfassen",
        body: "Waehlen Sie den Referenz-Typ und geben Sie den Code ein oder waehlen Sie aus den in der Naehe befindlichen Referenzen.",
        steps: [
          "Referenz-Typ waehlen (SOTA, POTA, etc.)",
          "Code eingeben (z.B. HB/AG-001) ODER",
          "«Referenzen in der Naehe» antippen fuer Liste",
          "Name wird automatisch ergaenzt"
        ]
      },
      {
        title: "Clubstation loggen",
        body: "Aktivieren Sie «Clubstation», wenn Sie mit einem abweichenden Stations-Rufzeichen funken (z.B. HB9OM).",
        steps: [
          "Checkbox «Clubstation» aktivieren",
          "Popup oeffnet sich",
          "Clubstations-Rufzeichen eingeben (z.B. HB9OM)",
          "Operator-Rufzeichen eingeben (persoenlich)",
          "Operator-Name eingeben",
          "«Bestaetigen» – Daten werden fuer zukuenftige QSOs gespeichert"
        ]
      },
      {
        title: "QSO bearbeiten",
        body: "Klicken Sie auf das Stift-Symbol neben einem Eintrag, um ihn zu bearbeiten.",
        steps: [
          "Im Logbuch zum Eintrag scrollen",
          "Stift-Symbol antippen",
          "Felder anpassen",
          "«Aktualisieren» zum Speichern"
        ]
      },
      {
        title: "Eintraege filtern & sortieren",
        body: "Oben im Logbuch koennen Sie nach Referenz-Typ filtern und die Sortierung aendern.",
        steps: [
          "Filter-Dropdown oben antippen",
          "Referenz-Typ waehlen (z.B. «SOTA»)",
          "Sortierung waehlen (Datum, Rufzeichen)",
          "Gefilterte Eintraege werden angezeigt"
        ]
      },
      {
        title: "ADIF-Export",
        body: "Klicken Sie auf «Export (ADIF)», um alle gefilterten Eintraege als ADIF-Datei herunterzuladen.",
        steps: [
          "Gewuenschte Filter einstellen",
          "«Export (ADIF)» antippen",
          ".adi-Datei wird heruntergeladen",
          "In Logbuch-Programm importieren (HRDLog, N1MM, etc.)"
        ]
      },
      {
        title: "Statistik-Ansicht",
        body: "Ueber das Balken-Diagramm-Icon wechseln Sie zur Statistik-Ansicht mit Diagrammen.",
        steps: [
          "Balken-Icon (oben rechts) antippen",
          "Statistik mit Diagrammen wird angezeigt",
          "QSOs pro Band, Mode und Referenz-Typ",
          "Weitere Kennzahlen"
        ],
        screenshot: "stats"
      }
    ]
  },
  {
    title: "EINSTELLUNGEN & DATENSICHERUNG",
    color: [245, 158, 11],
    icon: "⚙️",
    items: [
      {
        title: "Mein Profil",
        body: "Geben Sie Ihr persoehnliches Rufzeichen ein. Dieses wird beim Clubstation-Modus vorausgefuellt.",
        steps: [
          "Einstellungen oeffnen",
          "Rufzeichen im Feld «Mein Profil» eingeben",
          "«Speichern» antippen"
        ]
      },
      {
        title: "QRZ.com Abfrage",
        body: "Jeder Benutzer kann eigene QRZ.com-Zugangsdaten hinterlegen. Admins nutzen die Club-XML-Subscription.",
        steps: [
          "Einstellungen → QRZ-Benutzername eingeben",
          "QRZ-Passwort eingeben",
          "«Speichern» antippen",
          "Schalter «QRZ aktivieren» umlegen",
          "«QRZ-Verbindung testen» fuer Pruefung"
        ]
      },
      {
        title: "Cloud-Backups verwalten",
        body: "Listen Sie vorhandene Backups auf, stellen Sie sie wiederher oder loeschen Sie sie.",
        steps: [
          "«Dateien»-Button beim WebDAV-Anbieter antippen",
          "Liste aller Backups wird angezeigt",
          "Wiederherstellen: Upload-Icon antippen",
          "Loeschen: Muellheimer-Icon antippen und bestaetigen"
        ]
      },
      {
        title: "Cloud-Backup mit WebDAV",
        body: "Fuer fortgeschrittene Benutzer: WebDAV-Server (Nextcloud, ownCloud, Synology) konfigurieren.",
        steps: [
          "«WebDAV (erweitert)» aufklappen",
          "WebDAV-URL eingeben",
          "Benutzername eingeben",
          "Passwort / App-Token eingeben",
          "«Testen» fuer Verbindungspruefung",
          "«Speichern» – Fertig!"
        ],
        mockup: "webdav"
      },
      {
        title: "Manuelles Backup (Datei)",
        body: "Neben dem Cloud-Backup koennen Sie ein manuelles Backup als JSON-Datei herunterladen.",
        steps: [
          "«Backup» unter «Lokales Backup» antippen",
          "JSON-Datei wird heruntergeladen",
          "Datei an sicherem Ort speichern",
          "«Wiederherstellen» → Datei hochladen zum Restore"
        ]
      },
      {
        title: "Offline-Modus & Bereitschaft",
        body: "Beim Aktivieren des Offline-Modus werden alle Referenzdaten lokal gespeichert.",
        steps: [
          "Offline-Modus in Einstellungen aktivieren",
          "Alle Referenzdaten werden gespeichert",
          "Status zeigt «App bereit fuer Offline-Nutzung»",
          "Heruntergeladene Karten verwalten"
        ]
      },
      {
        title: "Benutzerverwaltung (Admin)",
        body: "Administratoren koennen alle Benutzer einsehen, Passwoerter zuruecksetzen und Rollen aendern.",
        steps: [
          "Einstellungen → «Benutzerverwaltung» (nur Admin)",
          "Benutzerliste durchsuchen",
          "Rolle aendern (Admin/User)",
          "Passwort zuruecksetzen",
          "Benutzer loeschen (falls noetig)"
        ]
      }
    ]
  },
  {
    title: "TIPPS & TRICKS",
    color: [139, 92, 246],
    icon: "💡",
    items: [
      {
        title: "Wake-Lock (Bildschirm an)",
        body: "Beim Erfassen eines QSOs bleibt der Bildschirm aktiviert, damit er nicht ausgeht.",
        steps: [
          "Wird automatisch beim Oeffnen des QSO-Formulars aktiviert",
          "Bildschirm bleibt an bis Formular geschlossen wird"
        ]
      },
      {
        title: "Formulardaten bleiben erhalten",
        body: "Haeufige Eingaben werden gespeichert und beim naechsten QSO vorausgefuellt.",
        steps: [
          "Nach QSO-Speichern: Frequenz, Band, Mode, RST bleiben erhalten",
          "Nur Rufzeichen, Datum und Zeit pro QSO anpassen",
          "Mehrere QSOs schnell hintereinander erfassen"
        ]
      },
      {
        title: "Hoher Kontrast (Sonnenmodus)",
        body: "Bei starker Sonneneinstrahlung koennen Sie den hohen Kontrast aktivieren.",
        steps: [
          "Im QSO-Formular: Sonnen-Icon antippen",
          "Schwarzer Hintergrund, gelbe Texte",
          "Ideal bei direktem Sonnenlicht",
          "Erneut antippen zum Deaktivieren"
        ]
      },
      {
        title: "Maidenhead-Locator",
        body: "Der Maidenhead-Locator ist ein geografisches Koordinatensystem fuer Amateurfunk.",
        steps: [
          "4 Stellen (z.B. JN36) = ca. 100×100 km",
          "6 Stellen (z.B. JN36af) = ca. 5×5 km",
          "Bei generellen Standorten reicht 4-stellig"
        ]
      }
    ]
  }
];

// ─── Drawing helpers ───

function drawStepBox(doc, x, y, w, stepNum, text, color) {
  const h = 7;
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(x, y, w, h, 1, 1, "F");
  doc.setFillColor(...color);
  doc.circle(x + 4, y + h / 2, 2.5, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(String(stepNum), x + 4, y + h / 2 + 0.7, { align: "center" });
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const lines = doc.splitTextToSize(text, w - 12);
  doc.text(lines[0] || text, x + 9, y + h / 2 + 0.7);
  return y + h + 1.5;
}

function drawMockup(doc, x, y, w, type, color) {
  const h = 30;
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.setFillColor(252, 252, 252);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");

  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");

  if (type === "search") {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x + 2, y + 2, w - 4, 5, 1, 1, "F");
    doc.setTextColor(...GRAY);
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
    var fields = [
      ["Rufzeichen:", "HB9XYZ", 8],
      ["Datum:", "2026-07-10", 13],
      ["Freq:", "144.500 MHz", 18],
      ["Band:", "2m  Mode: FM", 23]
    ];
    fields.forEach(function(f) {
      var label = f[0], val = f[1], ly = f[2];
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
    doc.text("QSO speichern & weiter", x + 5, y + 27.5);
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
    doc.text("••••••••", x + 19, y + 17.3);
    doc.setFillColor(...color);
    doc.roundedRect(x + 3, y + 20, 10, 4, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.text("Testen", x + 5, y + 22.5);
    doc.roundedRect(x + 14, y + 20, 10, 4, 1, 1, "F");
    doc.text("Speichern", x + 16, y + 22.5);
  }

  return y + h + 3;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function drawClickableLink(doc, x, y, text, url, color) {
  doc.setTextColor(...color);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.textWithLink(text, x, y, { url: url });
  var textWidth = doc.getTextWidth(text);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(x, y + 0.5, x + textWidth, y + 0.5);
  return y + 4;
}

export async function generateHelpPdf() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const MARGIN = 18;
  const CONTENT_W = W - 2 * MARGIN;
  let y = 0;

  const sectionPageMap = {};

  // ─── Bilder vorab laden ───
  const screenshotImgs = {};
  for (const key of Object.keys(SCREENSHOTS)) {
    screenshotImgs[key] = await loadImageData(SCREENSHOTS[key]);
  }
  // Marker-Symbole als PNG laden
  const markerImgs = {};
  for (const ms of MARKER_SYMBOLS) {
    const shape = MARKER_SHAPES[ms.type];
    if (shape) {
      markerImgs[ms.type] = await svgToPng(shape.svg(ms.color), 120);
    }
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
    doc.text("HB9OM On Field – Interaktive Hilfe", MARGIN, 8);
    doc.setTextColor(...GOLD);
    doc.textWithLink("v0.8", W - MARGIN - 5, 8, { url: "https://hb9om.ch" });
  };

  const addFooter = () => {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(...NAVY);
    doc.rect(0, pageHeight - 12, W, 12, "F");
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const pageNum = doc.internal.getNumberOfPages();
    doc.text("hb9om.ch  ·  Interaktive Hilfe & Anleitung", W / 2, pageHeight - 5, { align: "center" });
    doc.text("Seite " + pageNum, W - MARGIN, pageHeight - 5, { align: "right" });
  };

  // ========== COVER PAGE ==========
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
  // Navy-Band über dem unteren Teil des Hero-Bilds für Textlesbarkeit
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
  doc.text("Interaktive Hilfe & Anleitung", MARGIN, 48);
  doc.setFontSize(9);
  doc.text("Die exklusive Amateurfunk-App fuer Referenzen & QSO-Logbuch", MARGIN, 55);
  doc.text("SOTA · POTA · HBFF · WWBOTA · Burgen · Leuchttuerme · IOTA", MARGIN, 61);

  doc.setFillColor(...GOLD);
  doc.roundedRect(W - 65, 10, 47, 10, 1.5, 1.5, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("INTERAKTIVE HILFE", W - 41.5, 16, { align: "center" });

  // Tip box
  y = 95;
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Tipp: Klickbare Elemente", MARGIN + 3, y + 4);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Diese PDF enthaelt klickbare Links (blau unterstrichen) zu externen Ressourcen.", MARGIN + 3, y + 8);
  doc.text("Im Inhaltsverzeichnis springen die Eintraege direkt zur jeweiligen Seite.", MARGIN + 3, y + 11);

  // Table of contents
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

  const tocEntries = [];
  for (let i = 0; i < SECTIONS.length; i++) {
    const s = SECTIONS[i];
    tocEntries.push({ index: i, y: y });
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
    doc.text(s.items.length + " Themen · Schritt-fuer-Schritt Anleitungen", MARGIN + 10, y + 6);

    y += 12;
  }

  // Zusätzliche TOC-Einträge für Sonderseiten
  const extraTocEntries = [];
  const extraPages = [
    { title: "Symbole & Icons", desc: "Alle Marker-Symbole und UI-Icons", color: NAVY, icon: "S" },
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

  // Quick links section
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
    { label: "Burgen & Schloesser", url: LINKS.wca },
    { label: "IOTA-Inseln", url: LINKS.iota },
    { label: "Leuchttuerme (ARLHS)", url: LINKS.arlhs },
    { label: "Bundesinventare", url: LINKS.bafu }
  ];
  let colX = MARGIN;
  let linkY = y;
  quickLinks.forEach((ql, i) => {
    if (i === 4) { colX = MARGIN + 90; linkY = y; }
    linkY = drawClickableLink(doc, colX, linkY, "> " + ql.label, ql.url, [30, 64, 175]);
  });
  y = linkY + 4;

  addFooter();

  // ========== SYMBOLE & ICONS SEITE ==========
  doc.addPage();
  const symbolsPageNum = doc.internal.getNumberOfPages();
  y = 20;
  addHeader();

  doc.setFillColor(...NAVY);
  doc.rect(0, 12, W, 16, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Symbole & Icons in der App", MARGIN, 23);
  y = 38;

  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const symIntro = "Jeder Referenz-Typ hat ein eigenes, gut erkennbares Symbol auf der Karte. Diese Symbole werden auch in der Legende und im Ebenen-Menue verwendet. Hier sehen Sie alle Symbole mit Erklaerung:";
  const symIntroLines = doc.splitTextToSize(symIntro, CONTENT_W);
  for (const line of symIntroLines) {
    doc.text(line, MARGIN, y);
    y += 4;
  }
  y += 4;

  // Symbol-Tabelle: 2 Spalten, 4 Zeilen
  const symColW = (CONTENT_W - 6) / 2;
  const symRowH = 22;
  const symImgSize = 12;

  for (let i = 0; i < MARKER_SYMBOLS.length; i++) {
    const ms = MARKER_SYMBOLS[i];
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sx = MARGIN + col * (symColW + 6);
    const sy = y + row * (symRowH + 2);

    if (i === 0 || i === 2 || i === 4 || i === 6) {
      checkPage(symRowH * 2 + 6);
    }

    // Hintergrund-Karte
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(sx, sy, symColW, symRowH, 1.5, 1.5, "F");

    // Marker-Bild
    if (markerImgs[ms.type]) {
      try {
        doc.addImage(markerImgs[ms.type], "PNG", sx + 3, sy + 3, symImgSize, symImgSize);
      } catch (e) {}
    } else {
      // Fallback: farbiger Kreis
      const rgb = hexToRgb(ms.color);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.circle(sx + 3 + symImgSize / 2, sy + 3 + symImgSize / 2, symImgSize / 2, "F");
    }

    // Text
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(ms.name, sx + 3 + symImgSize + 3, sy + 6);

    // Farb-Indikator
    const rgb = hexToRgb(ms.color);
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(sx + symColW - 8, sy + 3, 5, 5, 0.5, 0.5, "F");

    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    const descLines = doc.splitTextToSize(ms.desc, symColW - symImgSize - 8);
    for (let dl = 0; dl < Math.min(descLines.length, 2); dl++) {
      doc.text(descLines[dl], sx + 3 + symImgSize + 3, sy + 10 + dl * 3.5);
    }
  }

  y += 4 * (symRowH + 2) + 4;

  // UI-Icons Erklaerung
  checkPage(40);
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Wichtige UI-Icons auf der Karte:", MARGIN, y);
  y += 6;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, MARGIN + 50, y);
  y += 6;

  const uiIcons = [
    { symbol: "[GPS]", color: BLUE, name: "GPS-Position", desc: "Zeigt Ihre aktuelle GPS-Position auf der Karte mit Radiuskreis." },
    { symbol: "[PIN]", color: BLUE, name: "Position fixieren", desc: "Setzt eine Position manuell auf der Karte (ohne GPS)." },
    { symbol: "[MOVE]", color: NAVY, name: "Marker verschieben", desc: "Drag & Drop-Modus: Marker an korrekte Position ziehen." },
    { symbol: "[WIFI]", color: GOLD, name: "Offline-Modus", desc: "Schaltet den Offline-Modus ein/aus. Gelb = aktiv." },
    { symbol: "[DL]", color: NAVY, name: "Karten herunterladen", desc: "Kartenausschnitte für Offline-Nutzung speichern." },
    { symbol: "[LAYERS]", color: NAVY, name: "Ebenen-Menü", desc: "Layer ein-/ausschalten, Hintergrundkarte wählen." },
    { symbol: "[+]", color: BLUE, name: "Neues QSO", desc: "Öffnet das QSO-Logbuch-Formular." },
    { symbol: "[BAR]", color: GREEN, name: "Statistik", desc: "Wechselt zur Statistik-Ansicht im Logbuch." }
  ];

  for (const ic of uiIcons) {
    checkPage(8);
    doc.setFillColor(...ic.color);
    doc.roundedRect(MARGIN, y - 3, 8, 5, 0.5, 0.5, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.text(ic.symbol, MARGIN + 4, y + 0.2, { align: "center" });

    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(ic.name, MARGIN + 11, y);
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const icDescLines = doc.splitTextToSize(ic.desc, CONTENT_W - 16);
    doc.text(icDescLines[0], MARGIN + 11, y + 3.5);
    y += 7;
  }

  addFooter();

  // ========== SCREENSHOT-GALERIE ==========
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

  // Drei Screenshots nebeneinander
  const sw = 52, sh = 93;
  const gap = 6;
  const startX = (W - 3 * sw - 2 * gap) / 2;
  const screens = [
    { img: screenshotImgs.map, label: "Karte & Referenzen" },
    { img: screenshotImgs.qso, label: "QSO-Formular" },
    { img: screenshotImgs.stats, label: "Statistik" }
  ];

  for (let i = 0; i < screens.length; i++) {
    const sx = startX + i * (sw + gap);
    // Handy-Rahmen
    doc.setFillColor(...NAVY);
    doc.roundedRect(sx - 1.5, y - 1.5, sw + 3, sh + 8, 2, 2, "F");
    if (screens[i].img) {
      try {
        doc.addImage(screens[i].img, "JPEG", sx, y, sw, sh);
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
    doc.text(screens[i].label, sx + sw / 2, y + sh + 4, { align: "center" });
  }

  y += sh + 12;

  // Hinweis
  doc.setTextColor(...GRAY);
  doc.setFontSize(7.5);
  doc.text("Tipp: Die Screenshots zeigen die Hauptansichten der App – Karte, QSO-Formular und Statistik.", MARGIN, y);

  addFooter();

  // ========== CONTENT PAGES ==========
  for (let si = 0; si < SECTIONS.length; si++) {
    const section = SECTIONS[si];
    doc.addPage();
    const sectionPageNum = doc.internal.getNumberOfPages();
    sectionPageMap[si] = sectionPageNum;
    y = 20;
    addHeader();

    // Section header
    doc.setFillColor(...section.color);
    doc.rect(0, 12, W, 16, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(section.icon + "  " + section.title, MARGIN, 23);
    y = 38;

    for (const item of section.items) {
      checkPage(30);

      // Item title
      doc.setTextColor(...section.color);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(item.title, MARGIN, y);

      // Divider
      doc.setDrawColor(...section.color);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 1.5, MARGIN + CONTENT_W, y + 1.5);
      y += 5;

      // Body text
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

      // Step-by-step
      if (item.steps && item.steps.length > 0) {
        checkPage(item.steps.length * 9 + 5);
        doc.setTextColor(...section.color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Schritt-fuer-Schritt:", MARGIN, y);
        y += 4;

        for (let i = 0; i < item.steps.length; i++) {
          checkPage(10);
          y = drawStepBox(doc, MARGIN, y, CONTENT_W, i + 1, item.steps[i], section.color);
        }
        y += 2;
      }

      // Mockup
      if (item.mockup) {
        checkPage(35);
        y = drawMockup(doc, MARGIN, y, CONTENT_W, item.mockup, section.color);
      }

      // Echter Screenshot
      if (item.screenshot && screenshotImgs[item.screenshot]) {
        checkPage(60);
        const scrW = CONTENT_W * 0.55;
        const scrH = scrW * 1.78; // 9:16 Aspect Ratio
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
        doc.text("Weiterfuehrende Links:", MARGIN, y);
        y += 4;
        for (const link of item.links) {
          checkPage(6);
          y = drawClickableLink(doc, MARGIN + 2, y, "-> " + link.label, link.url, [30, 64, 175]);
        }
        y += 2;
      }

      // Separator
      checkPage(5);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
      y += 5;
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
  doc.textWithLink("E-Mail: hb9om@hb9om.ch", MARGIN, y, { url: LINKS.email });
  y += 6;
  doc.textWithLink("Web: hb9om.ch", MARGIN, y, { url: "https://hb9om.ch" });
  y += 10;

  // Support box
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 2, 2, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Diese App unterstuetzen", MARGIN + 3, y + 5);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Wenn Ihnen diese App gefaellt, freuen wir uns ueber eine kleine Spende.", MARGIN + 3, y + 9);
  y += 13;
  doc.textWithLink("-> Ueber PayPal spenden (paypal.me/Thueler)", MARGIN + 3, y, { url: LINKS.paypal });
  y += 12;

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

  // ========== ADD CLICKABLE TOC LINKS ==========
  for (let i = 0; i < SECTIONS.length; i++) {
    const entry = tocEntries[i];
    const targetPage = sectionPageMap[i];
    if (targetPage) {
      doc.link(MARGIN, entry.y - 2, CONTENT_W, 10, { pageNumber: targetPage });
    }
  }
  // Klickbare Links für Sonderseiten (Symbole & Screenshots)
  if (extraTocEntries[0] && symbolsPageNum) {
    doc.link(MARGIN, extraTocEntries[0].y - 2, CONTENT_W, 10, { pageNumber: symbolsPageNum });
  }
  if (extraTocEntries[1] && screenshotsPageNum) {
    doc.link(MARGIN, extraTocEntries[1].y - 2, CONTENT_W, 10, { pageNumber: screenshotsPageNum });
  }

  doc.save("HB9OM_On_Field_Hilfe.pdf");
}