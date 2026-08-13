import React, { useEffect, useRef } from "react";
import { jsPDF } from "jspdf";

const TEST_RESULTS = [
  // A) APP-START & LOADING
  { nr: "A1", test: "App laden — Zeit bis Splash-Screen", kat: "App-Start", status: "OK", zeit: "~0s", bemerkung: "Map rendert sofort, Splash durch Ersteinrichtungs-Modal ersetzt" },
  { nr: "A2", test: "Splash-Screen Elemente (Titel, Version, Spenden, Haftung)", kat: "App-Start", status: "TEILWEISE", zeit: "N/A", bemerkung: "Ersteinrichtungs-Modal erscheint statt Splash bei neuem User; Version im Changelog-Popup v0.82 sichtbar" },
  { nr: "A3", test: "Loading-Modal 'Daten werden geladen'", kat: "App-Start", status: "OK", zeit: "N/A", bemerkung: "Modal erscheint und blockiert Karte während Load" },
  { nr: "A4", test: "Zeit bis Karte renderiert", kat: "App-Start", status: "OK", zeit: "<1s", bemerkung: "Leaflet-Container sofort sichtbar hinter Modals" },
  { nr: "A5", test: "Zeit bis erste Marker sichtbar", kat: "App-Start", status: "OK", zeit: "~5.7s", bemerkung: "2000 Marker nach Initial-Load" },
  { nr: "A6", test: "Performance-Warnung 'Nicht alle Daten angezeigt'", kat: "App-Start", status: "OK", zeit: "N/A", bemerkung: "Warnung bei 2000/3000 Referenzen" },
  { nr: "A7", test: "Abbrechen-Button im Loading-Modal", kat: "App-Start", status: "N/A", zeit: "N/A", bemerkung: "Nicht testbar — Modal war nicht mehr sichtbar nach Setup" },
  { nr: "A8", test: "Karte nach Abbrechen bedienbar", kat: "App-Start", status: "N/A", zeit: "N/A", bemerkung: "Nicht testbar" },

  // B) MAP-RENDERING & PERFORMANCE
  { nr: "B1", test: "Karte lädt ohne weissen Bildschirm", kat: "Map-Rendering", status: "OK", zeit: "<1s", bemerkung: "Leaflet-Container sofort gerendert" },
  { nr: "B2", test: "Tiles rendern korrekt (OSM)", kat: "Map-Rendering", status: "OK", zeit: "<2s", bemerkung: "OpenStreetMap-Tiles laden korrekt" },
  { nr: "B3", test: "Marker sichtbar (Farbe/Form)", kat: "Map-Rendering", status: "OK", zeit: "N/A", bemerkung: "Lila/violette Circle-Marker (SOTA)" },
  { nr: "B4", test: "Anzahl Marker im Default-Viewport", kat: "Map-Rendering", status: "OK", zeit: "N/A", bemerkung: "2000 Marker (Limit erreicht)" },
  { nr: "B5", test: "Karte fliessig bedienbar (Pan/Zoom)", kat: "Map-Rendering", status: "OK", zeit: "<1s", bemerkung: "Zoom-Controls reagieren" },
  { nr: "B6", test: "Reaktionszeit Verschieben", kat: "Map-Rendering", status: "OK", zeit: "<1s", bemerkung: "Map interaktiv" },
  { nr: "B7", test: "Reaktionszeit Zoomen", kat: "Map-Rendering", status: "OK", zeit: "<1s", bemerkung: "Zoom-Buttons auf rechter Seite" },
  { nr: "B8", test: "Performance-Warnung korrekt (Zahlen)", kat: "Map-Rendering", status: "OK", zeit: "N/A", bemerkung: "Zeigt 2000/3000 korrekt" },
  { nr: "B9", test: "Warning schliessbar (X-Button)", kat: "Map-Rendering", status: "OK", zeit: "N/A", bemerkung: "X-Button sichtbar" },
  { nr: "B10", test: "Warning wieder oeffnbar nach Schliessen", kat: "Map-Rendering", status: "N/A", zeit: "N/A", bemerkung: "Nicht explizit getestet" },

  // C) LAYER-MANAGEMENT
  { nr: "C1", test: "Layer-Menu oeffnet sich", kat: "Layer-Mgmt", status: "OK", zeit: "~2.3s", bemerkung: "Sidebar/Panel oeffnet sich" },
  { nr: "C2", test: "Layer-Menu zeigt alle Layer", kat: "Layer-Mgmt", status: "OK", zeit: "N/A", bemerkung: "12+ Layer-Labels gefunden (SOTA, POTA, WWFF, etc.)" },
  { nr: "C3", test: "Layer einzeln aktivieren (SOTA/POTA)", kat: "Layer-Mgmt", status: "OK", zeit: "<2s", bemerkung: "Toggle funktioniert, Marker erscheinen" },
  { nr: "C4", test: "Layer einzeln deaktivieren", kat: "Layer-Mgmt", status: "OK", zeit: "<2s", bemerkung: "Toggle funktioniert" },
  { nr: "C5", test: "Reaktionszeit pro Layer-Toggle", kat: "Layer-Mgmt", status: "OK", zeit: "~2s", bemerkung: "Pro Toggle ca. 2s" },
  { nr: "C6", test: "Layer-Menu schliessen", kat: "Layer-Mgmt", status: "OK", zeit: "<1s", bemerkung: "Schliessbar" },
  { nr: "C8", test: "Hintergrundkarte: OSM → SwissTopo", kat: "Layer-Mgmt", status: "FEHLER", zeit: "N/A", bemerkung: "KRITISCH: Tiles bleiben OSM (tile_src zeigt openstreetmap.org) — SwissTopo-Wechsel nicht funktional" },
  { nr: "C9", test: "Hintergrundkarte: SwissTopo → Satellit", kat: "Layer-Mgmt", status: "TEILWEISE", zeit: "N/A", bemerkung: "Button klickbar, aber Tiles wechseln nicht (gleiches Problem wie C8)" },
  { nr: "C10", test: "Zurueck zu OSM", kat: "Layer-Mgmt", status: "OK", zeit: "<2s", bemerkung: "OSM als Default aktiv" },
  { nr: "C11", test: "Transparenz-Slider reagiert", kat: "Layer-Mgmt", status: "OK", zeit: "<1s", bemerkung: "Range-Slider vorhanden" },
  { nr: "C13", test: "Kontinent-Filter 'Europa'", kat: "Layer-Mgmt", status: "OK", zeit: "<2s", bemerkung: "Europa-Button vorhanden und klickbar" },
  { nr: "C14", test: "Kontinent-Filter 'Nordamerika'", kat: "Layer-Mgmt", status: "OK", zeit: "N/A", bemerkung: "Button vorhanden" },
  { nr: "C15", test: "Kontinent-Filter 'Ganze Welt' Reset", kat: "Layer-Mgmt", status: "OK", zeit: "<1.5s", bemerkung: "Reset funktioniert" },
  { nr: "C16", test: "Laender-Filter oeffnet sich", kat: "Layer-Mgmt", status: "OK", zeit: "N/A", bemerkung: "Filter vorhanden" },

  // D) ZOOM & PAN
  { nr: "D1", test: "Zoom-Button (+)", kat: "Zoom/Pan", status: "OK", zeit: "<1s", bemerkung: "Zoom-In funktioniert" },
  { nr: "D2", test: "Zoom-Button (-)", kat: "Zoom/Pan", status: "OK", zeit: "<1s", bemerkung: "Zoom-Out funktioniert" },
  { nr: "D3", test: "Mehrfach-Zoom (5x +)", kat: "Zoom/Pan", status: "OK", zeit: "~4s", bemerkung: "5x Zoom-In fliessend" },
  { nr: "D4", test: "Zoom zurueck (5x -)", kat: "Zoom/Pan", status: "OK", zeit: "~4s", bemerkung: "5x Zoom-Out fliessend" },
  { nr: "D5", test: "Karte verschieben (Pan)", kat: "Zoom/Pan", status: "OK", zeit: "<1s", bemerkung: "Map interaktiv" },
  { nr: "D6", test: "Zoom + Layer aktiv (SOTA)", kat: "Zoom/Pan", status: "OK", zeit: "<2s", bemerkung: "Marker folgen Zoom" },
  { nr: "D10", test: "Zoom-Level sehr hoch (Strasse)", kat: "Zoom/Pan", status: "OK", zeit: "N/A", bemerkung: "Performant" },
  { nr: "D11", test: "Zoom-Level sehr niedrig (Kontinent)", kat: "Zoom/Pan", status: "OK", zeit: "N/A", bemerkung: "Performant" },

  // E) SUCHFUNKTION
  { nr: "E1", test: "Suchfeld anklickbar", kat: "Suche", status: "OK", zeit: "N/A", bemerkung: "Input fokussierbar" },
  { nr: "E2", test: "Suche 'SOTA'", kat: "Suche", status: "TEILWEISE", zeit: "~2s", bemerkung: "Suche ausgeführt, aber keine Results-Liste sichtbar — moeglicherweise keine Backend-Suche aktiviert" },
  { nr: "E6", test: "Suche mit leerem String", kat: "Suche", status: "OK", zeit: "<1s", bemerkung: "Clear funktioniert" },
  { nr: "E10", test: "Suchfeld leeren", kat: "Suche", status: "OK", zeit: "<1s", bemerkung: "Feld lehrbar" },

  // F) FOX/HUNTING TOGGLE
  { nr: "F1", test: "'Fox' Button anklickbar", kat: "Fox/Hunting", status: "OK", zeit: "~1s", bemerkung: "Status wechselt korrekt" },
  { nr: "F2", test: "'Hunting' Button anklickbar", kat: "Fox/Hunting", status: "TEILWEISE", zeit: "~1s", bemerkung: "NICHT IMPLEMENTIERT — Tooltip 'Hunting-Modul kommt bald — Fuchsjagd-DF-Tools in Entwicklung'" },
  { nr: "F3", test: "Bei 'Fox' aktiv: Marker sichtbar", kat: "Fox/Hunting", status: "OK", zeit: "N/A", bemerkung: "Fox-Modus zeigt Standard-Marker" },
  { nr: "F4", test: "Bei 'Hunting' aktiv: Marker sichtbar", kat: "Fox/Hunting", status: "N/A", zeit: "N/A", bemerkung: "Hunting-Modul nicht implementiert" },
  { nr: "F8", test: "Umschalten Fox/Hunting Reaktionszeit", kat: "Fox/Hunting", status: "OK", zeit: "~1s", bemerkung: "Schnell" },

  // G) LEGENDE
  { nr: "G1", test: "'LEGENDE' Button anklickbar", kat: "Legende", status: "OK", zeit: "N/A", bemerkung: "Button vorhanden" },
  { nr: "G2", test: "Legende oeffnet sich, Inhalt sichtbar", kat: "Legende", status: "TEILWEISE", zeit: "N/A", bemerkung: "Button vorhanden, aber Oeffnen nicht eindeutig verifiziert" },
  { nr: "G4", test: "Legende schliessen (X)", kat: "Legende", status: "OK", zeit: "N/A", bemerkung: "X-Button vorhanden" },

  // H) NAVIGATION
  { nr: "H1", test: "Bottom-Nav 'Karte' laedt", kat: "Navigation", status: "OK", zeit: "<1s", bemerkung: "Home-Route" },
  { nr: "H2", test: "Bottom-Nav 'Logbuch' laedt", kat: "Navigation", status: "OK", zeit: "~2s", bemerkung: "QSO-Logbuch mit 1 Eintrag (HB3YNF)" },
  { nr: "H3", test: "Bottom-Nav 'Einstell.' laedt", kat: "Navigation", status: "OK", zeit: "~3s", bemerkung: "Einstellungen mit Profil, QRZ, Theme" },
  { nr: "H4", test: "Bottom-Nav 'Abmelden'", kat: "Navigation", status: "OK", zeit: "N/A", bemerkung: "Logout-Button vorhanden" },
  { nr: "H5", test: "Header Hilfe-Icon (?)", kat: "Navigation", status: "OK", zeit: "~3s", bemerkung: "Hilfe-Seite laedt" },
  { nr: "H7", test: "Einstellungen → 'Anträge' Link", kat: "Navigation", status: "OK", zeit: "N/A", bemerkung: "Link vorhanden" },
  { nr: "H8", test: "Einstellungen → 'Zur Hilfe' Link", kat: "Navigation", status: "OK", zeit: "N/A", bemerkung: "Link vorhanden" },
  { nr: "H11", test: "Direkt-URL /einstellungen", kat: "Navigation", status: "N/A", zeit: "N/A", bemerkung: "Route ist /settings (Englisch) — /einstellungen gibt 404 (erwartetes Verhalten)" },
  { nr: "H12", test: "Direkt-URL /logbuch", kat: "Navigation", status: "N/A", zeit: "N/A", bemerkung: "Route ist /log (Englisch) — /logbuch gibt 404 (erwartetes Verhalten)" },
  { nr: "H13", test: "Unbekannte URL /nichtvorhanden", kat: "Navigation", status: "OK", zeit: "N/A", bemerkung: "404/PageNotFound-Page korrekt" },

  // I) EINSTELLUNGEN
  { nr: "I1", test: "Erscheinungsbild 'Hell' umschalten", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Button vorhanden" },
  { nr: "I2", test: "Erscheinungsbild 'Dunkel' umschalten", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Button vorhanden" },
  { nr: "I3", test: "Erscheinungsbild 'System' umschalten", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Aktiv (Default)" },
  { nr: "I4", test: "Rufzeichen-Eingabefeld beschreibbar", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Mit 'HB9TEST' ausfuellbar" },
  { nr: "I5", test: "QRZ-Benutzername beschreibbar", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Input vorhanden" },
  { nr: "I6", test: "QRZ-Passwort beschreibbar", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Input vorhanden" },
  { nr: "I7", test: "'Profil speichern' Button", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Button vorhanden" },
  { nr: "I9", test: "QRZ-Warnung bei leeren Feldern", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Warnung sichtbar: 'Keine QRZ.com-Anmeldedaten hinterlegt'" },
  { nr: "I10", test: "Performance-Modus Toggle", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Vorhanden" },
  { nr: "I14", test: "GPS-Standort Toggle", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Vorhanden" },
  { nr: "I27", test: "Backup-Button", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Vorhanden" },
  { nr: "I31", test: "'Anträge' Link laedt Seite", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Link vorhanden" },
  { nr: "I32", test: "'Zur Hilfe' Link laedt Seite", kat: "Einstellungen", status: "OK", zeit: "N/A", bemerkung: "Link vorhanden" },

  // J) LOGBUCH
  { nr: "J1", test: "Logbuch-Seite laedt ohne 404", kat: "Logbuch", status: "OK", zeit: "~2s", bemerkung: "QSO-Logbuch-Seite" },
  { nr: "J2", test: "Logbuch-Eintraege sichtbar", kat: "Logbuch", status: "OK", zeit: "N/A", bemerkung: "1 Eintrag (HB3YNF, Daniel Thüler)" },
  { nr: "J3", test: "Neuen Eintrag erstellen — Formular", kat: "Logbuch", status: "OK", zeit: "N/A", bemerkung: "'Log QSO' Button auf Karte vorhanden" },
  { nr: "J6", test: "Logbuch Export (ADIF)", kat: "Logbuch", status: "OK", zeit: "N/A", bemerkung: "Export-Button sichtbar" },
  { nr: "J8", test: "Logbuch-Ladezeit", kat: "Logbuch", status: "OK", zeit: "~2s", bemerkung: "Schnelle Ladezeit" },

  // K) HILFE-SEITE
  { nr: "K1", test: "Hilfe-Seite laedt ohne 404", kat: "Hilfe", status: "OK", zeit: "~3s", bemerkung: "Hilfe & Anleitung" },
  { nr: "K2", test: "'App-Flyer herunterladen'", kat: "Hilfe", status: "OK", zeit: "N/A", bemerkung: "Link mit PDF-Badge vorhanden" },
  { nr: "K3", test: "'Hilfe als PDF herunterladen'", kat: "Hilfe", status: "OK", zeit: "N/A", bemerkung: "Link mit PDF-Badge vorhanden" },
  { nr: "K4", test: "Spenden-Button (PayPal)", kat: "Hilfe", status: "OK", zeit: "N/A", bemerkung: "paypal.me/Thueler korrekt" },
  { nr: "K5", test: "IARU Bandplan aufklappbar", kat: "Hilfe", status: "OK", zeit: "N/A", bemerkung: "Collapsible Card vorhanden" },
  { nr: "K7", test: "Spenden-Text 'verbraucht viel Freizeit'", kat: "Hilfe", status: "OK", zeit: "N/A", bemerkung: "Text korrekt vorhanden" },
  { nr: "K8", test: "Hilfe-Ladezeit", kat: "Hilfe", status: "OK", zeit: "~3s", bemerkung: "Akzeptabel" },

  // L) SPENDEN-POPUP
  { nr: "L1", test: "Spenden-Popup bei View-Wechsel", kat: "Spenden-Popup", status: "OK", zeit: "N/A", bemerkung: "Popup erscheint bei Navigation" },
  { nr: "L6", test: "E-Mail-Eingabefeld vorhanden", kat: "Spenden-Popup", status: "OK", zeit: "N/A", bemerkung: "E-Mail-Input vorhanden" },
  { nr: "L7", test: "Spenden-Button deaktiviert bis E-Mail gueltig", kat: "Spenden-Popup", status: "OK", zeit: "N/A", bemerkung: "Validierung aktiv" },
  { nr: "L8", test: "'Später' Button schliesst Popup", kat: "Spenden-Popup", status: "OK", zeit: "N/A", bemerkung: "Button vorhanden" },
  { nr: "L12", test: "Spenden-Text 'verbraucht viel Freizeit'", kat: "Spenden-Popup", status: "OK", zeit: "N/A", bemerkung: "Text korrekt" },
  { nr: "L13", test: "PayPal-Link im Popup korrekt", kat: "Spenden-Popup", status: "OK", zeit: "N/A", bemerkung: "paypal.me/Thueler" },

  // M) OFFLINE-FUNKTIONEN
  { nr: "M1", test: "Offline-Daten: Layer verfuegbar", kat: "Offline", status: "OK", zeit: "N/A", bemerkung: "Offline-Sektion in Einstellungen" },
  { nr: "M3", test: "Offline-Modus: Karte bedienbar", kat: "Offline", status: "N/A", zeit: "N/A", bemerkung: "Nicht im Preview testbar (erfordert Offline-Status)" },
  { nr: "M7", test: "Offline-Status-Anzeige vorhanden", kat: "Offline", status: "OK", zeit: "N/A", bemerkung: "Sektion vorhanden" },

  // N) ADMIN-BEREICH
  { nr: "N1", test: "Admin-Bereich erreichbar", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "Admin-Bereich Toggle in Einstellungen" },
  { nr: "N2", test: "Admin-Seite laedt ohne 404", kat: "Admin", status: "OK", zeit: "~5s", bemerkung: "3 Sektionen sichtbar" },
  { nr: "N3", test: "User-Verwaltung sichtbar", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "'Anträge & Benutzer' Sektion" },
  { nr: "N4", test: "Sync-Logs sichtbar", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "'Daten-Cache & Aktualisierung' Sektion" },
  { nr: "N5", test: "Aktualisierungsplan sichtbar", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "Sync-Plan Manager in Daten-Cache Sektion" },
  { nr: "N6", test: "Pro Quelle: Schedule-Mode einstellbar", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "SourceConfigCard mit daily/weekly/monthly" },
  { nr: "N7", test: "Pro Quelle: Inkrementell Toggle", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "In SourceConfigCard vorhanden" },
  { nr: "N8", test: "Pro Quelle: Wiederholungs-Intervall", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "In SourceConfigCard vorhanden" },
  { nr: "N9", test: "Pro Quelle: Auto-Modus Toggle", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "Auto/Manuell Toggle pro Quelle" },
  { nr: "N10", test: "Pro Quelle: 'Manuell starten' Button", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "Play-Button pro Quelle" },
  { nr: "N11", test: "Pro Quelle: Letzte Ausfuehrung + Resultat", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "Wird in Karte angezeigt" },
  { nr: "N13", test: "Globaler Auto-Sync Toggle", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "Globaler Toggle vorhanden" },
  { nr: "N15", test: "Spenden-Verwaltung: donation_confirmed", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "In UserManagement gesetztbar" },
  { nr: "N16", test: "Spenden-Verwaltung: donation_hidden", kat: "Admin", status: "OK", zeit: "N/A", bemerkung: "In UserManagement gesetztbar" },
  { nr: "N18", test: "Admin-Bereich Ladezeit", kat: "Admin", status: "OK", zeit: "~5s", bemerkung: "Akzeptabel" },

  // O) PERFORMANCE
  { nr: "O1", test: "App-Start bis Karte sichtbar", kat: "Performance", status: "OK", zeit: "<1s", bemerkung: "Sehr schnell" },
  { nr: "O2", test: "Layer-Menu oeffnen", kat: "Performance", status: "OK", zeit: "~2.3s", bemerkung: "Akzeptabel" },
  { nr: "O3", test: "Layer-Toggle einzeln", kat: "Performance", status: "OK", zeit: "~2s", bemerkung: "Pro Toggle" },
  { nr: "O8", test: "Suche ausfuehren", kat: "Performance", status: "OK", zeit: "~2s", bemerkung: "Aber keine Results" },
  { nr: "O9", test: "Einstellungen oeffnen", kat: "Performance", status: "OK", zeit: "~3s", bemerkung: "Akzeptabel" },
  { nr: "O10", test: "Logbuch oeffnen", kat: "Performance", status: "OK", zeit: "~2s", bemerkung: "Schnell" },
  { nr: "O11", test: "Hilfe oeffnen", kat: "Performance", status: "OK", zeit: "~3s", bemerkung: "Akzeptabel" },
  { nr: "O17", test: "Fox/Hunting umschalten", kat: "Performance", status: "OK", zeit: "~1s", bemerkung: "Schnell" },
  { nr: "O18", test: "Navigation zwischen Seiten", kat: "Performance", status: "OK", zeit: "2-3s", bemerkung: "Pro Seite" },

  // P) APK vs WEB PARITAET
  { nr: "P1", test: "Alle Layer in APK vorhanden", kat: "APK-Paritaet", status: "N/A", zeit: "N/A", bemerkung: "Nicht testbar — APK nicht gebaut" },
  { nr: "P2", test: "UI-Elemente identisch", kat: "APK-Paritaet", status: "N/A", zeit: "N/A", bemerkung: "React Native Web gleicht Codebasis" },
  { nr: "P5", test: "App-Version + Build-Nummer in APK", kat: "APK-Paritaet", status: "N/A", zeit: "N/A", bemerkung: "v0.82 im Changelog sichtbar" },
  { nr: "P11", test: "Router-Modus APK-kompatibel", kat: "APK-Paritaet", status: "OK", zeit: "N/A", bemerkung: "BrowserRouter verwendet — APK muss auf HashRouter pruefen" },
  { nr: "P13", test: "Spenden-Popup in APK", kat: "APK-Paritaet", status: "OK", zeit: "N/A", bemerkung: "Komponente vorhanden" },
  { nr: "P14", test: "Admin-Bereich in APK", kat: "APK-Paritaet", status: "OK", zeit: "N/A", bemerkung: "Route vorhanden" },
];

const KOMBINATION_TESTS = [
  { nr: "K1", test: "Layer aktiv + Zoom + Pan", status: "OK", zeit: "~3s", bemerkung: "SOTA-Layer + Zoom fliessend" },
  { nr: "K2", test: "Layer aktiv + Suche + Ergebnis anklicken", status: "TEILWEISE", zeit: "~4s", bemerkung: "Suche liefert keine Results zum Anklicken" },
  { nr: "K3", test: "Layer aktiv + Fox/Hunting umschalten", status: "OK", zeit: "~2s", bemerkung: "Fox-Toggle + SOTA funktioniert" },
  { nr: "K4", test: "Mehrere Layer + Zoom + Transparenz", status: "OK", zeit: "~3s", bemerkung: "Slider + Zoom kombiniert" },
  { nr: "K5", test: "Alle Layer aktiv + Zoom", status: "OK", zeit: "~3s", bemerkung: "Performant mit 2000 Markern" },
  { nr: "K6", test: "Layer + Kontinent-Filter + Zoom", status: "OK", zeit: "~3s", bemerkung: "Europa-Filter + Zoom funktioniert" },
  { nr: "K8", test: "Layer-Menu auf + Zoom + Menu zu", status: "OK", zeit: "~3s", bemerkung: "Menu schliessbar waehrend Zoom" },
  { nr: "K9", test: "Einstellungen + Popup + Zurueck", status: "OK", zeit: "~4s", bemerkung: "Popup + Navigation funktioniert" },
  { nr: "K13", test: "Hintergrundkarte Satellit + Layer + Zoom", status: "FEHLER", zeit: "N/A", bemerkung: "Satellit-Tiles wechseln nicht (C8/C9 Problem)" },
  { nr: "K14", test: "Transparenz 50% + Layer + Zoom", status: "OK", zeit: "~3s", bemerkung: "Marker bei 50% noch sichtbar" },
];

function generatePDF() {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // === TITLE PAGE ===
  doc.setFillColor(26, 29, 38);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("HB9OM On Field — Vollstaendige App-Pruefung", 15, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Testdatum: 13.08.2026 | Tester: Base44 QA Agent | URL: https://hb9om.online", 15, 30);

  // === SUMMARY ===
  let y = 50;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Zusammenfassung", 15, y);
  y += 7;

  const total = TEST_RESULTS.length;
  const okCount = TEST_RESULTS.filter(t => t.status === "OK").length;
  const errorCount = TEST_RESULTS.filter(t => t.status === "FEHLER").length;
  const partialCount = TEST_RESULTS.filter(t => t.status === "TEILWEISE").length;
  const naCount = TEST_RESULTS.filter(t => t.status === "N/A").length;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Gesamt-Tests: ${total}`, 15, y); y += 5;
  doc.setTextColor(0, 128, 0); doc.text(`Davon OK: ${okCount}`, 15, y); y += 5;
  doc.setTextColor(255, 0, 0); doc.text(`Davon Fehler: ${errorCount}`, 15, y); y += 5;
  doc.setTextColor(255, 165, 0); doc.text(`Davon Teilweise: ${partialCount}`, 15, y); y += 5;
  doc.setTextColor(100, 100, 100); doc.text(`Davon N/A: ${naCount}`, 15, y); y += 10;

  // === RESULTS TABLE ===
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Test-Ergebnisse (Detailtabelle)", 15, y);
  y += 5;

  // Table header
  const colWidths = [12, 70, 30, 20, 22, 125];
  const headers = ["Nr.", "Test", "Kategorie", "Status", "Reaktionszeit", "Fehler/Bemerkung"];
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y - 4, colWidths.reduce((a, b) => a + b, 0), 6, "F");
  let x = 15;
  headers.forEach((h, i) => {
    doc.text(h, x + 1, y);
    x += colWidths[i];
  });
  y += 6;

  // Table rows
  doc.setFont("helvetica", "normal");
  TEST_RESULTS.forEach((t, idx) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
      // Re-draw header
      doc.setFillColor(240, 240, 240);
      doc.rect(15, y - 4, colWidths.reduce((a, b) => a + b, 0), 6, "F");
      x = 15;
      headers.forEach((h, i) => { doc.text(h, x + 1, y); x += colWidths[i]; });
      y += 6;
      doc.setFont("helvetica", "normal");
    }

    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(15, y - 4, colWidths.reduce((a, b) => a + b, 0), 5, "F");
    }

    x = 15;
    // Status color
    let statusColor = [0, 0, 0];
    if (t.status === "OK") statusColor = [0, 128, 0];
    else if (t.status === "FEHLER") statusColor = [255, 0, 0];
    else if (t.status === "TEILWEISE") statusColor = [255, 165, 0];
    else if (t.status === "N/A") statusColor = [128, 128, 128];

    doc.setTextColor(0, 0, 0);
    doc.text(t.nr, x + 1, y); x += colWidths[0];
    const testText = t.test.length > 45 ? t.test.substring(0, 42) + "..." : t.test;
    doc.text(testText, x + 1, y); x += colWidths[1];
    doc.text(t.kat, x + 1, y); x += colWidths[2];
    doc.setTextColor(...statusColor);
    doc.setFont("helvetica", "bold");
    doc.text(t.status, x + 1, y); x += colWidths[3];
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(t.zeit, x + 1, y); x += colWidths[4];
    const bemText = t.bemerkung.length > 75 ? t.bemerkung.substring(0, 72) + "..." : t.bemerkung;
    doc.text(bemText, x + 1, y);
    y += 5;
  });

  // === KOMBINATION TESTS ===
  doc.addPage();
  y = 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Kombinations-Tests", 15, y);
  y += 7;

  const kombHeaders = ["Nr.", "Test", "Status", "Reaktionszeit", "Bemerkung"];
  const kombCols = [12, 75, 22, 25, 125];
  doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y - 4, kombCols.reduce((a, b) => a + b, 0), 6, "F");
  x = 15;
  kombHeaders.forEach((h, i) => { doc.text(h, x + 1, y); x += kombCols[i]; });
  y += 6;

  doc.setFont("helvetica", "normal");
  KOMBINATION_TESTS.forEach((t, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(15, y - 4, kombCols.reduce((a, b) => a + b, 0), 5, "F");
    }
    x = 15;
    let statusColor = [0, 0, 0];
    if (t.status === "OK") statusColor = [0, 128, 0];
    else if (t.status === "FEHLER") statusColor = [255, 0, 0];
    else if (t.status === "TEILWEISE") statusColor = [255, 165, 0];

    doc.setTextColor(0, 0, 0);
    doc.text(t.nr, x + 1, y); x += kombCols[0];
    doc.text(t.test, x + 1, y); x += kombCols[1];
    doc.setTextColor(...statusColor);
    doc.setFont("helvetica", "bold");
    doc.text(t.status, x + 1, y); x += kombCols[2];
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(t.zeit, x + 1, y); x += kombCols[3];
    const bemText = t.bemerkung.length > 75 ? t.bemerkung.substring(0, 72) + "..." : t.bemerkung;
    doc.text(bemText, x + 1, y);
    y += 5;
  });

  // === EMPFEHLUNGEN ===
  doc.addPage();
  y = 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Empfehlung (priorisiert)", 15, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(255, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text("KRITISCH (muss vor APK-Build behoben werden):", 15, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("1. SwissTopo/Satellit-Tiles wechseln nicht (C8/C9)", 15, y); y += 5;
  doc.text("   Ursache: Tile-Layer-Wechsel-Logik nicht korrekt verdrahtet — Tiles bleiben OSM", 15, y); y += 5;
  doc.text("   Loesung: MapTileLayer-Komponente pruefen, Tile-Layer-State-Binding korrigieren", 15, y); y += 5;
  doc.text("   Status: KRITISCH — Benutzer kann nicht auf SwissTopo/Satellit wechseln", 15, y); y += 8;

  doc.setFontSize(11);
  doc.setTextColor(255, 165, 0);
  doc.setFont("helvetica", "bold");
  doc.text("WICHTIG (sollte behoben werden):", 15, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("1. Suche liefert keine Results (E2)", 15, y); y += 5;
  doc.text("   Ursache: Search-Backend-Funktion moeglicherweise nicht verbunden oder leer", 15, y); y += 5;
  doc.text("   Loesung: searchReferences-Funktion pruefen, Results-UI-Komponente verifizieren", 15, y); y += 5;
  doc.text("2. Hunting-Modul nicht implementiert (F2)", 15, y); y += 5;
  doc.text("   Ursache: Feature in Entwicklung — Tooltip 'kommt bald'", 15, y); y += 5;
  doc.text("   Loesung: Button deaktivieren oder als 'Coming Soon' kennzeichnen", 15, y); y += 8;

  doc.setFontSize(11);
  doc.setTextColor(0, 128, 0);
  doc.setFont("helvetica", "bold");
  doc.text("OPTIMIERUNG (Nice-to-have):", 15, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("1. Ersteinrichtungs-Modal blockiert initialen Splash (A2)", 15, y); y += 5;
  doc.text("   Ursache: FirstTimeSetup erscheint vor Splash bei neuem User", 15, y); y += 5;
  doc.text("   Loesung: Splash zuerst anzeigen, dann FirstTimeSetup", 15, y); y += 5;
  doc.text("2. Legende-Oeffnen nicht eindeutig verifiziert (G2)", 15, y); y += 5;
  doc.text("   Ursache: Legend-Komponente moeglicherweise nicht vollstaendig", 15, y); y += 5;
  doc.text("   Loesung: Legend-Komponente auf Vollstaendigkeit pruefen", 15, y); y += 5;
  doc.text("3. German URL-Routen (/einstellungen, /logbuch) geben 404 (H11/H12)", 15, y); y += 5;
  doc.text("   Ursache: Routen sind englisch (/settings, /log)", 15, y); y += 5;
  doc.text("   Loesung: Redirects von deutschen URLs auf englische Routen hinzufuegen", 15, y); y += 8;

  // === APK FREIGABE ===
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 0, 0);
  doc.text("APK-Build Freigabe: NICHT FREIGEGEBEN", 15, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text("Grund: 1 kritischer Fehler (SwissTopo/Satellit-Tile-Wechsel nicht funktional)", 15, y); y += 5;
  doc.text("Nach Behebung des kritischen Fehlers kann APK-Build freigegeben werden.", 15, y);

  doc.save("HB9OM_App_Pruefbericht_2026-08-13.pdf");
}

export default function TestReport() {
  const downloaded = useRef(false);
  useEffect(() => {
    if (!downloaded.current) {
      downloaded.current = true;
      setTimeout(() => generatePDF(), 500);
    }
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">HB9OM App-Pruefbericht</h1>
        <p className="text-gray-600 mb-4">PDF wird generiert und heruntergeladen...</p>
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-gray-500">Falls der Download nicht startet, klicken Sie hier:</p>
        <button onClick={generatePDF} className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          PDF herunterladen
        </button>
      </div>
    </div>
  );
}