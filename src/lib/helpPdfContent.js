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
export const MARKER_SYMBOLS = [
  { type: "sota", color: "#e74c3c", name: "SOTA", desc: "Berggipfel ab 150 m Prominenz" },
  { type: "pota", color: "#27ae60", name: "POTA", desc: "Nationalparks und Schutzgebiete" },
  { type: "hbff", color: "#8e44ad", name: "HBFF", desc: "Flora und Fauna Naturreservate" },
  { type: "wwbota", color: "#795548", name: "WWBOTA", desc: "Militärische Bunker" },
  { type: "castle", color: "#e67e22", name: "Burgen/Schlösser", desc: "WCA/COTA Referenzen" },
  { type: "iota", color: "#3498db", name: "IOTA", desc: "Inseln (Schweiz hat keine IOTA)" },
  { type: "lighthouse", color: "#f39c12", name: "Leuchttürme", desc: "ARLHS WLOL Referenzen" },
  { type: "swiss_protected", color: "#16a085", name: "BLN/Moor", desc: "Bundesinventare / Naturzonen" }
];

// UI-Icons auf der Karte
export const UI_ICONS = [
  { letter: "GPS", color: [59, 130, 246], name: "GPS-Position", desc: "Zeigt Ihre aktuelle GPS-Position auf der Karte mit Radiuskreis." },
  { letter: "PIN", color: [59, 130, 246], name: "Position fixieren", desc: "Setzt eine Position manuell auf der Karte (ohne GPS)." },
  { letter: "MOV", color: [11, 30, 51], name: "Marker verschieben", desc: "Drag & Drop-Modus: Marker an korrekte Position ziehen." },
  { letter: "WIF", color: [217, 119, 6], name: "Offline-Modus", desc: "Schaltet den Offline-Modus ein/aus. Gelb = aktiv." },
  { letter: "DL", color: [11, 30, 51], name: "Karten herunterladen", desc: "Kartenausschnitte für die Offline-Nutzung speichern." },
  { letter: "LAY", color: [11, 30, 51], name: "Ebenen-Menü", desc: "Layer ein-/ausschalten, Hintergrundkarte wählen." },
  { letter: "+", color: [59, 130, 246], name: "Neues QSO", desc: "Öffnet das QSO-Logbuch-Formular (unten rechts)." },
  { letter: "BAR", color: [5, 150, 105], name: "Statistik", desc: "Wechselt zur Statistik-Ansicht im Logbuch." }
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
          "Karte mit gedrückter Maustaste (oder Finger) verschieben",
          "Mit Mausrad oder Zwei-Finger-Pinch zoomen",
          "Die letzte Position wird automatisch gespeichert"
        ],
        screenshot: "map"
      },
      {
        title: "Referenzen suchen",
        body: "Im Suchfeld oben können Sie nach Referenz-Codes (z.B. HB/AG-001), Namen (z.B. Uetliberg) oder Orten suchen.",
        steps: [
          "Auf das Suchfeld oben tippen",
          "Code, Namen oder Ort eingeben (z.B. «Uetli»)",
          "Ergebnis aus der Dropdown-Liste auswählen",
          "Karte springt zur ausgewählten Referenz"
        ],
        mockup: "search"
      },
      {
        title: "Layer ein-/ausschalten",
        body: "Über das Ebenen-Menü (rechts oben) können Sie Referenz-Typen ein- und ausschalten und die Hintergrundkarte wechseln. Das Menü öffnet sich immer ganz oben und liegt über allen anderen Elementen.",
        steps: [
          "Auf das Layer-Icon (rechts oben) tippen",
          "Gewünschte Referenz-Typen ein-/ausschalten (SOTA, POTA, HBFF, etc.)",
          "Hintergrundkarte wählen (Strassenkarte, Satellit, SwissTopo)",
          "Menü schliessen – Änderungen sind sofort sichtbar"
        ],
        mockup: "layers"
      },
      {
        title: "Kartenmassstab wählen",
        body: "Im Ebenen-Menü unter «Kartenmassstab» können Sie einen festen Massstab auswählen: 1:10'000, 1:25'000, 1:50'000 oder 1:100'000. Bei SwissTopo-Karte wird automatisch die entsprechende offizielle Landeskarte verwendet.",
        steps: [
          "Ebenen-Menü öffnen (Layer-Icon)",
          "Bereich «Kartenmassstab» aufklappen",
          "Massstab wählen: 1:10'000 (LK10) bis 1:100'000 (PK100)",
          "Bei «Dynamisch (Auto)» passt sich die Karte dem Zoom an"
        ],
        tip: "Tipp: 1:25'000 ist ideal für SOTA-Aktivierungen – zeigt Wanderwege und Geländeform genau."
      },
      {
        title: "GPS-Position anzeigen",
        body: "Klicken Sie auf den GPS-Button, um Ihre aktuelle Position auf der Karte anzuzeigen. Die Karte zoomt automatisch so heraus, dass der Radiuskreis vollständig sichtbar ist. Die Pin-Nadel ist rot bei GPS-Position und blau bei fixierter Position.",
        steps: [
          "GPS-Button (Standort-Icon links) antippen",
          "Karte zoomt automatisch heraus, Radiuskreis wird sichtbar",
          "Pin-Nadel anklicken für Koordinaten-Popup",
          "Im Popup: Maidenhead-Locator, WGS84 und LV95 Koordinaten",
          "Radius mit Schieberegler anpassen (100 m bis 10 km)",
          "«Navigieren zu» übergibt Position an Google Maps"
        ],
        mockup: "gps"
      },
      {
        title: "Position fixieren (ohne GPS)",
        body: "Wenn Sie kein GPS haben oder die Position frei wählen möchten, können Sie die Position auf der Karte festlegen. Die fixierte Position (blau) ersetzt die GPS-Position für die Referenzsuche im QSO-Formular.",
        steps: [
          "Pin-Button (links) antippen",
          "Auf die gewünschte Stelle der Karte tippen",
          "Position erscheint blau, Karte zoomt heraus",
          "Popup mit Koordinaten und Radius-Steuerung",
          "Erneut GPS-Button klicken, um zur GPS-Position zurückzukehren"
        ]
      },
      {
        title: "Marker anklicken",
        body: "Klicken Sie auf einen Marker, um Details zu sehen: Referenz-Code, Name, Höhe, Punkte, Aktivierungsanzahl und einen externen Link zum jeweiligen Programm (SOTA, POTA, etc.).",
        steps: [
          "Marker auf der Karte antippen",
          "Popup mit Details öffnet sich",
          "«Mehr Infos» für externen Link antippen"
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
          "Move-Icon (links neben der Karte) aktivieren",
          "Marker an die korrekte Position ziehen",
          "Als Admin: Position wird sofort gespeichert",
          "Als Benutzer: Dialog mit Kommentarfeld öffnet sich",
          "«Einreichen» – Status unter «Meine Anträge» verfolgen"
        ],
        tip: "Tipp: Den Status Ihres Antrags sehen Sie unter «Meine Anträge» (ClipboardList-Icon auf der Karte oder in den Einstellungen)."
      },
      {
        title: "Offline-Modus aktivieren",
        body: "Klicken Sie auf das Wifi-Icon, um den Offline-Modus manuell zu aktivieren oder zu deaktivieren. Im Offline-Modus werden Kartenkacheln aus dem Cache geladen und alle Referenzpunkte aus dem lokalen Speicher angezeigt. QSOs können weiterhin erfasst werden.",
        steps: [
          "Wifi-Icon (links neben der Karte) antippen",
          "Symbol wird gelb – Offline-Modus aktiv",
          "Referenzdaten werden lokal gespeichert",
          "QSOs können offline erfasst werden",
          "Bei Online-Verbindung wird synchronisiert"
        ],
        tip: "Tipp: Beim ersten Aktivieren werden alle Referenzdaten lokal gespeichert. Das kann einen Moment dauern."
      },
      {
        title: "Offline-Karten herunterladen",
        body: "Mit dem Download-Icon können Sie Kartenausschnitte für die Offline-Nutzung herunterladen. Wählen Sie die Zoom-Stufen und laden Sie die Kacheln herunter.",
        steps: [
          "Download-Icon (links) antippen",
          "Gebiet auf der Karte auswählen",
          "Zoom-Stufen auswählen",
          "Download starten – Fortschritt wird angezeigt",
          "In Einstellungen unter «Heruntergeladene Karten» verwalten"
        ]
      },
      {
        title: "Gefahren und Störquellen",
        body: "Der Layer «Gefahren und Störquellen» zeigt Hochspannungsleitungen und Starkstromanlagen (über 36 kV) von map.geo.admin.ch. Diese Informationen sind für Amateurfunker wichtig, da Hochspannungsleitungen Störungen verursachen können.",
        steps: [
          "Layer-Menü öffnen",
          "«Gefahren und Störquellen» aktivieren",
          "Rote Linien zeigen Hochspannungsleitungen",
          "Auf Leitung tippen für Detail-Popup (Bezeichnung, Eigentümer, Spannung)"
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
          "Schwarzen Button «Neues QSO» (unten rechts) antippen",
          "Rufzeichen eingeben (z.B. HB9XYZ)",
          "QRZ-Button für automatische Datenabfrage",
          "Datum und Startzeit (UTC) bestätigen",
          "Frequenz eingeben – Band wird automatisch erkannt",
          "RST gesendet/erhalten eingeben",
          "Eigenen Standort/Referenz wählen",
          "«QSO speichern und weiter» – Formular bleibt offen"
        ],
        mockup: "qso",
        screenshot: "qso",
        tip: "Tipp: Rufzeichen, Operator-Daten und Notizen werden nach dem Speichern zurückgesetzt. Frequenz, Band, Mode, RST und Referenz bleiben erhalten."
      },
      {
        title: "QRZ.com-Abfrage",
        body: "Wenn Sie ein Rufzeichen eingeben und die QRZ-Abfrage aktiviert ist, werden automatisch Name, Adresse, Land, Grid-Locator und E-Mail des Operators von QRZ.com geladen.",
        steps: [
          "Rufzeichen in das Eingabefeld tippen",
          "Tab-Taste oder QRZ-Button für Abfrage",
          "Daten erscheinen im blauen Kasten",
          "Name, Adresse, Grid und E-Mail werden übernommen"
        ],
        tip: "Tipp: Jeder Benutzer kann seine eigenen QRZ.com-Zugangsdaten in den Einstellungen hinterlegen."
      },
      {
        title: "Band und Frequenz automatisch",
        body: "Das Band passt sich automatisch an die eingegebene Frequenz an (z.B. 144.500 MHz -> 2m). Bei manueller Band-Auswahl springt die Frequenz automatisch in die Mitte des Bandes (z.B. 2m -> 145.500 MHz).",
        steps: [
          "Frequenz eingeben (z.B. 144.500)",
          "Band wird automatisch auf «2m» gesetzt",
          "Oder: Band manuell wählen -> Frequenz springt in Bandmitte"
        ]
      },
      {
        title: "Sendeleistung (Power)",
        body: "Im QSO-Formular können Sie die Sendeleistung in Watt eingeben. Der Wert bleibt für das nächste QSO erhalten. Für ADIF-Exporte wird das Feld mit exportiert.",
        steps: [
          "Feld «Sendeleistung» (W) ausfüllen",
          "Wert wird gespeichert und im nächsten QSO vorausgefüllt",
          "Beim ADIF-Export wird der Wert mit exportiert"
        ],
        tip: "Tipp: Für QRP-Betrieb «5» Watt eingeben – wird gespeichert und automatisch übernommen."
      },
      {
        title: "Standort / Referenz erfassen",
        body: "Im Formular können Sie Ihren eigenen Standort erfassen: Wählen Sie den Referenz-Typ (SOTA, POTA, etc.) und geben Sie den Code ein oder wählen Sie aus den in der Nähe befindlichen Referenzen. Für generelle Standorte ohne Referenz wählen Sie «Generell» und geben nur Ihren Maidenhead-Locator ein.",
        steps: [
          "Referenz-Typ wählen (SOTA, POTA, etc.)",
          "Code eingeben (z.B. HB/AG-001) ODER",
          "«Referenzen in der Nähe» antippen für Liste (5-km-Umkreis)",
          "Name wird automatisch ergänzt"
        ]
      },
      {
        title: "Suffix verwenden",
        body: "Suffixe geben an, von wo aus Sie funken: /P = portable (Feldeinsatz), /M = mobil (Auto), /AM = mobilflug, /MM = Seefahrt. Wählen Sie den passenden Suffix im Formular.",
        steps: [
          "Suffix-Dropdown im QSO-Formular öffnen",
          "Passenden Suffix wählen (/P, /M, /AM, /MM)",
          "Suffix wird mit dem Rufzeichen gespeichert"
        ]
      },
      {
        title: "Clubstation loggen",
        body: "Aktivieren Sie die Checkbox «Clubstation», wenn Sie mit einem abweichenden Stations-Rufzeichen funken (z.B. HB9OM). Es öffnet sich ein Popup, in dem Sie das Clubstations-Rufzeichen, Ihr persönliches Rufzeichen (Operator) und den Operator-Namen eingeben.",
        steps: [
          "Checkbox «Clubstation» aktivieren",
          "Popup öffnet sich",
          "Clubstations-Rufzeichen eingeben (z.B. HB9OM)",
          "Operator-Rufzeichen eingeben (persönlich)",
          "Operator-Name eingeben",
          "«Bestätigen» – Daten werden für zukünftige QSOs gespeichert"
        ]
      },
      {
        title: "QSO bearbeiten",
        body: "Klicken Sie auf das Stift-Symbol neben einem Eintrag, um ihn zu bearbeiten. Alle Felder können angepasst werden.",
        steps: [
          "Im Logbuch zum Eintrag scrollen",
          "Stift-Symbol antippen",
          "Felder anpassen",
          "«Aktualisieren» zum Speichern"
        ]
      },
      {
        title: "Einträge filtern und sortieren",
        body: "Oben im Logbuch können Sie nach Referenz-Typ filtern, nur aktive oder archivierte Einträge anzeigen und die Sortierung ändern.",
        steps: [
          "Filter-Dropdown oben antippen",
          "Referenz-Typ wählen (z.B. «SOTA»)",
          "Sortierung wählen (Datum, Rufzeichen)",
          "Gefilterte Einträge werden angezeigt"
        ]
      },
      {
        title: "Einträge archivieren",
        body: "Klicken Sie auf das Archiv-Symbol, um einen Eintrag zu archivieren. Archivierte Einträge werden ausgeblendet, können aber über den Filter «Archiviert» wiederhergestellt werden.",
        steps: [
          "Archiv-Symbol neben dem Eintrag antippen",
          "«Archivieren» bestätigen",
          "Eintrag wird ausgeblendet",
          "Über Filter «Archiviert» wiederherstellbar"
        ],
        tip: "Tipp: Archivieren statt löschen! Archivierte Einträge können jederzeit wiederhergestellt werden."
      },
      {
        title: "ADIF-Export",
        body: "Klicken Sie auf «Export (ADIF)», um alle gefilterten Einträge als ADIF-Datei herunterzuladen. Diese Datei kann in andere Logbuch-Programme importiert werden.",
        steps: [
          "Gewünschte Filter einstellen",
          "«Export (ADIF)» antippen",
          ".adi-Datei wird heruntergeladen",
          "In Logbuch-Programm importieren (HRDLog, N1MM, Log4OM, etc.)"
        ]
      },
      {
        title: "Statistik-Ansicht",
        body: "Über das Balken-Diagramm-Icon oben rechts im Logbuch können Sie zwischen Listen- und Statistik-Ansicht wechseln. Die Statistik zeigt übersichtliche Diagramme zu QSOs pro Band, Mode, Referenz-Typ und Monat.",
        steps: [
          "Balken-Icon (oben rechts) antippen",
          "Statistik mit Diagrammen wird angezeigt",
          "QSOs pro Band, Mode und Referenz-Typ",
          "Weitere Kennzahlen"
        ],
        screenshot: "stats"
      },
      {
        title: "Einträge löschen",
        body: "Einzelne Einträge können über das Mülleimer-Symbol gelöscht werden. Über den Button «Löschen» oben können alle aktuell gefilterten Einträge auf einmal gelöscht werden.",
        steps: [
          "Mülleimer-Symbol neben dem Eintrag antippen, ODER",
          "«Löschen»-Button für alle gefilterten Einträge",
          "Bestätigungsdialog bestätigen"
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
          "Einstellungen öffnen",
          "Rufzeichen im Feld «Mein Profil» eingeben",
          "«Speichern» antippen"
        ],
        tip: "Tipp: Das Rufzeichen wird beim Clubstation-Modus automatisch als Operator vorausgefüllt."
      },
      {
        title: "QRZ.com Abfrage",
        body: "Jeder Benutzer kann seine eigenen QRZ.com-Zugangsdaten in den Einstellungen hinterlegen (Benutzername und Passwort). Der Schalter wird erst aktiviert, wenn Anmeldedaten hinterlegt sind. Administratoren und der Demo-Benutzer nutzen automatisch die Club-XML-Subscription.",
        steps: [
          "Einstellungen öffnen",
          "QRZ-Benutzername eingeben",
          "QRZ-Passwort eingeben",
          "«Speichern» antippen",
          "Schalter «QRZ aktivieren» umlegen",
          "«QRZ-Verbindung testen» für Prüfung"
        ],
        tip: "Tipp: Beim Erfassen eines QSOs werden Name, Adresse, Land, Grid-Locator und E-Mail des Operators automatisch von QRZ.com geladen."
      },
      {
        title: "Manuelles Backup (Datei)",
        body: "Neben dem Cloud-Backup können Sie ein manuelles Backup als JSON-Datei herunterladen. Die Datei enthält alle Logbuch-Einträge, Einstellungen, QRZ-Abfragen und Anträge. Mit «Wiederherstellen» laden Sie eine Backup-Datei hoch.",
        steps: [
          "«Backup» unter «Lokales Backup» antippen",
          "JSON-Datei wird heruntergeladen",
          "Datei an sicherem Ort speichern",
          "«Wiederherstellen» -> Datei hochladen zum Restore"
        ],
        warning: "ACHTUNG: Beim Wiederherstellen werden alle aktuellen Daten überschrieben! Stellen Sie sicher, dass Sie die richtige Datei auswählen.",
        tip: "Tipp: Ein Hinweis zeigt das Datum des letzten Backups an. Führen Sie regelmässig Backups durch."
      },
      {
        title: "Cloud-Backup mit WebDAV",
        body: "Für fortgeschrittene Benutzer: Klicken Sie auf «WebDAV (erweitert)», um einen WebDAV-Server (Nextcloud, ownCloud, Synology, Strato HiDrive) zu konfigurieren. Geben Sie URL, Benutzername und Passwort ein, testen Sie die Verbindung und sichern Sie Ihre Daten direkt auf Ihrem Server.",
        steps: [
          "«WebDAV (erweitert)» aufklappen",
          "WebDAV-URL eingeben",
          "Benutzername eingeben",
          "Passwort / App-Token eingeben",
          "«Testen» für Verbindungsprüfung",
          "«Speichern» – Fertig!",
          "Optional: «Auto-Backup bei QSO» aktivieren"
        ],
        mockup: "webdav",
        screenshot: "settings"
      },
      {
        title: "Cloud-Backups verwalten",
        body: "In der Datei-Liste Ihres WebDAV-Servers können Sie alle in der Cloud gespeicherten Backups anzeigen, wiederherstellen oder löschen. Tippen Sie auf «Dateien», um die Liste zu öffnen.",
        steps: [
          "«Dateien»-Button beim WebDAV-Anbieter antippen",
          "Liste aller Backups wird angezeigt",
          "Wiederherstellen: Upload-Icon antippen",
          "Löschen: Mülleimer-Icon antippen und bestätigen"
        ],
        warning: "ACHTUNG: Das Löschen von Cloud-Backups ist unwiderruflich! Gelöschte Dateien können nicht wiederhergestellt werden."
      },
      {
        title: "Offline-Modus und Bereitschaft",
        body: "In den Einstellungen unter «Offline-Modus» können Sie den manuellen Offline-Modus mit einem Schalter ein- und ausschalten. Beim Aktivieren werden alle Referenzdaten lokal gespeichert. Ein Status zeigt an, ob die App bereit für die Offline-Nutzung ist.",
        steps: [
          "Offline-Modus in Einstellungen aktivieren",
          "Alle Referenzdaten werden gespeichert",
          "Status zeigt «App bereit für Offline-Nutzung»",
          "Heruntergeladene Karten verwalten"
        ]
      },
      {
        title: "Daten aktualisieren (Admin)",
        body: "Über «Alle Daten aktualisieren» werden alle Referenz-Daten (SOTA, POTA, HBFF, WWBOTA, Burgen, Leuchttürme) neu von den jeweiligen Quellen geladen. Das kann einige Minuten dauern. Nur für Administratoren verfügbar.",
        steps: [
          "«Alle Daten aktualisieren» antippen",
          "Warten bis Status «Erfolgreich»",
          "Cache-Status zeigt Anzahl und Georeferenzierung"
        ]
      },
      {
        title: "Meine Änderungsanträge",
        body: "Unter «Meine Änderungsanträge» sehen Sie alle Ihre eingereichten Positions-Korrekturen. Jeder Antrag zeigt den Referenz-Code, die aktuelle und vorgeschlagene Position, den Status und eventuelle Admin-Kommentare. Ausstehende Anträge können jederzeit zurückgezogen werden.",
        steps: [
          "Einstellungen -> «Meine Anträge» oder ClipboardList-Icon auf der Karte",
          "Status sehen: In Prüfung, Genehmigt, Abgelehnt, Zurückgezogen",
          "Ausstehende Anträge können zurückgezogen werden"
        ]
      },
      {
        title: "Benutzerverwaltung (Admin)",
        body: "Administratoren sehen in den Einstellungen einen Bereich «Benutzerverwaltung». Darüber können alle angemeldeten Benutzer eingesehen, Passwörter zurückgesetzt, Rollen geändert (Admin/User) und Benutzer gelöscht werden.",
        steps: [
          "Einstellungen -> «Benutzerverwaltung» (nur Admin)",
          "Benutzerliste durchsuchen",
          "Rolle ändern (Admin/User)",
          "Passwort zurücksetzen",
          "Benutzer löschen (falls nötig)"
        ],
        warning: "ACHTUNG: Das Löschen eines Benutzers ist unwiderruflich! Alle Daten des Benutzers (QSO-Logs, Einstellungen) gehen verloren. Neue Admins müssen sich einmal ab- und wieder anmelden."
      },
      {
        title: "Konto löschen",
        body: "Über «Konto löschen» können Sie Ihr Konto inklusive aller QSO-Logs und Einstellungen unwiderruflich löschen.",
        steps: [
          "Einstellungen -> «Konto löschen»",
          "Bestätigungsdialog beachten",
          "«Endgültig löschen» antippen"
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
          "Wird automatisch beim Öffnen des QSO-Formulars aktiviert",
          "Bildschirm bleibt an bis Formular geschlossen wird"
        ]
      },
      {
        title: "Formulardaten bleiben erhalten",
        body: "Häufige Eingaben (Frequenz, Band, Mode, RST, Referenz-Typ, Suffix, Clubstation) werden nach dem Speichern eines QSOs gespeichert und beim nächsten QSO vorausgefüllt. Da das Formular nach dem Speichern offen bleibt, können Sie mehrere QSOs hintereinander schnell erfassen.",
        steps: [
          "Nach QSO-Speichern: Frequenz, Band, Mode, RST bleiben erhalten",
          "Nur Rufzeichen, Datum und Zeit pro QSO anpassen",
          "Mehrere QSOs schnell hintereinander erfassen"
        ],
        tip: "Tipp: Auf 2m/FM gespeichert – das nächste QSO ist automatisch wieder auf 2m/FM eingestellt."
      },
      {
        title: "Hoher Kontrast (Sonnenmodus)",
        body: "Bei starker Sonneneinstrahlung können Sie den hohen Kontrast aktivieren. Schwarzer Hintergrund, gelbe Texte und gelbe Rahmen sorgen für maximale Lesbarkeit bei direktem Sonnenlicht.",
        steps: [
          "Im QSO-Formular: Sonnen-Icon antippen",
          "Schwarzer Hintergrund, gelbe Texte",
          "Ideal bei direktem Sonnenlicht",
          "Erneut antippen zum Deaktivieren"
        ]
      },
      {
        title: "Maidenhead-Locator",
        body: "Der Maidenhead-Locator (Grid) ist ein geografisches Koordinatensystem für Amateurfunk. 4 Stellen (z.B. JN36) geben ein Gebiet von ca. 100x100 km an, 6 Stellen (z.B. JN36af) ca. 5x5 km. Bei generellen Standorten ohne Referenz reicht der 4-stellige Locator.",
        steps: [
          "4 Stellen (z.B. JN36) = ca. 100x100 km",
          "6 Stellen (z.B. JN36af) = ca. 5x5 km",
          "Bei generellen Standorten reicht 4-stellig"
        ]
      },
      {
        title: "Lokale Speicherung und Synchronisation",
        body: "Ihre QSO-Logeinträge werden lokal im Browser gespeichert (localStorage). Die Daten sind sofort verfügbar, auch ohne Internetverbindung. Beim Öffnen des Logbuchs werden zuerst die lokalen Daten angezeigt, dann wird im Hintergrund mit dem Server synchronisiert.",
        steps: [
          "Logbuch öffnen -> lokale Daten erscheinen sofort",
          "Cloud-Icon zeigt Synchronisationsstatus",
          "Daten sind auf jedem Gerät verfügbar"
        ],
        tip: "Tipp: Ein Cloud-Icon neben der Eintragsanzahl zeigt den Synchronisationsstatus an."
      }
    ]
  }
];