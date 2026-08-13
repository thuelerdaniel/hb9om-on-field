// Admin-spezifische Hilfe-PDF Inhalte
// Nur fuer Administratoren sichtbar und herunterladbar

// Screenshots und Links werden von generateHelpPdf.js aus helpPdfContent.js geladen

export const ADMIN_SECTIONS = [
  {
    title: "BENUTZERVERWALTUNG",
    shortTitle: "Benutzer",
    color: [11, 30, 51],
    letter: "B",
    description: "In diesem Kapitel lernen Sie die Benutzerverwaltung kennen: Benutzer einsehen, Rollen ändern, Passwörter zurücksetzen, Benutzer löschen und den Demo-Benutzer verwalten.",
    items: [
      {
        title: "Benutzerliste und Rollen",
        body: "Administratoren sehen in den Einstellungen einen Bereich «Benutzerverwaltung». Darüber können alle angemeldeten Benutzer eingesehen, Rollen geändert (Admin/User) und Passwörter zurückgesetzt werden.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Benutzerverwaltung»" },
          { icon: "list", text: "Benutzerliste durchsuchen" },
          { icon: "user", text: "Rolle ändern (Admin/User)" },
          { icon: "refreshCw", text: "Passwort zurücksetzen" }
        ],
        screenshot: "settings",
        warning: "ACHTUNG: Neue Admins müssen sich einmal ab- und wieder anmelden, damit die neue Rolle wirksam wird."
      },
      {
        title: "Benutzer löschen",
        body: "Benutzer können bei Bedarf gelöscht werden. Alle Daten des Benutzers (QSO-Logs, Einstellungen) gehen dabei verloren.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Benutzerverwaltung»" },
          { icon: "trash2", text: "Mülleimer-Symbol beim Benutzer" },
          { icon: "check", text: "Löschung bestätigen" }
        ],
        warning: "ACHTUNG: Das Löschen eines Benutzers ist unwiderruflich! Alle Daten (QSO-Logs, Einstellungen) gehen verloren."
      },
      {
        title: "Admin-Benachrichtigung bei Registrierung",
        body: "Wenn sich ein neuer Benutzer registriert, erhalten alle Administratoren automatisch eine E-Mail-Benachrichtigung mit der E-Mail-Adresse und dem Registrierungszeitpunkt.",
        steps: [
          { icon: "cloud", text: "Automatisch: Admins erhalten E-Mail bei neuer Registrierung" },
          { icon: "list", text: "Neuer Benutzer in der Benutzerverwaltung sichtbar" }
        ]
      },
      {
        title: "Demo-Benutzer",
        body: "Der Demo-Benutzer (demo@hb9om.ch / demo1234) kann in den Einstellungen eingerichtet werden. Seine Daten werden täglich gelöscht. Der Demo-Benutzer kann nicht gelöscht werden.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Demo-Benutzer»" },
          { icon: "check", text: "«Demo einrichten» antippen" }
        ],
        tip: "Tipp: Der Demo-Benutzer eignet sich für Präsentationen und Tests. Seine Daten werden täglich automatisch gelöscht."
      }
    ]
  },
  {
    title: "REFERENZEN BEARBEITEN",
    shortTitle: "Referenzen",
    color: [220, 38, 38],
    letter: "R",
    description: "Als Administrator können Sie Referenzpunkte anpassen, georeferenzieren und Korrekturen vornehmen. Dieses Kapitel zeigt alle Bearbeitungsmöglichkeiten.",
    items: [
      {
        title: "Referenz auf der Karte bearbeiten",
        body: "Klicken Sie als Administrator auf einen beliebigen Marker auf der Karte. Im Popup-Fenster finden Sie unten einen «Referenz bearbeiten»-Button. Damit können Sie den Namen, den Ort, manuelle Koordinaten und eine Web-Referenz anpassen.",
        steps: [
          { icon: "mapPin", text: "Marker auf der Karte anklicken" },
          { icon: "pencil", text: "«Referenz bearbeiten» antippen" },
          { icon: "pencil", text: "Name, Ort, Koordinaten oder Web-Referenz anpassen" },
          { icon: "save", text: "Speichern – Änderung sofort auf der Karte sichtbar" }
        ],
        screenshot: "map",
        tip: "Tipp: Angepasste Namen und Koordinaten werden sofort auf der Karte angezeigt – keine Datenaktualisierung nötig."
      },
      {
        title: "Marker per Drag & Drop verschieben",
        body: "Als Administrator können Sie den Drag & Drop-Modus aktivieren. Ziehen Sie Marker an die korrekte Position – die Koordinaten werden sofort gespeichert und sind für alle sichtbar.",
        steps: [
          { icon: "move", text: "Move-Button aktivieren" },
          { icon: "move", text: "Marker festhalten und verschieben" },
          { icon: "save", text: "Position wird automatisch gespeichert" }
        ],
        tip: "Tipp: Die neue Position erscheint sofort auf der Karte – kein Reload nötig."
      },
      {
        title: "Nicht georeferenzierte Burgen",
        body: "In den Einstellungen finden Sie eine Liste aller Burgen, die keine Koordinaten haben und nicht auf der Karte angezeigt werden. Sie können für jede Burg einen angepassten Namen, Ort, manuelle Koordinaten oder eine Web-Referenz erfassen.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Nicht georeferenzierte Burgen»" },
          { icon: "search", text: "Burg in der Liste suchen" },
          { icon: "pencil", text: "Bearbeiten – Koordinaten eingeben" },
          { icon: "save", text: "Speichern – Burg erscheint auf der Karte" }
        ]
      },
      {
        title: "Wie Overrides funktionieren",
        body: "Wenn Sie eine Referenz anpassen (Name, Ort, Koordinaten, Web-Referenz), wird ein Override gespeichert. Diese Overrides werden sofort auf der Karte angewendet. Bei der nächsten Datenaktualisierung werden die Overrides zusätzlich für das automatische Matching verwendet.",
        steps: [
          { icon: "pencil", text: "Referenz bearbeiten und speichern" },
          { icon: "check", text: "Override wird sofort angewendet" },
          { icon: "refreshCw", text: "Bei nächster Aktualisierung: Matching wird verbessert" },
          { icon: "trash2", text: "Override über «Zurücksetzen» im Bearbeitungsdialog löschen" }
        ],
        tip: "Tipp: Overrides können im Bearbeitungsdialog über «Zurücksetzen» gelöscht werden."
      },
      {
        title: "Daten-Cache mit Qualitätsanzeige",
        body: "Im Daten-Cache in den Einstellungen wird für jeden Referenz-Typ angezeigt, wie viele Referenzen insgesamt gespeichert sind und wie viele davon erfolgreich georeferenziert wurden. Bei veralteten Daten (>7 Tage) erscheint ein Warnhinweis.",
        steps: [
          { icon: "settings", text: "Einstellungen -> Daten-Cache" },
          { icon: "eye", text: "Total / Geo / Offen pro Referenz-Typ prüfen" },
          { icon: "zap", text: "Warnhinweis bei Daten älter als 7 Tage" }
        ],
        screenshot: "settings"
      }
    ]
  },
  {
    title: "DATEN AKTUALISIEREN",
    shortTitle: "Daten",
    color: [5, 150, 105],
    letter: "D",
    description: "Hier erfahren Sie, wie Sie Referenz-Daten aktualisieren, den Cache-Status überwachen und die tägliche Automatik verwalten.",
    items: [
      {
        title: "Alle Daten aktualisieren",
        body: "Über «Alle Daten aktualisieren» werden alle Referenz-Daten (SOTA, POTA, WWFF, WWBOTA, Burgen, Leuchttürme, IOTA) sowie die Amateurfunk-Relais neu von den jeweiligen Quellen geladen. Das kann einige Minuten dauern. Der Status wird unten im Aktualisierungsprotokoll angezeigt.",
        steps: [
          { icon: "refreshCw", text: "«Alle Daten aktualisieren» antippen" },
          { icon: "clock", text: "Warten – kann einige Minuten dauern" },
          { icon: "check", text: "Status wird im Aktualisierungsprotokoll angezeigt" },
          { icon: "database", text: "Bei Burgen: Georeferenzierungs-Methode wird angezeigt" },
          { icon: "radioTower", text: "Bei Relais: Standorte und Verlinkungen werden aktualisiert" },
          { icon: "wifi", text: "Bei APRS: inkrementelles Wachstum – nur neue Rufzeichen werden abgefragt" }
        ],
        screenshot: "settings",
        tip: "Tipp: Bei den Burgen wird angezeigt, wie viele erfolgreich georeferenziert wurden. Bei APRS wächst die Datenbank inkrementell – bestehende Stationen bleiben erhalten."
      },
      {
        title: "APRS-Datenbank inkrementell aktualisieren",
        body: "Die APRS-Datenbank wird inkrementell aufgebaut: Bei jeder Aktualisierung werden nur neue Rufzeichen (aus Relais-DB und QSO-Logbuch) von APRS.fi abgefragt, die noch nicht in der Datenbank sind. Bestehende Stationen werden beibehalten und periodisch (alle 7 Tage) aktualisiert. So wächst die Datenbank mit jeder Abfrage und später müssen nur noch Änderungen abgefragt werden. Die Aktualisierung wird über das Admin-Panel ausgelöst.",
        steps: [
          { icon: "settings", text: "Einstellungen -> Admin-Panel -> «APRS aktualisieren»" },
          { icon: "wifi", text: "Neue Rufzeichen werden von APRS.fi abgefragt" },
          { icon: "check", text: "Bestehende Stationen werden beibehalten (inkrementell)" },
          { icon: "clock", text: "Alle 7 Tage werden bestehende Stationen aktualisiert" },
          { icon: "database", text: "Datenbank wächst mit jeder Abfrage" }
        ],
        tip: "Tipp: Die APRS-Datenbank wird nie gelöscht – sie wächst kontinuierlich. Das macht zukünftige Aktualisierungen schneller, da nur neue und geänderte Stationen abgefragt werden."
      },
      {
        title: "Relais-Quellen weltweit",
        body: "Die Relais-Daten stammen von RepeaterBook.com und decken alle Kontinente ab. Ergänzende Quellen: ARRL Repeater Directory (US/Kanada), WIA (Wireless Institute of Australia für australische Relais), iz8wnh.it (interaktive Echtzeit-Weltkarte aller Relais und Bake). DMR-Verlinkungen werden von der BrandMeister Network API abgerufen. Die App umfasst nun auch afrikanische Länder und weitere südamerikanische Länder.",
        steps: [
          { icon: "globe", text: "RepeaterBook: 80+ Laender auf allen Kontinenten" },
          { icon: "globe", text: "Nordamerika: USA (50 Bundesstaaten + DC) + Kanada (13 Provinzen)" },
          { icon: "globe", text: "Suedamerika: 11 Laender (Argentinien bis Suriname)" },
          { icon: "globe", text: "Afrika: 19 Laender (Suedafrika bis Eswatini)" },
          { icon: "globe", text: "Ozeanien: 4 Laender (Australien, Neuseeland, PNG, Fidschi)" },
          { icon: "globe", text: "Ergänzend: ARRL, WIA, iz8wnh.it, BrandMeister API" }
        ],
        links: [
          { label: "RepeaterBook weltweit", url: "https://www.repeaterbook.com/" },
          { label: "ARRL Repeater Directory", url: "https://www.arrl.org/repeater-directory" },
          { label: "WIA Repeaters (Australien)", url: "https://www.wia.org.au/members/repeaters/" },
          { label: "iz8wnh.it Echtzeit-Karte", url: "https://www.iz8wnh.it/" },
          { label: "BrandMeister Network", url: "https://brandmeister.network/" }
        ]
      },
      {
        title: "Tägliche Automatik",
        body: "Mit dem Schalter «Tägliche Automatik» können Sie die automatische tägliche Aktualisierung der Referenzdaten ein- oder ausschalten. Wenn aktiviert, werden SOTA, POTA, WWFF etc. einmal pro Tag (nachts) automatisch aktualisiert.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Tägliche Automatik»" },
          { icon: "check", text: "Schalter ein-/ausschalten" },
          { icon: "clock", text: "Bei aktiv: nächtliche Aktualisierung" }
        ],
        tip: "Tipp: Wenn deaktiviert, müssen die Daten manuell über «Jetzt aktualisieren» neu geladen werden."
      },
      {
        title: "Relais-Abdeckung berechnen",
        body: "Im Admin-Panel kann die Abdeckungsberechnung fuer Relais pro Land oder weltweit ausgeloest werden. Die Berechnung verfeinert die geschaetzte Reichweite basierend auf Band, Standorthoehe (Open-Elevation API) und Gelaendefaktor. Zusaetzlich kann im Relais-Popup pro einzelnem Relais eine Neuberechnung angestossen werden («Abdeckung berechnen»-Button). Der Fortschritt wird im Admin-Panel als Prozentsatz angezeigt.",
        steps: [
          { icon: "settings", text: "Einstellungen -> Admin-Panel -> «Relais-Abdeckung»" },
          { icon: "globe", text: "Scope waehlen (Schweiz, USA, Kanada, Japan, Australien, Weltweit)" },
          { icon: "signal", text: "«Abdeckung berechnen» antippen" },
          { icon: "check", text: "Fortschritt und Verfeinerungsgrad werden angezeigt" },
          { icon: "mapPin", text: "Alternativ: pro Relais im Popup «Abdeckung berechnen»" }
        ],
        tip: "Tipp: Relais mit «needs_recalc»-Flag werden im naechsten Berechnungszyklus automatisch neu berechnet."
      },
      {
        title: "Relais-Web-Links ergaenzen",
        body: "Im Relais-Popup koennen Administratoren den Web-Link eines Relais ergaenzen oder korrigieren. Tippen Sie auf das Stift-Icon neben dem Web-Link-Feld. Der Link wird gespeichert und im Popup fuer alle Benutzer angezeigt. Falls RepeaterBook keinen Link liefert, kann er hier manuell nachgetragen werden.",
        steps: [
          { icon: "mapPin", text: "Relais-Marker auf der Karte antippen" },
          { icon: "pencil", text: "Stift-Icon neben Web-Link-Feld antippen" },
          { icon: "pencil", text: "URL eingeben oder korrigieren" },
          { icon: "save", text: "Speichern – Link ist sofort fuer alle sichtbar" }
        ],
        tip: "Tipp: Der Web-Link wird auch im QSO-Formular bei der Referenzsuche angezeigt."
      },
      {
        title: "FM-Funknetz TGs aktualisieren (weltweit)",
        body: "Im Admin-Bereich unter «Einzelne Datenquelle neu laden» finden Sie den Button «FM-Funknetz TGs». Dieser ruft die Reflector-JSON-Dateien (reflector1.json, reflector2.json) von dashboard.fm-funknetz.de ab, die ALLE Nodes mit ihrer TG-Konfiguration enthalten (DefaultTG, monitoredTGs, Koordinaten, Typ). Die Nodes werden per Rufzeichen + Frequenz mit den Relais in der Datenbank abgeglichen – weltweit. Pro Treffer werden die TG-Nummer, der TG-Name (aus der TG-Datenbank mit 265 Einträgen) und der Abrufzeitpunkt gespeichert. Im Relais-Popup erscheint eine FM-Funknetz-Sektion mit aktiven TGs und Links zum Live-Dashboard. Relais die nicht mehr matchen, werden automatisch bereinigt (fm_funknetz-Flag wird entfernt).",
        steps: [
          { icon: "settings", text: "Admin-Panel -> «Einzelne Datenquelle neu laden»" },
          { icon: "headphones", text: "«FM-Funknetz TGs» antippen" },
          { icon: "globe", text: "Reflector-JSON wird abgerufen (alle Nodes, nicht nur aktive)" },
          { icon: "check", text: "TG-Info erscheint im Relais-Popup mit Link zum Live-Dashboard" }
        ],
        links: [
          { label: "FM-Funknetz Live-Dashboard", url: "https://dashboard.fm-funknetz.de/" },
          { label: "FM-Funknetz Talkgroup-Übersicht", url: "https://fm-funknetz.de/unsere-talkgroups-sprechgruppen/" },
          { label: "SWISS-ARTG FM-Funknetz Seite", url: "https://www.swiss-artg.ch/index.php?id=187" }
        ],
        tip: "Tipp: Die Reflector-JSON enthält alle Nodes (Repeater, Simplex Links, Hotspots) mit ihrer statischen TG-Konfiguration. Das Matching per Rufzeichen + Frequenz (25 kHz Toleranz) verhindert falsche Treffer bei gleichen Rufzeichen auf unterschiedlichen Bändern."
      },
      {
        title: "SWISS-ARTG-Details im Relais-Popup",
        body: "Für Relais der SWISS-ARTG (swiss-artg.ch) zeigt das Popup eine eigene Sektion mit kuratierten Informationen: Beschreibung der Anlage, Standorthöhe, Locator, CTCSS, DMR-Talkgruppen (mit Timeslot), FM-Funknetz-Talkgruppen, EchoLink-Node, DTMF-Codes für SVXLink-Relais, Abdeckungsgebiet, weitere Anlagen am Standort (HAMNET, APRS, Winlink, WSPR, DAPNET, WebSDR, KI-Gateway), Notstrom/Solar-Indikator, Sysop und ein Link zur SWISS-ARTG-Webseite. Für DMR-Relais gibt es einen Brandmeister-Dashboard-Link, für D-STAR-Relais den Reflector-Link. Die Daten sind statisch in der App hinterlegt (src/data/swissArtgRepeaters.js) und werden per Rufzeichen + Frequenz zugeordnet. Eine Aktualisierung erfordert ein App-Update, keine Backend-Funktion.",
        steps: [
          { icon: "mapPin", text: "SWISS-ARTG-Relais auf der Karte antippen (HB9AK, HB9ZRH, HB9SG)" },
          { icon: "server", text: "Popup zeigt SWISS-ARTG-Sektion mit allen Details" },
          { icon: "externalLink", text: "Link zu swiss-artg.ch für weitere Informationen" }
        ],
        links: [
          { label: "SWISS-ARTG Standorte", url: "https://www.swiss-artg.ch/index.php?id=38" },
          { label: "SWISS-ARTG FM-Funknetz", url: "https://www.swiss-artg.ch/index.php?id=187" }
        ],
        tip: "Tipp: Die SWISS-ARTG-Daten umfassen 6 Standorte: Hörnli (DMR+FM), Uetliberg (D-STAR), Schleitheim (FM/SVXLink), Landstuhl (Winlink), Bullet (Winlink), Hohe Buche (23cm FM)."
      },
      {
        title: "TOTA-Daten verwalten (Towers on the Air)",
        body: "TOTA (Towers on the Air) ist ein internationales Programm für Aussichtstürme und Antennen. Die weltweiten Daten stammen von wwtota.com (5300+ Türme in 17 Ländern) und werden über den Backend-Funktion fetchTota geladen. Schweizer Daten können als CSV-Dateien über den TOTA-Manager im Admin-Panel hochgeladen werden – getrennt nach Antennen und Türmen. Im TOTA-Manager sehen Sie die aktuellen Datenbankstatistiken (Anzahl Antennen, Türme, Datenquellen) und können CSV-Dateien importieren oder die weltweite Synchronisation auslösen. CSV-Vorlagen können heruntergeladen werden.",
        steps: [
          { icon: "settings", text: "Admin-Panel -> TOTA-Manager" },
          { icon: "upload", text: "Schweizer CSV-Datei hochladen (Antennen oder Türme)" },
          { icon: "globe", text: "«Weltweite Synchronisation» für wwtota.com-Daten" },
          { icon: "download", text: "CSV-Vorlage herunterladen für korrektes Format" },
          { icon: "check", text: "Datenbankstatistiken zeigen Anzahl pro Typ und Quelle" }
        ],
        links: [
          { label: "wwtota.com TOTA-Tabelle", url: "https://wwtota.com/seznam/?lang=de" },
          { label: "wwtota.com Regeln", url: "https://wwtota.com/rules/" }
        ],
        tip: "Tipp: Schweizer CSV-Daten müssen im Format code,name,type,lat,lng,subtype,usage,locator,height_m,spot_height_m sein. Der Typ muss 'antenna' oder 'tower' sein."
      },
      {
        title: "Externe Daten prüfen",
        body: "Mit «Anbindung prüfen» testen Sie, ob alle Datenquellen, aus denen die Karte ihre Referenzpunkte aufbaut, erreichbar und funktionsfähig sind. Geprüft werden die Referenzquellen (SOTA, POTA, WWFF, WWBOTA, Leuchttürme, Burgen, IOTA) sowie die Relais-Quellen und die Geokodierungs-Hilfsquellen (OpenStreetMap, Wikidata, map.geo.admin.ch), von denen die Burg-Zuordnung abhängt. Zusätzlich werden Referenzen ohne Koordinaten («Datenlücken») angezeigt, die nicht als Kartenpunkte erstellt werden können.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Externe Daten prüfen»" },
          { icon: "shieldCheck", text: "«Anbindung prüfen» antippen – dauert wenige Sekunden" },
          { icon: "check", text: "Status pro Quelle: Erreichbar / Fehler" },
          { icon: "mapPin", text: "Referenzen ohne Koordinaten pro Typ einsehen" }
        ],
        tip: "Tipp: Fehlen Koordinaten (meist bei Burgen), fügt «Daten aktualisieren» diese ergänzt. Bleibende Lücken lassen sich unter «Nicht georeferenzierte Burgen» manuell erfassen."
      },
      {
        title: "JSON Repeater Import (RepeaterBook-Export)",
        body: "Im Admin-Bereich unter «Relais & Verlinkungen» -> «JSON Repeater Import» können Sie RepeaterBook-Exporte (.json) direkt in die Datenbank importieren – ergänzend zur automatischen Synchronisation. Ziehen Sie eine JSON-Datei in die Upload-Zone oder klicken Sie zum Auswählen (max. 10 MB). Nach dem Parsen erscheint eine Vorschau mit Anzahl erkannter Datensätze. Beim Import werden neue Relais angelegt und bestehende aktualisiert (inkrementell): Koordinaten, Modi und Band werden überschrieben, leere Felder (Tone, Standort, EchoLink) werden nur ergänzt. Duplikate werden anhand Rufzeichen + Frequenz erkannt – beim erneuten Import derselben Datei entstehen keine Dubletten. Jeder Datensatz wird mit dem Quellen-Tag «json-import» markiert und ist vor automatischen Sync-Überschreibungen geschützt.",
        steps: [
          { icon: "settings", text: "Admin-Panel -> «Relais & Verlinkungen» -> «JSON Repeater Import»" },
          { icon: "upload", text: "RepeaterBook-Export .json in Upload-Zone ziehen oder klicken" },
          { icon: "eye", text: "Vorschau mit Anzahl Datensätze prüfen" },
          { icon: "save", text: "«Import starten» – neue Relais werden angelegt, bestehende aktualisiert" },
          { icon: "check", text: "Ergebnis-Report: +neu, ↺aktualisiert, ↺übersprungen, Fehler" }
        ],
        tip: "Tipp: Duplikate werden anhand Rufzeichen + Frequenz erkannt (nicht anhand des Dateinamens). Beim erneuten Import derselben Datei werden bestehende Records aktualisiert statt neu angelegt."
      },
      {
        title: "Sync-Schutz für JSON-Importe",
        body: "Relais die über den JSON-Import angelegt wurden (source_id = «json-import») werden von automatischen Synchronisationen (fetchRepeaters, fetchHearhamRepeaters) nicht überschrieben oder gelöscht. Das verhindert, dass manuell importierte oder korrigierte Daten bei der nächsten Aktualisierung verloren gehen. Im Sync-Response wird die Anzahl geschützter Records als «json_protected» zurückgemeldet. Über «JSON-Schutz aufheben» im Import-Bereich kann der Schutz entfernt werden – die Records werden dann bei der nächsten Synchronisation wie alle anderen behandelt.",
        steps: [
          { icon: "settings", text: "Admin-Panel -> «JSON Repeater Import»" },
          { icon: "shield", text: "«JSON-Schutz aufheben» antippen" },
          { icon: "check", text: "Dialog bestätigen – source_id wird geleert" },
          { icon: "refreshCw", text: "Bei nächstem Sync: Records werden wieder synchronisiert" }
        ],
        warning: "ACHTUNG: Nach dem Aufheben des Schutzes sind die betroffenen Records dem automatischen Sync ausgesetzt – sie können überschrieben oder gelöscht werden."
      }
    ]
  },
  {
    title: "ANTRÄGE & VORSCHLÄGE",
    shortTitle: "Anträge",
    color: [139, 92, 246],
    letter: "A",
    description: "Hier lernen Sie, wie Sie eingereichte Änderungsanträge und Funktionsvorschläge prüfen, genehmigen, ablehnen und verwalten.",
    items: [
      {
        title: "Änderungsanträge prüfen",
        body: "Wenn Benutzer eine Marker-Position korrigieren, wird ein Änderungsantrag erstellt. Diese Anträge erscheinen in den Einstellungen unter «Anträge prüfen» und auf der separaten Prüfseite. Ausstehende Anträge sind gelb hinterlegt, genehmigte grün und abgelehnte rot.",
        steps: [
          { icon: "clipboardList", text: "Einstellungen -> «Anträge prüfen» oder separate Seite" },
          { icon: "eye", text: "Antrag prüfen: Referenz-Code, Positionen, Kommentar" },
          { icon: "check", text: "Genehmigen (mit optionalem Kommentar)" },
          { icon: "trash2", text: "Oder ablehnen (mit Kommentar)" }
        ],
        tip: "Tipp: Bei Genehmigung wird die Position sofort als Override gespeichert und auf der Karte angezeigt."
      },
      {
        title: "Zurückgezogene Anträge verwalten",
        body: "Über den Filter «Zurückgezogen» sehen Sie alle zurückgezogenen Anträge und können diese mit dem Button «Endgültig löschen» entfernen.",
        steps: [
          { icon: "filter", text: "Filter «Zurückgezogen» wählen" },
          { icon: "trash2", text: "«Endgültig löschen» antippen" },
          { icon: "check", text: "Bestätigen" }
        ]
      },
      {
        title: "Funktionsvorschläge prüfen",
        body: "Benutzer können neue Funktionen vorschlagen oder Fehler melden. Diese Vorschläge erscheinen auf der Prüfseite. Sie können den Status ändern und eine Antwort an den Benutzer hinterlegen.",
        steps: [
          { icon: "search", text: "Einstellungen -> «Funktionsvorschläge prüfen»" },
          { icon: "eye", text: "Vorschlag lesen" },
          { icon: "chevronDown", text: "Status ändern (In Prüfung, Geplant, Umgesetzt, Abgelehnt)" },
          { icon: "pencil", text: "Antwort an den Benutzer hinterlegen" },
          { icon: "save", text: "Speichern – Benutzer sieht Status und Antwort" }
        ]
      },
      {
        title: "Datenpflege – Aufräumen",
        body: "In der «Datenpflege» können Sie erledigte (genehmigte, abgelehnte, umgesetzte) und zurückgezogene Anträge sowie Funktionsvorschläge, die älter als eine bestimmte Anzahl Tage sind, in einem Schritt löschen. Ausstehende Anträge werden niemals gelöscht.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Datenpflege»" },
          { icon: "clock", text: "Zeitraum wählen (7, 14, 30, 90, 180 Tage oder 1 Jahr)" },
          { icon: "trash2", text: "«Änderungsanträge aufräumen» oder «Funktionsvorschläge aufräumen»" },
          { icon: "check", text: "Bestätigen – Anzahl gelöschter Einträge wird angezeigt" }
        ],
        tip: "Tipp: Diese Funktion eignet sich, um von Zeit zu Zeit aufzuräumen. Ausstehende Anträge werden niemals gelöscht."
      }
    ]
  }
];