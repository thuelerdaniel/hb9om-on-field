import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Radio, BookOpen, Settings as SettingsIcon, HelpCircle, Search, Layers, Plus, Download, Archive, Pencil, Building, ChevronDown, ChevronUp, ExternalLink, Mountain, Trees, Castle, Anchor, Navigation, Filter, Wifi, LocateFixed, Coffee, Zap, Lightbulb, FileText, Loader2, Diamond, Hexagon, Cloud, AlertTriangle, Shield, Bell } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import BandPlanInfo from "@/components/help/BandPlanInfo";
import FeatureSuggestion from "@/components/help/FeatureSuggestion";
import { generateFlyer } from "@/lib/generateFlyer";
import { generateHelpPdf } from "@/lib/generateHelpPdf";
import { generateAdminHelpPdf } from "@/lib/generateAdminHelpPdf";
import { base44 } from "@/api/base44Client";
import { resetChangelog } from "@/components/map/VersionChangelogPopup";
import { useToast } from "@/components/ui/use-toast";
import { APP_VERSION } from "@/lib/constants";

const SECTIONS = [
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
        body: "Verschieben Sie die Karte per Drag-and-Drop, zoomen Sie mit dem Mausrad oder mit zwei Fingern auf dem Handy. Die Karte merkt sich die letzte Position.",
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
          { icon: Diamond, color: "#3498db", name: "IOTA", desc: "Raute mit Welle – Inseln" },
          { icon: Anchor, color: "#f39c12", name: "WLOTA/ARLHS", desc: "Leuchtturm mit Lichtstrahlen – Leuchttürme" },
          { icon: Hexagon, color: "#16a085", name: "BLN – Natur Zonen (nur in CH)", desc: "Sechseck mit Blatt – Bundesinventare / Naturzonen" },
          { icon: Zap, color: "#dc2626", name: "Gefahren & Störquellen (nur in CH)", desc: "Blitz – Hochspannungsleitungen, Mobilfunkantennen, Richtfunk, Radio/TV-Sender" },
          { icon: Radio, color: "#3b82f6", name: "Amateurfunk-Relais", desc: "Turm mit Blitz – FM, C4FM, DMR, D-STAR Relais mit permanenten Verlinkungen, farbig nach Modulation" },
          { icon: Wifi, color: "#8b5cf6", name: "APRS", desc: "APRS-Standard-Symbole – Stern (Digipeater), Haus (Hotspot), Quadrat mit W (Wetterstation), Stern mit I (IGate) – farbig nach Node-Typ" }
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
        body: "Klicken Sie auf das Wifi-Icon links neben der Karte, um den Offline-Modus manuell zu aktivieren oder zu deaktivieren. Im Offline-Modus werden Kartenkacheln aus dem Cache geladen (sofern zuvor heruntergeladen) und alle Referenzpunkte aus dem lokalen Speicher angezeigt. QSOs können weiterhin erfasst werden und werden bei Wiederherstellung der Verbindung synchronisiert. Der manuelle Offline-Modus kann auch in den Einstellungen unter «Offline-Modus» ein- und ausgeschaltet werden.",
        example: "Wifi-Icon klicken → Symbol wird gelb → Offline-Modus aktiv → Kacheln aus Cache werden angezeigt."
      },
      {
        title: "Offline-Karten herunterladen & verwalten",
        body: "Mit dem Download-Icon links neben der Karte können Sie Kartenausschnitte für die Offline-Nutzung herunterladen. Wählen Sie die Zoom-Stufen und laden Sie die Kacheln herunter. In den Einstellungen unter «Heruntergeladene Karten» sehen Sie alle gespeicherten Gebiete mit Grösse und Datum. Einzelne Gebiete oder alle Offline-Daten können dort gelöscht werden.",
        example: "Download-Icon → Gebiet auf Karte wählen → Zoom-Stufen auswählen → Download starten → in Einstellungen verwalten."
      },
      {
        title: "Daten für Offline-Nutzung speichern",
        body: "Wenn Sie den Offline-Modus zum ersten Mal aktivieren (Wifi-Icon auf der Karte oder Schalter in den Einstellungen), werden alle aktuell geladenen Referenzdaten (SOTA, POTA, WWFF, WWBOTA, Burgen, IOTA, Leuchttürme) sowie alle Namens-Anpassungen lokal im Browser gespeichert. So können Sie die Karte, Referenzen und das Logbuch auch ohne Internetverbindung nutzen. In den Einstellungen sehen Sie einen Status, ob die App offline-bereit ist und wann die Daten zuletzt gespeichert wurden.",
        example: "Wifi-Icon auf Karte klicken → «Daten für Offline-Nutzung gespeichert» → alle Referenzen und Logbuch offline nutzbar."
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
          { icon: Navigation, color: "#3498db", name: "IOTA", desc: "Islands on the Air – Inseln", url: "https://www.iota-world.org/islands-on-the-air/iota-groups-islands.html" },
          { icon: Anchor, color: "#f39c12", name: "WLOTA/ARLHS", desc: "Lighthouses on the Air – Leuchttürme", url: "https://wlol.arlhs.com/" },
          { icon: Trees, color: "#16a085", name: "BLN – Natur Zonen (nur in CH)", desc: "Bundesinventare – Auengebiete, Moore etc. (nur in CH — map.geo.admin.ch)", url: "https://www.bafu.admin.ch/bafu/de/home/themen/biodiversitaet/infospezialist/biodiversitaet--daten--und-instrumente.html" },
          { icon: Zap, color: "#dc2626", name: "Gefahren & Störquellen (nur in CH)", desc: "Hochspannungsleitungen und Starkstromanlagen (nur in CH — map.geo.admin.ch)", url: "https://map.geo.admin.ch/" },
          { icon: Radio, color: "#3b82f6", name: "Amateurfunk-Relais", desc: "FM, C4FM, DMR, D-STAR Relais mit permanenten Verlinkungen", url: "https://www.repeaterbook.com/" },
          { icon: Wifi, color: "#8b5cf6", name: "APRS", desc: "Amateur Radio Positioning – Digipeater, IGates, Wetter, Hotspots und mobile Nutzer", url: "https://aprs.fi/" }
        ]
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
        title: "Schweizer Relais-Quellen & Verlinkungen",
        body: "Die Schweizer Amateurfunk-Relais werden aus drei Quellen angereichert: 1) RepeaterBook (weltweit, Basisdaten) liefert Frequenzen, Modi, Standorte und Koordinaten. 2) USKA HB Repeater Voice List (uska.ch) — die offizielle Liste der Schweizer Amateurfunk-Relais mit 308 Einträgen. Aus den Remarks werden Crosslinks extrahiert (z.B. <>Tamaro, <>Scura, >RX Chestenberg) und als Verlinkungen auf der Karte angezeigt. EchoLink-Node-Nummern (EL#), D-STAR CCS-Nummern und C4FM/Wires-X-IDs werden übernommen. 3) SWISS-ARTG (swiss-artg.ch) — Standortliste der SWISS-ARTG-Anlagen (HB9AK, HB9ZRH) mit DMR-, FM- und D-STAR-Relais sowie APRS-iGates und HAMNET. Die Funkwelt HB Repeater Map (funkwelt.net) dient als zusätzliche Referenz. Verlinkungen werden als animierte Linien auf der Karte angezeigt; im Relais-Popup sehen Sie die verlinkten Relais mit Frequenz, Standort und Entfernung.",
        example: "Relais anklicken → Popup zeigt «Verlinkungen (1)» → HB9W 438.4125 MHz, Brütten, 1.6 km entfernt → Linie auf der Karte."
      },
      {
        title: "FM-Funknetz.de – Talkgroups (TGs) weltweit",
        body: "FM-Funknetz.de ist ein SvxLink-basiertes Relais- und Hotspot-Netzwerk, das ursprünglich aus Deutschland stammt, aber weltweit genutzt wird. Das Live-Dashboard (dashboard.fm-funknetz.de) zeigt aktive Stationen und ihre Talkgroups (TGs) in Echtzeit. Die App ruft das Dashboard ab und gleicht die aktiven TGs mit den Relais in der Datenbank ab — weltweit. Im Relais-Popup sehen Sie dann die aktiven TGs mit Nummer, Name und letzter Aktivitätszeit. Zusätzlich gibt es Links zum Live-Dashboard und zur vollständigen TG-Übersicht (fm-funknetz.de/unsere-talkgroups-sprechgruppen/). Die TGs umfassen regionale Sprechgruppen (z.B. 262xx für Deutschland, 2280 für Schweiz, 232x für Österreich, 235 für UK) und weltweite TGs (z.B. TG 91 Worldwide, TG 92 Europa). Administratoren können die TG-Daten über «Einzelne Datenquelle neu laden» → «FM-Funknetz TGs» aktualisieren.",
        example: "Relais anklicken → Popup zeigt «FM-Funknetz TGs (2)» → TG 2620 Berlin Brandenburg, TG 262 Deutschland → Link zum Live-Dashboard."
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
        body: "Im Formular können Sie Ihren eigenen Standort erfassen: Wählen Sie den Referenz-Typ (SOTA, POTA, etc.), geben Sie den Referenz-Code ein oder wählen Sie aus den in der Nähe befindlichen Referenzen. Die Referenzen in der Nähe basieren auf Ihrer GPS-Position oder der fixierten Kartenposition (5-km-Umkreis). Für generelle Standorte ohne Referenz wählen Sie «Generell» und geben nur Ihren Maidenhead-Locator ein.",
        example: "Auf dem Gipfel: Typ «SOTA» wählen, Code «HB/AG-001» eingeben, Name wird automatisch ergänzt."
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
        title: "QRZ.com Abfrage",
        body: "Jeder Benutzer kann seine eigenen QRZ.com-Zugangsdaten in den Einstellungen hinterlegen (Benutzername & Passwort). Geben Sie Ihre Daten ein und speichern Sie das Profil. Der Schalter wird erst aktiviert, wenn Anmeldedaten hinterlegt sind. Administratoren und der Demo-Benutzer nutzen automatisch die Club-XML-Subscription. Klicken Sie auf «QRZ-Verbindung testen», um zu prüfen, ob die Anmeldung funktioniert. Beim Erfassen eines QSOs werden Name, Adresse, Land, Grid-Locator und E-Mail des Operators automatisch von QRZ.com geladen.",
        example: "Einstellungen → QRZ-Benutzername & Passwort eingeben → Speichern → Schalter aktivieren → «Verbindung testen»."
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
        title: "Offline-Modus & Bereitschaft",
        body: "In den Einstellungen unter «Offline-Modus» können Sie den manuellen Offline-Modus mit einem Schalter ein- und ausschalten. Beim Aktivieren werden alle Referenzdaten lokal gespeichert. Ein Status zeigt an, ob die App bereit für die Offline-Nutzung ist und wann die Daten zuletzt gespeichert wurden. Zudem werden hier alle heruntergeladenen Offline-Karten aufgelistet. Einzelne Gebiete können gelöscht werden, oder alle Offline-Daten auf einmal.",
        example: "Offline-Modus Schalter aktivieren → «App bereit für Offline-Nutzung» → Referenzdaten gespeichert → heruntergeladene Karten verwalten."
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
    id: "tipps",
    icon: HelpCircle,
    title: "Tipps & Tricks",
    color: "#8b5cf6",
    description: "Nützliche Hinweise für den Alltag.",
    items: [
      {
        title: "Ladeanzeige bei vielen Daten",
        body: "Wenn die App viele Referenzdaten laden muss (z.B. beim ersten Start oder bei aktivierten vielen Layern), erscheint oben ein Lade-Indikator. Wenn das Laden länger als 1,5 Sekunden dauert, wird ein kleines Handfunkgerät mit aussendenden Funkwellen angezeigt. Es weist darauf hin, dass viele Daten geladen werden und etwas Geduld nötig ist. Zusätzlich werden Tipps eingeblendet: Kartenausschnitt verkleinern (weniger Marker laden), weniger Layer aktivieren, oder den Performance-Modus in den Einstellungen einschalten. Der Lade-Indikator erscheint auch während dem Splash-Screen, falls das Laden der Referenzdaten länger dauert.",
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
      }
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
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: section.color + '15' }}>
          <Icon className="w-5 h-5" style={{ color: section.color }} />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-sm font-bold text-gray-900">{section.title}</h2>
          <p className="text-xs text-gray-500">{section.description}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {section.items.map((item, i) => (
            <div key={i} id={item.anchor} className="border-l-2 pl-4 scroll-mt-20" style={{ borderColor: section.color + '30' }}>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{item.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>

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
                <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 border border-gray-100">
                  <span className="font-semibold text-gray-700">💡 Beispiel:</span> {item.example}
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
  const [helpPdfLoading, setHelpPdfLoading] = useState(false);
  const [adminPdfLoading, setAdminPdfLoading] = useState(false);

  const handleDownloadFlyer = async () => {
    setFlyerLoading(true);
    try {
      await generateFlyer();
    } catch (e) {
      // ignore
    } finally {
      setFlyerLoading(false);
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Hilfe & Anleitung</h1>
              <p className="text-[10px] text-gray-400">Alle Funktionen im Überblick</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4 pb-24">
        {/* Werbe-Flyer Download */}
        <button
          onClick={handleDownloadFlyer}
          disabled={flyerLoading}
          className="w-full bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-5 flex items-center gap-4 hover:from-slate-700 hover:to-slate-800 transition-all disabled:opacity-60 shadow-lg"
        >
          <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
            {flyerLoading ? <Loader2 className="w-6 h-6 text-slate-900 animate-spin" /> : <FileText className="w-6 h-6 text-slate-900" />}
          </div>
          <div className="text-left flex-1">
            <h3 className="text-sm font-bold flex items-center gap-2">
              App-Flyer herunterladen
              <span className="px-2 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-bold rounded-full">PDF</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Promotions-Flyer mit allen Funktionen – exklusiv & einzigartig in der Schweiz
            </p>
          </div>
          <Download className="w-5 h-5 text-slate-400 flex-shrink-0" />
        </button>

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

        {/* PayPal Spende - am Anfang */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full mb-2">
            <Coffee className="w-5 h-5 text-amber-700" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">Spende mir einen Kaffee ☕</h3>
          <p className="text-xs text-gray-600 mb-3 leading-relaxed">
            Wenn Ihnen diese App gefällt und Sie die Entwicklung unterstützen möchten,
            freue ich mich über eine kleine Spende.
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

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
          <p className="font-semibold mb-1">Willkommen bei HB9OM On Field!</p>
          <p className="text-blue-700 text-xs leading-relaxed">
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
              className="px-3 py-2.5 text-sm font-semibold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 flex items-center gap-2 transition-colors"
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

        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <h3 className="text-sm font-bold text-red-900 mb-1">Keine rechtliche Grundlage – Eigenverantwortung</h3>
              <p className="text-xs text-red-800 leading-relaxed font-medium">
                Du bist lizenzierter Funkamateur und du musst selber wissen, was du machst und was du machen darfst.
                Darum hast du ja eine Prüfung gemacht. Also heule nicht, wenn du was falsch machst – du bist erwachsen.
              </p>
              <p className="text-xs text-red-700 leading-relaxed mt-2">
                Diese App und der enthaltene Bandplan dienen ausschliesslich als praktische Orientierungshilfe und
                stellen <strong>keine rechtsverbindliche Grundlage</strong> dar. Massgeblich ist stets der offizielle
                Frequenzplan des{" "}
                <a href="https://www.bakom.admin.ch/bakom/de/home/frequenzen-antennen/frequenzplan.html" target="_blank" rel="noopener noreferrer" className="text-red-900 underline font-bold">BAKOM</a>.
                Es wird keine Haftung für Fehler, Datenverluste oder andere Probleme übernommen.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Versions-Änderungen Popup</span>
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
          <p className="text-xs text-blue-700 mt-1.5">Zeigt die Änderungen seit v0.75 nach dem Splash Screen.</p>
        </div>

        <div className="bg-gray-100 rounded-xl p-4 text-center text-xs text-gray-500">
          <p>HB9OM On Field v{APP_VERSION} · Amateurfunk Referenzkarte & QSO-Logbuch</p>
          <p className="mt-1">
            <Link to="/privacy" className="text-blue-600 font-medium hover:underline">Datenschutzerklärung</Link>
            {" · "}
            Bei Fragen:{" "}
            <a href="mailto:hb9om@hb9om.ch" className="text-blue-600 font-medium hover:underline">hb9om@hb9om.ch</a>
          </p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
}