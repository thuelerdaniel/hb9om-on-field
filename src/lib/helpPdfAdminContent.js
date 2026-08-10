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
        title: "Externe Daten prüfen",
        body: "Mit «Anbindung prüfen» testen Sie, ob alle Datenquellen, aus denen die Karte ihre Referenzpunkte aufbaut, erreichbar und funktionsfähig sind. Geprüft werden die Referenzquellen (SOTA, POTA, WWFF, WWBOTA, Leuchttürme, Burgen, IOTA) sowie die Relais-Quellen und die Geokodierungs-Hilfsquellen (OpenStreetMap, Wikidata, map.geo.admin.ch), von denen die Burg-Zuordnung abhängt. Zusätzlich werden Referenzen ohne Koordinaten («Datenlücken») angezeigt, die nicht als Kartenpunkte erstellt werden können.",
        steps: [
          { icon: "settings", text: "Einstellungen -> «Externe Daten prüfen»" },
          { icon: "shieldCheck", text: "«Anbindung prüfen» antippen – dauert wenige Sekunden" },
          { icon: "check", text: "Status pro Quelle: Erreichbar / Fehler" },
          { icon: "mapPin", text: "Referenzen ohne Koordinaten pro Typ einsehen" }
        ],
        tip: "Tipp: Fehlen Koordinaten (meist bei Burgen), fügt «Daten aktualisieren» diese ergänzt. Bleibende Lücken lassen sich unter «Nicht georeferenzierte Burgen» manuell erfassen."
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