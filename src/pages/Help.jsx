import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Radio, BookOpen, Settings as SettingsIcon, HelpCircle, Search, Layers, Plus, Download, Archive, Pencil, Building, ChevronDown, ChevronUp, ExternalLink, Mountain, Trees, Castle, Anchor, Navigation, Filter, Wifi, LocateFixed, Coffee, Zap, Lightbulb, FileText, Loader2, Diamond, Hexagon, Cloud, AlertTriangle, Shield, Bell, RadioTower, Signal, Network, Database, Globe, Crosshair } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import BandPlanInfo from "@/components/help/BandPlanInfo";
import FeatureSuggestion from "@/components/help/FeatureSuggestion";
import OfflineChecklist from "@/components/help/OfflineChecklist";
import { generateFlyer } from "@/lib/generateFlyer";
import { generateTrifoldFlyer } from "@/lib/generateTrifoldFlyer";
import { generateHelpPdf } from "@/lib/generateHelpPdf";
import { generateAdminHelpPdf } from "@/lib/generateAdminHelpPdf";
import { base44 } from "@/api/base44Client";
import { resetChangelog } from "@/components/map/VersionChangelogPopup";
import { useToast } from "@/components/ui/use-toast";
import { APP_VERSION, APP_BUILD } from "@/lib/appVersion";
import { CEPT_COUNTRIES, CEPT_LINKS } from "@/lib/ceptCountries";
import DownloadSection from "@/components/help/DownloadSection";
import SetupWizard from "@/components/SetupWizard";

// CEPT-Laenderliste fuer die Hilfe-Tabelle
const CEPT_COUNTRIES_LIST = CEPT_COUNTRIES.map(c => ({
  icon: Globe,
  color: c.non_cept ? "#ef4444" : c.cept_novice ? "#f59e0b" : "#0ea5e9",
  name: `${c.flag} ${c.name}`,
  desc: `Präfix: ${c.prefix || "—"} · ${c.cept_full ? "Full ✓" : "Full ✗"} · ${c.cept_novice ? "Nov ✓" : "Nov ✗"}${c.non_cept ? " · Gastlizenz" : ""}${c.notes ? " · " + c.notes : ""}`,
}));

const SECTIONS = [
  {
    id: "hunting",
    icon: Crosshair,
    title: "Hunting & DX-Spots",
    color: "#00e5ff",
    description: "Die Hunting-Seite zeigt Live DX-Spots, SOTA/POTA-Aktivierungen, ISS-Echtzeit-Position, Propagation und eine 3D-Weltkugel.",
    items: [
      {
        title: "Hunting Globe (3D-Weltkugel)",
        body: "Die 3D-Weltkugel zeigt alle aktiven Spots als farbcodierte Marker: SOTA (blau), POTA (grün), DX (rot), eigene Station (pulsierend grün). Der Hintergrund ist immer dunkel (Weltall mit 2000 Sternen). Der Mond umkreist die Erde mit realistischer Textur (Bump-Map mit Kratern, Rim-Light/Fresnel-Effekt) an realer Position (Meeus-Algorithmus, alle 60 Sek. aktualisiert). Ein SOTA-Marker (blaues Dreieck) auf dem Mond bei Mare Tranquillitatis (Apollo 11 Landestelle, 20°N 0°O) öffnet beim Klick ein Spenden-Popup. Die ISS wird in Echtzeit (alle 5 Sek.) auf der Globe angezeigt mit Footprint-Kreis (Sichtbarkeitsbereich ca. 2260 km). Klick auf die ISS öffnet ein Frequenz-Popup.",
        example: "Globus drehen: Drag · Zoomen: Scroll/Pinch (min 1.5x, max 8x) · Klick auf 🛰️ ISS → Frequenz-Popup · Klick auf 🌙 Mond-SOTA-Marker (nicht Mond-Körper) → Spenden-Popup · Marker werden beim Zoomen kleiner"
      },
      {
        title: "QSO-Button verschieben",
        body: "Der grüne '+ QSO loggen' Button ist verschiebbar: Lang gedrückt halten (500ms) startet den Drag-Modus, dann an eine beliebige Position ziehen. Der Button wird an den Viewport-Grenzen festgehalten (Clamp) und kann nicht aus dem Bildschirm geschoben werden. Die Position wird im LocalStorage gespeichert und beim nächsten App-Start wiederhergestellt. Ein normaler Klick (ohne Halten) öffnet das QSO-Loggen-Formular. In den Einstellungen kann die Position zurückgesetzt werden ('QSO-Button Position zurücksetzen').",
        example: "Button lang drücken → verschieben → loslassen → Position gespeichert. Kurzer Klick (< 500ms) → QSO-Formular öffnet. Drag-Modus: Button wird halbtransparent."
      },
      {
        title: "Mond-Steuerung (Pause, Drag, Position)",
        body: "Der Mond auf dem Hunting Globe kann manuell gedreht werden: Drag auf den Mond startet die manuelle Drehung (um die Y-Achse). Nach Loslassen setzt die automatische Rotation nach 3 Sekunden Pause fort. Der Cursor ändert zu 'grab' beim Hover über den Mond, 'grabbing' beim Drag. Die Pause/Resume-Funktion stoppt sowohl die Erd- als auch die Mond-Rotation — beide müssen stoppen und sich wieder bewegen. Die Mond-Position wird realitätsnah aus dem aktuellen Datum berechnet (Meeus-Algorithmus: ekliptische Länge/Breite, Mondphase). Die Sonnen-Position für die Mondphasen-Beleuchtung wird ebenfalls berechnet.",
        example: "Pause-Button klicken → Erde UND Mond stoppen. Drag auf Mond → manuelle Drehung. Resume → beide drehen sich wieder."
      },
      {
        title: "Konsolidierte Spots (Duplicate Removal)",
        body: "In der Live Spot Activity Tabelle werden doppelte Spots konsolidiert: Gleicher Call + gleiche Frequenz = ein Eintrag. Die Anzahl wird als 'Nx' Badge (gelb) angezeigt. Bei mehreren Spottern wird der erste gezeigt mit '+N' Kürzung. Die neueste Spot-Zeit wird als Zeitstempel verwendet. Exakte Duplikate (gleicher Call, Freq, Spotter, Zeit innerhalb 60s) werden komplett entfernt. Das Backend löscht alle DX-Spots vor jedem Neuladen — keine Duplikat-Akkumulation mehr. Die Sortierung bleibt nach Hear-Probability-Score.",
        example: "50 Spots von 4 Stationen → 4 konsolidierte Einträge mit '12x', '12x', '14x', '2x' Badges."
      },
      {
        title: "QSO loggen aus Spot-Detail",
        body: "Beim Klick auf das Augen-Symbol eines Spots öffnet sich das Spot-Detail-Popup mit Karte und QRZ-Lookup. Der grüne '+ QSO loggen' Button öffnet das QSO-Formular mit vorausgefüllten Feldern: Call, Frequenz, Mode, Band (automatisch berechnet), Datum/Zeit (aktuelle UTC). Falls QRZ-Daten verfügbar sind (Name, QTH, Locator), werden diese ebenfalls eingetragen. Ein zusätzlicher 'QRZ' Button öffnet die QRZ.com Detail-Seite im neuen Tab.",
        example: "Spot anklicken → '+ QSO loggen' → Formular öffnet mit Call + Frequenz vorausgefüllt → RST eingeben → speichern."
      },
      {
        title: "DX Opportunity Klick → Spot in Tabelle",
        body: "Die DX Opportunity Karte oben in der CommandStrip ist klickbar. Beim Klick scrollt die Seite zur Live Spot Activity Tabelle und der entsprechende Spot-Eintrag wird mit einem gelben Rahmen für 3 Sekunden hervorgehoben. Falls der Spot durch Filter ausgeblendet ist, wird zur Tabelle gescrollt. Tooltip: 'Klicken um zum Spot in der Tabelle zu springen'.",
        example: "DX Opportunity zeigt AC1RH 6127 km → Klick → Tabelle scrollt zu AC1RH → gelber Rahmen 3s."
      },
      {
        title: "Mobile Tabellenansicht (ohne Scrollen)",
        body: "Auf Mobilgeräten (max 768px) zeigt die Live Spot Activity Tabelle nur 6 wesentliche Spalten: CALL, FREQ, MODE, DIST, SCORE, ACTIONS. Ausgeblendete Spalten (COMMENT, SPOTTER, TIME, REF, AZ, AGE, TYPE) sind nur auf Desktop sichtbar. Die Tabelle passt sich automatisch an die Bildschirmbreite an — kein horizontales Scrollen nötig auf iPhone SE (375px). Font: 12px Mobil, 13px Desktop. Padding: 4px 6px Mobil, 6px 10px Desktop.",
        example: "iPhone SE 375px → 6 Spalten passen ohne Scrollen → DIST und SCORE immer sichtbar."
      },
      {
        title: "ISS-Frequenzen & Echtzeit-Position",
        body: "Die ISS sendet auf mehreren Frequenzen: VHF Downlink 145.800 MHz FM (Voice), VHF Uplink 145.990 MHz FM, UHF Downlink 437.800 MHz (Packet), APRS 145.825 MHz (1200 baud AFSK), SSTV 145.800 MHz (gelegentlich). Die ISS-Position wird alle 5 Sekunden von wheretheiss.at aktualisiert. Der Footprint-Kreis (gelb) zeigt den Sichtbarkeitsbereich. Klick auf die ISS im Globe öffnet das Frequenz-Popup mit Position, Geschwindigkeit (ca. 27600 km/h) und Flughöhe (ca. 408 km).",
        example: "ISS sichtbar? Footprint-Kreis deckt Ihre Position ab → 145.800 MHz FM für Voice-QSO."
      },
      {
        title: "Stations-Locator (GPS-Fallback)",
        body: "Wenn kein GPS-Empfang verfügbar ist, wird der manuell eingegebene Maidenhead-Locator als Standort verwendet. Klicken Sie auf 'Station Ready' in der CommandStrip um den Locator einzugeben (Format: 2 Buchstaben + 2 Zahlen + optional 2 Buchstaben, z.B. JN58LK). Der Locator wird im LocalStorage gespeichert und in der User-Entity. Reihenfolge: 1. GPS (watchPosition) 2. gespeicherter Stations-Locator 3. Standard (Zürich: JN47OQ). Das UI zeigt klar ob GPS aktiv (grün) oder Locator manuell (gelb) ist.",
        example: "GPS nicht verfügbar → 'Station Ready' klicken → JN58LK eingeben → Distanz/Azimut werden ab diesem Locator berechnet."
      },
      {
        title: "Hear-Probability-Score (Hörscheinlichkeit)",
        body: "Die Live Spot Activity Tabelle ist standardmässig nach Hörscheinlichkeit sortiert (Score 0-100%). Der Score wird differenziert berechnet aus: Distanz (30% — kontinuierliche Exponentialfunktion, näher = höher), Alter (20% — neuere Spots scoren höher), Confidence (20% — Spotter/Locator/Land), Aktivität (15% — SOTA-Berge bekommen Bonus), Band/Propagation (15% — 20m/40m optimal, NOAA-Daten falls verfügbar). Farbcodierung: grün >70%, gelb 40-70%, rot <40%. Mit dem Toggle-Button können Sie zwischen 'Nach Score' und 'Nach Zeit' sortieren.",
        example: "Score 88 (nah, neu, SOTA, 20m) vs Score 44 (weit, alt, DX, 15m) → klare Differenzierung."
      },
      {
        title: "SOTA Scheduled Activations",
        body: "Geplante SOTA-Aktivierungen können über die SOTA Scheduled API abgerufen werden (api2.sota.org.uk/api/scheduled_activations). Die Funktion versucht 3 Mal mit 2 Sekunden Pause und 10 Sekunden Timeout. Bei Timeout erscheint 'SOTA Scheduled temporär nicht erreichbar'. Die summit_code wird mit der SotaPoint-Datenbank verknüpft um Koordinaten zu erhalten. Fehler werden mit '[SOTA Scheduled]' Prefix in der Konsole protokolliert.",
        example: "Scheduled Activations laden → zeigt zukünftige SOTA-Aktivierungen mit Summit-Koordinaten auf der Globe."
      },
      {
        title: "Spot-Detail Karte (kontinent-übergreifend)",
        body: "Beim Klick auf das Augen-Symbol eines Spots öffnet sich eine Detail-Karte. Die Verbindungslinie wird als Great Circle (Grosskreis) mit 64 Zwischenpunkten gezeichnet — korrekt gekrümmt, nicht gerade. Bei kontinent-übergreifenden Spots (Datumsgrenze) wird der Viewport korrekt berechnet (Longitude um ±360 verschoben) und maxZoom auf 3 gesetzt. invalidateSize wird nach 200ms und 500ms aufgerufen damit die Karte im Modal korrekt dargestellt wird.",
        example: "Spot in USA (kontinent-übergreifend) → Karte zeigt gekrümmte Linie, beide Marker sichtbar, korrekter Zoom."
      },
    ],
  },
  {
    id: "karte",
    icon: MapPin,
    title: "Karte & Referenzen",
    color: "#3b82f6",
    description: "Die interaktive Karte zeigt Amateurfunk-Referenzpunkte weltweit (SOTA, POTA, WWFF, WWBOTA, Burgen, Leuchttürme, IOTA).",
    items: [
      {
        title: "Bildschirm-Aufbau der Karte",
        body: "Die Kartenansicht ist der Hauptbildschirm der App. Oben in der Mitte befindet sich das Suchfeld für Referenzen. An der linken Seite sind die Werkzeug-Buttons vertikal angeordnet: GPS-Position (blau), Position fixieren (blau), Marker verschieben (navy), Offline-Modus (gelb), Karten herunterladen (navy) und Ebenen-Menü (navy). Der schwarze Button «Neues QSO» unten rechts öffnet das QSO-Formular. Ganz unten befindet sich die Navigation mit den Tabs Karte, Logbuch, Einstellungen und Abmelden.",
        example: "Suchfeld oben → Werkzeug-Buttons links → Marker in der Mitte → «Neues QSO» unten rechts → Navigation ganz unten."
      },
      {
        title: "Karte navigieren",
        body: "Verschieben Sie die Karte per Drag-and-Drop, zoomen Sie mit dem Mausrad oder mit zwei Fingern auf dem Handy. Die Karte merkt sich die letzte Position. Der Zoom erfolgt ohne Animation (direkt) — das verhindert Abstürze beim schnellen Schliessen von Modalen oder beim Seitenwechsel während des Zoomens und sorgt für maximale Stabilität.",
        example: "Tipp: Auf dem Handy nach oben wischen, um die Karte unter der Kopfleiste zu sehen."
      },
      {
        title: "Referenzen suchen",
        body: "Im Suchfeld oben können Sie nach Referenz-Codes (z.B. HB/AG-001), Namen (z.B. Uetliberg) oder Orten suchen. Die Ergebnisse erscheinen als Dropdown-Liste.",
        example: "Eingabe: «Uetli» → zeigt alle Referenzen, die «Uetli» im Namen enthalten."
      },
      {
        title: "Layer ein-/ausschalten",
        body: "Über das Ebenen-Menü (rechts oben, Layer-Icon) können Sie verschiedene Referenz-Typen ein- und ausschalten: SOTA, POTA, WWFF, WWBOTA, WCA/COTA, IOTA, WLOTA/ARLHS, BLN – Natur Zonen (nur in CH), Gefahren & Störquellen (nur in CH), Amateurfunk-Relais und APRS. Ausserdem können Sie die Hintergrundkarte wechseln (Strassenkarte, Satellit, SwissTopo). Das Menü öffnet sich immer ganz oben und liegt über allen anderen Elementen.",
        example: "Nur SOTA-Gipfel anzeigen: Alle anderen Layer ausschalten, nur SOTA aktiv lassen."
      },
      {
        title: "Bestätigung bei vielen Datenpunkten",
        body: "Wenn Sie einen Layer aktivieren, dessen geschätzte Ladezeit 7 Sekunden oder mehr beträgt (z.B. SOTA mit ~180'000 Gipfeln, POTA mit ~89'000 Parks, Burgen, Relais oder APRS-Nodes), erscheint ein Bestätigungsdialog vor dem Laden. Der Dialog zeigt eine Schätzung der Anzahl Punkte, der Datenmenge in MB und der voraussichtlichen Ladezeit. Im Ebenen-Menü wird bei jedem Layer die Anzahl Punkte und die Grösse in MB in kleiner Schrift angezeigt. So können Sie entscheiden, ob Sie das Laden bestätigen und die Wartezeit in Kauf nehmen möchten, oder ob Sie abbrechen und zuerst die Karte anpassen (zoomen, verschieben) möchten. Bei Abbruch wird der Layer aktiviert, aber nur der sichtbare Kartenausschnitt geladen — das ist deutlich schneller. Layer mit einer geschätzten Ladezeit unter 7 Sekunden (z.B. WWFF, WWBOTA, IOTA, Leuchttürme) werden ohne Dialog direkt geladen.",
        example: "SOTA aktivieren → Dialog zeigt «~180'000 Punkte, ~35 MB, ~45 Sekunden» → Abbrechen → nur sichtbare Gipfel laden → hineinzoomen für mehr Details."
      },
      {
        title: "Entscheidung merken (nicht mehr anzeigen)",
        body: "Im Bestätigungsdialog können Sie die Option «Entscheidung merken» aktivieren. Wählen Sie dabei, ob die Entscheidung nur für den aktuellen Layer oder für alle Layer gelten soll. Wenn Sie dann «Laden bestätigen» oder «Abbrechen» klicken, wird diese Entscheidung gespeichert und der Dialog erscheint beim nächsten Aktivieren des betreffenden Layers nicht mehr. Bei «Bestätigen» lädt die App künftig automatisch alle Daten weltweit; bei «Abbrechen» wird automatisch nur der sichtbare Ausschnitt geladen. Die gemerkten Entscheidungen können Sie in den Einstellungen unter «Karte & Anzeige» → «Bestätigungsdialog zurücksetzen» jederzeit zurücksetzen.",
        example: "Häkchen «Entscheidung merken» → «Nur für diesen Layer» → «Abbrechen» → SOTA wird künftig ohne Dialog nur für den sichtbaren Ausschnitt geladen."
      },
      {
        title: "Kartenmassstab wählen",
        body: "Im Ebenen-Menü unter «Kartenmassstab» können Sie einen festen Massstab auswählen: 1:10'000, 1:25'000, 1:50'000 oder 1:100'000. Bei SwissTopo-Karte wird automatisch die entsprechende offizielle Landeskarte verwendet: 1:10'000 = Landeskarte 10 (LK10), 1:25'000 = Pixelkarte PK25, 1:50'000 = Pixelkarte PK50, 1:100'000 = Pixelkarte PK100. Bei «Dynamisch (Auto)» wird die Standard-Pixelkarte verwendet, die sich je nach Zoomstufe anpasst. Der Massstab wird anhand der aktuellen Breitenkoordinate und der Bildschirmauflösung (96 DPI Standard) berechnet.",
        example: "1:25'000 wählen → offizielle SwissTopo-Karte 1:25'000 (PK25) wird geladen."
      },
      {
        title: "Legende ein-/ausblenden",
        body: "Unten links auf der Karte finden Sie die Legende, die die Farben der aktiven Layer anzeigt. Klicken Sie auf die Leiste, um die Legende zu minimieren (nur Referenzanzahl wird angezeigt). Klicken Sie auf das X-Symbol, um die Legende komplett auszublenden. Ein Layer-Icon erscheint, um die Legende wieder einzublenden.",
        example: "Legende ausblenden: X-Symbol klicken → Legende verschwindet → Layer-Icon klicken zum Wiederherstellen."
      },
      {
        title: "Meine Position (GPS)",
        body: "Klicken Sie auf den GPS-Button (Standort-Icon links neben der Karte), um Ihre aktuelle GPS-Position auf der Karte anzuzeigen. Die Karte zoomt automatisch so heraus, dass der Radiuskreis vollständig sichtbar ist. Die Position wird auch im QSO-Formular für die Suche nach Referenzen in der Nähe verwendet. Die Pin-Nadel ist rot bei GPS-Position und blau bei fixierter Position. Klicken Sie auf die Pin-Nadel, um ein Popup mit Maidenhead-Locator, Längen- und Breitengrad (WGS84) sowie Schweizer Koordinaten (LV95) anzuzeigen. Im Popup können Sie die Koordinaten manuell eingeben (WGS84 Breite/Länge oder LV95 E/N) und der Pin springt an die neue Position. Ausserdem können Sie den Radius des Kreises mit einem Schieberegler oder per Zahleneingabe von 100 m bis 10 km anpassen. Mit dem Button «Navigieren zu» übergeben Sie die Position an Google Maps zur Navigation.",
        example: "GPS-Button klicken → Karte zoomt heraus, Kreis sichtbar → Pin-Nadel anklicken → Koordinaten, manuelle Eingabe, Radiusschieber und Navigieren-Button."
      },
      {
        title: "GPS-Standort-Tracking (Dauerhaft)",
        body: "In den Einstellungen können Sie unter «GPS-Standort auf Karte» eine permanente GPS-Anzeige aktivieren. Ein blaues Kreuz mit Mittelpunkt zeigt Ihren aktuellen Standort auf der Karte an – unabhängig vom GPS-Button für die QSO-Positionierung. Das Aktualisierungsintervall ist einstellbar von 30 Sekunden bis 1 Stunde. Ein kürzeres Intervall liefert eine genauere Position, erhöht aber den Akkuverbrauch. Die Einstellung wird sofort wirksam – ein Neuladen der Seite ist nicht nötig. Diese Funktion ist nützlich, um beim Navigieren im Feld immer zu sehen, wo man sich gerade befindet.",
        example: "Einstellungen → «GPS-Standort auf Karte» einschalten → Intervall «1 Minute» wählen → blaues Kreuz erscheint auf der Karte."
      },
      {
        title: "Position fixieren",
        body: "Wenn Sie die GPS-Position nicht verwenden möchten oder kein GPS-Empfang haben, können Sie die Position frei auf der Karte festlegen: Klicken Sie auf den Pin-Button, dann auf die gewünschte Stelle der Karte. Die Karte zoomt automatisch so heraus, dass der Radiuskreis vollständig sichtbar ist. Die fixierte Position (blau) ersetzt die GPS-Position für die Referenzsuche im QSO-Formular. Im Popup können Sie den Radius anpassen und die Position an Google Maps übergeben. Klicken Sie erneut auf den GPS-Button, um zur GPS-Position zurückzukehren.",
        example: "Pin-Button → Karte antippen → Position blau, Karte zoomt heraus → Popup mit Koordinaten, Radiusschieber und Navigieren-Button."
      },
      {
        title: "Marker-Symbole",
        body: "Jeder Referenz-Typ hat ein eigenes, gut erkennbares Symbol auf der Karte. In der Legende unten links und im Ebenen-Menü sehen Sie dieselben Symbole:",
        list: [
          { icon: Mountain, color: "#e74c3c", name: "SOTA", desc: "Berg mit Gipfelkreuz (Dreieck) – Berggipfel ab 150 m Prominenz" },
          { icon: Trees, color: "#27ae60", name: "POTA", desc: "Baum – Nationalparks und Schutzgebiete" },
          { icon: Trees, color: "#8e44ad", name: "WWFF", desc: "Blume – Flora & Fauna Naturreservate" },
          { icon: Building, color: "#795548", name: "WWBOTA", desc: "Bunker (Halbkuppel mit Schiessscharte) – Militärische Bunker, farbig nach Land" },
          { icon: Castle, color: "#e67e22", name: "WCA/COTA", desc: "Burg mit Zinnen und Tor – Burgen und Schlösser" },
          { icon: RadioTower, color: "#f97316", name: "TOTA", desc: "Aussichtsturm mit Antenne – Türme und Antennen weltweit (wwtota.com), in der Schweiz getrennt nach Antennen und Türmen" },
          { icon: Diamond, color: "#3498db", name: "IOTA", desc: "Raute mit Welle – Inseln" },
          { icon: Anchor, color: "#f39c12", name: "WLOTA/ARLHS", desc: "Leuchtturm mit Lichtstrahlen – Leuchttürme" },
          { icon: Hexagon, color: "#16a085", name: "BLN – Natur Zonen (nur in CH)", desc: "Sechseck mit Blatt – Bundesinventare / Naturzonen" },
          { icon: Zap, color: "#dc2626", name: "Gefahren & Störquellen (nur in CH)", desc: "Blitz – Hochspannungsleitungen, Mobilfunkantennen, Richtfunk, Radio/TV-Sender" },
          { icon: Radio, color: "#3b82f6", name: "Amateurfunk-Relais", desc: "Turm mit Blitz – FM, C4FM, DMR, D-STAR Relais mit permanenten Verlinkungen, farbig nach Modulation" },
          { icon: Wifi, color: "#8b5cf6", name: "APRS", desc: "APRS-Standard-Symbole – Stern (Digipeater), Haus (Hotspot), Quadrat mit W (Wetterstation), Stern mit I (IGate) – farbig nach Node-Typ" },
          { icon: Network, color: "#14b8a6", name: "BrandMeister", desc: "DMR-Quadrat mit doppelten Wellen – DMR-Relais und Hotspots im BrandMeister-Netzwerk mit Talkgroups" }
        ]
      },
      {
        title: "Marker anklicken",
        body: "Klicken Sie auf einen Marker, um Details zu sehen: Referenz-Code, Name, Höhe, Punkte, Aktivierungsanzahl und einen externen Link zum jeweiligen Programm (SOTA, POTA, etc.).",
        example: "Klick auf einen SOTA-Gipfel → Popup zeigt Name, Höhe, Punkte und Link zu sotl.as."
      },
      {
        title: "Marker verschieben / korrigieren",
        body: "Alle Benutzer können den Drag & Drop-Modus aktivieren (Move-Icon links neben der Karte), um Marker an die korrekte Position zu verschieben. Administratoren: Die neuen Koordinaten werden sofort gespeichert und sind für alle sichtbar. Normale Benutzer: Die Verschiebung öffnet einen Dialog, in dem ein Kommentar erfasst werden kann. Der Antrag wird an einen Admin gesendet und nach Prüfung freigegeben. Den Status können Sie unter «Meine Anträge» (ClipboardList-Icon auf der Karte oder in den Einstellungen) verfolgen oder den Antrag zurückziehen.",
        example: "Move-Button aktivieren → Marker ziehen → Dialog mit Kommentarfeld → «Einreichen» → Status unter «Meine Anträge» verfolgen."
      },
      {
        title: "Offline-Modus manuell aktivieren",
        body: "Klicken Sie auf das Wifi-Icon links neben der Karte, um den Offline-Modus manuell zu aktivieren oder zu deaktivieren. Im Offline-Modus werden Kartenkacheln aus dem Cache geladen (sofern zuvor heruntergeladen) und alle Referenzpunkte aus dem lokalen Speicher angezeigt. QSOs können weiterhin erfasst werden und werden bei Wiederherstellung der Verbindung synchronisiert. Der manuelle Offline-Modus kann auch in den Einstellungen unter «Offline-Modus & lokaler Speicher» ein- und ausgeschaltet werden.",
        example: "Wifi-Icon klicken → Symbol wird gelb → Offline-Modus aktiv → Kacheln aus Cache werden angezeigt."
      },
      {
        title: "Offline-Karten herunterladen & verwalten",
        body: "Mit dem Download-Icon links neben der Karte können Sie Kartenausschnitte für die Offline-Nutzung herunterladen. Wählen Sie die Zoom-Stufen und laden Sie die Kacheln herunter. In den Einstellungen unter «Offline-Modus & lokaler Speicher» im Bereich «Offline-Karten» sehen Sie alle gespeicherten Gebiete mit Grösse und Datum. Einzelne Gebiete oder alle Offline-Daten können dort gelöscht werden.",
        example: "Download-Icon → Gebiet auf Karte wählen → Zoom-Stufen auswählen → Download starten → in Einstellungen verwalten."
      },
      {
        title: "100% Offline-Checkliste",
        body: "Oben in der Hilfe finden Sie eine interaktive Checkliste, die Sie Schritt für Schritt zu einer 100% offline-fähigen App führt. Jeder Schritt hat einen direkten Link zum entsprechenden Bereich in der App (Einstellungen oder Karte), damit Sie die Aktion direkt ausführen können. Die Checkliste erkennt automatisch, welche Daten bereits lokal gespeichert sind (Referenzen, Relais, APRS, QRZ, Offline-Karten) und hakt diese Schritte ab. Nur Backup erstellen und Offline-Modus testen müssen manuell abgehakt werden. Der Fortschritt wird als Prozentsatz angezeigt.",
        example: "Checkliste oben in der Hilfe → «Alle laden» in Einstellungen klicken → Schritt wird automatisch grün → Fortschritt steigt."
      },
      {
        title: "Daten pro Layer herunterladen",
        body: "In den Einstellungen unter «Offline-Modus & lokaler Speicher» gibt es für jeden Daten-Typ einen eigenen Download-Button: SOTA, POTA, WWFF, WWBOTA, Burgen, IOTA, Leuchttürme, Amateurfunk-Relais, APRS-Nodes und QRZ-Abfragen. Der Button «Alle laden» lädt alle Referenz-Typen auf einmal. Pro Layer wird angezeigt, wie viele Einträge lokal gespeichert sind und wie gross der Speicherbedarf ist. Bei veralteten Daten erscheint ein «Update verfügbar»-Hinweis.",
        example: "Einstellungen → «Offline-Modus & lokaler Speicher» → «Alle laden» → alle Layer werden nacheinander heruntergeladen."
      },
      {
        title: "Was offline funktioniert – und was nicht",
        body: "Offline nutzbar: Karte (mit Cached-Kacheln), Referenzen anzeigen und suchen, QSOs erfassen/bearbeiten/löschen, Logbuch-Statistik, ADIF-Export. Nicht offline nutzbar: QRZ.com-Abfrage (Button ausgegraut), Positions-Korrekturen einreichen (Button ausgegraut), Funktionsvorschläge einreichen (Button ausgegraut), Daten aktualisieren, neue Referenz-Layer laden. Ausgegraute Buttons zeigen den Hinweis «Nur online möglich».",
        example: "Offline QSO erfassen: Rufzeichen manuell eingeben (QRZ-Button ausgegraut) → QSO speichern → wird bei Online-Verbindung synchronisiert."
      },
      {
        title: "Referenz-Typen",
        body: "Folgende Referenz-Typen werden unterstützt. Klicken Sie auf den Namen, um die aktuelle Referenzliste zu öffnen:",
        list: [
          { icon: Mountain, color: "#e74c3c", name: "SOTA", desc: "Summits on the Air – Berggipfel ab 150 m Prominenz", url: "https://www.sotadata.org.uk/summitlist.aspx" },
          { icon: Trees, color: "#27ae60", name: "POTA", desc: "Parks on the Air – Nationalparks und Schutzgebiete", url: "https://pota.app/#/park/CH" },
          { icon: Trees, color: "#8e44ad", name: "WWFF", desc: "Worldwide Flora & Fauna – Naturreservate", url: "https://wwff.co/directory/" },
          { icon: Building, color: "#795548", name: "WWBOTA", desc: "Bunkers on the Air – Militärische Bunker, farbig nach Land", url: "https://wwbota.net/map/" },
          { icon: Castle, color: "#e67e22", name: "WCA/COTA", desc: "Castles on the Air – Burgen und Schlösser", url: "https://wcagroup.org/?page_id=207" },
          { icon: RadioTower, color: "#f97316", name: "TOTA", desc: "Towers on the Air – Aussichtstürme und Antennen weltweit (wwtota.com)", url: "https://wwtota.com/seznam/?lang=de" },
          { icon: Navigation, color: "#3498db", name: "IOTA", desc: "Islands on the Air – Inseln", url: "https://www.iota-world.org/islands-on-the-air/iota-groups-islands.html" },
          { icon: Anchor, color: "#f39c12", name: "WLOTA/ARLHS", desc: "Lighthouses on the Air – Leuchttürme", url: "https://wlol.arlhs.com/" },
          { icon: Trees, color: "#16a085", name: "BLN – Natur Zonen (nur in CH)", desc: "Bundesinventare – Auengebiete, Moore etc. (nur in CH — map.geo.admin.ch)", url: "https://www.bafu.admin.ch/bafu/de/home/themen/biodiversitaet/infospezialist/biodiversitaet--daten--und-instrumente.html" },
          { icon: Zap, color: "#dc2626", name: "Gefahren & Störquellen (nur in CH)", desc: "Hochspannungsleitungen und Starkstromanlagen (nur in CH — map.geo.admin.ch)", url: "https://map.geo.admin.ch/" },
          { icon: Radio, color: "#3b82f6", name: "Amateurfunk-Relais", desc: "FM, C4FM, DMR, D-STAR Relais mit permanenten Verlinkungen", url: "https://www.repeaterbook.com/" },
          { icon: Wifi, color: "#8b5cf6", name: "APRS", desc: "Amateur Radio Positioning – Digipeater, IGates, Wetter, Hotspots und mobile Nutzer", url: "https://aprs.fi/" },
          { icon: Network, color: "#14b8a6", name: "BrandMeister", desc: "DMR-Netzwerk – Relais und Hotspots mit Talkgroups und DMR-IDs", url: "https://brandmeister.network/" }
        ]
      },
      {
        title: "TOTA – Towers on the Air",
        body: "TOTA (Towers on the Air) ist ein internationales Programm für Aktivierungen von Aussichtstürmen, Antennen und ähnlichen Bauwerken. Die Daten stammen von wwtota.com (5300+ Türme in 17 Ländern). In der Schweiz werden Antennen und Türme aus lokalen Datenquellen getrennt dargestellt. Der TOTA-Filter (oben links) erlaubt das Filtern nach Typ (Antennen/Türme), Land und Namenssuche. Im Marker-Popup finden Sie Links zur TOTA-Detailseite auf wwtota.com und zur vollständigen TOTA-Tabelle. Die TOTA-Daten werden über den Backend-Funktion fetchTota geladen und im TotaPoint-Entity gespeichert. Administratoren können Schweizer CSV-Daten über den TOTA-Manager im Admin-Panel hochladen.",
        example: "TOTA-Layer aktivieren → TOTA-Filter oben links → Typ «Türme» wählen → nur Aussichtstürme werden angezeigt → Marker anklicken für Detailseite auf wwtota.com."
      },
      {
        title: "BrandMeister – DMR-Netzwerk",
        body: "BrandMeister ist ein weltweites DMR-Netzwerk mit Talkgroups (TGs) und DMR-IDs. Die BrandMeister-Ebene zeigt DMR-Relais und Hotspots im BrandMeister-Netzwerk – eigenständiges Netzwerk, nicht APRS. Der BrandMeister-Filter (oben links) erlaubt das Filtern nach Node-Typ (Repeater, Hotspot, Other) und Namenssuche. Im Popup finden Sie DMR-ID, Talkgroups, Netzwerk-Details und einen Link zum BrandMeister-Dashboard. Die Daten werden separat von APRS verwaltet und haben eine eigene Farbe (türkis).",
        example: "BrandMeister-Layer aktivieren → BrandMeister-Filter oben links → Typ «Repeater» wählen → nur DMR-Relais werden angezeigt → Marker anklicken für DMR-Details und Dashboard-Link."
      },
      {
        title: "Burgen & Schlösser – Wikipedia",
        body: "In der Detailansicht einer Burg oder eines Schlosses (Marker anklicken) finden Sie einen Wikipedia-Link. Die Suche verwendet den Burgnamen zusammen mit dem Ort. Bei Swisstopo-Karten sind viele Burgnamen als Flurnamen auf der Karte sichtbar – diese Namen können im Suchfeld oben gesucht und für die Wikipedia-Recherche genutzt werden.",
        example: "Burgmarker anklicken → «Wikipedia»-Link → Wikipedia öffnet sich mit Suchergebnis für Burgname + Ort."
      },
      {
        title: "Burgen-Statistik in der Legende",
        body: "Wenn der Burgen-Layer aktiv ist, zeigt die Legende unten links eine Statistik an: «Burgen X/Y» – dabei ist X die Anzahl der erfolgreich georeferenzierten Burgen und Y die Gesamtzahl. Die Statistik erscheint nur, wenn der Burgen-Layer eingeschaltet ist.",
        example: "Burgen-Layer aktivieren → Legende zeigt «Burgen 180/256»."
      },
      {
        title: "Gefahren & Störquellen",
        body: "Der Layer «Gefahren & Störquellen» blendet Hochspannungsleitungen und Starkstromanlagen (über 36 kV) von map.geo.admin.ch ein. Diese Informationen sind für Amateurfunker wichtig, da Hochspannungsleitungen und elektrische Anlagen Störungen verursachen können. Der Layer zeigt auch Projektierungszonen für zukünftige Starkstromanlagen. Die Daten stammen vom Bundesamt für Energie (BFE).",
        example: "Layer «Gefahren & Störquellen» aktivieren → rote Linien zeigen Hochspannungsleitungen auf der Karte."
      },
      {
        title: "Standort-Info bei Gefahren & Naturzonen",
        body: "Wenn Sie die Layer «Gefahren & Störquellen» oder «Natur Zonen» aktiviert haben, können Sie auf die Karte tippen, um detaillierte Informationen zu den Objekten an diesem Standort abzufragen. Es erscheint ein Popup mit allen verfügbaren Details wie Bezeichnung, Eigentümer, Spannung, Frequenz, Antennenhöhe, Azimut, Polarisation und weiteren technischen Daten. Bei Richtfunkstrecken und Sendemasten werden zusätzlich Frequenzbereich, Kanal, Bandbreite, Programm, Dienstart, System, Sektor, Tilt und Gain angezeigt. Auf Touch-Geräten (Handy/Tablet) ist die Toleranz beim Antippen automatisch erhöht, damit sich auch kleine Objekte wie Mobilfunkantennen oder Richtfunkstrecken leichter treffen lassen. Wenn sich an einem geklickten Standort keine Gefahrenquelle oder Naturzone befindet, erscheint kein Popup – die Abfrage erfolgt im Hintergrund und wird bei leerem Ergebnis still verworfen. Jeder Layer-Abschnitt im Popup hat einen eigenen «In map.geo.admin.ch öffnen»-Link, der die Karte genau an der geklickten Position mit dem richtigen Zoom, dem aktiven Layer und einem Fadenkreuz-Marker öffnet. Die Koordinaten werden automatisch in das Schweizer LV95-Koordinatensystem umgerechnet.",
        example: "Layer «Gefahren» aktivieren → auf Hochspannungsleitung tippen → Popup zeigt Bezeichnung, Eigentümer und Spannung → «In map.geo.admin.ch öffnen» öffnet die Karte genau an dieser Position mit dem richtigen Layer und Fadenkreuz-Marker."
      },
      {
        title: "Funktionsvorschläge einreichen",
        body: "In der Hilfe unten im Bereich «Funktionsvorschläge» können Sie neue Funktionen vorschlagen oder Fehler melden. Geben Sie einen Titel, eine Kategorie und eine Beschreibung ein. Nach dem Einreichen können Sie den Status Ihres Vorschlags verfolgen: In Prüfung, Wird geprüft, Geplant, Umgesetzt oder Abgelehnt. Admins können eine Antwort hinterlegen, die Sie ebenfalls sehen. Ausstehende Vorschläge können jederzeit zurückgezogen werden.",
        example: "«Neuen Vorschlag machen» → Titel «Dunkelmodus» → Kategorie «Verbesserung» → Beschreibung → Einreichen → Status in der Liste verfolgen."
      },
      {
        title: "Bunker-Details & Farben (WWBOTA weltweit)",
        body: "WWBOTA-Bunker werden nach Land eingefärbt: Jedes nationale Schemata hat eine eigene Farbe (z.B. Schweiz braun, Deutschland dunkelgrau, Frankreich blau, Grossbritannien violett, Tschechien orange). In der Legende unten links werden die Farben der wichtigsten Länder angezeigt. Der «Mehr Infos»-Link führt zur länderspezifischen WWBOTA-Seite (z.B. wwbota.net/dlbota/ für deutsche Bunker, wwbota.net/fbota/ für französische). Der Wikipedia-Link sucht nach dem Bunkernamen zusammen mit dem jeweiligen Land (z.B. «Führungsstelle Bunker Deutschland»).",
        example: "Deutschen Bunker anklicken → Marker ist dunkelgrau → «Mehr Infos» öffnet wwbota.net/dlbota/ → «Wikipedia» sucht nach Bunkernamen + Deutschland."
      },
      {
        title: "Leuchtturm-Referenzen (ARLHS WLOL)",
        body: "Schweizer Leuchttürme verwenden die offiziellen ARLHS WLOL-Referenznummern (SWI-001 bis SWI-006). Der «Mehr Infos»-Link führt direkt zur jeweiligen Detailseite auf wlol.arlhs.com. Die Referenzen wurden gegen die offizielle ARLHS-Liste verifiziert. Es gibt 6 verifizierte Schweizer Leuchttürme: Phare des Pâquis (Genf), Genève Jetée du Sud, Morges Jetée du Sud/Nord, Romanshorn und Rorschach Hafen.",
        example: "Leuchtturm anklicken → «Mehr Infos» öffnet wlol.arlhs.com/lighthouse/SWI1.html mit Details zum Leuchtturm."
      },
      {
        title: "Lade-Reihenfolge: Lokaler Cache zuerst, dann Server",
        body: "Alle Layer (SOTA, POTA, WWFF, WWBOTA, Burgen, IOTA, Leuchttürme, Relais, APRS, TOTA) laden in zwei Schritten: 1) Zuerst werden die Daten aus dem lokalen Cache (Offline-Download) geladen — das passiert sofort und die Punkte erscheinen sofort auf der Karte. 2) Wenn Sie online sind, wird anschliessend im Hintergrund der vollständige Datensatz vom Server geladen und ersetzt die lokalen Daten. So ist sichergestellt, dass die Karte immer komplett ist, wenn Sie online sind — auch wenn der lokale Cache unvollständig oder veraltet ist. Bei langsamer oder fehlender Verbindung wird der Server-Fetch im Hintergrund fortgesetzt; schlägt er fehl, bleiben die lokalen Daten sichtbar. Im Offline-Modus wird nur der lokale Cache verwendet (kein Server-Fetch).",
        example: "Relais-Layer aktivieren → lokale Relais erscheinen sofort → online: Server lädt kompletten Datensatz im Hintergrund → Karte zeigt alle 2300+ Relais aus 7 Ländern (CH, DE, AT, FR, IT, GB, LI)."
      },
      {
        title: "Layer-Filter überschreibt globalen Länder-Filter",
        body: "Wenn Sie im Ebenen-Menü (rechts oben) einen Länder-Filter aktivieren (z.B. nur Schweiz), gilt dieser für SOTA, POTA, Burgen, IOTA, Leuchttürme und WWBOTA. Bei Layern mit einem eigenen Länder-Filter (Relais, TOTA) überschreibt der jeweilige Layer-Filter den globalen Filter: Sie können also global «nur Schweiz» für SOTA/POTA einstellen und im Relais-Filter trotzdem Deutschland auswählen — die deutschen Relais werden dann angezeigt, obwohl der globale Filter auf Schweiz steht. Ist im Layer-Filter «Alle» ausgewählt, gilt der globale Länder-Filter normal.",
        example: "Global: Schweiz → Relais-Filter: Deutschland → deutsche Relais werden angezeigt, SOTA/POTA nur Schweizer Gipfel."
      },
      {
        title: "Relais-Filter: Alle Länder verfügbar",
        body: "Im Relais-Filter (oben links) werden alle Länder angezeigt, für die Relais in der Datenbank vorhanden sind — mit Anzahl pro Land. Aktuell: Grossbritannien (751), Deutschland (599), Frankreich (439), Italien (220), Schweiz (214), Österreich (143), Liechtenstein (1). Die Kontinent-Filter (Europa, Nordamerika, etc.) zeigen die Summe der Relais pro Kontinent. Wählen Sie ein einzelnes Land, um nur Relais dieses Landes zu sehen. Der Relais-Filter überschreibt den globalen Länder-Filter aus dem Ebenen-Menü: Sie können global «nur Schweiz» für SOTA/POTA einstellen und im Relais-Filter trotzdem Deutschland auswählen. Wenn ein Land fehlt, wurden noch keine Relais für dieses Land abgefragt — Administratoren können die Daten über «Alle Daten aktualisieren» oder «Einzelne Datenquelle neu laden» → «Relais» aktualisieren.",
        example: "Relais-Filter öffnen → «Europa» zeigt alle europäischen Relais → «Frankreich» wählen → nur 439 französische Relais werden angezeigt."
      },
      {
        title: "Verlinkungen nur bei sichtbaren Relais",
        body: "Verlinkungslinien zwischen Relais werden nur gezeichnet, wenn beide Relais-Marker tatsächlich auf der Karte sichtbar sind. Wenn durch den Viewport-Capping (max. 1000 Marker pro Ausschnitt) ein Relais nicht als Marker dargestellt wird, werden auch seine Verlinkungslinien ausgeblendet. So entstehen keine «Geister-Linien» zu unsichtbaren Relais. Verlinkungen erscheinen nur bei permanenten, bestätigten Crosslinks (RepeaterBook + 2 Quellen oder admin-bestätigt).",
        example: "In einen Bereich mit 1500 Relais zoomen → nur 1000 Marker + deren Verlinkungen werden gezeigt → herauszoomen → mehr Marker und Verlinkungen erscheinen."
      },
      {
        title: "Zusätzliche Relais-Quellen weltweit",
        body: "Neben RepeaterBook (Hauptquelle für CH, DE, AT, FR, IT, GB, LI und 70+ weitere Länder) werden zusätzliche Datenquellen für Relais genutzt: 1) USKA HB Repeater Voice List (uska.ch) — offizielle Schweizer Liste mit Crosslinks und EchoLink-Nodes. 2) SWISS-ARTG (swiss-artg.ch) — DMR-, FM- und D-STAR-Relais. 3) ukrepeater.net — 751 UK-Relais. 4) FM-Funknetz.de — Talkgruppen weltweit. Weitere potenzielle Quellen für Länder mit wenig RepeaterBook-Abdeckung: iz8wnh.it (weltweite Relais-Karte mit CSV-Export), dstarusers.org (D-STAR-Relais weltweit), wia.org.au (Australien), m0lxq.com (UK-CSVs). Administratoren können über «Einzelne Datenquelle neu laden» neue Quellen hinzufügen.",
        example: "Admin → «Einzelne Datenquelle neu laden» → «Relais» → RepeaterBook lädt 70+ Länder → «CH-Relais-Links» lädt USKA-Daten."
      },
      {
        title: "Schweizer Relais-Quellen & Verlinkungen",
        body: "Die Schweizer Amateurfunk-Relais werden aus drei Quellen angereichert: 1) RepeaterBook (weltweit, Basisdaten) liefert Frequenzen, Modi, Standorte und Koordinaten. 2) USKA HB Repeater Voice List (uska.ch) — die offizielle Liste der Schweizer Amateurfunk-Relais mit 308 Einträgen. Aus den Remarks werden Crosslinks extrahiert (z.B. <>Tamaro, <>Scura, >RX Chestenberg) und als Verlinkungen auf der Karte angezeigt. EchoLink-Node-Nummern (EL#), D-STAR CCS-Nummern und C4FM/Wires-X-IDs werden übernommen. 3) SWISS-ARTG (swiss-artg.ch) — Standortliste der SWISS-ARTG-Anlagen (HB9AK, HB9ZRH, HB9SG) mit DMR-, FM- und D-STAR-Relais sowie APRS-iGates und HAMNET. Die Funkwelt HB Repeater Map (funkwelt.net) dient als zusätzliche Referenz. Verlinkungen werden als animierte Linien auf der Karte angezeigt; im Relais-Popup sehen Sie die verlinkten Relais mit Frequenz, Standort und Entfernung.",
        example: "Relais anklicken → Popup zeigt «Verlinkungen (1)» → HB9W 438.4125 MHz, Brütten, 1.6 km entfernt → Linie auf der Karte."
      },
      {
        title: "SWISS-ARTG-Details im Relais-Popup",
        body: "Für Relais der SWISS-ARTG (swiss-artg.ch) zeigt das Popup eine eigene Sektion mit detaillierten Informationen: Beschreibung der Anlage (z.B. «DMR Repeater Brandmeister SwissDMR»), Standorthöhe, Locator, CTCSS-Ton, DMR-Talkgruppen (mit Timeslot und TG-Nummer), FM-Funknetz-Talkgruppen, EchoLink-Node, DTMF-Steuerungscodes (für SVXLink-Relais), Abdeckungsgebiet, weitere Anlagen am Standort (HAMNET, APRS, Winlink, WSPR, DAPNET, WebSDR, KI-Gateway), Notstrom/Solar-Indikator, Sysop und ein direkter Link zur SWISS-ARTG-Webseite. Für DMR-Relais gibt es zusätzlich einen Link zum Brandmeister-Dashboard. Für D-STAR-Relais wird der verbundene Reflector (z.B. XLX229) angezeigt. Die Daten werden statisch aus der SWISS-ARTG-Webseite kuratiert und per Rufzeichen + Frequenz zugeordnet.",
        example: "HB9AK 438.400 MHz (Schleitheim) anklicken → Popup zeigt SWISS-ARTG-Sektion mit FM-Funknetz TGs, Echolink #326020, DTMF-Codes und DAPNET-Hinweis → Link zu swiss-artg.ch."
      },
      {
        title: "FM-Funknetz.de – Talkgroups (TGs) weltweit",
        body: "FM-Funknetz.de ist ein SvxLink-basiertes Relais- und Hotspot-Netzwerk, das ursprünglich aus Deutschland stammt, aber weltweit genutzt wird. Das Live-Dashboard (dashboard.fm-funknetz.de) zeigt aktive Stationen und ihre Talkgroups (TGs) in Echtzeit. Die App ruft das Dashboard ab und gleicht die aktiven TGs mit den Relais in der Datenbank ab — weltweit. Im Relais-Popup sehen Sie dann die aktiven TGs mit Nummer, Name und letzter Aktivitätszeit. Zusätzlich gibt es Links zum Live-Dashboard und zur vollständigen TG-Übersicht (fm-funknetz.de/unsere-talkgroups-sprechgruppen/). Die TGs umfassen regionale Sprechgruppen (z.B. 262xx für Deutschland, 2280 für Schweiz, 232x für Österreich, 235 für UK) und weltweite TGs (z.B. TG 91 Worldwide, TG 92 Europa). Administratoren können die TG-Daten über «Einzelne Datenquelle neu laden» → «FM-Funknetz TGs» aktualisieren.",
        example: "Relais anklicken → Popup zeigt «FM-Funknetz TGs (2)» → TG 2620 Berlin Brandenburg, TG 262 Deutschland → Link zum Live-Dashboard."
      },
      {
        title: "Relais-Abdeckung (Terrain-LOS mit SRTM)",
        body: "Die Relais-Abdeckung wird mit echten Geländedaten berechnet: SRTM 30m Höhenprofile via OpenTopoData API, Line-of-Sight (Sichtlinie) mit Erdkrümmung, Fresnel-Zone und Link-Budget pro Radial. Pro Relais werden 72 Radiale (alle 5°) berechnet — das Ergebnis ist ein asymmetrisches Polygon, das Berge und Täler berücksichtigt. Die maximale Reichweite wird dynamisch aus der Antennenhöhe berechnet (Horizontformel: 3.57×√h): ein Relais auf 2500m Säntis sieht bis ~120km, die Abdeckung erstreckt sich entsprechend. Bergketten (mehrere hohe Hindernisse) werden als harte Blockade behandelt — kein Signal dringt dahinter durch. Die Abdeckung wird mit einem Radial-Gradienten gerendert, der von innen nach aussen weich ausläuft (nicht als einfacher Kreis oder harte Kante). Aktivieren Sie die Abdeckung über den «Abdeckung anzeigen»-Toggle im Relais-Filter oder klicken Sie auf ein einzelnes Relais und dann auf den Abdeckung-Button im Popup. Schweizer Relais werden mit voller Terrain-Berechnung behandelt, weltweite Relais erhalten eine Band-Schätzung. Die Berechnung läuft wöchentlich automatisch (Montag nach Sync) oder manuell über den Admin-Bereich.",
        example: "Relais-Filter → «Abdeckung anzeigen» einschalten → asymmetrische Polygone mit weichem Rand erscheinen → enger in Berg-Richtung, weiter in Tal-Richtung → Säntis: weites Polygon bis zum Horizont."
      },
      {
        title: "Eigene Abdeckung berechnen (MODUS B)",
        body: "Mit dem orange-farbenen Radio-Button links auf der Karte können Sie Ihre eigene Sendereichweite berechnen. Geben Sie Ihre Position (GPS, QTH-Locator oder Kartenklick), Geräteart (Mobil/Fix/Portabel), Sendeleistung, Band/Frequenz und Modus ein. Die App berechnet 36 Radiale mit SRTM-Höhen, LOS und Link-Budget — das Ergebnis ist ein oranges Polygon auf der Karte, das Ihre effektive Reichweite unter Berücksichtigung von Gelände zeigt. Die Parameter (ausser Position) werden gespeichert. Die Position wird aus Datenschutzgründen nicht gespeichert. Verschiedene Gerätearten ergeben verschiedene Polygone: Mobil 50W 2m → grösseres Polygon, Portabel 5W 70cm → kleineres Polygon.",
        example: "Radio-Button klicken → GPS → «Mobil» → 50 W → 2m → FM → «Abdeckung berechnen» → oranges Polygon zeigt Reichweite mit Geländeeinfluss."
      },
      {
        title: "Abdeckungs-Dialog verschiebbar & Antennenhöhe",
        body: "Der Abdeckungs-Dialog kann frei auf dem Bildschirm verschoben werden: greifen Sie den Dialog an der Titelleiste (Header) und ziehen Sie ihn an eine beliebige Stelle. Die Antennenhöhe ist sowohl über einen Slider als auch über eine Zahleneingabe einstellbar — für präzise Werte tippen Sie die Zahl direkt ein, für schnelles Ausprobieren verwenden Sie den Slider. Die Antennenhöhe beeinflusst die Horizontreichweite (3.57×√h) und damit die Grösse des resultierenden Polygons.",
        example: "Dialog am Header greifen → an freie Stelle ziehen → Antennenhöhe per Slider auf 10m → Polygon wird kleiner → Zahleneingabe auf 25m für präzisen Wert."
      },
      {
        title: "Berechnungs-Verlauf verwalten",
        body: "Mehrere Abdeckungs-Berechnungen werden automatisch im Verlauf gespeichert. Jede Berechnung erscheint mit Datum, Position, Band und Modus. Sie können eine frühere Berechnung erneut laden (Polygon erscheint wieder auf der Karte) oder einzelne Einträge löschen. Beim «Neu berechnen» wird abgefragt, wie viele der vorgängigen Berechnungen behalten werden sollen — so vermeiden Sie versehentliches Verlieren wichtiger Referenz-Polygone. Der Verlauf wird pro Gerät lokal gespeichert.",
        example: "Berechnung 1 (2m) → Berechnung 2 (70cm) → Verlauf zeigt beide → 2m-Eintrag laden → Polygon erscheint → 70cm-Eintrag löschen."
      },
      {
        title: "Öffentliche Position teilen",
        body: "Sie können Ihren GPS-Standort als öffentliche Position markieren — alle Benutzer der App sehen Ihre Position dann auf der Karte mit Ihrem Rufzeichen und einem Zeitstempel. Aktivieren Sie den Toggle «Öffentlich teilen» im Abdeckungs-Dialog. Die Position wird automatisch im in den Einstellungen konfigurierten GPS-Intervall aktualisiert (z.B. alle 30 Sekunden). Andere Benutzer sehen Ihre Position als Marker mit Popup (Rufzeichen, Geräteart, letzte Aktualisierung). Sie können die öffentliche Freigabe jederzeit wieder deaktivieren — die Position verschwindet dann sofort für alle.",
        example: "Abdeckungs-Dialog → «Öffentlich teilen» aktivieren → eigene Position erscheint auf allen Karten → GPS-Intervall 30s → Position aktualisiert sich automatisch → Toggle aus → Position verschwindet."
      },
      {
        title: "Frequenz-spezifische Abdeckung",
        body: "Die Abdeckungsberechnung verwendet die exakte Frequenz (nicht nur das Band): Freiraumdämpfung (FSPL) steigt mit der Frequenz, Fresnel-Zone wird bei höheren Frequenzen kleiner, Beugung an Hindernissen nimmt mit der Frequenz ab. Beispiel: 145.325 MHz (2m) bei 30 km → FSPL 105.2 dB; 438.500 MHz (70cm) bei 30 km → FSPL 114.8 dB (9.6 dB mehr Dämpfung = ca. 3x weniger Reichweite). Die Parameter pro Band umfassen: max_range_flat/terrain, antenna_gain, ground_loss, vegetation_loss, building_loss, diffraction_factor, atmospheric_loss und k_factor.",
        example: "2m-Relais zeigt weiteres Polygon als 70cm-Relais am selben Standort → 23cm-Relais deutlich enger → Berg-Richtung bei allen enger als Tal-Richtung."
      },
      {
        title: "Position auf Karte setzen (Abdeckungs-Dialog)",
        body: "Im Abdeckungs-Dialog klicken Sie auf «Karte», um den Kartenklick-Modus zu aktivieren. Der Dialog wird ausgeblendet und ein orangefarbener Hinweis erscheint in der Mitte. Klicken Sie auf die gewünschte Stelle der Karte — die Position wird übernommen und der Dialog erscheint wieder mit der ausgewählten Position. Alternativ können Sie GPS verwenden oder einen QTH-Locator eingeben.",
        example: "Abdeckung-Dialog → «Karte» klicken → Dialog verschwindet → auf Karte tippen → Dialog kehrt zurück mit Position."
      },
      {
        title: "Position per Verschiebe-Modus korrigieren",
        body: "Aktivieren Sie den Verschiebe-Modus (Move-Icon links auf der Karte), um den Positions-Marker dragbar zu machen. Ziehen Sie die Pin-Nadel an die gewünschte Position — die Koordinaten werden sofort aktualisiert. Der Verschiebe-Modus funktioniert auch für Referenz-Marker: Ziehen Sie einen Referenz-Marker, um eine Positions-Korrektur einzureichen (wird vom Admin geprüft). Deaktivieren Sie den Modus nach der Korrektur wieder.",
        example: "Move-Button aktivieren → Pin-Nadel auf neue Position ziehen → Koordinaten aktualisiert → Move-Button deaktivieren."
      },
      {
        title: "Relais-Abdeckung im Popup",
        body: "Im Relais-Popup sehen Sie den Abdeckungs-Status: Prozentzahl und Fortschrittsbalken zeigen den Verfeinerungsgrad (0% = Band-Schätzung, 100% = Terrain-LOS). Wenn noch keine Abdeckung berechnet wurde, steht «Noch nicht berechnet». Administratoren sehen einen Button «Abdeckung berechnen» oder «Neu berechnen», um die Abdeckung für dieses spezifische Relais sofort zu berechnen. Die Berechnung verwendet SRTM 30m Höhendaten mit 72 Radialen und dauert ca. 60-160 Sekunden — die alte Abdeckung wird vorher gelöscht, damit keine veralteten Daten bleiben.",
        example: "Relais anklicken → «Mehr Informationen» → Abdeckungs-Status zeigt «Noch nicht berechnet» → Admin: «Abdeckung berechnen» klicken → nach 1-2 Minuten erscheint das Polygon mit weichem Rand."
      },
      {
        title: "Ausbreitungsmodelle – Übersicht",
        body: "Die App verwendet zwei verschiedene physikalische Ausbreitungsmodelle je nach Frequenzbereich: Für VHF/UHF (6m bis 23cm) das ITM+-Modell (Improved Terrain Model) und für Kurzwelle/HF (160m bis 10m) das KW-Modell mit Bodenwelle, Raumwelle und NVIS. Beide Modelle berechnen 72 Radiale (alle 5°) um den Sender und ergeben ein asymmetrisches Polygon, das Gelände und physikalische Ausbreitungseffekte berücksichtigt. Die maximale Reichweite wird dynamisch aus der Antennenhöhe berechnet (Horizontformel), nicht durch ein starres Band-Limit. Die Berechnung verwendet echte SRTM 30m Höhendaten via OpenTopoData API.",
        example: "2m/70cm → ITM+ mit LOS, Beugung, Troposcatter und Reflexion · 80m/40m → KW mit Bodenwelle, Raumwelle (MUF/LUF) und NVIS."
      },
      {
        title: "ITM+-Modell (VHF/UHF: 6m–23cm)",
        body: "Das ITM+-Modell (Improved Terrain Model) berechnet die Reichweite für VHF- und UHF-Bänder mit vier Ausbreitungsmechanismen: 1) Line-of-Sight (LOS): Direkte Sichtlinie mit Erdkrümmung (k-Faktor 4/3) und Fresnel-Zonen-Clearance. 2) Knife-Edge Diffraction: Beugung an Geländekanten nach dem ITU-R P.526-Modell — Signale biegen um Berge und Hügel. 3) Troposcatter: Streuung an Troposphären-Turbulenzen für Reichweiten über die Sichtlinie hinaus (bis ~30% über LOS). 4) Two-Ray Reflection: Bodenreflexion bei niedrigen Antennen (Bodenwelle im VHF-Bereich). Pro Radial wird das Maximum aus allen vier Mechanismen als effektive Reichweite genommen. Das Link-Budget berechnet Freiraumdämpfung (FSPL), Boden-, Vegetations- und Gebäudeverluste sowie atmosphärische Dämpfung. Die Rx-Empfindlichkeit hängt vom Modus ab (FM: -117 dBm, DMR: -112 dBm, SSB: -130 dBm, CW: -137 dBm).",
        example: "2m FM 50W auf einem Berg: LOS bis 40 km, + Beugung bis 55 km in Tallagen, + Troposcatter bis 65 km bei guter Troposphäre → asymmetrisches Polygon."
      },
      {
        title: "KW-/HF-Modell (160m–10m)",
        body: "Das KW-Modell berechnet die Reichweite für Kurzwellen-Bänder mit drei Ausbreitungsmechanismen: 1) Bodenwelle (Ground Wave): Signalausbreitung entlang der Erdoberfläche mit frequenzabhängiger Dämpfung (ground_alpha_moist/dry). Niedrige Frequenzen (160m, 80m) haben eine stärkere Bodenwelle (bis 200 km), höhere Frequenzen (20m, 15m) nur wenige Kilometer. 2) Raumwelle (Sky Wave): Reflexion an der Ionosphäre (F2-Schicht) — abhängig von MUF (Maximum Usable Frequency) und LUF (Lowest Usable Frequency). Die MUF wird aus foF2 (kritische Frequenz) × 3.5 berechnet, foF2 hängt von Sonnenhöhe und Sonnenaktivität (Solarzyklus) ab. Bei Tag ist die MUF höher (bis ~30 MHz), bei Nacht niedriger (~5-10 MHz). 3) NVIS (Near Vertical Incidence Skywave): Bei Frequenzen 3-10 MHz mit niedriger Antenne (2m) wird das Signal fast senkrecht in die Ionosphäre gestrahlt und reflektiert — deckt 0-500 km ohne Skip-Zone. Ideal für regionale Kommunikation bei schlechten Bodenwellen-Bedingungen.",
        example: "80m Tag: Bodenwelle bis 120 km + NVIS bis 500 km · 20m Tag: Raumwelle bis 3000 km, Bodenwelle nur ~20 km · 80m Nacht: MUF sinkt, Raumwelle nur bei niedrigen Frequenzen."
      },
      {
        title: "MUF, LUF und Sonnenaktivität",
        body: "Die ionosphärische Ausbreitung hängt stark von der Sonnenaktivität ab. Die App berechnet MUF (Maximum Usable Frequency) und LUF (Lowest Usable Frequency) aus der Sonnenhöhe (Deklination, Tageszeit, Breitengrad) und einem Solar-Aktivitätsfaktor (0.7 = Solar Minimum, 1.0 = Mittel, 1.3 = Solar Maximum). foF2 = (1.5 + 4.5 × sin(Sonnenhöhe)) × Solar-Aktivität. MUF = foF2 × 3.5. LUF = 5 × Solar-Aktivität (Tag) bzw. 2 × Solar-Aktivität (Nacht). Wenn die gewählte Frequenz über der MUF liegt, ist das Band geschlossen (Signal durchquert die Ionosphäre). Wenn sie unter der LUF liegt, ist die Dämpfung zu hoch. Im Abdeckungs-Dialog wird MUF/LUF und die Sonnenhöhe angezeigt, mit einer Warnung bei geschlossenem Band.",
        example: "20m bei Nacht im Solar Minimum: MUF ~7 MHz → Band geschlossen (14 MHz > MUF) · 40m bei Tag im Solar Maximum: MUF ~25 MHz → Band offen."
      },
      {
        title: "Skip-Zone bei KW-Raumwelle",
        body: "Bei der Raumwelle entsteht eine Skip-Zone: der Bereich zwischen der maximalen Bodenwellen-Reichweite und dem ersten Reflexionspunkt an der Ionosphäre, in dem kein Signal empfangbar ist. Die App berechnet die Skip-Zone und zeigt sie als grauen gestrichelten Kreis auf der Karte. Innerhalb der Skip-Zone ist kein Empfang möglich (ausser NVIS im 3-10 MHz Bereich). Ausserhalb der Skip-Zone beginnt die Raumwellen-Abdeckung. Die Skip-Zone ist frequenzabhängig: höhere Frequenzen haben eine grössere Skip-Zone (20m: ~500-1500 km), niedrigere Frequenzen eine kleinere (80m: ~100-300 km). NVIS überbrückt die Skip-Zone bei 3-10 MHz mit niedriger Antenne.",
        example: "20m Raumwelle: Skip-Zone 500-1500 km → innerhalb 500 km kein Empfang (ausser NVIS), ab 1500 km Raumwellen-Empfang bis 3000 km."
      },
      {
        title: "Link-Budget und Empfindlichkeit",
        body: "Das Link-Budget berechnet die Signalstärke am Empfänger: Sendeleistung (dBW) + Antennengewinn (dBi) − Freiraumdämpfung (FSPL) − Bodenverluste − Vegetationsverluste − Gebäudeverluste − atmosphärische Dämpfung = Rx-Signal (dBm). Wenn das Rx-Signal über der Empfindlichkeit des Empfängers liegt (mit Margin), ist die Verbindung möglich. Die Empfindlichkeit hängt vom Modus ab: FM -117 dBm, DMR -112 dBm, D-STAR -112 dBm, Fusion -112 dBm, SSB -130 dBm, CW -137 dBm, FT8 -130 dBm. Ein Margin von 10 dB wird als zuverlässig betrachtet. Die FSPL steigt mit der Frequenz: 145 MHz bei 30 km = 105 dB, 438 MHz bei 30 km = 115 dB (10 dB mehr = ca. 3x weniger Reichweite).",
        example: "50W (47 dBW) + 5 dBi Antenne = 52 dBm EIRP · 2m bei 30 km: FSPL 105 dB → Rx = 52 - 105 = -53 dBm · Margin zu FM (-117): 64 dB → sehr zuverlässig."
      },
      {
        title: "SRTM-Höhendaten und Radiale",
        body: "Die Abdeckungsberechnung verwendet SRTM 30m Höhendaten (Shuttle Radar Topography Mission) via OpenTopoData API. Pro Sender werden 72 Radiale (alle 5°) berechnet: entlang jedes Radials werden Höhenprofile in adaptiven Schritten abgefragt (0.5km für <30km Reichweite, 1km für 30-60km, 2km für >60km). Die maximale Reichweite wird dynamisch aus der Antennenhöhe berechnet (Horizontformel 3.57×√h, gedeckelt bei 120km). Für jeden Punkt wird geprüft: ist LOS frei (Sichtlinie mit Erdkrümmung und Fresnel-Zone)? Gibt es eine Beugungsmöglichkeit am nächsten Hindernis? Ist Troposcatter möglich? Bergketten (3+ hohe Hindernisse) blockieren komplett — kein Signal dringt durch. Die 72 Radiale werden mit Moving-Average geglättet (3 Durchgänge) und bilden zusammen ein asymmetrisches Polygon mit natürlichem, weichem Verlauf. Die Berechnung dauert 60-160 Sekunden pro Relais (72 Radiale × adaptive Schritte × Höhen-API).",
        example: "Relais auf einem Berg: Nord-Radial (über Berg) = 15 km, Süd-Radial (über Tal) = 80 km → asymmetrisches Polygon mit weichem Rand, nicht ein einfacher Kreis."
      },
      {
        title: "Band-spezifische Parameter",
        body: "Jedes Band hat eigene physikalische Parameter: maximale Reichweite (flach/Gelände), Antennengewinn, Fresnel-Clearance, Boden-/Vegetations-/Gebäudeverluste, Beugungsfaktor, atmosphärische Dämpfung und k-Faktor. Für KW-Bänder zusätzlich: Bodenwellen-Dämpfung (feucht/trocken), Raumwellen-Reichweite und NVIS-Reichweite. Niedrige Frequenzen (160m, 80m) haben eine stärkere Bodenwelle und höhere Beugung, höhere Frequenzen (70cm, 23cm) haben eine höhere FSPL und geringere Beugung. Die Parameter basieren auf ITU-R Empfehlungen (P.368, P.526, P.837) und empirischen Werten aus dem Amateurfunk-Bereich.",
        example: "2m: max. 80 km flach, 40 km Gelände, Beugung 0.5 · 70cm: max. 50 km flach, 25 km Gelände, Beugung 0.35 · 23cm: max. 25 km flach, 12 km Gelände, Beugung 0.25."
      },
      {
        title: "App-Funktionen anpassen (Feature-Flags)",
        body: "In den Einstellungen unter «App-Funktionen anpassen» können Sie die App personalisieren: Layer ein-/ausschalten, Bänder aktivieren (Standard: nur 2m und 70cm), Werkzeuge ein-/ausblenden (GPS, Logbuch, QSO, Filter, Abdeckung, etc.), Offline-Funktionen und erweiterte Optionen. Die Einstellungen werden lokal gespeichert und mit dem Benutzerprofil synchronisiert. Schnell-Vorlagen (Minimal, Standard, KW-Modus, VHF/UHF, 2m/70cm) setzen alle Funktionen auf einmal. Der «Auf Standard zurücksetzen»-Button stellt die werkseitigen Standardwerte wieder her. Neue Benutzer starten mit minimaler Konfiguration (nur Log QSO, Layers, GPS).",
        example: "Einstellungen → App-Funktionen → «KW-Modus» Vorlage → nur KW-Bänder aktiv, VHF/UHF ausgeblendet, NVIS verfügbar → speichern."
      },
      {
        title: "LLOTA – Lakes & Lagoons on the Air",
        body: "LLOTA ist ein weltweites Aktivierungsprogramm für Seen und Lagunen mit 8.357 Referenzen in 54 Ländern (llota.app). Die Seen werden auf der Karte als farbige Polygone (See-Umrisse) dargestellt, nicht als einfache Marker. Farb-Codierung: Hellblau = noch nie aktiviert, Kräftiges Blau = bereits aktiviert (mit Marker-Pin und Aktivierungsanzahl), Pulsierender roter Ring = Live-Aktivierung (Spot vorhanden). Polygone werden ab Zoom-Stufe 10 gerendert, bei weiter herausgezoomt werden CircleMarker angezeigt. Beim Klick auf einen See öffnet sich ein Popup mit Referenz-Code, Name, Region, Beschreibung, Zugangsinformationen, Aktivierungsanzahl und Link zu llota.app. Im Hunting-Modul gibt es einen eigenen LLOTA-Tab mit allen aktiven LLOTA-Spots (Auto-Refresh 60s).",
        example: "Layer «LLOTA – Lakes & Lagoons» aktivieren → Seen erscheinen als blaue Polygone → hineinzoomen (Zoom ≥ 10) für Polygon-Darstellung → Klick auf See → Popup mit Details."
      },
      {
        title: "LLOTA Aktivierungs-Regeln",
        body: "Aktivierung: Mindestens 10 QSOs müssen getätigt werden, maximal 200 m vom Ufer entfernt. Spots verfallen nach 30 Minuten Inaktivität. Auto-Spotting ist erlaubt. ADIF-Format: <MY_SIG>LLOTA und <MY_SIG_INFO>LLCL-0001 (Referenz-Code). Hunters (Jäger) müssen keinen Log-Upload durchführen — die Aktivierung gilt für den Aktivator. Die Band-Berechnung für LLOTA-Spots erfolgt automatisch aus der Frequenz (Hz): 14335000 Hz = 14.335 MHz = 20m Band.",
        example: "Am Seeufer stehen → 10 QSOs funken → ADIF: <MY_SIG>LLOTA <MY_SIG_INFO>LLCH-0001 → Spot wird automatisch nach 30 Min. inaktiv."
      }
    ]
  },
  {
    id: "logbuch",
    icon: BookOpen,
    title: "QSO-Logbuch",
    color: "#10b981",
    description: "Im Logbuch werden alle Funkverbindungen (QSOs) erfasst, verwaltet und exportiert.",
    items: [
      {
        title: "Neues QSO erfassen",
        body: "Klicken Sie auf der Karte auf den schwarzen Button «Neues QSO» unten rechts. Im Formular geben Sie Rufzeichen, Datum, Zeit, Frequenz, Band, Mode und RST-Werte ein. Optionale Felder: Notizen, Standort/Referenz, Suffix. Nach dem Speichern bleibt das Formular offen, damit Sie direkt das nächste QSO erfassen können. Rufzeichen, Operator-Daten und Notizen werden zurückgesetzt, häufige Werte (Frequenz, Band, Mode, RST, Referenz) bleiben erhalten. Das Formular kann nur über das X-Icon oben rechts geschlossen werden – ein Klick auf die Karte oder ausserhalb des Formulars schliesst es nicht.",
        example: "Rufzeichen HB9XYZ eingeben → QRZ-Abfrage füllt Name, Adresse und Grid aus → «QSO speichern & weiter» → Formular bleibt offen für das nächste QSO."
      },
      {
        title: "QRZ.com-Abfrage",
        body: "Wenn Sie ein Rufzeichen eingeben und die QRZ-Abfrage aktiviert ist (in den Einstellungen), werden automatisch Name, Adresse, Land, Grid-Locator und E-Mail des Operators von QRZ.com geladen. Klicken Sie auf den «QRZ»-Button, um die Abfrage manuell auszulösen.",
        example: "Eingabe «HB9XYZ» + Tab-Taste oder QRZ-Button → Daten werden geladen und im blauen Kasten angezeigt."
      },
      {
        title: "Band & Frequenz automatisch",
        body: "Das Band passt sich automatisch an die eingegebene Frequenz an (z.B. 144.500 MHz → 2m). Wenn Sie das Band manuell ändern, springt die Frequenz automatisch in die Mitte des Bandes (z.B. 2m → 145.500 MHz). Dies beschleunigt die QSO-Erfassung und verhindert Eingabefehler.",
        example: "Frequenz 145.500 eingeben → Band wird automatisch auf «2m» gesetzt. Band «70cm» wählen → Frequenz springt auf 433.500 MHz."
      },
      {
        title: "Sendeleistung (Power)",
        body: "Im QSO-Formular können Sie die Sendeleistung in Watt eingeben. Der Wert bleibt für das nächste QSO erhalten. Für ADIF-Exporte wird das Feld mit exportiert.",
        example: "QRP-Betrieb: «5» Watt eingeben → wird gespeichert und im nächsten QSO vorausgefüllt."
      },
      {
        title: "Standort / Referenz erfassen",
        body: "Im Formular können Sie Ihren eigenen Standort erfassen: Wählen Sie den Referenz-Typ (SOTA, POTA, etc.). Beim Wechsel des Referenz-Typs werden der Referenz-Code und der Referenz-Name automatisch geleert, damit Sie sauber neu beginnen können. Tippen Sie in das Feld «Referenz-Code» oder «Name der Referenz», öffnet sich automatisch eine Auswahlliste mit passenden Referenzen – weltweit, gefiltert nach dem gewählten Referenz-Typ. Geben Sie z.B. «Bürkli» im Namensfeld ein, erscheinen alle passenden Gipfel/Burgen/etc. zur Auswahl. Ein Klick auf einen Eintrag füllt sowohl Code als auch Name automatisch aus. Alternativ können Sie aus den in der Nähe befindlichen Referenzen wählen (basierend auf GPS-Position oder fixierter Kartenposition, 25-km-Umkreis). Für generelle Standorte ohne Referenz wählen Sie «Generell» und geben nur Ihren Maidenhead-Locator ein.",
        example: "Auf dem Gipfel: Typ «SOTA» wählen → «Bürkli» im Namensfeld eingeben → Auswahlliste erscheint → Eintrag anklicken → Code und Name werden automatisch ausgefüllt."
      },
      {
        title: "Suffix verwenden",
        body: "Suffixe geben an, von wo aus Sie funken: /P = portable (Feldeinsatz), /M = mobil (Auto), /AM = mobilflug, /MM = Seefahrt. Wählen Sie den passenden Suffix im Formular.",
        example: "Feldeinsatz auf einem Berg: Suffix «/P» auswählen."
      },
      {
        title: "Clubstation loggen",
        body: "Aktivieren Sie die Checkbox «Clubstation», wenn Sie mit einem abweichenden Stations-Rufzeichen funken (z.B. HB9OM). Es öffnet sich ein Popup, in dem Sie das Clubstations-Rufzeichen, Ihr persönliches Rufzeichen (Operator) und den Operator-Namen eingeben. Die Daten werden für zukünftige QSOs gespeichert.",
        example: "Clubstation HB9OM aktivieren → Popup ausfüllen → bei jedem QSO wird HB9OM als Stations-Rufzeichen gespeichert."
      },
      {
        title: "QSO bearbeiten",
        body: "Klicken Sie auf das Stift-Symbol neben einem Eintrag, um ihn zu bearbeiten. Alle Felder können angepasst werden. Klicken Sie auf «Aktualisieren», um die Änderungen zu speichern.",
        example: "RST-Wert korrigieren: Stift klicken → RST ändern → «Aktualisieren»."
      },
      {
        title: "Einträge filtern & sortieren",
        body: "Oben im Logbuch können Sie nach Referenz-Typ filtern, nur aktive oder archivierte Einträge anzeigen und die Sortierung ändern (Datum absteigend/aufsteigend, Rufzeichen A-Z).",
        example: "Nur SOTA-Logeinträge: Filter «SOTA» wählen → nur SOTA-QSOs werden angezeigt."
      },
      {
        title: "Einträge archivieren",
        body: "Klicken Sie auf das Archiv-Symbol, um einen Eintrag zu archivieren. Archivierte Einträge werden ausgeblendet, können aber über den Filter «Archiviert» wiederhergestellt werden.",
        example: "Alte QSOs archivieren: Archiv-Symbol klicken → «Archivieren» bestätigen."
      },
      {
        title: "ADIF-Export",
        body: "Klicken Sie auf «Export (ADIF)», um alle gefilterten Einträge als ADIF-Datei herunterzuladen. Diese Datei kann in andere Logbuch-Programme (z.B. HRDLog, N1MM, Log4OM) importiert werden. Die Export-Datei enthält alle QSO-Daten inklusive Referenzen und Clubstations-Rufzeichen.",
        example: "Alle QSOs von 2026 exportieren: Nach Datum sortieren → Export klicken → .adi-Datei wird heruntergeladen."
      },
      {
        title: "ADIF-Import",
        body: "Klicken Sie auf «Import», um eine ADIF-Datei (.adi) hochzuladen und in das Logbuch zu importieren. Die Datei wird vor dem Import validiert: ungültige Einträge werden markiert, Dubletten (gleiche Rufzeichen, Datum, Zeit, Frequenz und Mode) werden erkannt. In der Vorschau sehen Sie alle Datensätze mit Status (gültig, Dublette, fehlerhaft) und können den Import bestätigen. Nach dem Import wird ein Import-Protokoll mit Erfolgs- und Fehlerstatistik angezeigt. Die importierten QSOs werden lokal gespeichert und im Hintergrund mit dem Server synchronisiert.",
        example: "ADIF-Datei aus anderem Logbuch hochladen → Vorschau mit Validierung → «Importieren» → Protokoll zeigt Anzahl importierter und übersprungener Einträge."
      },
      {
        title: "Mehrfachauswahl & Bulk-Bearbeitung (Umbuchen)",
        body: "Klicken Sie auf das Kontrollkästchen-Symbol oben rechts im Logbuch, um den Auswahlmodus zu aktivieren. Tippen Sie auf einzelne Einträge, um sie auszuwählen, oder verwenden Sie «Alle auswählen». Eine blaue Aktionsleiste zeigt die Anzahl ausgewählter Einträge und den Button «Umbuchen». Im Bulk-Edit-Dialog können Sie mehrere Felder gleichzeitig für alle ausgewählten Einträge ändern: Suffix, Referenz-Typ, Referenz-Code, Referenz-Name, Locator, Band, Mode und Status. Zudem gibt es eine Schnellaktion «Club → Persönlich», die Clubstation-Einträge in persönliche umwandelt (entfernt Club-Rufzeichen und Operator-Felder) – nur sichtbar wenn Clubstation-Einträge ausgewählt sind. Jedes Feld muss mit einer Checkbox aktiviert werden; nur aktivierte Felder werden überschrieben. Die Änderungen werden lokal sofort angwendet und im Hintergrund synchronisiert.",
        example: "10 Clubstation-QSOs auswählen → «Umbuchen» → «Club → Persönlich» aktivieren → «Anwenden» → alle 10 werden zu persönlichen QSOs."
      },
      {
        title: "Lokale Speicherung & Synchronisation",
        body: "Ihre QSO-Logeinträge werden lokal im Browser gespeichert (localStorage). Das bedeutet: Die Daten sind sofort verfügbar, auch ohne Internetverbindung. Beim Öffnen des Logbuchs werden zuerst die lokalen Daten angezeigt (sofort), dann wird im Hintergrund mit dem Server synchronisiert. Ein Cloud-Icon neben der Eintragsanzahl zeigt den Synchronisationsstatus an. So haben Sie Ihre Daten immer auf jedem Gerät – lokal zwischengespeichert und online synchronisiert.",
        example: "Logbuch öffnen → lokale Daten erscheinen sofort → Cloud-Icon = synchronisiert."
      },
      {
        title: "Statistik-Ansicht",
        body: "Über das Balken-Diagramm-Icon oben rechts im Logbuch können Sie zwischen Listen- und Statistik-Ansicht wechseln. Die Statistik zeigt übersichtliche Diagramme zu QSOs pro Band, Mode, Referenz-Typ und Monat sowie weitere Kennzahlen.",
        example: "Balken-Icon klicken → Statistik mit Diagrammen zu Bändern, Modes und Referenz-Typen."
      },
      {
        title: "Einträge löschen",
        body: "Einzelne Einträge können über das Mülleimer-Symbol gelöscht werden. Über den Button «Löschen» oben können alle aktuell gefilterten Einträge auf einmal gelöscht werden (mit Bestätigungsdialog). ACHTUNG: Das Löschen ist unwiderruflich! Gelöschte QSOs können nicht wiederhergestellt werden. Verwenden Sie stattdessen die Archiv-Funktion, wenn Sie sich nicht sicher sind.",
        example: "Vorsicht: Das Löschen ist unwiderruflich – besser zuerst archivieren, dann können Einträge jederzeit wiederhergestellt werden."
      }
    ]
  },
  {
    id: "einstellungen",
    icon: SettingsIcon,
    title: "Einstellungen",
    color: "#f59e0b",
    description: "In den Einstellungen verwalten Sie Ihr Profil, die QRZ.com-Integration und die Datenaktualisierung.",
    items: [
      {
        title: "Mein Profil",
        body: "Geben Sie Ihr persönliches Rufzeichen ein. Dieses wird beim Clubstation-Modus als Standard-Operator vorausgefüllt. Speichern Sie mit «Speichern».",
        example: "Rufzeichen «HB9ABC» eingeben → Speichern → beim nächsten Clubstation-QSO bereits vorausgefüllt."
      },
      {
        anchor: "qrz-konfiguration",
        title: "QRZ.com Abfrage & Konfiguration",
        body: "Jeder Benutzer kann seine eigenen QRZ.com-Zugangsdaten in den Einstellungen hinterlegen (Benutzername & Passwort). Geben Sie Ihre Daten ein und speichern Sie das Profil. Der Schalter wird erst aktiviert, wenn Anmeldedaten hinterlegt sind. Administratoren und der Demo-Benutzer nutzen automatisch die Club-XML-Subscription. Klicken Sie auf «QRZ-Verbindung testen», um zu prüfen, ob die Anmeldung funktioniert. Beim Erfassen eines QSOs werden Name, Adresse, Land, Grid-Locator und E-Mail des Operators automatisch von QRZ.com geladen.",
        example: "Einstellungen → QRZ-Benutzername & Passwort eingeben → Speichern → Schalter aktivieren → «Verbindung testen».",
        links: [
          { label: "QRZ.com Konto erstellen", url: "https://www.qrz.com/register" },
          { label: "QRZ.com XML-Subscription (erforderlich)", url: "https://www.qrz.com/page/current_spec.html" },
        ]
      },
      {
        anchor: "aprs-konfiguration",
        title: "APRS.fi API-Key konfigurieren",
        body: "Für die APRS-Datenabfrage (Private Nodes, Relais-Koordinaten) benötigen Sie einen APRS.fi API-Key. Der Key ist kostenlos erhältlich. Gehen Sie auf aprs.fi/page/api, melden Sie sich mit Ihrem APRS-Rufzeichen an und fordern Sie einen API-Key an. Geben Sie den Key in den Einstellungen unter «APRS.fi API-Key» ein. Klicken Sie auf «APRS-Key testen», um die Funktion zu prüfen. Ohne Key sind APRS-Relais und Private Nodes nicht verfügbar. Demo-Konto: Der Club-Key ist bereits hinterlegt.",
        example: "aprs.fi/page/api → API-Key anfordern → Einstellungen → Key eingeben → «Testen».",
        links: [
          { label: "APRS.fi API-Key anfordern (kostenlos)", url: "https://aprs.fi/page/api" },
        ]
      },
      {
        anchor: "repeaterbook-konfiguration",
        title: "RepeaterBook API-Token konfigurieren",
        body: "Seit März 2026 blockiert RepeaterBook automatische Logins per Cloudflare-Anti-Bot-Schutz. Statt Benutzername/Passwort wird ein API-Token verwendet. Generieren Sie den Token im RepeaterBook Dashboard unter repeaterbook.com/user/api_apps.php. Voraussetzung: Die App «HB9OM On Field» muss bei RepeaterBook freigeschaltet sein (Freischalt-Formular: repeaterbook.com/api_request.php). Geben Sie den Token (rbuapp_...) in den Einstellungen ein und testen Sie ihn mit «Token testen». Bei Erfolg ist der automatische Sync aktiviert. Bei ungültigem Token: Sync stoppt, Fehlermeldung wird angezeigt. Ohne Token: Sync deaktiviert, manueller JSON-Export als Fallback (Admin → JSON Repeater Import). Demo-Konto: Eingabe gesperrt, Club-Token wird verwendet.",
        example: "repeaterbook.com/user/api_apps.php → Token generieren → Einstellungen → Token eingeben → «Token testen» → Sync aktiviert.",
        links: [
          { label: "RepeaterBook API-Token generieren", url: "https://www.repeaterbook.com/user/api_apps.php" },
          { label: "App freischalten (falls noch nicht erfolgt)", url: "https://www.repeaterbook.com/api_request.php" },
          { label: "RepeaterBook API-Dokumentation", url: "https://www.repeaterbook.com/wiki/doku.php?id=api" },
        ]
      },
      {
        anchor: "brandmeister-konfiguration",
        title: "BrandMeister API-Key konfigurieren",
        body: "BrandMeister nutzt API-Keys statt Login-Formular. Generieren Sie den Key im BrandMeister Dashboard unter Profile → API (brandmeister.network). Der Key ist ein langer Hex-String, eindeutig pro Nutzer. Geben Sie den Key in den Einstellungen ein und testen Sie ihn mit «Key testen». Bei Erfolg sind persönliche Daten (Last Heard, etc.) verfügbar. Bei ungültigem Key: nur öffentliche Repeater-Liste wird geladen. Ohne Key: Repeater-Liste ist trotzdem öffentlich verfügbar — persönliche Daten nicht. Demo-Konto: Eingabe gesperrt, Club-Key wird verwendet.",
        example: "brandmeister.network → Profile → API → Key generieren → Einstellungen → Key eingeben → «Key testen».",
        links: [
          { label: "BrandMeister Dashboard (Key generieren)", url: "https://brandmeister.network" },
          { label: "BrandMeister API-Keys Info", url: "https://news.brandmeister.network/introducing-user-api-keys/" },
        ]
      },
      {
        title: "Zugangsdaten-Priorität (Club vs. Persönlich)",
        body: "In den Einstellungen können Sie unter «Zugangsdaten-Priorität» festlegen, welche Zugangsdaten für App-Abfragen verwendet werden: «Auto» (Fallback: Persönlich → Club → Code), «Persönliche Zugangsdaten» oder «Club-Zugangsdaten». Bei «Auto» werden persönliche Angaben bevorzugt, falls vorhanden. Fehlen diese, werden Club-Daten oder die im Code hinterlegten Secrets verwendet. Das Demo-Konto nutzt immer die Club-Daten — eigene Eingaben sind gesperrt.",
        example: "Einstellungen → «Zugangsdaten-Priorität» → «Persönliche Zugangsdaten» wählen → alle Abfragen nutzen Ihre eigenen Daten."
      },
      {
        title: "Konfigurations-Status (Fortschrittsbalken)",
        body: "Oben in den Einstellungen wird ein Fortschrittsbalken angezeigt, der anzeigt, wie viele Konfigurationen erfasst sind. Fehlende Konfigurationen werden mit Erklärung und direktem Link aufgelistet. Bei 100% sind alle Funktionen verfügbar. Bei fehlenden Konfigurationen sind die entsprechenden Funktionen (z.B. APRS-Layer ohne API-Key) in der App ausgegraut.",
        example: "Fortschrittsbalken zeigt 60% → fehlende Konfiguration anklicken → direkt zum Eingabefeld springen."
      },
      {
        title: "Demo-Konto Beschränkungen",
        body: "Das Demo-Konto (demo@hb9om.ch) hat eingeschränkte Funktionen: Eingabefelder für QRZ, APRS, RepeaterBook API-Token und BrandMeister API-Key sind gesperrt (HB9OM hat Accounts für Demo-Zwecke hinterlegt). Backup & Restore sind gesperrt. QRZ-Uploads aus dem Logbuch sind gesperrt. Alle gesperrten Funktionen sind ausgegraut mit entsprechendem Hinweis. Normale Benutzerkonten haben volle Funktionalität.",
        example: "Demo-Konto → Einstellungen → alle Token-/Key-Felder grau mit Hinweis «Demo-Konto: gesperrt»."
      },
      {
        title: "Daten aktualisieren",
        body: "Über «Alle Daten aktualisieren» werden alle Referenz-Daten (SOTA, POTA, WWFF, WWBOTA, Burgen, Leuchttürme, IOTA) neu von den jeweiligen Quellen geladen. Das kann einige Minuten dauern. Der Status wird unten im Aktualisierungsprotokoll angezeigt. Bei den Burgen wird zusätzlich angezeigt, wie viele erfolgreich georeferenziert wurden und über welche Methode (OSM/Wikidata, map.admin.ch, Locator, Nominatim). Diese Funktion ist nur für Administratoren verfügbar.",
        example: "Neue SOTA-Gipfel verfügbar: «Alle Daten aktualisieren» klicken → warten bis Status «Erfolgreich»."
      },
      {
        title: "Cache-Status",
        body: "Zeigt, wie viele Referenzen pro Typ zwischengespeichert sind und wann die letzte Aktualisierung stattfand. Zusätzlich wird angezeigt, wie viele Referenzen erfolgreich georeferenziert wurden (mit Koordinaten) und wie viele noch offen sind. Bei veralteten Daten (>7 Tage) erscheint ein Warnhinweis. Nur für Administratoren sichtbar.",
        example: "SOTA: 1341 total, 1341 geo, zuletzt aktualisiert 09.07.2026."
      },
      {
        title: "QRZ-Abfrageverlauf",
        body: "Zeigt die letzten 10 QRZ-Abfragen mit Status (Erfolg/Fehler) und Uhrzeit. Der Verlauf kann mit «Protokoll löschen» geleert werden.",
        example: "HB9XYZ – Erfolg – 14:32 Uhr"
      },
      {
        title: "Tägliche Automatik",
        body: "Mit dem Schalter «Tägliche Automatik» können Administratoren die automatische tägliche Aktualisierung der Referenzdaten ein- oder ausschalten. Wenn aktiviert, werden SOTA, POTA, WWFF etc. einmal pro Tag (nachts) automatisch aktualisiert. Wenn deaktiviert, müssen die Daten manuell über «Jetzt aktualisieren» neu geladen werden. Diese Funktion ist nur für Administratoren verfügbar.",
        example: "Automatik ausschalten → Daten werden nur bei manueller Aktualisierung erneuert."
      },
      {
        title: "Meine Änderungsanträge",
        body: "Unter «Meine Änderungsanträge» in den Einstellungen oder über das ClipboardList-Icon auf der Karte sehen Sie alle Ihre eingereichten Positions-Korrekturen. Jeder Antrag zeigt den Referenz-Code, die aktuelle und vorgeschlagene Position, den Status (In Prüfung, Genehmigt, Abgelehnt, Zurückgezogen) und eventuelle Admin-Kommentare. Ausstehende Anträge können jederzeit zurückgezogen werden.",
        example: "Einstellungen → «Meine Änderungsanträge» → «Anträge» → Status siehen oder zurückziehen."
      },
      {
        title: "Offline-Modus & lokaler Speicher",
        body: "In den Einstellungen unter «Offline-Modus & lokaler Speicher» (eine vereinheitlichte Sektion) finden Sie alles für den Offline-Betrieb an einem Ort: 1) Schalter für den manuellen Offline-Modus, 2) Bereitschaftsanzeige mit Liste der noch fehlenden Daten, 3) Gesamtspeicher-Übersicht (Grösse und Referenzanzahl), 4) Pro-Layer-Schalter mit Download-Buttons für jeden Daten-Typ (SOTA, POTA, WWFF, WWBOTA, Burgen, IOTA, Leuchttürme, Relais, APRS, QRZ), 5) «Alle laden»-Button für alle Referenz-Typen auf einmal, 6) Offline-Karten-Verwaltung mit Grössenangaben, 7) «Alle Offline-Daten löschen»-Button. Die obige Offline-Checkliste in der Hilfe führt Schritt für Schritt durch alle Punkte.",
        example: "Einstellungen → «Offline-Modus & lokaler Speicher» → «Alle laden» → Bereitschaftsanzeige wird grün → Offline-Modus testen."
      },
      {
        title: "Konto löschen",
        body: "Über «Konto löschen» können Sie Ihr Konto inklusive aller QSO-Logs und Einstellungen unwiderruflich löschen. ACHTUNG: Diese Aktion kann nicht rückgängig gemacht werden! Alle Ihre Daten (QSO-Logs, Einstellungen, QRZ-Abfragen, Anträge) werden dauerhaft gelöscht. Erstellen Sie vorher ein Backup, wenn Sie Ihre Daten behalten möchten.",
        example: "Konto löschen → Bestätigungsdialog → Endgültig löschen. Vorher Backup erstellen!"
      },
      {
        title: "Datensicherung (Backup & Restore)",
        body: "In den Einstellungen unter «Datensicherung» können Sie ein vollständiges Backup aller Ihrer Daten erstellen: Logbuch, Einstellungen, QRZ-Abfragen und Anträge. Klicken Sie auf «Backup», um eine JSON-Datei herunterzuladen. Speichern Sie diese Datei an einem sicheren Ort. Mit «Wiederherstellen» können Sie eine Backup-Datei hochladen – alle aktuellen Daten werden dabei überschrieben. Ein Hinweis zeigt das Datum des letzten Backups an.",
        example: "Einstellungen → «Datensicherung» → «Backup» → JSON-Datei wird heruntergeladen → sicher speichern."
      },
      {
        title: "Cloud-Backup mit WebDAV",
        body: "Für fortgeschrittene Benutzer: Klicken Sie auf «WebDAV (erweitert)», um einen WebDAV-Server (Nextcloud, ownCloud, Synology, Strato HiDrive) zu konfigurieren. Geben Sie URL, Benutzername und Passwort ein, testen Sie die Verbindung und sichern Sie Ihre Daten direkt auf Ihrem Server. Auch hier ist ein automatisches Backup bei jedem neuen QSO verfügbar.",
        example: "Einstellungen → «Datensicherung» → «WebDAV (erweitert)» → URL/Benutzer/Passwort eingeben → «Testen» → «Speichern»."
      },
      {
        title: "Cloud-Daten löschen",
        body: "In der Datei-Liste Ihres WebDAV-Servers können Sie einzelne Backups mit dem Mülleimer-Symbol dauerhaft löschen. Tippen Sie auf «Dateien», um alle in der Cloud gespeicherten Backups anzuzeigen, und entfernen Sie nicht mehr benötigte Dateien. Achtung: Das Löschen von Cloud-Backups ist unwiderruflich! Gelöschte Dateien können nicht wiederhergestellt werden.",
        example: "«Dateien» klicken → Backup-Liste wird angezeigt → Mülleimer-Symbol neben dem Backup klicken → bestätigen → Datei wird gelöscht."
      },
      {
        title: "Benutzerverwaltung (Admin)",
        body: "Administratoren sehen in den Einstellungen einen Bereich «Benutzerverwaltung». Darüber können alle angemeldeten Benutzer eingesehen, Passwörter zurückgesetzt, Rollen geändert (Admin/User) und Benutzer gelöscht werden. Neue Admins müssen sich einmal ab- und wieder anmelden, falls ihre Rolle kürzlich geändert wurde.",
        example: "Admin → Einstellungen → Benutzerverwaltung → Benutzer zum Admin befördern."
      }
    ]
  },
  {
    id: "ausland",
    icon: Globe,
    title: "Im Ausland funken (CEPT)",
    color: "#0ea5e9",
    description: "CEPT-Länderpräfixe, Full vs. Novice Lizenz und Gastlizenzen für Nicht-CEPT-Länder.",
    items: [
      {
        title: "CEPT-Regeln: Mit welcher Lizenz im Ausland funken?",
        body: "Mit einer CEPT-Lizenz (Full License / HAREC) dürfen Sie in allen CEPT-Ländern für bis zu 3 Monate funken. Setzen Sie das Präfix des Gastlandes vor Ihren Call. Beispiel: HB9XYZ besucht Deutschland → DL/HB9XYZ. Beispiel: HB9XYZ besucht Frankreich → F/HB9XYZ. Beispiel: HB9XYZ besucht Italien → I/HB9XYZ. Die CEPT-Voll-Lizenz gilt in allen CEPT-Ländern (Liste siehe unten). Maximal 3 Monate Aufenthalt pro Gastland.",
        example: "HB9XYZ besucht Österreich → OE/HB9XYZ · HB9XYZ besucht Italien → I/HB9XYZ · HB9XYZ besucht Spanien → EA/HB9XYZ"
      },
      {
        title: "Novice-Lizenz (ECC/REC/05(06))",
        body: "Mit einer CEPT Novice-Lizenz (in der Schweiz HB3) können Sie in bestimmten Ländern funken. Nicht alle CEPT-Länder akzeptieren die Novice-Lizenz. Beispiel: HB3XYZ besucht Deutschland → DL/HB3XYZ (Novice akzeptiert). Beispiel: HB3XYZ besucht Frankreich → NICHT möglich (Frankreich akzeptiert keine Novice). Die Novice-Lizenz hat geringere Privilegien (weniger Bänder, weniger Leistung). Im Logbuch-Formular können Sie unter «Ich funke aus» zwischen Full und Novice Lizenz umschalten — nur Novice-akzeptierende Länder werden dann angezeigt.",
        example: "DL/HB3XYZ (Novice, Deutschland ✓) · F/HB3XYZ (Novice, Frankreich ✗ — nicht akzeptiert) · OE/HB3XYZ (Novice, Österreich ✓)"
      },
      {
        title: "Nicht-CEPT-Länder (Gastlizenz erforderlich)",
        body: "Für Länder ausserhalb des CEPT-Abkommens benötigen Sie eine Gastlizenz, die Sie vor der Reise beantragen müssen. Beispiele: USA (W/ oder K/ + Distrikt + / + Heim-Call), Australien (VK/ + Heim-Call), Neuseeland (ZL/ + Heim-Call), Südafrika (ZS/ + Heim-Call), Kanada (VE/ + Heim-Call), Japan (JA/ + Heim-Call). Im Logbuch-Formular erscheint bei Auswahl eines Nicht-CEPT-Landes eine Warnung mit Hinweis auf die Gastlizenz.",
        example: "USA: W/HB9XYZ (Gastlizenz erforderlich) · Australien: VK/HB9XYZ · Japan: JA/HB9XYZ"
      },
      {
        title: "Länderpräfix im Logbuch-Formular",
        body: "Im QSO-Formular finden Sie den Bereich «Ich funke aus» mit einer Länderauswahl. Standard ist «Schweiz (kein Präfix)». Wählen Sie ein anderes Land aus, wird das Präfix automatisch vor Ihren Call gesetzt und eine Vorschau angezeigt (z.B. «DL/HB9XYZ (Full License, Deutschland)»). Umschalten zwischen Full License und Novice über die Toggle-Buttons. Bei Novice werden nur Länder angezeigt, die Novice akzeptieren. Bei Nicht-CEPT-Ländern erscheint eine Warnung. Das ausgewählte Land und die Lizenzklasse werden im QSO-Eintrag gespeichert.",
        example: "Logbuch → «Ich funke aus» → «🇩🇪 Deutschland» wählen → Toggle «Full License» → Vorschau: DL/HB9XYZ (Full License, Deutschland)"
      },
      {
        title: "CEPT-Ländertabelle (alle Länder)",
        body: "Die folgende Tabelle zeigt alle unterstützten Länder mit Präfix, Flagge und CEPT-Status. Full = CEPT T/R 61-01 (Voll-Lizenz), Nov = CEPT ECC/REC/05(06) (Novice). Gast = Nicht-CEPT (Gastlizenz erforderlich).",
        list: CEPT_COUNTRIES_LIST
      },
      {
        title: "Wichtige Hinweise vor der Reise",
        body: "Vor der Reise: lokale Bestimmungen prüfen! Bandpläne und Leistungen können abweichen. Maximal 3 Monate Aufenthalt unter CEPT pro Gastland. Für Nicht-CEPT-Länder: Gastlizenz frühzeitig beantragen (teils Wochen Bearbeitungszeit). Prüfen Sie, ob Ihre Lizenzklasse (Full/Novice) im Gastland akzeptiert wird. Die CEPT-Regeln gelten nur für Amateurfunk — andere Lizenzen (z.B. CB) sind davon nicht betroffen.",
        example: "Vor Reise nach Frankreich: Full License ✓, Novice ✗ → als HB3-Inhaber Gastlizenz beantragen oder nur als Full operieren.",
        links: CEPT_LINKS
      }
    ]
  },
  {
    id: "tipps",
    icon: HelpCircle,
    title: "Tipps & Tricks",
    color: "#8b5cf6",
    description: "Nützliche Hinweise für den Alltag.",
    items: [
      {
        title: "Ladeanzeige bei vielen Daten",
        body: "Wenn die App viele Referenzdaten laden muss (z.B. beim ersten Start oder bei aktivierten vielen Layern), erscheint oben ein Lade-Indikator. Wenn das Laden länger als 1,5 Sekunden dauert, wird ein kleines Handfunkgerät mit aussendenden Funkwellen angezeigt. Es weist darauf hin, dass viele Daten geladen werden und etwas Geduld nötig ist. Zusätzlich werden Tipps eingeblendet: Kartenausschnitt verkleinern (weniger Marker laden), weniger Layer aktivieren, oder den Performance-Modus in den Einstellungen einschalten. Der Lade-Indikator erscheint auch während dem Splash-Screen, falls das Laden der Referenzdaten länger dauert. Die App lädt immer zuerst die Karte und die gecachten Punkte aus dem lokalen Speicher, bevor schwere Layer (Relais, APRS, weltweite SOTA/POTA-Daten) im Hintergrund geladen werden. So ist die Karte sofort nutzbar, während weitere Daten im Hintergrund nachladen.",
        example: "Viele Layer aktiviert + langsames Internet → nach 3s erscheint das Handfunkgerät mit Wellen → Tipps zum Beschleunigen werden angezeigt."
      },
      {
        title: "Marker-Laden vom Mittelpunkt nach aussen",
        body: "Alle Marker werden immer vom Mittelpunkt der aktuellen Karte nach aussen geladen und gerendert. Das bedeutet: Die Referenzen nächst dem Kartenmittelpunkt erscheinen zuerst, weiter entfernte werden schrittweise ergänzt. Bei sehr vielen Markern (z.B. weltweite SOTA-Gipfel oder WWBOTA-Bunker) werden die nächsten zum Mittelpunkt priorisiert, um die Karte schnell und flüssig zu halten. Beim Verschieben oder Zoomen der Karte wird der neue Mittelpunkt automatisch verwendet. Im Performance-Modus (Canvas) werden bis zu 10'000 Marker gleichzeitig gerendert, im Normalmodus (SVG) bis zu 2'000.",
        example: "Karte auf Deutschland zentrieren → deutsche Bunker und Gipfel erscheinen zuerst → beim Herauszoomen werden europäische Referenzen schrittweise ergänzt."
      },
      {
        anchor: "energiesparmodus",
        title: "Energiesparmodus (Performance) & Auto-Modus überschreiben",
        body: "In den Einstellungen gibt es zwei Schalter im Bereich «Performance-Modus»: 1) Energiesparmodus: Wenn aktiviert, werden Marker als einfache farbige Kreise statt komplexe SVG-Symbole gerendert (schnellerer Aufbau). Beim Antippen eines Markers zeigt das Popup nur die wichtigsten Infos (Name, Referenz-Code, Koordinaten) – ein «Mehr Infos»-Button lädt die vollständigen Details erst auf Wunsch nach. Beim Gefahren-Layer werden im Sparmodus nur die wichtigsten Layer abgefragt. Ausserdem werden nur sichtbare Marker im aktuellen Kartenausschnitt gerendert (Viewport-Culling). 2) Auto-Modus überschreiben: Standardmässig schaltet die App automatisch auf den Energiesparmodus um, wenn das Laden der Daten länger als 3 Sekunden dauert (z.B. bei langsamer Internetverbindung oder grossem Datenumsatz). Dies verhindert ein Einfrieren des Browsers bei trägen Ladevorgängen. Wenn Sie diesen automatischen Wechsel nicht möchten, aktivieren Sie «Auto-Modus überschreiben». Dann gilt immer Ihre manuelle Einstellung – auch wenn das Laden lange dauert. Der Auto-Modus wird pro Sitzung nur einmal aktiviert und zeigt einen Hinweis an.",
        example: "Auto-Modus deaktivieren: Einstellungen → «Auto-Modus überschreiben» einschalten → Ihre Einstellung gilt immer, kein automatisches Umschalten mehr."
      },
      {
        title: "Wake-Lock (Bildschirm an)",
        body: "Beim Erfassen eines QSOs bleibt der Bildschirm aktiviert (Wake-Lock), damit der Bildschirm nicht während des Funkens ausgeht. Schliessen Sie das Formular, um den Bildschirm wieder normal zu nutzen.",
        example: "Wird automatisch aktiviert, sobald das QSO-Formular geöffnet ist."
      },
      {
        title: "Formulardaten bleiben erhalten",
        body: "Häufige Eingaben (Frequenz, Band, Mode, RST, Referenz-Typ, Suffix, Clubstation) werden nach dem Speichern eines QSOs gespeichert und beim nächsten QSO vorausgefüllt. Da das Formular nach dem Speichern offen bleibt, können Sie mehrere QSOs hintereinander schnell erfassen – nur Rufzeichen, Datum und Zeit müssen Sie pro QSO anpassen.",
        example: "Nach QSO auf 2m/FM ist das nächste QSO automatisch wieder auf 2m/FM eingestellt – einfach neues Rufzeichen eingeben und speichern."
      },
      {
        title: "Externe Links",
        body: "In den Marker-Popups finden Sie Links zu den jeweiligen Programm-Websites (SOTA, POTA, IOTA etc.). Diese öffnen sich in einem neuen Tab.",
        example: "SOTA-Marker klicken → «Mehr Infos» → sotl.as öffnet sich mit Gipfel-Details."
      },
      {
        title: "Maidenhead-Locator",
        body: "Der Maidenhead-Locator (Grid) ist ein geografisches Koordinatensystem für Amateurfunk. 4 Stellen (z.B. JN36) geben ein Gebiet von ca. 100×100 km an, 6 Stellen (z.B. JN36af) ca. 5×5 km. Bei generellen Standorten ohne Referenz reicht der 4-stellige Locator.",
        example: "Standort Zürich: JN36 – genauer: JN36af"
      }
    ]
  },
  {
    id: "hunting-module",
    icon: Crosshair,
    title: "Hunting (DX-Spots & Fuchsjagd)",
    color: "#ff9800",
    description: "Live DX-Spots, Propagation-Dashboard, Fox Hunting mit Peilung und Triangulation, QSO-Logging.",
    items: [
      {
        title: "Hunting-Seite öffnen",
        body: "Auf der Karte oben in der Mitte finden Sie den Fox/Hunting-Schalter (orange hervorgehoben). Tippen Sie auf «Hunting», um die Hunting-Seite zu öffnen. Die Seite zeigt DX-Spots, Propagation, Fox Hunting und QSO-Logging im dunklen SHACK-SERVER-Stil.",
        example: "Karte → Fox/Hunting-Schalter oben Mitte → «Hunting» tippen → Hunting-Seite öffnet sich."
      },
      {
        title: "Command Strip (Übersicht)",
        body: "Oben auf der Hunting-Seite sehen Sie vier Kästchen: 1) DX Opportunity — der weiteste DX-Spot mit Rufzeichen und Distanz. 2) Best Band — das aktuell beste Band laut Propagation. 3) Station Ready — Ihr Rufzeichen und Locator. 4) Opportunities — Anzahl Spots und bereits gearbeitete Stationen.",
        example: "Command Strip zeigt «W3GTR — 8500 km» als DX-Opportunity und «30m — Excellent» als Best Band."
      },
      {
        title: "Propagation Bar (Ausbreitungsbedingungen)",
        body: "Die Propagation Bar zeigt Solar Flux, A-Index, K-Index, MUF und einen SVG-Balken-Graph für alle Bänder (80m bis 6m). Die Balken sind farbcodiert: grün = Excellent, gelb = Good, orange = Fair, rot = Poor. Die Daten stammen von NOAA SWPC und werden alle 5 Minuten automatisch aktualisiert.",
        example: "Solar Flux 101, K-Index 2 → 30m zeigt grünen Balken (Excellent), 10m zeigt roten Balken (Poor)."
      },
      {
        title: "Fox Hunting (Fuchsjagd)",
        body: "Tippen Sie auf den grossen grünen Button «FOX HUNTING — Fuchsjagd starten», um das Fox-Hunt-Modal zu öffnen. Dort erfassen Sie Peilungen: Peilrichtung (Azimuth 0-360°) per Slider, Feldstärke (S1-S9) per Slider, optionale Frequenz und Notiz. Beim Speichern wird die geschätzte Distanz aus der Feldstärke berechnet (S9=1km, S8=2km, S7=5km, S6=10km, S5=20km, S4=50km, S3=100km, S2=200km, S1=500km) und ein Ziel-Punkt auf der Karte markiert.",
        example: "Azimuth 45° + S7 → Peilung gespeichert → geschätzte Distanz 5 km → Ziel-Punkt 5 km nordöstlich auf der Karte."
      },
      {
        title: "Fox Hunting: GPS-Position",
        body: "Die Fox-Hunt-Peilungen verwenden Ihre aktuelle GPS-Position als Standort (QTH), nicht den festen Station-Locator. So werden Peilungen und die Triangulation korrekt von Ihrem aktuellen Standort im Feld berechnet. Wenn keine GPS-Position verfügbar ist, wird der Station-Locator (z.B. JN36FL) als Fallback verwendet. Im Modal sehen Sie oben, welche Position verwendet wird (📍 GPS oder 🏠 Station).",
        example: "Im Feld mit GPS → Peilungen starten von Ihrer GPS-Position → ohne GPS → Peilungen starten vom Station-Locator JN36FL."
      },
      {
        title: "Fox Hunting: Karte & Triangulation",
        body: "Tippen Sie im Fox-Hunt-Modal auf «Karte», um eine Leaflet-Karte mit QTH-Marker (🏠), Peillinien (grün gestrichelt) und einem 🦊-Marker am Schnittpunkt aller Peilungen zu sehen. Bei mehreren Peilungen von verschiedenen Positionen wird der Fuchs-Standort durch Triangulation (Durchschnitt der Endpunkte) geschätzt. Die Karte zoomt automatisch, um alle Peilungen zu zeigen.",
        example: "3 Peilungen aus verschiedenen Richtungen → 🦊-Marker erscheint am Schnittpunkt → Karte zoomt automatisch."
      },
      {
        title: "Fox Hunting: Verlauf",
        body: "Tippen Sie auf «Verlauf», um alle gespeicherten Peilungen als Liste zu sehen. Jede Peilung zeigt Feldstärke, Azimuth, optionale Frequenz und Notiz, sowie die Uhrzeit. Peilungen können einzeln gelöscht werden. Der Verlauf bleibt erhalten, bis Peilungen gelöscht werden.",
        example: "Verlauf (3) → Peilung von 14:32 mit S7 und 45° → Mülleimer-Icon zum Löschen."
      },
      {
        title: "Activity Panel (Live SOTA & POTA Aktivierungen)",
        body: "Das Activity Panel zeigt Live-Aktivierungen von SOTA- und POTA-Aktivatoren weltweit. Die Daten stammen direkt von den offiziellen APIs: POTA (api.pota.app) und SOTA (api2.sota.org.uk). Das Panel hat zwei Tabs: SOTA und POTA. Jede Aktivierung zeigt Rufzeichen, Referenz-Code, Summit/Park-Name, Frequenz, Mode, Distanz, Azimuth und Alter des Spots. Die Aktivierungen werden alle 60 Sekunden automatisch aktualisiert. Die Distanz und Peilung werden ab Ihrer GPS-Position berechnet (Fallback: Stations-Locator). Tippen Sie auf das Stift-Icon, um ein QSO direkt aus der Aktivierung zu loggen — das Formular wird vorausgefüllt.",
        example: "Activity Panel → POTA-Tab → «M0TTQ, GB-4591, Farlington Marshes, 14.315 MHz SSB, 733 km» → Stift-Icon → QSO-Formular vorausgefüllt."
      },
      {
        title: "Live Spot Activity (DX-Spots)",
        body: "Die Live Spot Activity Tabelle zeigt die aktuellsten DX-Spots (max. 50) mit Filtern: Suche, Band, Mode, Land, Quelle, Referenz-Typ (SOTA, POTA, WWFF, etc.) und Confidence. Auf dem Handy werden nur die wichtigsten Spalten angezeigt (Call, Freq, Mode, Age, Actions) — weitere Spalten (Comment, Dist, Az, Source, Score) erscheinen auf grösseren Bildschirmen. Die Spots werden alle 30 Sekunden automatisch aktualisiert. Der Referenz-Filter zeigt nur DX-Spots der gewählten Aktivität (z.B. nur SOTA-Spots).",
        example: "Filter «20m» + «FT8» + «SOTA» → nur 20m FT8-Spots mit SOTA-Aktivität werden angezeigt → Auto-Refresh alle 30s."
      },
      {
        title: "Worked-Status (farbiger Punkt)",
        body: "Jeder Spot hat einen farbigen Punkt vor dem Rufzeichen: grün = Station auf diesem Band bereits gearbeitet, blau = Land auf diesem Band gearbeitet, gelb = Station gearbeitet (anderes Band), grau = neue Station. Der Worked-Status wird aus Ihrem Logbuch extrahiert.",
        example: "Grüner Punkt vor DL1LDZ → Sie haben DL1LDZ bereits auf 20m gearbeitet."
      },
      {
        title: "Spot Details",
        body: "Tippen Sie auf das Augen-Icon in der Tabelle, um die Spot-Details zu sehen: Rufzeichen, Frequenz, Band, Mode, Distanz, Azimuth, Locator, Confidence, Kommentare und Quelle. Die Detailansicht zeigt auch eine Leaflet-Karte mit QTH und DX-Marker sowie eine Peillinie. Bei SOTA/POTA-Aktivitäten wird ein Badge angezeigt.",
        example: "Augen-Icon → Spot Details mit 5W1SA, 12m CW, Karte mit Peillinie nach Samoa."
      },
      {
        title: "QSO loggen (prominent)",
        body: "Der grosse grüne Button «QSO loggen» unten rechts auf der Hunting-Seite öffnet das QSO-Logbuch-Formular. Alternativ können Sie das Stift-Icon in der Spot-Tabelle tippen, um ein QSO direkt aus einem Spot vorzufüllen. Das Formular füllt automatisch Rufzeichen, Frequenz, Band und Mode aus dem Spot. QRZ-Lookup liefert den Operator-Namen. Clubstation-Modus und SOTA/POTA-Referenzen werden unterstützt.",
        example: "Grüner «QSO loggen» Button → leeres Formular → oder Stift-Icon in Spot-Tabelle → vorausgefülltes Formular."
      },
      {
        title: "Priority DX (Top 5)",
        body: "Die Priority DX Sektion zeigt die 5 weitesten DX-Spots nach Distanz sortiert: Flagge, Rufzeichen, Frequenz + Mode, Distanz + Azimuth. Tippen Sie auf einen Eintrag, um die Spot-Details zu öffnen.",
        example: "Priority DX zeigt W3GTR (8500 km), JA1ABC (9500 km), … → W3GTR tippen → Details öffnen."
      },
      {
        title: "QRZ-Lookup",
        body: "Tippen Sie auf ein Rufzeichen in der Spot-Tabelle, um einen QRZ-Lookup durchzuführen. Das Modal zeigt Name, Adresse, Land, Grid-Locator und E-Mail des Operators (von QRZ.com). Die Daten werden in der QrzLookup-Entity zwischengespeichert für schnellere zukünftige Abfragen.",
        example: "Rufzeichen DL1LDZ tippen → QRZ-Lookup zeigt Name, Adresse und Grid."
      },
      {
        title: "GPS-basierte Station-Position (Live)",
        body: "Die Hunting-Seite verwendet Ihre Live-GPS-Position vom Gerät für alle Distanz- und Azimuth-Berechnungen — nicht den statischen Stations-Locator. Beim Öffnen der Hunting-Seite wird automatisch GPS aktiviert (watchPosition). Die GPS-Position wird an fetchDxSpots, fetchPotaSpots und fetchSotaSpots übergeben. Wenn GPS nicht verfügbar ist (z.B. im Browser ohne Berechtigung), wird der Station-Locator (JN36FL) als Fallback verwendet. Ein Status-Banner oben zeigt den GPS-Status: blau = lokalisieren, orange = nicht verfügbar. Die Command Strip und das SpotDetailsModal zeigen ebenfalls, ob GPS oder Station-Locator verwendet wird.",
        example: "Hunting-Seite öffnen → GPS wird automatisch aktiviert → Status-Banner «GPS wird lokalisiert…» → Position gefunden → alle Distanzen ab echter GPS-Position berechnet."
      },
      {
        title: "Datenquellen & Automation",
        body: "DX-Spots stammen von dxc.jo30.de (DXCluster) und Spothole (spothole.app) für SIG-gefilterte Spots (SOTA, POTA, WWFF, etc.). Activity-Spots stammen von POTA (api.pota.app) und SOTA (api2.sota.org.uk). Propagation-Daten stammen von NOAA SWPC (Solar Flux F10.7, planetarer K-Index). Eine Automation ruft alle 5 Minuten neue DX-Spots und Propagation-Daten ab. Activity-Spots werden alle 60 Sekunden aktualisiert. Distanz und Azimuth werden aus Ihrer GPS-Position (oder Station-Locator als Fallback) berechnet.",
        example: "Automation läuft alle 5 Min → 50 neue DX-Spots von jo30.de + Spothole → Distanz/Azimuth aus GPS-Position berechnet."
      },
      {
        title: "Station-Info konfigurieren",
        body: "Die Station-Info (Rufzeichen, Name, Club, Locator) wird in der AppSetting «station_info» gespeichert. Standard: Station HB9OM, Rufzeichen HB3YNF, Name Dani, Locator JN36FL. Der Locator wird für Distanz- und Azimuth-Berechnungen der DX-Spots verwendet (Fallback, wenn keine GPS-Position verfügbar). Wenn GPS verfügbar ist, wird die GPS-Position anstelle des Locators verwendet.",
        example: "AppSetting station_info = {station:'HB9OM', callsign:'HB3YNF', name:'Dani', locator:'JN36FL'}."
      }
    ]
  }
];

const ADMIN_SECTIONS = [
  {
    id: "admin-vorschlaege",
    icon: Lightbulb,
    title: "Admin: Funktionsvorschläge prüfen",
    color: "#8b5cf6",
    description: "Benutzer haben neue Funktionen vorgeschlagen? Hier können Sie diese prüfen und beantworten.",
    items: [
      {
        title: "Vorschläge prüfen",
        body: "Wenn Benutzer einen Funktionsvorschlag einreichen, erscheint dieser auf der Prüfseite. Sie können den Status ändern (In Prüfung, Wird geprüft, Geplant, Umgesetzt, Abgelehnt) und eine Antwort an den Benutzer hinterlegen. Der Benutzer sieht die Antwort und den neuen Status in seinem Vorschlags-Bereich in der Hilfe.",
        example: "Vorschlag «Dunkelmodus» → Status «Geplant» → Antwort «Wird in nächster Version umgesetzt» → Benutzer sieht dies in der Hilfe."
      }
    ]
  },
  {
    id: "admin-referenzen",
    icon: Pencil,
    title: "Admin: Referenzen bearbeiten",
    color: "#dc2626",
    description: "Als Administrator können Sie Referenzpunkte anpassen und georeferenzieren.",
    items: [
      {
        title: "Referenz auf der Karte bearbeiten",
        body: "Klicken Sie als Administrator auf einen beliebigen Marker auf der Karte. Im Popup-Fenster finden Sie unten einen «Referenz bearbeiten»-Button. Damit können Sie den Namen, den Ort, manuelle Koordinaten und eine Web-Referenz anpassen. Angepasste Namen und Koordinaten werden sofort auf der Karte angezeigt – keine Datenaktualisierung nötig.",
        example: "Burg anklicken → «Referenz bearbeiten» → neuen Namen eingeben → Speichern → Name erscheint sofort auf der Karte."
      },
      {
        title: "Marker per Drag & Drop verschieben",
        body: "Als Administrator können Sie den Drag & Drop-Modus aktivieren (Move-Icon links neben der Karte). Ziehen Sie Marker an die korrekte Position – die Koordinaten werden sofort gespeichert und sind für alle Administratoren sichtbar. Die neue Position erscheint sofort auf der Karte.",
        example: "Move-Button aktivieren → Marker festhalten und verschieben → Position wird automatisch gespeichert."
      },
      {
        title: "Nicht georeferenzierte Burgen",
        body: "In den Einstellungen (Admin-Bereich) finden Sie eine Liste aller Burgen, die keine Koordinaten haben und nicht auf der Karte angezeigt werden. Sie können für jede Burg einen angepassten Namen, Ort, manuelle Koordinaten oder eine Web-Referenz erfassen.",
        example: "Einstellungen → «Nicht georeferenzierte Burgen» → Burg suchen → Bearbeiten → Koordinaten eingeben."
      },
      {
        title: "Wie Overrides funktionieren",
        body: "Wenn Sie eine Referenz anpassen (Name, Ort, Koordinaten, Web-Referenz), wird ein Override gespeichert. Diese Overrides werden sofort auf der Karte angewendet: Angepasste Namen ersetzen den Originalnamen, manuelle Koordinaten überschreiben die automatischen Positionen. Bei der nächsten Datenaktualisierung werden die Overrides zusätzlich für das automatische Matching verwendet. Overrides können im Bearbeitungsdialog über «Zurücksetzen» gelöscht werden.",
        example: "Override mit neuem Namen → Marker zeigt sofort den neuen Namen, kein Update nötig."
      },
      {
        title: "Daten-Cache mit Qualitätsanzeige",
        body: "Im Daten-Cache in den Einstellungen wird für jeden Referenz-Typ angezeigt, wie viele Referenzen insgesamt gespeichert sind und wie viele davon erfolgreich georeferenziert wurden (mit Koordinaten). Referenzen ohne Koordinaten werden als «offen» markiert. Bei veralteten Daten (>7 Tage) erscheint ein Warnhinweis. So sehen Administratoren auf einen Blick, welche Daten qualitativ hochwertig sind und wo Nacharbeit nötig ist.",
        example: "Burgen: 938 total, 646 geo, 292 offen → 292 Burgen haben keine Koordinaten und erscheinen nicht auf der Karte."
      },
      {
        title: "Admin-Benachrichtigung bei Registrierung",
        body: "Wenn sich ein neuer Benutzer registriert, erhalten alle Administratoren automatisch eine E-Mail-Benachrichtigung mit der E-Mail-Adresse des neuen Benutzers und dem Registrierungszeitpunkt. So bleiben Administratoren über neue Benutzer auf dem Laufenden.",
        example: "Neuer Benutzer registriert → Admins erhalten E-Mail → Benutzer in der Benutzerverwaltung sichtbar."
      },
      {
        title: "Demo-Benutzer",
        body: "Der Demo-Benutzer (demo@hb9om.ch / demo1234) kann in den Einstellungen eingerichtet werden. Seine Daten werden täglich gelöscht. Der Demo-Benutzer kann nicht gelöscht werden.",
        example: "Einstellungen → «Demo-Benutzer» → «Demo einrichten»."
      },
      {
        title: "Änderungsanträge prüfen",
        body: "Wenn Benutzer eine Marker-Position korrigieren, wird ein Änderungsantrag erstellt. Diese Anträge erscheinen in den Einstellungen unter «Anträge prüfen» und auf der separaten Prüfseite. Ausstehende Anträge sind gelb hinterlegt, genehmigte grün und abgelehnte rot. Sie können jeden Antrag mit optionalem Kommentar genehmigen oder ablehnen. Bei Genehmigung wird die Position sofort als Override gespeichert und auf der Karte angezeigt. Über den Filter «Zurückgezogen» sehen Sie alle zurückgezogenen Anträge und können diese mit dem Button «Endgültig löschen» entfernen.",
        example: "Einstellungen → «Anträge prüfen» → Filter «Zurückgezogen» → «Endgültig löschen»."
      },
      {
        title: "Funktionsvorschläge prüfen",
        body: "In den Einstellungen im Admin-Bereich finden Sie den Button «Funktionsvorschläge prüfen». Dort können Sie eingereichte Vorschläge mit Statusänderung (In Prüfung, Wird geprüft, Geplant, Umgesetzt, Abgelehnt) und einem Kommentar an den Benutzer beantworten. Über den Filter «Zurückgezogen» sehen Sie alle zurückgezogenen Vorschläge und können diese endgültig löschen.",
        example: "Einstellungen → «Funktionsvorschläge prüfen» → Filter «Zurückgezogen» → «Endgültig löschen»."
      },
      {
        title: "Datenpflege – Anträge & Vorschläge aufräumen",
        body: "In den Einstellungen im Admin-Bereich finden Sie die «Datenpflege». Hier können Sie erledigte (genehmigte, abgelehnte, umgesetzte) und zurückgezogene Anträge sowie Funktionsvorschläge, die älter als eine bestimmte Anzahl Tage sind, in einem Schritt löschen. Wählen Sie den Zeitraum (7, 14, 30, 90, 180 Tage oder 1 Jahr) und klicken Sie auf «Änderungsanträge aufräumen» oder «Funktionsvorschläge aufräumen». Ausstehende Anträge werden niemals gelöscht. Diese Funktion eignet sich, um von Zeit zu Zeit aufzuräumen.",
        example: "Einstellungen → «Datenpflege» → «Älter als 90 Tage» → «Änderungsanträge aufräumen» → Bestätigen → Anzahl gelöschter Anträge wird angezeigt."
      },
      {
        title: "CH-Relais-Links aktualisieren (USKA)",
        body: "Im Admin-Bereich unter «Einzelne Datenquelle neu laden» finden Sie den Button «CH-Relais-Links». Dieser ruft die USKA HB Repeater Voice List (uska.ch) ab und reichert die vorhandenen RepeaterBook-Daten an: EchoLink-Node-Nummern, Höhen, Status und Modulationsarten werden ergänzt. Aus den Remarks der USKA-Liste werden Crosslinks extrahiert (<>Tamaro, <>Scura, <>HB9T, >RX Chestenberg etc.) und als genehmigte, permanente RepeaterLink-Einträge angelegt. Die Verlinkungen erscheinen als animierte Linien auf der Karte und im Relais-Popup. Quellen: USKA (uska.ch/hb-repeater-voice-list/), SWISS-ARTG (swiss-artg.ch), Funkwelt (funkwelt.net).",
        example: "Admin → «CH-Relais-Links» klicken → 308 USKA-Einträge werden geparst → EchoLink-Nodes und Crosslinks werden angelegt → Linien auf der Karte sichtbar."
      },
      {
        title: "FM-Funknetz TGs aktualisieren (weltweit)",
        body: "Im Admin-Bereich unter «Einzelne Datenquelle neu laden» finden Sie den Button «FM-Funknetz TGs». Dieser ruft das Live-Dashboard von dashboard.fm-funknetz.de ab und parst die «Zuletzt Aktiv»-Tabelle. Die dort gezeigten Stationen und ihre aktiven Talkgroups (TGs) werden mit den Relais in der Datenbank abgeglichen — weltweit, nicht nur in der Schweiz. Pro Treffer werden die TG-Nummer, der TG-Name und die letzte Aktivitätszeit gespeichert und im Relais-Popup angezeigt. Da das Dashboard nur kürzlich aktive Stationen zeigt, werden bei jedem Abruf unterschiedliche Relais erfasst — regelmässiges Aktualisieren empfohlen. Die TG-Liste umfasst regionale (262xx DL, 2280 CH, 232x AT, 235 UK) und weltweite Sprechgruppen (91 Worldwide, 92 Europa).",
        example: "Admin → «FM-Funknetz TGs» klicken → Dashboard wird geparst → aktive TGs werden mit Relais abgeglichen → Popup zeigt TG-Info mit Link zum Live-Dashboard."
      },
      {
        title: "JSON Repeater Import (RepeaterBook-Export)",
        body: "Im Admin-Bereich unter «Relais & Verlinkungen» → «JSON Repeater Import» können Sie RepeaterBook-Exporte (.json) direkt in die Datenbank importieren — ergänzend zur automatischen Synchronisation. Ziehen Sie eine JSON-Datei in die Upload-Zone oder klicken Sie zum Auswählen (max. 10 MB). Nach dem Parsen erscheint eine Vorschau mit Anzahl erkannter Datensätze. Beim Import werden neue Relais angelegt und bestehende aktualisiert (inkrementell): Koordinaten, Modi und Band werden überschrieben, leere Felder (Tone, Standort, EchoLink) werden nur ergänzt, falls sie noch leer sind. Duplikate werden anhand Rufzeichen + Frequenz erkannt (nicht anhand des Dateinamens) — so werden beim erneuten Import derselben Datei keine Dubletten erstellt. Jeder importierte Datensatz wird mit dem Quellen-Tag «json-import» markiert. Diese Records sind vor automatischen Sync-Überschreibungen geschützt: fetchRepeaters und fetchHearhamRepeaters überspringen json-import-Records beim Löschen und Herausfiltern. Über «JSON-Schutz aufheben» können Sie den Schutz entfernen — die betroffenen Records erhalten dann ein leeres source_id und werden bei der nächsten Synchronisation wie alle anderen behandelt. Die Import-Historie (letzte 20 Imports) zeigt Datum, Dateiname, Status, Anzahl neu/aktualisiert/übersprungen und Fehler pro Import.",
        example: "Admin → «Relais & Verlinkungen» → «JSON Repeater Import» → RepeaterBook-Export .json in Upload-Zone ziehen → Vorschau prüfen → «Import starten» → Ergebnis-Report zeigt +12 neu, ↺5 aktualisiert, ↺0 übersprungen."
      },
      {
        title: "Sync-Schutz für JSON-Importe",
        body: "Relais die über den JSON-Import angelegt wurden (source_id = «json-import») werden von automatischen Synchronisationen (fetchRepeaters, fetchHearhamRepeaters) nicht überschrieben oder gelöscht. Das verhindert, dass manuell importierte oder korrigierte Daten bei der nächsten Aktualisierung verloren gehen. Im Sync-Response wird die Anzahl geschützter Records als «json_protected» zurückgemeldet. Wenn Sie den Schutz für einzelne oder alle JSON-Importe aufheben möchten, klicken Sie im JSON-Repeater-Import-Bereich auf «JSON-Schutz aufheben». Bestätigen Sie den Dialog — die betroffenen Records erhalten ein leeres source_id und werden bei der nächsten Synchronisation wie alle anderen behandelt (überschrieben oder gelöscht). Verwenden Sie diese Funktion mit Bedacht: nach dem Aufheben sind die Daten dem automatischen Sync ausgesetzt.",
        example: "«JSON-Schutz aufheben» klicken → Bestätigen → json_protected wird bei nächstem Sync als 0 gemeldet → Records werden wieder synchronisiert."
      }
    ]
  },
  {
    id: "downloads",
    icon: Download,
    title: "Downloads (PDF & APK)",
    color: "#22c55e",
    description: "Lade Hilfe-Dokumente (PDF) und die Android-App (APK) herunter.",
    items: [
      {
        title: "Verfügbare Downloads",
        body: "Im Download-Bereich unten findest du alle verfügbaren PDF-Dokumente (z.B. Hilfe, Flyer, Bandplan) und die aktuelle Android APK-Version. Jeder Download zeigt Dateiname, Version, Dateigröße und Upload-Datum. Klicke auf einen Eintrag um den Download zu starten.",
      },
      {
        title: "APK-Installation (Android)",
        body: "Lade die APK-Datei herunter und öffne sie auf deinem Android-Gerät. Falls die Installation aus unbekannten Quellen blockiert wird: erlaube die Installation in den Android-Sicherheitseinstellungen. Die APK ist direkt von der HB9OM-Website und sicher.",
        example: "Download → Datei öffnen → Installation erlauben → App starten"
      },
    ]
  },
  {
    id: "releases",
    icon: Bell,
    title: "Release History (Versionen)",
    color: "#6366f1",
    description: "Alle Versionen seit v0.8 mit Änderungen — das Versions-Popup zeigt nur die neuesten Versionen.",
    items: [
      {
        title: "v0.9003 — Hunting-Fixes",
        body: "Spot-Konsolidierung (Call+Frequenz = ein Eintrag mit Nx Badge), mobile Tabelle ohne horizontales Scrollen (6 Spalten), DX Opportunity klickbar (scrollt zum Spot mit Highlight), QSO loggen aus Spot-Detail (grün, QRZ-Vorausfüllung), Priority DX konsolidiert (max 5 unique), Hear-Score differenziert (Distanz/Alter/Confidence/Band), SOTA API mit CORS-Proxy, DX-Backend löscht alle Spots vor Neuladen, Fox-Modus QSO-Button verschiebbar.",
      },
      {
        title: "v0.9002 — Karten-Stabilität & Zoom-Fix",
        body: "Stabile Container-Keys verhindern _leaflet_pos-Fehler bei View-Wechseln. Zoom-Animation deaktiviert — keine Abstürze beim Schliessen von Modalen. QSO-Weltkarte sauberes Umschalten zwischen Globus und 2D-Karte.",
      },
      {
        title: "v0.9001 — Hunting-Modul & Live SOTA/POTA",
        body: "Hunting-Modul mit DX-Spots, GPS-basierter Distanz/Azimuth, Activity Panel (SOTA/POTA), Propagation-Dashboard, Fox Hunting, QSO loggen aus Spot, QRZ-Lookup, Priority DX, GPS-Tracking, Theme-aware, Build-Optimierung.",
      },
      {
        title: "v0.87 — Abdeckungs-Dialog & Öffentliche Position",
        body: "Abdeckungs-Dialog verschiebbar, Antennenhöhe-Slider, Berechnungs-Verlauf, Öffentliche Position mit GPS-Refresh, Karte zeigt öffentliche Positionen.",
      },
      {
        title: "v0.86 — Passwort-Sicherheit & Demo-Beschränkungen",
        body: "Passwort-Sichtbarkeit, Verbindungs-Tests, BrandMeister-Login, Demo-Konto gesperrt, Konfigurations-Status, einklappbare Menüs, Hilfe-Links.",
      },
      {
        title: "v0.85 — Terrain-Abdeckung & Relais-Performance",
        body: "Terrain-LOS Abdeckung mit SRTM 30m, Meine Abdeckung berechnen, Position auf Karte setzen, CircleMarker bei >500 Stationen, Admin Abdeckungs-Stats.",
      },
      {
        title: "v0.82 — TOTA weltweit & IOTA erweitert",
        body: "TOTA 5315 Türme weltweit, IOTA 326 Inselgruppen, Multi-Select Länder-Filter, Leuchttürme laden sofort, stabile Zähler, Paginierung repariert.",
      },
      {
        title: "v0.81 — Leuchtturm-Scraper & Relais-Länder-Filter",
        body: "Leuchtturm-Scraper sequenziell (15 Regionen), Relais-Länder-Filter repariert (31000+), Daten-Zähler konsistent, Auto-Geocodierung, Splash-Screen Zähler.",
      },
      {
        title: "v0.8 — Weltweite Referenzen & Nordamerika-Relais",
        body: "SOTA/POTA/WWFF/WWBOTA/Burgen weltweit, WWFF ersetzt HBFF, RepeaterBook USA+Kanada, IOTA weltweit, Kontinent-Filter, Marker-Sortierung, Restore-Points, API-Key-Verwaltung, BrandMeister, Admin E-Mail-Reports, Club-Rufzeichen.",
      },
    ]
  }
];

function HelpSection({ section }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = section.icon;

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (section.items.some(item => item.anchor === hash)) {
      setExpanded(true);
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, []);

  return (
    <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: section.color + '15' }}>
          <Icon className="w-5 h-5" style={{ color: section.color }} />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">{section.title}</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">{section.description}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {section.items.map((item, i) => (
            <div key={i} id={item.anchor} className="border-l-2 pl-4 scroll-mt-20" style={{ borderColor: section.color + '30' }}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{item.body}</p>

              {item.list && (
                <div className="mt-2 space-y-1.5">
                  {item.list.map((entry, j) => {
                    const EntryIcon = entry.icon;
                    return (
                      <div key={j} className="flex items-start gap-2 text-sm">
                        <EntryIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: entry.color }} />
                        <div>
                          {entry.url ? (
                            <a href={entry.url} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5">
                              {entry.name} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="font-medium text-gray-900">{entry.name}</span>
                          )}
                          {": "}
                          <span className="text-gray-600">{entry.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {item.example && (
                <div className="mt-2 px-3 py-2 bg-gray-50 dark:bg-slate-900 rounded-lg text-xs text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700">
                  <span className="font-semibold text-gray-700 dark:text-slate-200">💡 Beispiel:</span> {item.example}
                </div>
              )}

              {item.links && item.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.links.map((link, j) => (
                    <a
                      key={j}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      {link.label} <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Help() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const [flyerLoading, setFlyerLoading] = useState(false);
  const [trifoldLoading, setTrifoldLoading] = useState(false);
  const [helpPdfLoading, setHelpPdfLoading] = useState(false);
  const [adminPdfLoading, setAdminPdfLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const handleDownloadFlyer = async () => {
    setFlyerLoading(true);
    try {
      await generateFlyer();
      toast({ title: "Flyer heruntergeladen", description: "HB9OM On Field Flyer (v0.9005)", duration: 3000 });
    } catch (e) {
      // ignore
    } finally {
      setFlyerLoading(false);
    }
  };

  const handleDownloadTrifold = async () => {
    setTrifoldLoading(true);
    try {
      await generateTrifoldFlyer();
      toast({ title: "Faltflyer heruntergeladen", description: "HB9OM On Field Faltflyer (v0.9005)", duration: 3000 });
    } catch (e) {
      // ignore
    } finally {
      setTrifoldLoading(false);
    }
  };

  const handleDownloadHelpPdf = async () => {
    setHelpPdfLoading(true);
    try {
      await generateHelpPdf();
    } catch (e) {
      // ignore
    } finally {
      setHelpPdfLoading(false);
    }
  };

  const handleDownloadAdminPdf = async () => {
    setAdminPdfLoading(true);
    try {
      await generateAdminHelpPdf();
    } catch (e) {
      // ignore
    } finally {
      setAdminPdfLoading(false);
    }
  };

  useEffect(() => {
    base44.functions.invoke("adminManageUsers", { action: "checkStatus" })
      .then(res => setIsAdmin(res.data?.isAdmin === true))
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 dark:text-slate-100">Hilfe & Anleitung</h1>
              <p className="text-[10px] text-gray-400 dark:text-slate-500">Alle Funktionen im Überblick</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4 pb-24">
        {/* Help PDF Download */}
        <button
          onClick={handleDownloadHelpPdf}
          disabled={helpPdfLoading}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-5 flex items-center gap-4 hover:from-blue-500 hover:to-blue-600 transition-all disabled:opacity-60 shadow-lg"
        >
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            {helpPdfLoading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <FileText className="w-6 h-6 text-white" />}
          </div>
          <div className="text-left flex-1">
            <h3 className="text-sm font-bold flex items-center gap-2">
              Hilfe als PDF herunterladen
              <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold rounded-full">PDF</span>
            </h3>
            <p className="text-xs text-blue-100 mt-0.5">
              Komplette Anleitung mit allen Funktionen offline als PDF
            </p>
          </div>
          <Download className="w-5 h-5 text-blue-200 flex-shrink-0" />
        </button>

        {/* Admin PDF Download - nur fuer Admins */}
        {isAdmin && (
          <button
            onClick={handleDownloadAdminPdf}
            disabled={adminPdfLoading}
            className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-5 flex items-center gap-4 hover:from-slate-700 hover:to-slate-800 transition-all disabled:opacity-60 shadow-lg border border-amber-500/30"
          >
            <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              {adminPdfLoading ? <Loader2 className="w-6 h-6 text-slate-900 animate-spin" /> : <Shield className="w-6 h-6 text-slate-900" />}
            </div>
            <div className="text-left flex-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                Admin-Anleitung als PDF
                <span className="px-2 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-bold rounded-full">ADMIN</span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Verwaltung: Benutzer, Referenzen, Anträge und Datenpflege
              </p>
            </div>
            <Download className="w-5 h-5 text-amber-400 flex-shrink-0" />
          </button>
        )}

        {/* Flyer Downloads — on-the-fly generiert mit aktueller Version */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadFlyer}
            disabled={flyerLoading}
            className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl p-3 flex items-center gap-2 hover:from-green-500 hover:to-green-600 transition-all disabled:opacity-60 shadow-sm"
          >
            {flyerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <div className="text-left">
              <h3 className="text-xs font-bold">Flyer</h3>
              <p className="text-[10px] text-green-100">Info-Flyer v0.9005</p>
            </div>
          </button>
          <button
            onClick={handleDownloadTrifold}
            disabled={trifoldLoading}
            className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl p-3 flex items-center gap-2 hover:from-green-500 hover:to-green-600 transition-all disabled:opacity-60 shadow-sm"
          >
            {trifoldLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <div className="text-left">
              <h3 className="text-xs font-bold">Faltflyer</h3>
              <p className="text-[10px] text-green-100">Trifold v0.9005</p>
            </div>
          </button>
        </div>

        {/* PayPal Spende - am Anfang */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full mb-2">
            <Coffee className="w-5 h-5 text-amber-700" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 mb-1">Spende mir einen Kaffee ☕</h3>
          <p className="text-xs text-gray-600 dark:text-slate-300 mb-3 leading-relaxed">
            Die Entwicklung und der Betrieb der App verursachen Kosten und verbraucht viel Freizeit.
            Jede Spende hilft, das Projekt am Leben zu erhalten.
          </p>
          <a
            href="https://paypal.me/Thueler"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0070ba] text-white rounded-lg text-sm font-medium hover:bg-[#005ea6] transition-colors"
          >
            <Coffee className="w-4 h-4" />
            Über PayPal spenden
          </a>
          <p className="text-[10px] text-gray-400 mt-2">paypal.me/Thueler</p>
        </div>

        {/* Bandplan - direkt nach PayPal-Spende */}
        <BandPlanInfo />

        {/* Offline-Checkliste – Schritt fuer Schritt zu 100% Offline */}
        <OfflineChecklist />

        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-900 dark:text-blue-100">
          <p className="font-semibold mb-1">Willkommen bei HB9OM On Field!</p>
          <p className="text-blue-700 dark:text-blue-300 text-xs leading-relaxed">
            Diese App unterstützt Sie beim Aktivieren von Amateurfunk-Referenzen (SOTA, POTA, WWFF, WWBOTA, etc.) 
            weltweit. Sie können Referenzen auf der Karte finden, QSOs loggen und als ADIF exportieren.
            Unten finden Sie alle Funktionen mit Erklärungen und Beispielen.
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-2 gap-2">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-2.5 text-sm font-semibold bg-white dark:bg-slate-800 dark:text-slate-100 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 flex items-center gap-2 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.color + '15' }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <span className="text-gray-700">{s.title}</span>
            </a>
          ))}
        </div>

        {SECTIONS.map(section => (
          <div key={section.id} id={section.id}>
            <HelpSection section={section} />
          </div>
        ))}

        {/* Funktionsvorschläge */}
        <FeatureSuggestion />

        {isAdmin && ADMIN_SECTIONS.map(section => (
          <div key={section.id} id={section.id}>
            <HelpSection section={section} />
          </div>
        ))}

        <div className="bg-red-50 dark:bg-red-950/40 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <h3 className="text-sm font-bold text-red-900 dark:text-red-200 mb-1">Keine rechtliche Grundlage – Eigenverantwortung</h3>
              <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed font-medium">
                Du bist lizenzierter Funkamateur und du musst selber wissen, was du machst und was du machen darfst.
                Darum hast du ja eine Prüfung gemacht. Also heule nicht, wenn du was falsch machst – du bist erwachsen.
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed mt-2">
                Diese App und der enthaltene Bandplan dienen ausschliesslich als praktische Orientierungshilfe und
                stellen <strong>keine rechtsverbindliche Grundlage</strong> dar. Massgeblich ist stets der offizielle
                Frequenzplan des{" "}
                <a href="https://www.bakom.admin.ch/bakom/de/home/frequenzen-antennen/frequenzplan.html" target="_blank" rel="noopener noreferrer" className="text-red-900 underline font-bold">BAKOM</a>.
                Es wird keine Haftung für Fehler, Datenverluste oder andere Probleme übernommen.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Versions-Änderungen Popup</span>
            </div>
            <button
              onClick={() => {
                resetChangelog();
                toast({ title: "Versions-Popup reaktiviert", description: "Es erscheint nach dem nächsten App-Start", duration: 3000 });
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              Reaktivieren
            </button>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1.5">Zeigt die Änderungen seit v0.75 nach dem Splash Screen.</p>
        </div>

        {/* Download-Bereich: PDFs + APK */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Downloads</h3>
          </div>
          <DownloadSection />
        </div>

        {/* Setup-Wizard starten */}
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Setup-Wizard</span>
            </div>
            <button
              onClick={() => {
                if (confirm('Möchtest du den Wizard neu starten? Deine aktuellen Einstellungen bleiben erhalten.')) {
                  setShowWizard(true);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              Setup-Wizard starten
            </button>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1.5">Einrichtungs-Assistent für neue Benutzer — Rufzeichen, Club, QRZ, GPS, Filter.</p>
        </div>

        <div className="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 text-center text-xs text-gray-500 dark:text-slate-400">
          <p>HB9OM On Field v{APP_VERSION} (Build {APP_BUILD}) · Amateurfunk Referenzkarte & QSO-Logbuch</p>
          <p className="mt-1">
            <Link to="/privacy" className="text-blue-600 font-medium hover:underline">Datenschutzerklärung</Link>
            {" · "}
            Bei Fragen:{" "}
            <a href="mailto:hb9om@hb9om.ch" className="text-blue-600 font-medium hover:underline">hb9om@hb9om.ch</a>
          </p>
        </div>
      </div>

      {showWizard && <SetupWizard onClose={() => setShowWizard(false)} />}
      <BottomNavigation />
    </div>
  );
}