// Hilfe-PDF Inhaltsdaten – sauberes Deutsch mit Umlauten (ä ö ü ß)
// Keine Emojis, keine nicht-WinAnsi Zeichen

// Externe Links
export const LINKS = {
  sota: "https://www.sotadata.org.uk/summitlist.aspx",
  pota: "https://pota.app/#/park/CH",
  hbff: "https://hbff.ch/Refs/HBFFReferenceSlim.html",
  wwbota: "https://wwbota.net/map/",
  wca: "https://wcagroup.org/?page_id=207",
  iota: "https://www.iota-world.org/islands-on-the-air/iota-groups-islands.html",
  arlhs: "https://wlol.arlhs.com/",
  geoAdmin: "https://map.geo.admin.ch/",
  bafu: "https://www.bafu.admin.ch/bafu/de/home/themen/biodiversitaet/infospezialist/biodiversitaet--daten--und-instrumente.html",
  bakom: "https://www.bakom.admin.ch/bakom/de/home/frequenzen-antennen/frequenzplan.html",
  paypal: "https://paypal.me/Thueler",
  email: "mailto:hb9om@hb9om.ch"
};

// Screenshot URLs (echte App-Screenshots)
export const SCREENSHOTS = {
  map: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/51001fde7_generated_image.png",
  qso: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/f63bcb32e_generated_image.png",
  stats: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/9dd11427e_generated_image.png",
  hero: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/b2f8036bf_generated_image.png",
  settings: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/057e2d1f4_generated_image.png",
  mapOverview: "https://media.base44.com/images/public/6a4a64185561a655062a41bf/a7c136b84_generated_image.png"
};

// Marker-Symbole aus der App
// icon = Lucide-Icon-Name (wie in Layer-Control und Hilfe-Seite)
// shape = Marker-Typ fuer Karten-Marker-Shape (markerShapes.js)
export const MARKER_SYMBOLS = [
  { icon: "mountain", shape: "sota", color: "#e74c3c", name: "SOTA", desc: "Berggipfel ab 150 m Prominenz – Karte: Berg mit Gipfelkreuz" },
  { icon: "trees", shape: "pota", color: "#27ae60", name: "POTA", desc: "Nationalparks und Schutzgebiete – Karte: Baum-Form" },
  { icon: "trees", shape: "hbff", color: "#8e44ad", name: "HBFF", desc: "Flora und Fauna Naturreservate – Karte: Blume" },
  { icon: "building", shape: "wwbota", color: "#795548", name: "WWBOTA", desc: "Militärische Bunker – Karte: Halbkuppel mit Scharte" },
  { icon: "castle", shape: "castle", color: "#e67e22", name: "Burgen/Schlösser", desc: "WCA/COTA Referenzen – Karte: Burg mit Zinnen" },
  { icon: "diamond", shape: "iota", color: "#3498db", name: "IOTA", desc: "Inseln (Schweiz hat keine IOTA) – Karte: Raute mit Welle" },
  { icon: "anchor", shape: "lighthouse", color: "#f39c12", name: "Leuchttürme", desc: "ARLHS WLOL Referenzen – Karte: Leuchtturm mit Licht" },
  { icon: "hexagon", shape: "swiss_protected", color: "#16a085", name: "BLN/Moor", desc: "Bundesinventare / Naturzonen – Karte: Sechseck mit Blatt" }
];

// UI-Icons auf der Karte – Lucide-Icon-Namen wie in der App
export const UI_ICONS = [
  { icon: "locateFixed", color: [59, 130, 246], name: "GPS-Position", desc: "Zeigt Ihre aktuelle GPS-Position auf der Karte mit Radiuskreis." },
  { icon: "mapPin", color: [59, 130, 246], name: "Position fixieren", desc: "Setzt eine Position manuell auf der Karte (ohne GPS)." },
  { icon: "move", color: [11, 30, 51], name: "Marker verschieben", desc: "Drag & Drop-Modus: Marker an korrekte Position ziehen." },
  { icon: "wifi", color: [217, 119, 6], name: "Offline-Modus", desc: "Schaltet den Offline-Modus ein/aus. Gelb = aktiv." },
  { icon: "download", color: [11, 30, 51], name: "Karten herunterladen", desc: "Kartenausschnitte für die Offline-Nutzung speichern." },
  { icon: "layers", color: [11, 30, 51], name: "Ebenen-Menü", desc: "Layer ein-/ausschalten, Hintergrundkarte wählen." },
  { icon: "radio", color: [17, 24, 39], name: "Neues QSO", desc: "Öffnet das QSO-Logbuch-Formular (schwarzer Button unten rechts)." },
  { icon: "barChart3", color: [5, 150, 105], name: "Statistik", desc: "Wechselt zur Statistik-Ansicht im Logbuch." },
  { icon: "clipboardList", color: [59, 130, 246], name: "Meine Anträge", desc: "Zeigt eingereichte Positions-Korrekturen und deren Status." },
  { icon: "search", color: [100, 116, 139], name: "Suchfeld", desc: "Suche nach Referenz-Code, Name oder Ort (oben Mitte)." },
  { icon: "helpCircle", color: [59, 130, 246], name: "Hilfe", desc: "Öffnet diese Hilfe-Anleitung." },
  { icon: "plus", color: [100, 116, 139], name: "Zoom rein/raus", desc: "Karte vergrössern/verkleinern (rechts oben)." },
  { icon: "bookOpen", color: [100, 116, 139], name: "Logbuch (Nav)", desc: "Navigation unten: Wechsel zum QSO-Logbuch." },
  { icon: "settings", color: [100, 116, 139], name: "Einstell. (Nav)", desc: "Navigation unten: Wechsel zu den Einstellungen." },
  { icon: "logOut", color: [100, 116, 139], name: "Abmelden (Nav)", desc: "Navigation unten: Von der App abmelden." }
];

export const SECTIONS = [
  {
    title: "KARTE & REFERENZEN",
    shortTitle: "Karte",
    color: [59, 130, 246],
    letter: "K",
    items: [
      {
        title: "Bildschirm-Aufbau der Karte",
        body: "Die Kartenansicht ist der Hauptbildschirm der App. Hier sehen Sie, wo sich die wichtigsten Bedienelemente befinden:",
        screenLayout: "mapOverview",
        layoutLabels: [
          { num: 1, label: "Suchfeld", desc: "Oben Mitte – Suche nach Referenz-Code, Name oder Ort" },
          { num: 2, label: "Werkzeug-Leiste links", desc: "GPS, Pin, Move, Wifi, Download, Layers – vertikal angeordnet" },
          { num: 3, label: "Kartenbereich", desc: "Zeigt Referenz-Marker in verschiedenen Farben und Formen" },
          { num: 4, label: "Neues QSO", desc: "Schwarzer Button unten rechts – öffnet das QSO-Formular" },
          { num: 5, label: "Navigation", desc: "Ganz unten: Karte, Logbuch, Einstellungen, Abmelden" }
        ]
      },
      {
        title: "Karte navigieren",
        body: "Verschieben Sie die Karte per Drag-and-Drop, zoomen Sie mit dem Mausrad oder mit zwei Fingern auf dem Handy. Die Karte merkt sich die letzte Position.",
        steps: [
          { icon: "move", text: "Karte mit gedrückter Maustaste (oder Finger) verschieben" },
          { icon: "plus", text: "Mit Mausrad oder Zwei-Finger-Pinch zoomen" },
          { icon: "check", text: "Die letzte Position wird automatisch gespeichert" }
        ],
        screenshot: "map"
      },
      {
        title: "Referenzen suchen",
        body: "Im Suchfeld oben können Sie nach Referenz-Codes (z.B. HB/AG-001), Namen (z.B. Uetliberg) oder Orten suchen.",
        steps: [
          { icon: "search", text: "Auf das Suchfeld oben tippen" },
          { icon: "pencil", text: "Code, Namen oder Ort eingeben (z.B. «Uetli»)" },
          { icon: "chevronDown", text: "Ergebnis aus der Dropdown-Liste auswählen" },
          { icon: "mapPin", text: "Karte springt zur ausgewählten Referenz" }
        ],
        mockup: "search"
      },
      {
        title: "Layer ein-/ausschalten",
        body: "Über das Ebenen-Menü (rechts oben) können Sie Referenz-Typen ein- und ausschalten und die Hintergrundkarte wechseln. Das Menü öffnet sich immer ganz oben und liegt über allen anderen Elementen.",
        steps: [
          { icon: "layers", text: "Auf das Layer-Icon (rechts oben) tippen" },
          { icon: "eye", text: "Gewünschte Referenz-Typen ein-/ausschalten (SOTA, POTA, HBFF, etc.)" },
          { icon: "mapPin", text: "Hintergrundkarte wählen (Strassenkarte, Satellit, SwissTopo)" },
          { icon: "check", text: "Menü schliessen – Änderungen sind sofort sichtbar" }
        ],
        mockup: "layers"
      },
      {
        title: "Kartenmassstab wählen",
        body: "Im Ebenen-Menü unter «Kartenmassstab» können Sie einen festen Massstab auswählen: 1:10'000, 1:25'000, 1:50'000 oder 1:100'000. Bei SwissTopo-Karte wird automatisch die entsprechende offizielle Landeskarte verwendet.",
        steps: [
          { icon: "layers", text: "Ebenen-Menü öffnen (Layer-Icon)" },
          { icon: "chevronDown", text: "Bereich «Kartenmassstab» aufklappen" },
          { icon: "ruler", text: "Massstab wählen: 1:10'000 (LK10) bis 1:100'000 (PK100)" },
          { icon: "ruler", text: "Bei «Dynamisch (Auto)» passt sich die Karte dem Zoom an" }
        ],
        tip: "Tipp: 1:25'000 ist ideal für SOTA-Aktivierungen – zeigt Wanderwege und Geländeform genau."
      },
      {
        title: "GPS-Position anzeigen",
        body: "Klicken Sie auf den GPS-Button, um Ihre aktuelle Position auf der Karte anzuzeigen. Die Karte zoomt automatisch so heraus, dass der Radiuskreis vollständig sichtbar ist. Die Pin-Nadel ist rot bei GPS-Position und blau bei fixierter Position.",
        steps: [
          { icon: "locateFixed", text: "GPS-Button (Standort-Icon links) antippen" },
          { icon: "mapPin", text: "Karte zoomt automatisch heraus, Radiuskreis wird sichtbar" },
          { icon: "mapPin", text: "Pin-Nadel anklicken für Koordinaten-Popup" },
          { icon: "globe", text: "Im Popup: Maidenhead-Locator, WGS84 und LV95 Koordinaten" },
          { icon: "ruler", text: "Radius mit Schieberegler anpassen (100 m bis 10 km)" },
          { icon: "mapPin", text: "«Navigieren zu» übergibt Position an Google Maps" }
        ],
        mockup: "gps"
      },
      {
        title: "Position fixieren (ohne GPS)",
        body: "Wenn Sie kein GPS haben oder die Position frei wählen möchten, können Sie die Position auf der Karte festlegen. Die fixierte Position (blau) ersetzt die GPS-Position für die Referenzsuche im QSO-Formular.",
        steps: [
          { icon: "mapPin", text: "Pin-Button (links) antippen" },
          { icon: "mapPin", text: "Auf die gewünschte Stelle der Karte tippen" },
          { icon: "locateFixed", text: "Position erscheint blau, Karte zoomt heraus" },
          { icon: "globe", text: "Popup mit Koordinaten und Radius-Steuerung" },
          { icon: "locateFixed", text: "Erneut GPS-Button klicken, um zur GPS-Position zurückzukehren" }
        ]
      },
      {
        title: "Marker anklicken",
        body: "Klicken Sie auf einen Marker, um Details zu sehen: Referenz-Code, Name, Höhe, Punkte, Aktivierungsanzahl und einen externen Link zum jeweiligen Programm (SOTA, POTA, etc.).",
        steps: [
          { icon: "mapPin", text: "Marker auf der Karte antippen" },
          { icon: "eye", text: "Popup mit Details öffnet sich" },
          { icon: "globe", text: "«Mehr Infos» für externen Link antippen" }
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
        body: "Alle Benutzer können den Drag & Drop-Modus aktivieren, um Marker an die korrekte Position zu verschieben. Administratoren: Die neuen Koordinaten werden sofort gespeichert. Normale Benutzer: Die Verschiebung öffnet einen Dialog für einen Änderungsantrag.",
        steps: [
          { icon: "move", text: "Move-Icon (links neben der Karte) aktivieren" },
          { icon: "move", text: "Marker an die korrekte Position ziehen" },
          { icon: "save", text: "Als Admin: Position wird sofort gespeichert" },
          { icon: "pencil", text: "Als Benutzer: Dialog mit Kommentarfeld öffnet sich" },
          { icon: "clipboardList", text: "«Einreichen» – Status unter «Meine Anträge» verfolgen" }
        ],
        tip: "Tipp: Den Status Ihres Antrags sehen Sie unter «Meine Anträge» (ClipboardList-Icon auf der Karte oder in den Einstellungen)."
      },
      {
        title: "Offline-Modus aktivieren",
        body: "Klicken Sie auf das Wifi-Icon, um den Offline-Modus manuell zu aktivieren oder zu deaktivieren. Im Offline-Modus werden Kartenkacheln aus dem Cache geladen und alle Referenzpunkte aus dem lokalen Speicher angezeigt. QSOs können weiterhin erfasst werden.",
        steps: [
          { icon: "wifi", text: "Wifi-Icon (links neben der Karte) antippen" },
          { icon: "wifiOff", text: "Symbol wird gelb – Offline-Modus aktiv" },
          { icon: "database", text: "Referenzdaten werden lokal gespeichert" },
          { icon: "radio", text: "QSOs können offline erfasst werden" },
          { icon: "cloud", text: "Bei Online-Verbindung wird synchronisiert" }
        ],
        tip: "Tipp: Beim ersten Aktivieren werden alle Referenzdaten lokal gespeichert. Das kann einen Moment dauern."
      },
      {
        title: "Offline-Karten herunterladen",
        body: "Mit dem Download-Icon können Sie Kartenausschnitte für die Offline-Nutzung herunterladen. Wählen Sie die Zoom-Stufen und laden Sie die Kacheln herunter.",
        steps: [
          { icon: "download", text: "Download-Icon (links) antippen" },
          { icon: "mapPin", text: "Gebiet auf der Karte auswählen" },
          { icon: "layers", text: "Zoom-Stufen auswählen" },
          { icon: "download", text: "Download starten – Fortschritt wird angezeigt" },
          { icon: "settings", text: "In Einstellungen unter «Heruntergeladene Karten» verwalten" }
        ]
      },
      {
        title: "Gefahren und Störquellen",
        body: "Der Layer «Gefahren und Störquellen» zeigt Hochspannungsleitungen und Starkstromanlagen (über 36 kV) von map.geo.admin.ch. Diese Informationen sind für Amateurfunker wichtig, da Hochspannungsleitungen Störungen verursachen können.",
        steps: [
          { icon: "layers", text: "Layer-Menü öffnen" },
          { icon: "zap", text: "«Gefahren und Störquellen» aktivieren" },
          { icon: "zap", text: "Rote Linien zeigen Hochspannungsleitungen" },
          { icon: "eye", text: "Auf Leitung tippen für Detail-Popup (Bezeichnung, Eigentümer, Spannung)" }
        ],
        links: [{ label: "geo.admin.ch Karte", url: LINKS.geoAdmin }]
      },
      {
        title: "Referenz-Typen Übersicht",
        body: "Folgende Referenz-Typen werden unterstützt. Klicken Sie auf einen Link für die offizielle Referenzliste:",
        links: [
          { label: "SOTA – Berggipfel", url: LINKS.sota },
          { label: "POTA – Parks und Schutzgebiete", url: LINKS.pota },
          { label: "HBFF – Flora und Fauna", url: LINKS.hbff },
          { label: "WWBOTA – Bunker", url: LINKS.wwbota },
          { label: "WCA/COTA – Burgen und Schlösser", url: LINKS.wca },
          { label: "IOTA – Inseln", url: LINKS.iota },
          { label: "ARLHS WLOL – Leuchttürme", url: LINKS.arlhs },
          { label: "BLN – Bundesinventare", url: LINKS.bafu }
        ]
      }
    ]
  },
  {
    title: "QSO-LOGBUCH",
    shortTitle: "Logbuch",
    color: [5, 150, 105],
    letter: "L",
    items: [
      {
        title: "Neues QSO erfassen",
        body: "Klicken Sie auf der Karte auf den schwarzen Button «Neues QSO» unten rechts. Im Formular geben Sie Rufzeichen, Datum, Zeit, Frequenz, Band, Mode und RST ein. Nach dem Speichern bleibt das Formular offen, damit Sie direkt das nächste QSO erfassen können. Das Formular kann nur über das X-Icon oben rechts geschlossen werden.",
        steps: [
          { icon: "radio", text: "Schwarzen Button «Neues QSO» (unten rechts) antippen" },
          { icon: "pencil", text: "Rufzeichen eingeben (z.B. HB9XYZ)" },
          { icon: "search", text: "QRZ-Button für automatische Datenabfrage" },
          { icon: "clock", text: "Datum und Startzeit (UTC) bestätigen" },
          { icon: "pencil", text: "Frequenz eingeben – Band wird automatisch erkannt" },
          { icon: "pencil", text: "RST gesendet/erhalten eingeben" },
          { icon: "mapPin", text: "Eigenen Standort/Referenz wählen" },
          { icon: "save", text: "«QSO speichern und weiter» – Formular bleibt offen" }
        ],
        mockup: "qso",
        screenshot: "qso",
        tip: "Tipp: Rufzeichen, Operator-Daten und Notizen werden nach dem Speichern zurückgesetzt. Frequenz, Band, Mode, RST und Referenz bleiben erhalten."
      },
      {
        title: "QRZ.com-Abfrage",
        body: "Wenn Sie ein Rufzeichen eingeben und die QRZ-Abfrage aktiviert ist, werden automatisch Name, Adresse, Land, Grid-Locator und E-Mail des Operators von QRZ.com geladen.",
        steps: [
          { icon: "pencil", text: "Rufzeichen in das Eingabefeld tippen" },
          { icon: "search", text: "Tab-Taste oder QRZ-Button für Abfrage" },
          { icon: "user", text: "Daten erscheinen im blauen Kasten" },
          { icon: "check", text: "Name, Adresse, Grid und E-Mail werden übernommen" }
        ],
        tip: "Tipp: Jeder Benutzer kann seine eigenen QRZ.com-Zugangsdaten in den Einstellungen hinterlegen."
      },
      {
        title: "Band und Frequenz automatisch",
        body: "Das Band passt sich automatisch an die eingegebene Frequenz an (z.B. 144.500 MHz -> 2m). Bei manueller Band-Auswahl springt die Frequenz automatisch in die Mitte des Bandes (z.B. 2m -> 145.500 MHz).",
        steps: [
          { icon: "pencil", text: "Frequenz eingeben (z.B. 144.500)" },
          { icon: "check", text: "Band wird automatisch auf «2m» gesetzt" },
          { icon: "chevronDown", text: "Oder: Band manuell wählen -> Frequenz springt in Bandmitte" }
        ]
      },
      {
        title: "Sendeleistung (Power)",
        body: "Im QSO-Formular können Sie die Sendeleistung in Watt eingeben. Der Wert bleibt für das nächste QSO erhalten. Für ADIF-Exporte wird das Feld mit exportiert.",
        steps: [
          { icon: "pencil", text: "Feld «Sendeleistung» (W) ausfüllen" },
          { icon: "save", text: "Wert wird gespeichert und im nächsten QSO vorausgefüllt" },
          { icon: "download", text: "Beim ADIF-Export wird der Wert mit exportiert" }
        ],
        tip: "Tipp: Für QRP-Betrieb «5» Watt eingeben – wird gespeichert und automatisch übernommen."
      },
      {
        title: "Standort / Referenz erfassen",
        body: "Im Formular können Sie Ihren eigenen Standort erfassen: Wählen Sie den Referenz-Typ (SOTA, POTA, etc.) und geben Sie den Code ein oder wählen Sie aus den in der Nähe befindlichen Referenzen. Für generelle Standorte ohne Referenz wählen Sie «Generell» und geben nur Ihren Maidenhead-Locator ein.",
        steps: [
          { icon: "chevronDown", text: "Referenz-Typ wählen (SOTA, POTA, etc.)" },
          { icon: "pencil", text: "Code eingeben (z.B. HB/AG-001) ODER" },
          { icon: "mapPin", text: "«Referenzen in der Nähe» antippen für Liste (5-km-Umkreis)" },
          { icon: "check", text: "Name wird automatisch ergänzt" }
        ]
      },
      {
        title: "Suffix verwenden",
        body: "Suffixe geben an, von wo aus Sie funken: /P = portable (Feldeinsatz), /M = mobil (Auto), /AM = mobilflug, /MM = Seefahrt. Wählen Sie den passenden Suffix im Formular.",
        steps: [
          { icon: "chevronDown", text: "Suffix-Dropdown im QSO-Formular öffnen" },
          { icon: "check", text: "Passenden Suffix wählen (/P, /M, /AM, /MM)" },
          { icon: "save", text: "Suffix wird mit dem Rufzeichen gespeichert" }
        ]
      },
      {
        title: "Clubstation loggen",
        body: "Aktivieren Sie die Checkbox «Clubstation», wenn Sie mit einem abweichenden Stations-Rufzeichen funken (z.B. HB9OM). Es öffnet sich ein Popup, in dem Sie das Clubstations-Rufzeichen, Ihr persönliches Rufzeichen (Operator) und den Operator-Namen eingeben.",
        steps: [
          { icon: "check", text: "Checkbox «Clubstation» aktivieren" },
          { icon: "building", text: "Popup öffnet sich" },
          { icon: "pencil", text: "Clubstations-Rufzeichen eingeben (z.B. HB9OM)" },
          { icon: "user", text: "Operator-Rufzeichen eingeben (persönlich)" },
          { icon: "user", text: "Operator-Name eingeben" },
          { icon: "save", text: "«Bestätigen» – Daten werden für zukünftige QSOs gespeichert" }
        ]
      },
      {
        title: "QSO bearbeiten",
        body: "Klicken Sie auf das Stift-Symbol neben einem Eintrag, um ihn zu bearbeiten. Alle Felder können angepasst werden.",
        steps: [
          { icon: "list", text: "Im Logbuch zum Eintrag scrollen" },
          { icon: "pencil", text: "Stift-Symbol antippen" },
          { icon: "pencil", text: "Felder anpassen" },
          { icon: "save", text: "«Aktualisieren» zum Speichern" }
        ]
      },
      {
        title: "Einträge filtern und sortieren",
        body: "Oben im Logbuch können Sie nach Referenz-Typ filtern, nur aktive oder archivierte Einträge anzeigen und die Sortierung ändern.",
        steps: [
          { icon: "filter", text: "Filter-Dropdown oben antippen" },
          { icon: "chevronDown", text: "Referenz-Typ wählen (z.B. «SOTA»)" },
          { icon: "filter", text: "Sortierung wählen (Datum, Rufzeichen)" },
          { icon: "list", text: "Gefilterte Einträge werden angezeigt" }
        ]
      },
      {
        title: "Einträge archivieren",
        body: "Klicken Sie auf das Archiv-Symbol, um einen Eintrag zu archivieren. Archivierte Einträge werden ausgeblendet, können aber über den Filter «Archiviert» wiederhergestellt werden.",
        steps: [
          { icon: "archive", text: "Archiv-Symbol neben dem Eintrag antippen" },
          { icon: "check", text: "«Archivieren» bestätigen" },
          { icon: "archive", text: "Eintrag wird ausgeblendet" },
          { icon: "archiveRestore", text: "Über Filter «Archiviert» wiederherstellbar" }
        ],
        tip: "Tipp: Archivieren statt löschen! Archivierte Einträge können jederzeit wiederhergestellt werden."
      },
      {
        title: "ADIF-Export",
        body: "Klicken Sie auf «Export (ADIF)», um alle gefilterten Einträge als ADIF-Datei herunterzuladen. Diese Datei kann in andere Logbuch-Programme importiert werden.",
        steps: [
          { icon: "filter", text: "Gewünschte Filter einstellen" },
          { icon: "download", text: "«Export (ADIF)» antippen" },
          { icon: "download", text: ".adi-Datei wird heruntergeladen" },
          { icon: "download", text: "In Logbuch-Programm importieren (HRDLog, N1MM, Log4OM, etc.)" }
        ]
      },
      {
        title: "Statistik-Ansicht",
        body: "Über das Balken-Diagramm-Icon oben rechts im Logbuch können Sie zwischen Listen- und Statistik-Ansicht wechseln. Die Statistik zeigt übersichtliche Diagramme zu QSOs pro Band, Mode, Referenz-Typ und Monat.",
        steps: [
          { icon: "barChart3", text: "Balken-Icon (oben rechts) antippen" },
          { icon: "barChart3", text: "Statistik mit Diagrammen wird angezeigt" },
          { icon: "barChart3", text: "QSOs pro Band, Mode und Referenz-Typ" },
          { icon: "barChart3", text: "Weitere Kennzahlen" }
        ],
        screenshot: "stats"
      },
      {
        title: "Einträge löschen",
        body: "Einzelne Einträge können über das Mülleimer-Symbol gelöscht werden. Über den Button «Löschen» oben können alle aktuell gefilterten Einträge auf einmal gelöscht werden.",
        steps: [
          { icon: "trash2", text: "Mülleimer-Symbol neben dem Eintrag antippen, ODER" },
          { icon: "trash2", text: "«Löschen»-Button für alle gefilterten Einträge" },
          { icon: "check", text: "Bestätigungsdialog bestätigen" }
        ],
        warning: "ACHTUNG: Das Löschen ist unwiderruflich! Gelöschte QSOs können nicht wiederhergestellt werden. Verwenden Sie stattdessen die Archiv-Funktion, wenn Sie sich nicht sicher sind."
      }
    ]
  },
  {
    title: "EINSTELLUNGEN & DATENSICHERUNG",
    shortTitle: "Einstellungen",
    color: [217, 119, 6],
    letter: "E",
    items: [
      {
        title: "Übersicht der Einstellungen",
        body: "In den Einstellungen verwalten Sie Ihr Profil, die QRZ.com-Integration, die Datensicherung und den Offline-Modus. Administratoren finden hier zusätzlich die Benutzerverwaltung und Datenpflege.",
        screenshot: "settings"
      },
      {
        title: "Mein Profil",
        body: "Geben Sie Ihr persönliches Rufzeichen ein. Dieses wird beim Clubstation-Modus als Standard-Operator vorausgefüllt.",
        steps: [
          { icon: "settings", text: "Einstellungen öffnen" },
          { icon: "pencil", text: "Rufzeichen im Feld «Mein Profil» eingeben" },
          { icon: "save", text: "«Speichern» antippen" }
        ],
        tip: "Tipp: Das Rufzeichen wird beim Clubstation-Modus automatisch als Operator vorausgefüllt."
      },
      {
        title: "QRZ.com Abfrage",
        body: "Jeder Benutzer kann seine eigenen QRZ.com-Zugangsdaten in den Einstellungen hinterlegen (Benutzername und Passwort). Der Schalter wird erst aktiviert, wenn Anmeldedaten hinterlegt sind. Administratoren und der Demo-Benutzer nutzen automatisch die Club-XML-Subscription.",
        steps: [
          { icon: "settings", text: "Einstellungen öffnen" },
          { icon: "pencil", text: "QRZ-Benutzername eingeben" },
          { icon: "pencil", text: "QRZ-Passwort eingeben" },
          { icon: "save", text: "«Speichern» antippen" },
          { icon: "check", text: "Schalter «QRZ aktivieren» umlegen" },
          { icon: "search", text: "«QRZ-Verbindung testen» für Prüfung" }
        ],
        tip: "Tipp: Beim Erfassen eines QSOs werden Name, Adresse, Land, Grid-Locator und E-Mail des Operators automatisch von QRZ.com geladen."
      },
      {
        title: "Manuelles Backup (Datei)",
        body: "Neben dem Cloud-Backup können Sie ein manuelles Backup als JSON-Datei herunterladen. Die Datei enthält alle Logbuch-Einträge, Einstellungen, QRZ-Abfragen und Anträge. Mit «Wiederherstellen» laden Sie eine Backup-Datei hoch.",
        steps: [
          { icon: "download", text: "«Backup» unter «Lokales Backup» antippen" },
          { icon: "download", text: "JSON-Datei wird heruntergeladen" },
          { icon: "save", text: "Datei an sicherem Ort speichern" },
          { icon: "archiveRestore", text: "«Wiederherstellen» -> Datei hochladen zum Restore" }
        ],
        warning: "ACHTUNG: Beim Wiederherstellen werden alle aktuellen Daten überschrieben! Stellen Sie sicher, dass Sie die richtige Datei auswählen.",
        tip: "Tipp: Ein Hinweis zeigt das Datum des letzten Backups an. Führen Sie regelmässig Backups durch."
      },
      {
        title: "Cloud-Backup mit WebDAV",
        body: "Für fortgeschrittene Benutzer: Klicken Sie auf «WebDAV (erweitert)», um einen WebDAV-Server (Nextcloud, ownCloud, Synology, Strato HiDrive) zu konfigurieren. Geben Sie URL, Benutzername und Passwort ein, testen Sie die Verbindung und sichern Sie Ihre Daten direkt auf Ihrem Server.",
        steps: [
          { icon: "chevronDown", text: "«WebDAV (erweitert)» aufklappen" },
          { icon: "globe", text: "WebDAV-URL eingeben" },
          { icon: "user", text: "Benutzername eingeben" },
          { icon: "pencil", text: "Passwort / App-Token eingeben" },
          { icon: "search", text: "«Testen» für Verbindungsprüfung" },
          { icon: "save", text: "«Speichern» – Fertig!" },
          { icon: "cloud", text: "Optional: «Auto-Backup bei QSO» aktivieren" }
        ],
        mockup: "webdav",
        screenshot: "settings"
      },
      {
        title: "Cloud-Backups verwalten",
        body: "In der Datei-Liste Ihres WebDAV-Servers können Sie alle in der Cloud gespeicherten Backups anzeigen, wiederherstellen oder löschen. Tippen Sie auf «Dateien», um die Liste zu öffnen.",
        steps: [
          { icon: "cloud", text: "«Dateien»-Button beim WebDAV-Anbieter antippen" },
          { icon: "list", text: "Liste aller Backups wird angezeigt" },
          { icon: "archiveRestore", text: "Wiederherstellen: Upload-Icon antippen" },
          { icon: "trash2", text: "Löschen: Mülleimer-Icon antippen und bestätigen" }
        ],
        warning: "ACHTUNG: Das Löschen von Cloud-Backups ist unwiderruflich! Gelöschte Dateien können nicht wiederhergestellt werden."
      },
      {
        title: "Offline-Modus und Bereitschaft",
        body: "In den Einstellungen unter «Offline-Modus» können Sie den manuellen Offline-Modus mit einem Schalter ein- und ausschalten. Beim Aktivieren werden alle Referenzdaten lokal gespeichert. Ein Status zeigt an, ob die App bereit für die Offline-Nutzung ist.",
        steps: [
          { icon: "wifi", text: "Offline-Modus in Einstellungen aktivieren" },
          { icon: "database", text: "Alle Referenzdaten werden gespeichert" },
          { icon: "check", text: "Status zeigt «App bereit für Offline-Nutzung»" },
          { icon: "download", text: "Heruntergeladene Karten verwalten" }
        ]
      },
      {
        title: "Daten aktualisieren (Admin)",
        body: "Über «Alle Daten aktualisieren» werden alle Referenz-Daten (SOTA, POTA, HBFF, WWBOTA, Burgen, Leuchttürme) neu von den jeweiligen Quellen geladen. Das kann einige Minuten dauern. Nur für Administratoren verfügbar.",
        steps: [
          { icon: "refreshCw", text: "«Alle Daten aktualisieren» antippen" },
          { icon: "check", text: "Warten bis Status «Erfolgreich»" },
          { icon: "database", text: "Cache-Status zeigt Anzahl und Georeferenzierung" }
        ]
      },
      {
        title: "Meine Änderungsanträge",
        body: "Unter «Meine Änderungsanträge» sehen Sie alle Ihre eingereichten Positions-Korrekturen. Jeder Antrag zeigt den Referenz-Code, die aktuelle und vorgeschlagene Position, den Status und eventuelle Admin-Kommentare. Ausstehende Anträge können jederzeit zurückgezogen werden.",
        steps: [
          { icon: "clipboardList", text: "Einstellungen -> «Meine Anträge» oder ClipboardList-Icon auf der Karte" },
          { icon: "eye", text: "Status sehen: In Prüfung, Genehmigt, Abgelehnt, Zurückgezogen" },
          { icon: "archiveRestore", text: "Ausstehende Anträge können zurückgezogen werden" }
        ]
      },
      {
        title: "Benutzerverwaltung (Admin)",
        body: "Administratoren sehen in den Einstellungen einen Bereich «Benutzerverwaltung». Darüber können alle angemeldeten Benutzer eingesehen, Passwörter zurückgesetzt, Rollen geändert (Admin/User) und Benutzer gelöscht werden.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Benutzerverwaltung» (nur Admin)" },
          { icon: "list", text: "Benutzerliste durchsuchen" },
          { icon: "user", text: "Rolle ändern (Admin/User)" },
          { icon: "refreshCw", text: "Passwort zurücksetzen" },
          { icon: "trash2", text: "Benutzer löschen (falls nötig)" }
        ],
        warning: "ACHTUNG: Das Löschen eines Benutzers ist unwiderruflich! Alle Daten des Benutzers (QSO-Logs, Einstellungen) gehen verloren. Neue Admins müssen sich einmal ab- und wieder anmelden."
      },
      {
        title: "Konto löschen",
        body: "Über «Konto löschen» können Sie Ihr Konto inklusive aller QSO-Logs und Einstellungen unwiderruflich löschen.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Konto löschen»" },
          { icon: "shield", text: "Bestätigungsdialog beachten" },
          { icon: "trash2", text: "«Endgültig löschen» antippen" }
        ],
        warning: "ACHTUNG: Die Kontolöschung ist unwiderruflich! Alle Ihre Daten (QSO-Logs, Einstellungen, QRZ-Abfragen, Anträge) werden dauerhaft gelöscht und können NICHT wiederhergestellt werden! Erstellen Sie vorher ein Backup, wenn Sie Ihre Daten behalten möchten."
      }
    ]
  },
  {
    title: "TIPPS & TRICKS",
    shortTitle: "Tipps",
    color: [139, 92, 246],
    letter: "T",
    items: [
      {
        title: "Wake-Lock (Bildschirm an)",
        body: "Beim Erfassen eines QSOs bleibt der Bildschirm aktiviert (Wake-Lock), damit der Bildschirm nicht während des Funkens ausgeht. Schliessen Sie das Formular, um den Bildschirm wieder normal zu nutzen.",
        steps: [
          { icon: "radio", text: "Wird automatisch beim Öffnen des QSO-Formulars aktiviert" },
          { icon: "clock", text: "Bildschirm bleibt an bis Formular geschlossen wird" }
        ]
      },
      {
        title: "Formulardaten bleiben erhalten",
        body: "Häufige Eingaben (Frequenz, Band, Mode, RST, Referenz-Typ, Suffix, Clubstation) werden nach dem Speichern eines QSOs gespeichert und beim nächsten QSO vorausgefüllt. Da das Formular nach dem Speichern offen bleibt, können Sie mehrere QSOs hintereinander schnell erfassen.",
        steps: [
          { icon: "save", text: "Nach QSO-Speichern: Frequenz, Band, Mode, RST bleiben erhalten" },
          { icon: "pencil", text: "Nur Rufzeichen, Datum und Zeit pro QSO anpassen" },
          { icon: "radio", text: "Mehrere QSOs schnell hintereinander erfassen" }
        ],
        tip: "Tipp: Auf 2m/FM gespeichert – das nächste QSO ist automatisch wieder auf 2m/FM eingestellt."
      },
      {
        title: "Hoher Kontrast (Sonnenmodus)",
        body: "Bei starker Sonneneinstrahlung können Sie den hohen Kontrast aktivieren. Schwarzer Hintergrund, gelbe Texte und gelbe Rahmen sorgen für maximale Lesbarkeit bei direktem Sonnenlicht.",
        steps: [
          { icon: "sun", text: "Im QSO-Formular: Sonnen-Icon antippen" },
          { icon: "sun", text: "Schwarzer Hintergrund, gelbe Texte" },
          { icon: "sun", text: "Ideal bei direktem Sonnenlicht" },
          { icon: "sun", text: "Erneut antippen zum Deaktivieren" }
        ]
      },
      {
        title: "Maidenhead-Locator",
        body: "Der Maidenhead-Locator (Grid) ist ein geografisches Koordinatensystem für Amateurfunk. 4 Stellen (z.B. JN36) geben ein Gebiet von ca. 100x100 km an, 6 Stellen (z.B. JN36af) ca. 5x5 km. Bei generellen Standorten ohne Referenz reicht der 4-stellige Locator.",
        steps: [
          { icon: "globe", text: "4 Stellen (z.B. JN36) = ca. 100x100 km" },
          { icon: "globe", text: "6 Stellen (z.B. JN36af) = ca. 5x5 km" },
          { icon: "globe", text: "Bei generellen Standorten reicht 4-stellig" }
        ]
      },
      {
        title: "Lokale Speicherung und Synchronisation",
        body: "Ihre QSO-Logeinträge werden lokal im Browser gespeichert (localStorage). Die Daten sind sofort verfügbar, auch ohne Internetverbindung. Beim Öffnen des Logbuchs werden zuerst die lokalen Daten angezeigt, dann wird im Hintergrund mit dem Server synchronisiert.",
        steps: [
          { icon: "list", text: "Logbuch öffnen -> lokale Daten erscheinen sofort" },
          { icon: "cloud", text: "Cloud-Icon zeigt Synchronisationsstatus" },
          { icon: "cloud", text: "Daten sind auf jedem Gerät verfügbar" }
        ],
        tip: "Tipp: Ein Cloud-Icon neben der Eintragsanzahl zeigt den Synchronisationsstatus an."
      }
    ]
  }
];