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
  email: "mailto:hb9om@hb9om.ch",
  repeaterbook: "https://www.repeaterbook.com/row_repeaters/?state_id=CH",
  repeaterbookUS: "https://www.repeaterbook.com/repeater.php?state_id=none&country=United+States",
  repeaterbookCA: "https://www.repeaterbook.com/repeater.php?state_id=none&country=Canada",
  repeaterbookSA: "https://www.repeaterbook.com/row_repeaters/?state_id=none&country=South+America",
  repeaterbookAF: "https://www.repeaterbook.com/row_repeaters/?state_id=none&country=Africa",
  repeaterbookOC: "https://www.repeaterbook.com/row_repeaters/?state_id=none&country=Oceania",
  arrl: "https://www.arrl.org/repeater-directory",
  wia: "https://www.wia.org.au/members/repeaters/",
  iz8wnh: "https://www.iz8wnh.it/",
  brandmeister: "https://brandmeister.network/",
  dmrMarc: "https://www.dmr-marc.net/",
  echolink: "https://www.echolink.org/",
  allstar: "https://www.allstarlink.org/"
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
  { icon: "trees", shape: "hbff", color: "#8e44ad", name: "WWFF", desc: "Flora und Fauna Naturreservate – Karte: Blume" },
  { icon: "building", shape: "wwbota", color: "#795548", name: "WWBOTA", desc: "Militärische Bunker, farbig nach Land – Karte: Halbkuppel mit Scharte" },
  { icon: "castle", shape: "castle", color: "#e67e22", name: "WCA/COTA", desc: "Burgen und Schlösser – Karte: Burg mit Zinnen" },
  { icon: "diamond", shape: "iota", color: "#3498db", name: "IOTA", desc: "Inseln – Karte: Raute mit Welle" },
  { icon: "anchor", shape: "lighthouse", color: "#f39c12", name: "WLOTA/ARLHS", desc: "Leuchttürme – Karte: Leuchtturm mit Licht" },
  { icon: "hexagon", shape: "swiss_protected", color: "#16a085", name: "BLN – Natur Zonen (nur in CH)", desc: "Bundesinventare / Naturzonen – Karte: Sechseck mit Blatt" },
  { icon: "zap", shape: "hazards", color: "#dc2626", name: "Gefahren & Störquellen (nur in CH)", desc: "Hochspannungsleitungen, Mobilfunkantennen, Richtfunk, Radio/TV-Sender – Karte: Blitz" },
  { icon: "radioTower", shape: "repeater", color: "#3b82f6", name: "Amateurfunk-Relais", desc: "FM, C4FM, DMR, D-STAR Relais mit permanenten Verlinkungen, Radius-Filter und Notstrom-Info – Karte: Turm mit Blitzsymbol, farbig nach Modulation" },
  { icon: "wifi", shape: "private_node", color: "#8b5cf6", name: "APRS", desc: "Alle APRS-Stationen: Digipeater, IGates, Wetter, Hotspots und mobile Nutzer – Symbole nach APRS-Standard: Stern (Digipeater), Haus (Hotspot), Quadrat mit W (Wetter), Stern mit I (IGate) – farbig nach Node-Typ" }
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
    description: "In diesem Kapitel lernen Sie die interaktive Karte kennen: Navigation, Referenzsuche, Layer-Verwaltung, GPS-Positionierung, Offline-Modus und alle Marker-Symbole der verschiedenen Referenz-Typen.",
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
        title: "GPS-Standort-Tracking (Dauerhaft)",
        body: "In den Einstellungen kann eine permanente GPS-Anzeige aktiviert werden. Ein blaues Kreuz mit Mittelpunkt zeigt Ihren aktuellen Standort auf der Karte – unabhaengig vom GPS-Button fuer die QSO-Positionierung. Das Aktualisierungsintervall ist einstellbar von 30 Sekunden bis 1 Stunde. Ein kuerzeres Intervall liefert eine genauere Position, erhoeht aber den Akkuverbrauch.",
        steps: [
          { icon: "settings", text: "In die Einstellungen wechseln" },
          { icon: "locateFixed", text: "«GPS-Standort auf Karte» einschalten" },
          { icon: "clock", text: "Aktualisierungsintervall waehlen (30 s bis 1 h)" },
          { icon: "mapPin", text: "Blaues Kreuz erscheint auf der Karte" }
        ],
        tip: "Tipp: 1 Minute ist ein guter Kompromiss zwischen Genauigkeit und Akkuverbrauch."
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
        body: "Der Layer «Gefahren und Störquellen» zeigt Hochspannungsleitungen, Starkstromanlagen, Mobilfunkantennen, Richtfunkstrecken und Radio-/Fernsehsender von map.geo.admin.ch. Diese Informationen sind für Amateurfunker wichtig, da elektrische Anlagen und Sendeanlagen Störungen verursachen können.",
        steps: [
          { icon: "layers", text: "Layer-Menü öffnen" },
          { icon: "zap", text: "«Gefahren und Störquellen» aktivieren" },
          { icon: "zap", text: "Rote Linien zeigen Hochspannungsleitungen" },
          { icon: "eye", text: "Auf Objekt tippen für Detail-Popup" },
          { icon: "zap", text: "Details: Bezeichnung, Eigentümer, Spannung, Frequenz, Antennenhöhe" },
          { icon: "globe", text: "«In map.geo.admin.ch öffnen» öffnet Karte an exakter Position mit Fadenkreuz" }
        ],
        tip: "Tipp: Der map.geo.admin.ch-Link öffnet die Karte mit den korrekten LV95-Koordinaten, dem richtigen Zoom-Level und dem aktiven Layer – Sie landen genau am geklickten Punkt.",
        links: [{ label: "geo.admin.ch Karte", url: LINKS.geoAdmin }]
      },
      {
        title: "Standort-Info bei Gefahren und Naturzonen",
        body: "Wenn Sie die Layer «Gefahren und Störquellen» oder «Natur Zonen» aktiviert haben, können Sie auf die Karte tippen, um detaillierte Informationen zu den Objekten an diesem Standort abzufragen. Bei Richtfunkstrecken und Sendemasten werden zusätzlich Frequenzbereich, Kanal, Bandbreite, Programm, Dienstart, System, Sektor, Tilt und Gain angezeigt. Wenn keine Detaildaten verfügbar sind, erscheint direkt der Link zu map.geo.admin.ch. Jeder Layer-Abschnitt hat einen eigenen Deep-Link, der die Karte mit LV95-Koordinaten, richtigem Zoom, aktivem Layer und Fadenkreuz-Marker öffnet.",
        steps: [
          { icon: "layers", text: "Layer «Gefahren» oder «Natur Zonen» aktivieren" },
          { icon: "mapPin", text: "Auf Karte tippen – Popup erscheint bei Treffer" },
          { icon: "eye", text: "Details wie Eigentümer, Spannung, Frequenz etc." },
          { icon: "globe", text: "«In map.geo.admin.ch öffnen» – exakte Position mit Fadenkreuz" }
        ],
        tip: "Tipp: Im Energiesparmodus werden nur die wichtigsten Layer abgefragt (Starkstromanlagen). BAKOM-Details werden übersprungen."
      },
      {
        title: "Referenz-Typen Übersicht",
        body: "Folgende Referenz-Typen werden unterstützt. Klicken Sie auf einen Link für die offizielle Referenzliste:",
        links: [
          { label: "SOTA – Berggipfel", url: LINKS.sota },
          { label: "POTA – Parks und Schutzgebiete", url: LINKS.pota },
          { label: "WWFF – Flora und Fauna", url: "https://wwff.co/directory/" },
          { label: "WWBOTA – Bunker", url: LINKS.wwbota },
          { label: "WCA/COTA – Burgen und Schlösser", url: LINKS.wca },
          { label: "IOTA – Inseln", url: LINKS.iota },
          { label: "WLOTA/ARLHS – Leuchttürme", url: LINKS.arlhs },
          { label: "BLN – Natur Zonen (nur in CH)", url: LINKS.bafu },
          { label: "Gefahren & Störquellen (nur in CH)", url: LINKS.geoAdmin }
        ]
      }
    ]
  },
  {
    title: "QSO-LOGBUCH",
    shortTitle: "Logbuch",
    color: [5, 150, 105],
    letter: "L",
    description: "Hier erfahren Sie alles über das Erfassen, Bearbeiten und Verwalten von Funkverbindungen (QSOs): vom ersten Eintrag über QRZ.com-Abfragen bis hin zu ADIF-Export und Statistik-Auswertungen.",
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
    description: "Dieses Kapitel behandelt Ihr Profil, die QRZ.com-Integration, lokale und Cloud-basierte Datensicherung (WebDAV), den Offline-Modus sowie die Kontoverwaltung.",
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
        title: "Meine Änderungsanträge",
        body: "Unter «Meine Änderungsanträge» sehen Sie alle Ihre eingereichten Positions-Korrekturen. Jeder Antrag zeigt den Referenz-Code, die aktuelle und vorgeschlagene Position, den Status und eventuelle Admin-Kommentare. Ausstehende Anträge können jederzeit zurückgezogen werden.",
        steps: [
          { icon: "clipboardList", text: "Einstellungen -> «Meine Anträge» oder ClipboardList-Icon auf der Karte" },
          { icon: "eye", text: "Status sehen: In Prüfung, Genehmigt, Abgelehnt, Zurückgezogen" },
          { icon: "archiveRestore", text: "Ausstehende Anträge können zurückgezogen werden" }
        ]
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
    description: "Praktische Hinweise für den Alltag: Wake-Lock, Formulardaten-Erhaltung, Sonnenmodus für starke Sonneneinstrahlung, Maidenhead-Locator und lokale Speicherung mit Synchronisation.",
    items: [
      {
        title: "Ladeanzeige bei vielen Daten",
        body: "Wenn die App viele Referenzdaten laden muss (z.B. beim ersten Start oder bei vielen aktivierten Layern), erscheint oben ein Lade-Indikator. Wenn das Laden länger als 1,5 Sekunden dauert, wird ein kleines Handfunkgerät mit aussendenden Funkwellen angezeigt. Es weist darauf hin, dass viele Daten geladen werden und etwas Geduld nötig ist. Zusätzlich werden Tipps eingeblendet: Kartenausschnitt verkleinern, weniger Layer aktivieren oder den Performance-Modus in den Einstellungen einschalten. Der Lade-Indikator erscheint auch während dem Splash-Screen, falls das Laden der Referenzdaten länger dauert.",
        steps: [
          { icon: "zap", text: "Viele Layer aktiviert + langsames Internet" },
          { icon: "clock", text: "Nach 1,5s erscheint das Handfunkgerät mit Wellen" },
          { icon: "mapPin", text: "Tipp: Kartenausschnitt verkleinern" },
          { icon: "layers", text: "Tipp: Weniger Layer aktivieren" },
          { icon: "settings", text: "Tipp: Performance-Modus in den Einstellungen" }
        ],
        tip: "Tipp: Die App lädt zuerst den lokalen Cache (sofortige Anzeige), dann wird im Hintergrund der Server-Cache geladen. Erst wenn Daten fehlen, werden die externen Quellen abgefragt."
      },
      {
        title: "Energiesparmodus (Performance)",
        body: "In den Einstellungen können Sie den Energiesparmodus aktivieren – ideal für langsame Geräte oder instabile Internetverbindungen. Marker werden als einfache farbige Kreise gerendert. Beim Antippen eines Markers zeigt das Popup nur die wichtigsten Infos (Name, Referenz-Code, Koordinaten). Ein «Mehr Infos»-Button lädt die vollständigen Details erst auf Wunsch nach. Beim Gefahren-Layer werden nur die wichtigsten Layer abgefragt.",
        steps: [
          { icon: "settings", text: "Einstellungen öffnen" },
          { icon: "zap", text: "Energiesparmodus aktivieren" },
          { icon: "mapPin", text: "Marker erscheinen als einfache Kreise" },
          { icon: "chevronDown", text: "Marker antippen – «Mehr Infos» für volle Details" },
          { icon: "chevronUp", text: "«Weniger Infos» blendet Details wieder aus" }
        ],
        tip: "Tipp: Im Sparmodus werden nur sichtbare Marker gerendert (Viewport-Culling) und die Kartenkacheln mit Hardware-Beschleunigung geladen."
      },
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
        title: "Nach Clubstation filtern",
        body: "Im Logbuch koennen Sie QSOs nach Quelle filtern: «Alle QSOs», «Persönlich» (nur eigene Rufzeichen) oder «Clubstation» (nur QSOs, die fuer eine Clubstation z.B. HB9OM geloggt wurden). Der Filter wirkt sich auch auf den ADIF-Export aus – so koennen Sie gezielt nur Clubstation-QSOs exportieren.",
        steps: [
          { icon: "filter", text: "Filter-Dropdown «Alle QSOs / Persönlich / Clubstation» waehlen" },
          { icon: "list", text: "Liste zeigt nur gefilterte QSOs" },
          { icon: "download", text: "Export (ADIF) exportiert nur die gefilterten QSOs" }
        ],
        tip: "Tipp: Kombinieren Sie den Clubstation-Filter mit dem Typ-Filter (z.B. SOTA) und dem Datums-Filter, um sehr spezifische Exporte zu erstellen."
      },
      {
        title: "Relais-Verlinkungen",
        body: "Relais-Verlinkungen (Linien zwischen Relais) werden nur angezeigt, wenn RepeaterBook.com tatsaechliche Crosslink-Daten fuer ein Relais enthaelt (Feld «Crosslinked to / with»). Gleiches Rufzeichen auf unterschiedlichen Baendern bedeutet NICHT automatisch, dass die Relais zusammengeschaltet sind. Viele Relais teilen sich ein Rufzeichen, arbeiten aber unabhaengig. Die Verlinkungs-Linien zeigen ausschliesslich echte, von der Quelle bestaetigte Querverbindungen.",
        steps: [
          { icon: "link2", text: "Verlinkungs-Button (Ketten-Icon) aktivieren" },
          { icon: "check", text: "Linien erscheinen nur bei echten Crosslinks" },
          { icon: "eye", text: "Im Popup werden verlinkte Relais nur bei echten Daten angezeigt" }
        ],
        tip: "Tipp: Da viele Relais-Betreiber das Crosslink-Feld nicht ausfuellen, werden oft keine Linien angezeigt. Das ist korrekt – es werden keine falschen Verlinkungen dargestellt."
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
  },
  {
    title: "RELAIS & VERLINKUNGEN",
    shortTitle: "Relais",
    color: [59, 130, 246],
    letter: "R",
    description: "Das Relais-Overlay zeigt Amateurfunk-Relais auf der Karte – farbcodiert nach Modulation (FM, C4FM, DMR, D-STAR etc.), mit Verlinkungen zwischen Relais, Laenderfilter, Distanzanzeige und Google-Maps-Navigation.",
    items: [
      {
        title: "Relais-Overlay aktivieren",
        body: "Oeffnen Sie das Ebenen-Menue (Layer-Icon rechts oben) und aktivieren Sie die Ebene «Amateurfunk-Relais». Relais werden als farbige Kreise auf der Karte angezeigt – farbcodiert nach Modulationsart.",
        steps: [
          { icon: "layers", text: "Layer-Icon (rechts oben) antippen" },
          { icon: "radioTower", text: "«Amateurfunk-Relais» aktivieren" },
          { icon: "eye", text: "Relais erscheinen als farbige Kreise auf der Karte" }
        ]
      },
      {
        title: "Modulationsart erkennen",
        body: "Jeder Relais-Marker ist nach seiner Hauptmodulation farbcodiert: Rot = FM, Gruen = C4FM (Fusion), Blau = DMR, Violett = D-STAR, Orange = P-25, Tuerkis = NXDN, Pink = M17. In der Legende unten links werden die aktiven Modulationsarten angezeigt.",
        steps: [
          { icon: "eye", text: "Farbe des Kreises pruefen" },
          { icon: "signal", text: "Rot = FM, Gruen = C4FM, Blau = DMR, Violett = D-STAR" },
          { icon: "layers", text: "Legende unten links zeigt alle aktiven Farben" }
        ],
        tip: "Tipp: Ein Relais kann mehrere Modulationsarten unterstuetzen (z.B. FM + Fusion + EchoLink). Die Hauptfarbe zeigt die digitale Modulation."
      },
      {
        title: "Relais-Filter verwenden",
        body: "Wenn das Relais-Overlay aktiv ist, erscheint oben links ein Relais-Filter-Button. Tippen Sie darauf, um nach Land, Modulationsart zu filtern, Relais zu suchen und Verlinkungen ein-/auszuschalten.",
        steps: [
          { icon: "radioTower", text: "Relais-Filter-Button (oben links) antippen" },
          { icon: "globe", text: "Land filtern (alle Laender oder einzelnes Land waehlen)" },
          { icon: "filter", text: "Modulationsarten ein-/ausschalten (FM, C4FM, DMR, etc.)" },
          { icon: "search", text: "Suchfeld: Rufzeichen, Ort, Land oder Frequenz eingeben" },
          { icon: "link2", text: "Verlinkungen ein-/ausschalten" }
        ],
        tip: "Tipp: Der Laenderfilter zeigt alle verfuegbaren Laender mit Anzahl Relais. Wahlen Sie ein Land, um nur Relais dieses Landes zu sehen."
      },
      {
        title: "Relais-Details abrufen",
        body: "Tippen Sie auf einen Relais-Marker, um Details zu sehen: Rufzeichen, Frequenz mit Offset, Zugangston (CTCSS/CC), Modulationsarten, Band, Status (On Air/Off Air), EchoLink-Knotennummer, Web-Link und verlinkte Relais.",
        steps: [
          { icon: "mapPin", text: "Relais-Marker auf der Karte antippen" },
          { icon: "eye", text: "Popup zeigt Rufzeichen, Frequenz, Offset und Zugang" },
          { icon: "signal", text: "Modulationsart-Badges und Band werden angezeigt" },
          { icon: "globe", text: "Web-Link antippen fuer Relais-Homepage" }
        ]
      },
      {
        title: "Verlinkungen zwischen Relais",
        body: "Relais mit demselben Rufzeichen auf verschiedenen Baendern (z.B. HB9LU auf 2m und 70cm) sind miteinander verlinkt. Die App zeichnet blaue gestrichelte Linien zwischen diesen Relais. Im Popup werden alle verlinkten Frequenzen aufgelistet.",
        steps: [
          { icon: "link2", text: "Blaue gestrichelte Linien zeigen verlinkte Relais" },
          { icon: "mapPin", text: "Relais antippen – verlinkte Frequenzen im Popup" },
          { icon: "link2", text: "Verlinkungen im Filter ein-/ausschaltbar" }
        ],
        tip: "Tipp: EchoLink-Relais sind weltweit ueber das EchoLink-Netzwerk verlinkt. Die Knotennummer im Popup zeigt die Verbindung an."
      },
      {
        title: "Distanz und Navigation",
        body: "Wenn Sie Ihre GPS-Position oder eine fixierte Position gesetzt haben, wird im Popup eines Relais oder Referenzpunktes die Distanz von Ihrem Standort angezeigt. Ausserdem koennen Sie direkt zu jedem Punkt mit Google Maps navigieren.",
        steps: [
          { icon: "mapPin", text: "GPS-Position oder fixierte Position setzen (links oben)" },
          { icon: "mapPin", text: "Punkt antippen – Distanz wird im Popup angezeigt" },
          { icon: "navigation", text: "«Navigieren (Google Maps)» antippen fuer Route" }
        ],
        tip: "Tipp: Die Distanz wird als Luftlinie berechnet. Google Maps oeffnet mit der Zielkoordinate und berechnet die Strassenroute."
      },
      {
        title: "FM-Funknetz.de Hinweis",
        body: "Relais, die auf FM-Funknetz.de online anhoerbar sind, werden mit einem gruenen Kopfhoerer-Badge im Popup markiert. Die Verfuegbarkeit wird regelmmaessig geprueft.",
        steps: [
          { icon: "headphones", text: "Gruenes Kopfhoerer-Icon im Popup = auf FM-Funknetz.de anhoerbar" },
          { icon: "radioTower", text: "Nur FM-Relais koennen auf FM-Funknetz.de verfuegbar sein" }
        ]
      },
      {
        title: "EchoLink-Filter",
        body: "Im Relais-Filter gibt es einen EchoLink-Filter (Feature-Filter). EchoLink ist keine eigene Modulationsart, sondern ein Feature – ein Relais kann FM oder DMR sein und gleichzeitig EchoLink unterstuetzen. Der EchoLink-Filter zeigt alle Relais mit EchoLink-Zugang, unabhaengig vom Hauptmodus. EchoLink-Relais sind weltweit ueber das EchoLink-Netzwerk verlinkt.",
        steps: [
          { icon: "radioTower", text: "Relais-Filter oeffnen (oben links)" },
          { icon: "filter", text: "EchoLink im Modulationsart-Filter einschalten" },
          { icon: "link2", text: "Alle Relais mit EchoLink werden angezeigt (unabhaengig von FM/DMR/etc.)" }
        ],
        tip: "Tipp: EchoLink-Filter kann mit anderen Filtern kombiniert werden – z.B. EchoLink + DMR zeigt nur DMR-Relais mit EchoLink."
      },
      {
        title: "Nur verlinkte Relais anzeigen",
        body: "Der Filter «Nur verlinkte Relais» blendet alle unverlinkten Relais aus und zeigt nur Relais mit echten Crosslinks an – analog zum EchoLink-Filter. Es werden nur Relais angezeigt, die tatsaechlich mit anderen Relais verlinkt sind (RepeaterBook-Crosslinks oder admin-bestätigte Verlinkungen). Das hilft, uebersichtlich nur vernetzte Relais zu sehen und die Verlinkungs-Linien besser zu erkennen.",
        steps: [
          { icon: "radioTower", text: "Relais-Filter oeffnen (oben links)" },
          { icon: "link2", text: "Schalter «Nur verlinkte Relais» aktivieren" },
          { icon: "link2", text: "Alle unverlinkten Relais werden ausgeblendet" },
          { icon: "eye", text: "Nur Relais mit echten Crosslinks bleiben sichtbar" }
        ],
        tip: "Tipp: Kombinieren Sie «Nur verlinkte Relais» mit «Verlinkungen anzeigen», um das gesamte Verlinkungsnetzwerk auf einen Blick zu sehen."
      },
      {
        title: "Relais-Quellen weltweit",
        body: "Die Relais-Daten stammen von RepeaterBook.com und decken alle Kontinente ab: Europa (7928), Nordamerika (USA 50 Bundesstaaten + DC, Kanada 13 Provinzen), Suedamerika (1375), Afrika (166), Asien (517), Ozeanien (Australien, Neuseeland, Papua-Neuguinea, Fidschi). Zusaetzlich werden DMR-Verlinkungen von der BrandMeister Network API abgerufen. Weitere Referenz-Quellen: ARRL Repeater Directory (US/Kanada), WIA (Australien), iz8wnh.it (weltweite Echtzeit-Karte).",
        steps: [
          { icon: "globe", text: "RepeaterBook: 80+ Laender weltweit abgedeckt" },
          { icon: "globe", text: "Nordamerika: USA (50 Bundesstaaten + DC) + Kanada (13 Provinzen)" },
          { icon: "globe", text: "Suedamerika: Argentinien, Brasilien, Chile, Kolumbien, Ecuador, Peru, Uruguay, Venezuela, Bolivien, Paraguay, Guyana, Suriname" },
          { icon: "globe", text: "Afrika: Suedafrika, Kenia, Marokko, Nigeria, Ghana, Aegypten, Namibia, Botswana, Simbabwe, Sambia, Mauritius, Reunion, Madagaskar, Senegal, Kamerun, Uganda, Tansania, Lesotho, Eswatini" },
          { icon: "globe", text: "Ozeanien: Australien, Neuseeland, Papua-Neuguinea, Fidschi" },
          { icon: "globe", text: "Asien: Japan, Suedkorea, China, Indien, Indonesien, Malaysia, Philippinen, Thailand u.v.m." }
        ],
        links: [
          { label: "RepeaterBook weltweit", url: LINKS.repeaterbook },
          { label: "ARRL Repeater Directory (US/Kanada)", url: LINKS.arrl },
          { label: "WIA Repeaters (Australien)", url: LINKS.wia },
          { label: "iz8wnh.it Echtzeit-Karte", url: LINKS.iz8wnh },
          { label: "BrandMeister Network", url: LINKS.brandmeister }
        ],
        tip: "Tipp: Nicht fuer alle Laender sind viele Relais verfuegbar. Die Datenbank wird laufend erweitert."
      },
      {
        title: "Abdeckung pro Relais anzeigen",
        body: "Neben der globalen Abdeckungs-Anzeige (alle Relais) koennen Sie die Abdeckung auch fuer ein einzelnes Relais im Popup ein- und ausschalten. Tippen Sie auf «Abdeckung» im Popup, um die geschaetzte Reichweite fuer dieses Relais als Kreis anzuzeigen. Die Reichweite basiert auf dem Band (2m ~35 km, 70cm ~25 km, etc.).",
        steps: [
          { icon: "mapPin", text: "Relais-Marker antippen – Popup oeffnet sich" },
          { icon: "signal", text: "«Abdeckung»-Button im Popup antippen" },
          { icon: "signal", text: "Gruener Kreis zeigt geschaetzte Reichweite" },
          { icon: "signal", text: "Erneut antippen zum Ausblenden" }
        ],
        tip: "Tipp: Die globale Abdeckung (alle Relais) im Relais-Filter bleibt davon unberuehrt. Pro-Relais-Abdeckung ist zusaetzlich."
      },
      {
        title: "Admin: Relais-Verwaltung",
        body: "Administratoren koennen im Relais-Popup zusaetzliche Aktionen ausloesen: den Web-Link eines Relais ergaenzen oder korrigieren (Stift-Icon) und die Abdeckungsberechnung fuer ein einzelnes Relais anstossen («Abdeckung berechnen»). Die Abdeckung wird basierend auf Band, Standorthoehe und Gelaendefaktor verfeinert. Normale Benutzer sehen diese Buttons nicht.",
        steps: [
          { icon: "mapPin", text: "Relais-Marker antippen – Popup oeffnet sich" },
          { icon: "pencil", text: "Admin: Stift-Icon neben Web-Link fuer Link-Ergaenzung" },
          { icon: "signal", text: "Admin: «Abdeckung berechnen» fuer einzelnes Relais" },
          { icon: "check", text: "Abdeckung wird im Hintergrund verfeinert (Band + Hoehe + Gelände)" }
        ],
        tip: "Tipp: Die Abdeckungsberechnung kann auch im Admin-Panel fuer ganze Laender oder weltweit ausgeloest werden."
      },
      {
        title: "Verlinkung melden (fehlende/existente)",
        body: "Im Relais-Popup koennen Sie Verlinkungen zwischen Relais melden – sowohl fehlende als auch existierende. Tippen Sie auf «Verlinkung» im Popup, waehlen Sie das Ziel-Relais (nach Distanz sortiert), und geben Sie Netzwerk (Brandmeister, XLX, EchoLink) und Beschreibung an. Ihr Vorschlag wird als «ausstehend» gespeichert und von einem Admin geprueft.",
        steps: [
          { icon: "mapPin", text: "Relais-Marker antippen – Popup oeffnet sich" },
          { icon: "link2", text: "«Verlinkung»-Button antippen" },
          { icon: "link2", text: "Ziel-Relais aus Liste waehlen (nach Distanz)" },
          { icon: "pencil", text: "Netzwerk und Beschreibung eingeben" },
          { icon: "clipboardList", text: "Einreichen – Admin prueft den Vorschlag" }
        ],
        tip: "Tipp: Melden Sie Crosslinks, EchoLink-Verbindungen, Brandmeister-Talkgroups oder andere Netzwerk-Verlinkungen."
      },
      {
        title: "APRS – Amateur Radio Positioning",
        body: "Die Ebene «APRS – Amateur Radio Positioning» zeigt APRS-Stationen weltweit auf der Karte: Digipeater, IGates, Hotspots, AllStar- und EchoLink-Nodes sowie Wetterstationen. Die Daten stammen von APRS.fi. Die APRS-Datenbank waechst inkrementell: Bei jeder Aktualisierung werden nur neue Rufzeichen abgefragt und vorhandene Stationen werden aktualisiert. So wird die Datenbank mit jeder Abfrage groesser und spaeter muessen nur noch Aenderungen abgefragt werden. Jeder Node-Typ wird mit dem entsprechenden APRS-Standard-Symbol dargestellt – farbig nach Typ. Ueber den APRS-Filter (Wifi-Icon oben links) koennen einzelne Node-Typen ein- und ausgeschaltet werden.",
        steps: [
          { icon: "layers", text: "Layer-Icon (rechts oben) antippen" },
          { icon: "wifi", text: "«APRS – Amateur Radio Positioning» aktivieren" },
          { icon: "wifi", text: "APRS-Filter (Wifi-Icon oben links) fuer Node-Typ-Filter" },
          { icon: "mapPin", text: "Symbole nach APRS-Standard: Stern (Digipeater), Haus (Hotspot), Quadrat mit W (Wetter)" },
          { icon: "mapPin", text: "Popup antippen fuer Node-Details" }
        ],
        tip: "Tipp: Die APRS-Datenbank waechst mit jeder Aktualisierung – bestehende Stationen bleiben erhalten, neue werden hinzugefuegt. Spaeter werden nur noch Aenderungen abgefragt."
      },
      {
        title: "Kontinent-Filter",
        body: "Im Ebenen-Menue gibt es einen Kontinent-Filter, mit dem Sie Overlay-Ebenen nach Kontinent ein- und ausblenden koennen. Waehlen Sie «Ganze Welt» (Standard) oder einzelne Kontinente (Europa, Nordamerika, Asien, etc.). Der Filter wirkt sich auf alle Referenz-Ebenen aus (SOTA, POTA, HBFF, etc.).",
        steps: [
          { icon: "layers", text: "Ebenen-Menue oeffnen (Layer-Icon rechts oben)" },
          { icon: "globe", text: "Bereich «Kontinent-Filter» aufklappen" },
          { icon: "globe", text: "«Ganze Welt» oder einzelne Kontinente waehlen" },
          { icon: "check", text: "Marker ausserhalb der Auswahl werden ausgeblendet" }
        ],
        tip: "Tipp: Der Kontinent-Filter hilft bei Uebersichtlichkeit – blenden Sie z.B. nur Europa ein, wenn Sie nur europaeische Referenzen sehen moechten."
      },
      {
        title: "Weltweite Referenz-Erweiterung",
        body: "Alle Referenz-Ebenen sind weltweit erweiterbar: SOTA unterstuetzt alle Assoziationen weltweit, POTA alle Entitaeten. Die App ruft standardmaessig Schweizer Daten ab, kann aber vom Admin auf weltweite Daten erweitert werden. Burgen, Leuchttuerme und WWBOTA sind bereits weltweit verfuegbar.",
        steps: [
          { icon: "layers", text: "Layer aktivieren – Schweizer Daten werden geladen" },
          { icon: "globe", text: "Kontinent-Filter auf andere Kontinente erweitern" },
          { icon: "radioTower", text: "Relais sind bereits weltweit (80+ Laender inkl. USA/Kanada)" }
        ],
        tip: "Tipp: Admins koennen die weltweite Aktualisierung im Admin-Panel ausloesen."
      }
    ]
  }
];

// Checkliste fuer erste Inbetriebnahme
// mandatory = true: zwingend fuer Grundfunktionen
// mandatory = false: optional fuer erweiterte Funktionen
export const SETUP_CHECKLIST = [
  {
    category: "Konto & Profil",
    items: [
      { text: "Konto erstellen und anmelden", mandatory: true },
      { text: "Persönliches Rufzeichen im Profil erfassen", mandatory: true },
      { text: "QRZ.com-Zugangsdaten hinterlegen (für automatische Operator-Abfragen)", mandatory: false }
    ]
  },
  {
    category: "Karte & Referenzen",
    items: [
      { text: "GPS-Berechtigung im Browser erteilen", mandatory: true },
      { text: "Gewünschte Referenz-Layer aktivieren (SOTA, POTA, etc.)", mandatory: true },
      { text: "Hintergrundkarte wählen (Strassenkarte, Satellit, SwissTopo)", mandatory: false },
      { text: "Kartenmassstab festlegen (z.B. 1:25'000 für SOTA)", mandatory: false },
      { text: "Offline-Karten für Einsatzgebiete herunterladen", mandatory: false },
      { text: "Offline-Modus aktivieren und Referenzdaten lokal speichern", mandatory: false }
    ]
  },
  {
    category: "QSO-Logbuch",
    items: [
      { text: "Erstes QSO erfassen und speichern", mandatory: true },
      { text: "Band und Mode korrekt einstellen", mandatory: true },
      { text: "Eigenen Standort/Referenz erfassen (SOTA, POTA, etc.)", mandatory: true },
      { text: "Suffix wählen (/P für portable, etc.)", mandatory: false },
      { text: "Clubstation-Modus einrichten (falls relevant)", mandatory: false },
      { text: "Statistik-Ansicht testen", mandatory: false },
      { text: "ADIF-Export testen", mandatory: false }
    ]
  },
  {
    category: "Datensicherung",
    items: [
      { text: "Erstes lokales Backup erstellen (JSON-Datei)", mandatory: true },
      { text: "Backup-Datei an sicherem Ort aufbewahren", mandatory: true },
      { text: "WebDAV-Cloud-Backup einrichten", mandatory: false },
      { text: "Auto-Backup bei jedem QSO aktivieren", mandatory: false }
    ]
  }
];

// === Repeater-Verlinkung Informationen ===
// Quellen: BrandMeister Network API, RepeaterBook, DMR-MARC, ARRL Repeater Directory
export const REPEATER_LINKING_INFO = {
  title: "Relais-Verlinkungen (Crosslinks)",
  description: "Relais können über verschiedene Netzwerke dauerhaft oder temporär miteinander verlinkt sein. Diese Verlinkungen erweitern die Reichweite und ermöglichen weltweite Kommunikation.",
  networks: [
    {
      name: "BrandMeister (DMR)",
      description: "Das grösste DMR-Netzwerk mit über 500 Repeatern in 83 Ländern. Verlinkungen über Talkgroups und Peer-IDs. API: api.brandmeister.network",
      url: "https://brandmeister.network/",
      features: ["Dynamic Talkgroups", "Static Talkgroups", "Peer-to-Peer Crosslinks", "XLX-Reflector-Anbindung"]
    },
    {
      name: "DMR-MARC",
      description: "Zweites grosses DMR-Netzwerk mit über 6600 registrierten Repeatern. Unabhängig von BrandMeister.",
      url: "https://www.dmr-marc.net/",
      features: ["Talkgroups", "Reflectors", "Brandmeister-Crosslinks"]
    },
    {
      name: "EchoLink",
      description: "Internet-basiertes System, das Relais und Hotspots weltweit verbindet. Über 2000 aktive Nodes.",
      url: "https://www.echolink.org/",
      features: ["Konferenz-Server", "Verlinkung von Relais über Internet", "Smartphone-App"]
    },
    {
      name: "AllStarLink",
      description: "VoIP-basiertes Verlinkungssystem, hauptsächlich in Nordamerika. Über 3000 aktive Nodes.",
      url: "https://www.allstarlink.org/",
      features: ["Node-to-Node-Verlinkung", "Konferenz-Bridges", "IRLP-Kompatibilität"]
    },
    {
      name: "WIRES-X (Yaesu Fusion)",
      description: "Yaesu-eigenes Verlinkungssystem für Fusion/C4FM-Relais. Verbindet Relais über Internet.",
      url: "https://www.yaesu.com/",
      features: ["Digitaler Raum", "Analoger Raum", "Node-Verlinkung"]
    },
    {
      name: "D-STAR (XLX/XRF/REF)",
      description: "D-STAR-Reflektoren verlinken D-STAR-Relais weltweit. XLX-Reflektoren sind die moderne Variante.",
      url: "https://www.dstarusers.net/",
      features: ["REF-Reflektoren", "XRF-Reflektoren", "XLX-Multi-Protocol-Reflektoren"]
    }
  ],
  dataSources: [
    { name: "RepeaterBook", url: "https://www.repeaterbook.com/", desc: "Weltweite Repeater-Datenbank mit Crosslink-Informationen" },
    { name: "BrandMeister API", url: "https://api.brandmeister.network/", desc: "Echtzeit-Daten aller BrandMeister-DMR-Relais und deren Verlinkungen" },
    { name: "DMR-MARC", url: "https://www.dmr-marc.net/", desc: "DMR-MARC Repeater-Verzeichnis" },
    { name: "APRS.fi", url: "https://aprs.fi/", desc: "APRS-Stationen inkl. Digipeater und IGates" }
  ],
  mapFeatures: [
    "Permanente Verlinkungen als gestrichelte Linien auf der Karte",
    "BrandMeister-DMR-Crosslinks werden automatisch von der API abgerufen",
    "RepeaterBook-Crosslinks aus den Detailseiten werden geparst",
    "Admin-bestätigte Verlinkungen können manuell hinzugefügt werden",
    "Temporäre Verlinkungen werden nicht angezeigt (nur permanente)"
  ]
};

// === APRS-Filter Erklärung ===
export const APRS_FILTER_INFO = {
  title: "APRS-Filter",
  description: "Der APRS-Filter blendet APRS-Stationen nach Node-Typ ein und aus. Die Symbole entsprechen dem APRS-Standard (aprs.org).",
  nodeTypes: [
    { type: "hotspot", symbol: "Haus", aprsCode: "/H", desc: "Private Hotspots (DMR, D-STAR, Fusion)" },
    { type: "simplex_node", symbol: "Radio", aprsCode: "/r", desc: "Simplex-Nodes mit fester Frequenz" },
    { type: "repeater_node", symbol: "Stern (Digipeater)", aprsCode: "/#", desc: "Digipeater und Repeater-Nodes" },
    { type: "allstar_node", symbol: "Stern mit A", aprsCode: "/n", desc: "AllStar-Link-Nodes" },
    { type: "echolink_node", symbol: "Stern mit I (IGate)", aprsCode: "/i", desc: "EchoLink-IGates und EchoLink-Nodes" },
    { type: "weather_station", symbol: "Quadrat mit W", aprsCode: "/W", desc: "APRS-Wetterstationen" },
    { type: "other", symbol: "Kreis", aprsCode: "/O", desc: "Sonstige APRS-Stationen" }
  ],
  rules: [
    "Node-Typ-Filter: einzelne Typen ein-/ausschalten (Hotspot, Digipeater, IGate, Wetter, etc.)",
    "Suche: nach Rufzeichen, Ort oder Netzwerk suchen",
    "Symbole entsprechen dem APRS-Standard (aprs.org)",
    "Datenquelle: APRS.fi API (Digipeater, IGates, Wetterstationen, Hotspots weltweit)",
    "Admin: APRS.fi-Daten ueber das Admin-Panel aktualisieren",
    "Hinweis: Nicht fuer alle Kontinente/Laender sind bereits APRS-Daten verfuegbar"
  ]
};

// === Repeater-Filter Erklärung ===
export const REPEATER_FILTER_INFO = {
  title: "Relais-Filter",
  rules: [
    "Mindestens eine Modulationsart muss aktiv sein, sonst werden keine Relais angezeigt",
    "FM, Fusion, DMR, D-STAR, P-25, NXDN, M17 sind Hauptmodulationsarten",
    "EchoLink ist ein Feature-Filter: zeigt alle Relais mit EchoLink-Zugang unabhängig vom Hauptmodus",
    "Nur verlinkte Relais: blendet alle unverlinkten Relais aus, zeigt nur Relais mit echten Crosslinks (analog EchoLink-Filter)",
    "Kontinent-Filter: «Ganze Welt» oder einzelne Kontinente (Europa, Nordamerika, Asien, etc.)",
    "Land-Filter: nach einzelnen Ländern filtern (alle Länder verfügbar)",
    "Radius-Filter: nur Relais innerhalb eines Radius von Ihrer GPS-Position",
    "Suche: nach Rufzeichen, Ort, Land oder Frequenz suchen",
    "Abdeckung: geschätzte Reichweite pro Relais (verfeinert durch APRS-Dichte und Geländedaten)",
    "Verlinkungen: permanente Crosslinks als gestrichelte Linien anzeigen",
    "Admin: pro Relais Web-Link ergänzen und Abdeckungsberechnung anstossen"
  ],
  continentalSources: [
    { continent: "Europa", source: "RepeaterBook (7928 Relais)", url: "https://www.repeaterbook.com/row_repeaters/" },
    { continent: "Nordamerika", source: "RepeaterBook USA (50 Bundesstaaten + DC) & Kanada (13 Provinzen), ARRL Repeater Directory", url: "https://www.arrl.org/repeater-directory" },
    { continent: "Südamerika", source: "RepeaterBook (1375 Relais): Argentinien, Brasilien, Chile, Kolumbien, Ecuador, Peru, Uruguay, Venezuela, Bolivien, Paraguay, Guyana, Suriname", url: "https://www.repeaterbook.com/row_repeaters/" },
    { continent: "Afrika", source: "RepeaterBook (166 Relais): Südafrika, Kenia, Marokko, Nigeria, Ghana, Ägypten, Namibia, Botswana, Simbabwe, Sambia, Mauritius, Réunion, Madagaskar, Senegal, Kamerun, Uganda, Tansania, Lesotho, Eswatini", url: "https://www.repeaterbook.com/row_repeaters/" },
    { continent: "Ozeanien", source: "RepeaterBook + WIA (Wireless Institute of Australia): Australien, Neuseeland, Papua-Neuguinea, Fidschi", url: "https://www.wia.org.au/members/repeaters/" },
    { continent: "Asien", source: "RepeaterBook (517 Relais): Japan, Südkorea, China, Indien, Indonesien, Malaysia, Philippinen, Thailand, Singapur u.v.m.", url: "https://www.repeaterbook.com/row_repeaters/" },
    { continent: "Weltweit", source: "iz8wnh.it – Interaktive Weltkarte aller Relais und Bake (Echtzeit)", url: "https://www.iz8wnh.it/" },
    { continent: "DMR-Netzwerke", source: "BrandMeister Network API + DMR-MARC – weltweite DMR-Relais mit Verlinkungen", url: "https://brandmeister.network/" }
  ]
};