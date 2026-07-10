import { jsPDF } from "jspdf";

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
        ]
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
        mockup: "qso"
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
        ]
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
        title: "Cloud-Backup mit Google Drive",
        body: "Verbinden Sie Ihr Google Drive mit einem Klick. Backups werden automatisch in Ihre Cloud hochgeladen.",
        steps: [
          "Einstellungen → «Datensicherung»",
          "«Mit Google Drive verbinden» antippen",
          "Google-Konto im Popup auswaehlen",
          "Zugriff erlauben – Popup schliesst sich",
          "Status zeigt «Verbunden» (gruen)",
          "«Backup» fuer manuelles Backup antippen",
          "Oder «Automatisches Backup» aktivieren"
        ],
        mockup: "cloudGoogle"
      },
      {
        title: "Cloud-Backup mit OneDrive",
        body: "Genauso einfach verbinden Sie Ihr OneDrive (Microsoft-Konto).",
        steps: [
          "Einstellungen → «Datensicherung»",
          "«Mit OneDrive verbinden» antippen",
          "Microsoft-Konto im Popup auswaehlen",
          "Zugriff erlauben – Popup schliesst sich",
          "Status zeigt «Verbunden» (gruen)",
          "Backup-Funktionen wie bei Google Drive"
        ],
        mockup: "cloudOneDrive"
      },
      {
        title: "Cloud-Backups verwalten",
        body: "Listen Sie vorhandene Backups auf, stellen Sie sie wiederher oder loeschen Sie sie.",
        steps: [
          "«Dateien»-Button beim Cloud-Anbieter antippen",
          "Liste aller Backups wird angezeigt",
          "Wiederherstellen: Upload-Icon antippen",
          "Loeschen: Muellheimer-Icon antippen und bestaetigen"
        ]
      },
      {
        title: "Verbindung trennen",
        body: "Sie koennen die Verbindung zu Google Drive oder OneDrive jederzeit entfernen.",
        steps: [
          "«Verbindung trennen» antippen",
          "Verbindung wird entfernt",
          "Bereits hochgeladene Backups bleiben erhalten",
          "Neu verbinden jederzeit moeglich"
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
  } else if (type === "cloudGoogle") {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x + 2, y + 2, w - 4, 24, 1, 1, "F");
    doc.setTextColor(15, 157, 88);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("Google Drive", x + 3, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...GRAY);
    doc.text("Google-Konto verbinden", x + 3, y + 9);
    doc.setTextColor(15, 157, 88);
    doc.text("o Nicht verbunden", x + 3, y + 13);
    doc.setFillColor(15, 157, 88);
    doc.roundedRect(x + 3, y + 15, 25, 5, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(5.5);
    doc.text("Mit Google Drive verbinden", x + 5, y + 18);
    doc.setTextColor(...GRAY);
    doc.setFontSize(5);
    doc.text("Klicken -> Google-Konto waehlen -> Zugriff erlauben", x + 3, y + 23);
  } else if (type === "cloudOneDrive") {
    doc.setFillColor(...WHITE);
    doc.roundedRect(x + 2, y + 2, w - 4, 24, 1, 1, "F");
    doc.setTextColor(0, 120, 212);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("OneDrive", x + 3, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...GRAY);
    doc.text("Microsoft-Konto verbinden", x + 3, y + 9);
    doc.setTextColor(0, 120, 212);
    doc.text("o Nicht verbunden", x + 3, y + 13);
    doc.setFillColor(0, 120, 212);
    doc.roundedRect(x + 3, y + 15, 22, 5, 1, 1, "F");
    doc.setTextColor(...WHITE);
    doc.setFontSize(5.5);
    doc.text("Mit OneDrive verbinden", x + 5, y + 18);
    doc.setTextColor(...GRAY);
    doc.setFontSize(5);
    doc.text("Klicken -> Microsoft-Konto waehlen -> Zugriff erlauben", x + 3, y + 23);
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
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 85, "F");

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

  doc.save("HB9OM_On_Field_Hilfe.pdf");
}