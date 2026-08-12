import React, { useState } from "react";
import { FileDown, Database, Globe, Key, Clock, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { jsPDF } from "jspdf";

// All external data sources and their query modalities
const DATA_SOURCES = [
  {
    name: "SOTA – Summits on the Air",
    type: "Referenz-Daten",
    url: "https://api2.sota.org.uk/api/",
    modality: "REST API (JSON)",
    scope: "Weltweit (~70'000 Gipfel)",
    auth: "Keine (öffentlich)",
    updateFrequency: "On-Demand + Geplant (refreshAllData)",
    rateLimit: "Keine bekannt",
    description: "Alle SOTA-Assoziationen weltweit werden über die offizielle API abgerufen. Pro Assoziation werden Regionen und Summits geladen.",
    status: "Aktiv",
  },
  {
    name: "POTA – Parks on the Air",
    type: "Referenz-Daten",
    url: "https://api.pota.app/program/",
    modality: "REST API (JSON)",
    scope: "Weltweit (~50'000 Parks)",
    auth: "Keine (öffentlich)",
    updateFrequency: "On-Demand + Geplant (refreshAllData)",
    rateLimit: "Keine bekannt",
    description: "Alle POTA-Entitäten weltweit werden über die offizielle API abgerufen. Pro Entität werden alle Parks mit Koordinaten geladen.",
    status: "Aktiv",
  },
  {
    name: "WWFF – Flora & Fauna (weltweit)",
    type: "Referenz-Daten",
    url: "https://wwff.co/wwff-data/wwff_directory.csv",
    modality: "CSV-Download",
    scope: "Weltweit (~40'000 Referenzen)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData)",
    rateLimit: "Keine bekannt",
    description: "WWFF-Verzeichnis wird als CSV von wwff.co geladen. Enthält alle Flora-Fauna-Referenzen weltweit mit Koordinaten. Ersetzt das frühere Schweizer-only HBFF.",
    status: "Aktiv",
  },
  {
    name: "WWBOTA – Bunkers on the Air (weltweit)",
    type: "Referenz-Daten",
    url: "https://api.wwbota.org/bunkers/",
    modality: "API (CSV)",
    scope: "Weltweit (alle Schemata: HBBOTA, DLBOTA, F-BOTA, GBBOTA etc.)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData)",
    rateLimit: "Keine bekannt",
    description: "Bunker-Referenzen werden als CSV von der WWBOTA-API geladen. Alle nationalen Schemata (HBBOTA, DLBOTA, F-BOTA etc.) werden inkludiert, nicht nur HBBOTA.",
    status: "Aktiv",
  },
  {
    name: "Burgen / Schlösser (WCA weltweit)",
    type: "Referenz-Daten",
    url: "https://wcagroup.org/FORMS/WCALIST.ods",
    modality: "ODS-Datei (alle Länder-Tabellen) + OSM Overpass + Wikidata SPARQL + map.admin.ch + Nominatim",
    scope: "Weltweit (alle WCA-Länder + OSM/Wikidata)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData)",
    rateLimit: "Overpass: 30s Timeout; Nominatim: 1s/Request; Wikipedia: 0.3s/Request",
    description: "WCA-ODS wird heruntergeladen und ALLE Länder-Tabellen geparst (HB, DL, F, G etc.). Schweizer Burgen werden mit map.admin.ch und Schweizer Nominatim geokodiert, nicht-Schweizer mit weltweitem Nominatim. OSM Overpass und Wikidata liefern zusätzliche weltweite Burgen.",
    status: "Aktiv",
  },
  {
    name: "IOTA – Islands on the Air",
    type: "Referenz-Daten",
    url: "https://www.iota-world.org/",
    modality: "Statische kuratierte Daten",
    scope: "Weltweit (~170 Inselgruppen)",
    auth: "N/A",
    updateFrequency: "Manuell (bei Updates)",
    rateLimit: "N/A",
    description: "Kuratierte Teilmenge der ~1200 IOTA-Inselgruppen weltweit. Vollständige Liste unter iota-world.org/islands-on-the-air/downloads.html verfügbar.",
    status: "Aktiv (Teilmenge)",
  },
  {
    name: "Leuchttürme (WLOTA / ARLHS WLOL / ILLW)",
    type: "Referenz-Daten",
    url: "https://wlol.arlhs.com/ / https://wllw.org/",
    modality: "Statische kuratierte Daten",
    scope: "Weltweit (~170 Leuchttürme)",
    auth: "N/A",
    updateFrequency: "Manuell (bei Updates)",
    rateLimit: "N/A",
    description: "Kuratierte Liste wichtiger Leuchttürme weltweit. Quellen: ARLHS WLOL, WLOTA, ILLW. ILLW-Flat-File wird für Schweizer Leuchttürme via fetchILLW abgerufen.",
    status: "Aktiv",
  },
  {
    name: "TOTA – Towers on the Air",
    type: "Referenz-Daten",
    url: "https://wwtota.com/",
    modality: "HTML-Scraping (Turmliste) + CSV-Upload (Schweiz)",
    scope: "Weltweit (~5300 Türme in 17 Ländern) + Schweiz (~6900 Antennen & Türme)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData — worldwide) + Manuell (Admin — Schweizer CSV-Upload)",
    rateLimit: "Keine bekannt",
    description: "TOTA ist ein internationales Programm für Aussichtstürme. Worldwide-Daten werden von wwtota.com gescraped (Maidenhead-Locator → Koordinaten). Schweizer Daten werden als CSV-Dateien (Antennen.csv & Turm.csv mit LV95-Koordinaten) vom Admin manuell hochgeladen. In der Schweiz wird zwischen Antennen und Türmen getrennt.",
    status: "Aktiv",
  },
  {
    name: "Amateurfunk-Relais (RepeaterBook)",
    type: "Relais-Daten",
    url: "https://www.repeaterbook.com/",
    modality: "Web-Scraping (HTML, 120+ Länder inkl. US-Bundesstaaten & Kanada-Provinzen)",
    scope: "Weltweit (alle Kontinente: Europa, Asien, Afrika, Nord-/Südamerika, Ozeanien)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (täglich 01:00 UTC) + On-Demand (Admin)",
    rateLimit: "80 parallel, 8s Timeout pro Request",
    description: "Relais-Daten werden von RepeaterBook.com gescraped — weltweit 120+ Länder. Priorität 1 (CH+Nachbarn): 500 Detail-Abfragen/Land (volle Koordinaten). Priorität 2 (Rest Europa): 30/Land. Priorität 3 (Asien, Afrika, Amerika, Ozeanien): 15/Land. Nordamerika (USA 50 Bundesstaaten + DC, Kanada 13 Provinzen) über separate URL. Umfasst FM, C4FM, DMR, D-STAR, P-25, NXDN, M17, EchoLink. Permanente Crosslinks werden extrahiert. Der ARRL Repeater Directory wird ebenfalls von RepeaterBook gespeist (arrl.org/news).",
    status: "Aktiv",
  },
  {
    name: "WIA Australia – Repeater Directory (CSV)",
    type: "Relais-Daten (Australien)",
    url: "https://www.wia.org.au/members/repeaters/data/",
    modality: "CSV-Download (HTML-Seite → CSV-URL)",
    scope: "Australien (VK1-VK8, alle Bundesstaaten/Territorien)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData — integriert in Relais-Reload)",
    rateLimit: "Keine bekannt",
    description: "WIA (Wireless Institute of Australia) veröffentlicht ein CSV mit allen australischen Repeatern. Die CSV-URL ändert sich mit dem Datum — die HTML-Seite wird gescraped um die aktuelle CSV-URL zu finden. VK1-VK8-Präfixe werden auf Bundesstaat-Koordinaten gemappt (approximativ, da CSV keine Koordinaten enthält). Modi: FM, D-STAR, DMR. Status-Mapping: O=on-air, W=weekly, L=testing, LN/X=off-air.",
    status: "Aktiv",
  },
  {
    name: "dstarusers.org – D-STAR Repeater (weltweit)",
    type: "Relais-Daten (D-STAR weltweit)",
    url: "https://dstarusers.org/repeaters.php",
    modality: "HTML-Scraping (Tabelle)",
    scope: "Weltweit (D-STAR-Repeater in 40+ Ländern — alle Kontinente)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (täglich 01:00 UTC — integriert in Relais-Reload)",
    rateLimit: "Keine bekannt",
    description: "dstarusers.org listet alle D-STAR-Repeater weltweit mit Callsign, Stadt, Staat/Land und Frequenzen (2m, 70cm, 23cm). US-Staaten werden auf State-Center-Koordinaten gemappt, andere Länder auf Country-Center. Deduplizierung gegen RepeaterBook nach Callsign+Frequenz. Web-Link auf dstarusers.org/viewrepeater.php wird als web_url gespeichert. Deckt Asien, Afrika, Amerika und Ozeanien ab, wo RepeaterBook-Detaildaten lückenhaft sind.",
    status: "Aktiv",
  },
  {
    name: "ARRL Repeater Directory (Referenz)",
    type: "Relais-Daten (Referenz)",
    url: "https://www.arrl.org/repeater-directory",
    modality: "Print + App (Powered by RepeaterBook)",
    scope: "USA & Kanada (22'000+ Einträge)",
    auth: "Kauf/App-Download",
    updateFrequency: "Jährlich (Print) / Live (App)",
    rateLimit: "N/A",
    description: "Der ARRL Repeater Directory wird seit 2025 von RepeaterBook gespeist (arrl.org/news). Die Daten sind identisch mit unserem RepeaterBook-Scraper — keine separate Integration nötig. Die ARRL-App bietet zusätzlich Offline-Suche per GPS. FCC (fcc.gov/wireless) lizenziert einzelne Stationen, führt aber keine eigene Repeater-Liste.",
    status: "Abgedeckt via RepeaterBook",
  },
  {
    name: "IZ8WNH.it – Worldwide Repeater Map",
    type: "Relais-Daten (Referenz)",
    url: "https://www.iz8wnh.it/rpts/",
    modality: "Interaktive Web-Karte + CSV-Export",
    scope: "Weltweit (Repeater + Baken, alle Kontinente)",
    auth: "Keine (öffentlich, kostenlos)",
    updateFrequency: "Live (Community-gepflegt)",
    rateLimit: "Keine bekannt",
    description: "IZ8WNH.it ist die erste interaktive weltweite Repeater- und Baken-Karte. Bietet drei Suchmaschinen (Filter, Geolocation, Routen) mit CSV-Export für Transceiver-Programmierung. Community-gepflegt seit 2016, alle Einträge werden vor Veröffentlichung verifiziert. API-Swagger verfügbar. Dient als Validierungs-Referenz und Ergänzung für Regionen mit lückenhafter RepeaterBook-Abdeckung (insb. Afrika, Asien, Südamerika).",
    status: "Verfügbar (Referenz)",
  },
  {
    name: "OpenRepeater.org – Free Repeater API",
    type: "Relais-Daten (Referenz)",
    url: "https://www.openrepeater.org/",
    modality: "REST API (JSON, API-Key)",
    scope: "Weltweit (Community-gepflegt, Schwerpunkt MENA/Asien/Afrika)",
    auth: "API-Key (or_…, kostenlos nach Registrierung)",
    updateFrequency: "Live (Community-Einträge)",
    rateLimit: "30 Requests/Tag pro API-Key",
    description: "OpenRepeater.org bietet eine kostenlose REST-API für weltweite Repeater-Daten. Endpunkte: /repeaters, /country/{code}, /search (Text + Geo-Radius). JSON mit Koordinaten, Mode, Band, Status. Besonders stark in Regionen mit schwacher RepeaterBook-Abdeckung (MENA, Asien, Afrika). Rate-Limit von 30 Requests/Tag limitiert auf Key-Countries pro Abruf. API-Key-Integration vorbereitet (OPENREPEATER_API_KEY).",
    status: "Verfügbar (API-Key erforderlich)",
  },
  {
    name: "SARL – South African Radio League Repeaters",
    type: "Relais-Daten (Südafrika)",
    url: "https://mysarl.org.za/repeaters/",
    modality: "HTML-Tabelle (Web-Scraping)",
    scope: "Südafrika (ZS-Präfix, FM/DMR/D-STAR)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Manuell (bei Updates)",
    rateLimit: "Keine bekannt",
    description: "SARL (South African Radio League) veröffentlicht eine Liste aller südafrikanischen Relais (ZS0–ZS6) mit Callsign, Standort, Mode und Status. Keine Koordinaten — Standortnamen werden via Nominatim geokodiert. Ergänzt RepeaterBook für Afrika, wo Detail-Daten oft lückenhaft sind.",
    status: "Verfügbar (Referenz)",
  },
  {
    name: "MARTS – Malaysian Amateur Radio Repeater List",
    type: "Relais-Daten (Malaysia/Asien)",
    url: "https://marts.org.my/ver2/iaru-region-3/",
    modality: "HTML (Web)",
    scope: "Malaysia + IARU Region 3 (Asien-Pazifik)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Manuell (bei Updates)",
    rateLimit: "Keine bekannt",
    description: "MARTS (Malaysian Amateur Radio Transmitter Society) veröffentlicht Repeater-Listen für IARU Region 3 (Asien-Pazifik). Enthält auch das Repeater Linking Project mit SOPs für neue Relais. Dient als Referenz für Südostasien, wo RepeaterBook-Abdeckung variabel ist.",
    status: "Verfügbar (Referenz)",
  },
  {
    name: "USKA HB Repeater Voice List",
    type: "CH-Relais-Daten + Verlinkungen",
    url: "https://uska.ch/hb-repeater-voice-list/",
    modality: "Web-Scraping (HTML-Tabelle, 308 CH-Relais)",
    scope: "Schweiz (alle HB9-Relais)",
    auth: "Keine (öffentlich)",
    updateFrequency: "On-Demand (Admin-Panel: CH-Relais-Links)",
    rateLimit: "Keine bekannt",
    description: "Offizielle USKA-Liste aller Schweizer Amateurfunk-Relais mit TX/RX-Frequenz, QTH, Kanton, Locator, Höhe und Remarks. Aus den Remarks werden Crosslinks extrahiert (<>Tamaro, <>Scura, >RX Chestenberg) und als RepeaterLink-Einträge angelegt. EchoLink-Node-Nummern (EL#), D-STAR CCS-Nummern und C4FM/Wires-X-IDs werden in die Repeater-Daten übernommen. Status-Mapping: 0=geplant, 1=qrv (on-air), 2=qrx (testing), 3=qrt (off-air).",
    status: "Aktiv",
  },
  {
    name: "SWISS-ARTG Standorte",
    type: "CH-Relais-Stationen",
    url: "https://www.swiss-artg.ch/index.php?id=38",
    modality: "Web-Scraping (HTML)",
    scope: "Schweiz (SWISS-ARTG-Anlagen: HB9AK, HB9ZRH)",
    auth: "Keine (öffentlich)",
    updateFrequency: "On-Demand (Referenz)",
    rateLimit: "Keine bekannt",
    description: "Standortliste der SWISS-ARTG (Sektion HB9AK) mit Anlagen-Übersicht: DMR-Relais (HB9AK-1 438.600 MHz), FM-Relais SVXLink (439.900 MHz), D-STAR-Relais (HB9ZRH 145.575 MHz), APRS-iGates, LoRa, HAMNET, WSPR-Baken, Winlink-Gateways. Partnerstandorte: Hohe Buche HB9SG, Weissenstein HB9BA, Schleitheim, Rigi-Scheidegg HB9ZG.",
    status: "Aktiv (Referenz)",
  },
  {
    name: "Funkwelt HB Repeater Map",
    type: "CH-Relais-Übersicht",
    url: "https://www.funkwelt.net/funkwelt-dxcluster/hb-repeater-liste/",
    modality: "Web (interaktive Karte, JS-rendered)",
    scope: "Schweiz (308 Relais, 265 aktiv)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Live (Web-Anzeige)",
    rateLimit: "Keine bekannt",
    description: "Interaktive Übersichtskarte aller aktiven HB-Amateurfunk-Repeater mit Standorten, Frequenzen, CTCSS-Tönen und Betriebsarten (FM, DMR, D-STAR, C4FM). Statistiken nach Kanton, Band und Modus. CSV/PDF-Export verfügbar. JS-rendered — nicht direkt scrapbar, dient als Referenz und Validierung.",
    status: "Verfügbar (Referenz, nicht automatisiert)",
  },
  {
    name: "FM-Funknetz.de – Talkgroups & Live-Dashboard",
    type: "Relais-Talkgroups (weltweit)",
    url: "https://dashboard.fm-funknetz.de/",
    modality: "Web-Scraping (HTML-Tabelle, Live-Aktivität)",
    scope: "Weltweit (SvxLink-Netzwerk, primär DACH + Europa)",
    auth: "Keine (öffentlich)",
    updateFrequency: "On-Demand (Admin-Panel: FM-Funknetz TGs)",
    rateLimit: "Keine bekannt",
    description: "FM-Funknetz.de ist ein SvxLink-basiertes Relais- und Hotspot-Netzwerk. Das Live-Dashboard zeigt aktive Stationen und ihre Talkgroups (TGs). Die TG-Nummern und -Namen werden gescraped und mit den Relais in der Datenbank abgeglichen. Im Relais-Popup werden die aktiven TGs mit Name und letzter Aktivitätszeit angezeigt. Link zum Live-Dashboard und zur TG-Übersicht (fm-funknetz.de/unsere-talkgroups-sprechgruppen/) im Popup. TGs umfassen regionale (262xx für DL, 2280 für CH, 232x für AT) und weltweite Sprechgruppen.",
    status: "Aktiv",
  },
  {
    name: "APRS.fi – Koordinaten-Verfeinerung",
    type: "Relais-Koordinaten",
    url: "https://aprs.fi/api/",
    modality: "REST API (JSON, name= Rufzeichen-Query)",
    scope: "Weltweit (APRS-IS)",
    auth: "API-Key (APRS_FI_API_KEY)",
    updateFrequency: "Geplant (refreshAllData) + On-Demand (Admin-Panel)",
    rateLimit: "~1 Request/Sekunde, 4 Quadranten-Bounding-Box-Strategie",
    description: "APRS.fi API verfeinert Repeater-Koordinaten und -Höhen. Globale Abdeckung durch 4 Quadranten-Bounding-Box-Queries. Liefert auch digipeater/IGate-Daten für PrivateNode-Ebene. Brandmeister-API ergänzt DMR-Verlinkungs-Status.",
    status: "Aktiv",
  },
  {
    name: "APRS.fi",
    type: "Station-Daten",
    url: "https://aprs.fi/api/",
    modality: "REST API (JSON)",
    scope: "Weltweit (APRS-IS)",
    auth: "API-Key (APRS_FI_API_KEY)",
    updateFrequency: "On-Demand (Admin-Panel)",
    rateLimit: "~1 Request/Sekunde",
    description: "APRS.fi API für Stations-Abfragen. Query nach Rufzeichen (name=). Keine geografische Bereichssuche verfügbar. Rate-Limit beachten.",
    status: "Aktiv (Rate-Limited)",
  },
  {
    name: "aprs.world (Alternative)",
    type: "Station-Daten",
    url: "https://aprs.world/",
    modality: "Web-API (ungeauthentifiziert)",
    scope: "Weltweit (APRS-IS)",
    auth: "Keine (öffentlich, kostenlos)",
    updateFrequency: "Live-Feed",
    rateLimit: "Keine bekannt",
    description: "Moderne Alternative zu aprs.fi. Freie, ungeauthentifizierte API. Gleiche APRS-IS-Datenquelle. 30 Tage Positionsverlauf (vs. Jahre bei aprs.fi).",
    status: "Verfügbar (nicht integriert)",
  },
  {
    name: "QRZ.com (XML-Subscription)",
    type: "Rufzeichen-Lookup",
    url: "https://www.qrz.com/xml",
    modality: "REST API (XML)",
    scope: "Weltweit",
    auth: "QRZ_USERNAME + QRZ_PASSWORD (Club-Subscription)",
    updateFrequency: "On-Demand (Logbuch)",
    rateLimit: "Keine bekannt (Subscription)",
    description: "QRZ.com XML-API für Rufzeichen-Lookup (Name, Adresse, Land, Grid, E-Mail). Club-Subscription hinterlegt. Ergebnisse werden in QrzLookup-Entity zwischengespeichert.",
    status: "Aktiv",
  },
  {
    name: "Brandmeister.network",
    type: "DMR-Netzwerk",
    url: "https://api.brandmeister.network/v2/",
    modality: "REST API (JSON, JWT-Auth)",
    scope: "Pro User (eigene Hotspots/Relais)",
    auth: "API-Key v2 (JWT) – pro User in SelfCare generierbar",
    updateFrequency: "Nicht integriert",
    rateLimit: "Keine bekannt",
    description: "Brandmeister API v2 für DMR-Netzwerk. Ermöglicht Zugriff auf eigene Hotspots/Relais/Talkgroups. Kein öffentlicher Endpunkt für globale Relais-Liste. API-Key in Brandmeister SelfCare generierbar.",
    status: "Nicht integriert (kein öffentlicher Listen-Endpunkt)",
  },
  {
    name: "SwissTopo WMS (map.geo.admin.ch)",
    type: "Karten-Overlay",
    url: "https://wms.geo.admin.ch/",
    modality: "WMS Tile Service",
    scope: "Schweiz",
    auth: "Keine (öffentlich)",
    updateFrequency: "Live-Tiles",
    rateLimit: "Fair-Use",
    description: "SwissTopo WMS-Layer für Gefahren & Störquellen (Hochspannung, Mobilfunk, Richtfunk, Radio/TV) und Schweizer Naturinventare (BLN, Moore, Vogelreservate).",
    status: "Aktiv",
  },
  {
    name: "OpenStreetMap (Tiles + Overpass)",
    type: "Kartenbasis + Geokodierung",
    url: "https://tile.openstreetmap.org/ / https://overpass-api.de/",
    modality: "Tile-Server + Overpass API",
    scope: "Weltweit",
    auth: "Keine (öffentlich)",
    updateFrequency: "Live-Tiles / On-Demand",
    rateLimit: "Overpass: 30s Timeout; Tiles: Fair-Use",
    description: "OSM-Tiles als Standard-Kartenbasis. Overpass API für Burgen-Suche (historic=castle|tower|fort|ruins). Nominatim für Fallback-Geokodierung.",
    status: "Aktiv",
  },
  {
    name: "Wikidata SPARQL",
    type: "Geokodierung",
    url: "https://query.wikidata.org/sparql",
    modality: "SPARQL Query (JSON)",
    scope: "Weltweit (alle Länder)",
    auth: "Keine (öffentlich)",
    updateFrequency: "On-Demand (refreshAllData)",
    rateLimit: "Keine bekannt",
    description: "Wikidata SPARQL für Burgen/Schlösser weltweit (Q23413, Q57821, etc.). Koordinaten als WKT-Point. Schweizer Burgen werden separat (Q39) und weltweit ohne Länderfilter abgefragt.",
    status: "Aktiv",
  },
];

export default function ExternalSourcesList() {
  const [expanded, setExpanded] = useState(null);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 20;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Externe Datenquellen – HB9OM On Field", margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Exportiert: ${new Date().toLocaleString("de-CH")}`, margin, y);
    y += 10;

    doc.setTextColor(0);

    // Table header
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, "F");
    doc.text("Quelle", margin + 1, y);
    doc.text("Modalität", margin + 60, y);
    doc.text("Scope", margin + 100, y);
    doc.text("Auth", margin + 130, y);
    doc.text("Status", margin + 160, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    for (const src of DATA_SOURCES) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const lines = doc.splitTextToSize(src.name, 58);
      const lineHeight = 4;
      const blockHeight = lines.length * lineHeight;

      if (y + blockHeight > 280) {
        doc.addPage();
        y = 20;
      }

      doc.text(lines, margin + 1, y);
      doc.text(doc.splitTextToSize(src.modality, 38), margin + 60, y);
      doc.text(doc.splitTextToSize(src.scope, 28), margin + 100, y);
      doc.text(doc.splitTextToSize(src.auth, 28), margin + 130, y);
      doc.text(doc.splitTextToSize(src.status, 35), margin + 160, y);

      y += Math.max(blockHeight, 8) + 1;

      // Details
      doc.setFontSize(6);
      doc.setTextColor(80);
      doc.text(`URL: ${src.url}`, margin + 4, y);
      y += 3.5;
      doc.text(`Update: ${src.updateFrequency}`, margin + 4, y);
      y += 3.5;
      doc.text(`Rate-Limit: ${src.rateLimit}`, margin + 4, y);
      y += 3.5;
      const descLines = doc.splitTextToSize(src.description, pageWidth - 2 * margin - 4);
      doc.text(descLines, margin + 4, y);
      y += descLines.length * 3 + 3;
      doc.setTextColor(0);
      doc.setFontSize(7);

      // Separator
      doc.setDrawColor(200);
      doc.line(margin, y - 1, pageWidth - margin, y - 1);
      y += 2;
    }

    doc.save("externe-datenquellen-hb9om.pdf");
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" /> Externe Datenquellen & Abrufmodalitäten
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Übersicht aller externen Datenquellen, ihrer API-Endpunkte, Authentifizierung und Abruf-Modalitäten
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" /> PDF exportieren
        </button>
      </div>

      <div className="space-y-2">
        {DATA_SOURCES.map((src, idx) => (
          <div key={idx} className="border border-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === idx ? null : idx)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                {src.auth !== "Keine (öffentlich)" && src.auth !== "N/A" ? (
                  <Key className="w-4 h-4 text-amber-500" />
                ) : (
                  <Globe className="w-4 h-4 text-blue-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{src.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    src.status.startsWith("Aktiv") ? "bg-green-100 text-green-700" :
                    src.status.includes("Verfügbar") ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {src.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{src.modality} · {src.scope}</div>
              </div>
              {expanded === idx ? (
                <ChevronUp className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
              )}
            </button>

            {expanded === idx && (
              <div className="px-3 pb-3 pt-1 bg-gray-50 border-t border-gray-100 text-xs space-y-1.5">
                <div className="flex gap-2">
                  <span className="font-medium text-gray-600 w-20 flex-shrink-0">URL:</span>
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5 break-all">
                    {src.url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-gray-600 w-20 flex-shrink-0">Modalität:</span>
                  <span className="text-gray-700">{src.modality}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-gray-600 w-20 flex-shrink-0">Scope:</span>
                  <span className="text-gray-700">{src.scope}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-gray-600 w-20 flex-shrink-0">Auth:</span>
                  <span className="text-gray-700">{src.auth}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-gray-600 w-20 flex-shrink-0 flex items-center gap-0.5"><Clock className="w-3 h-3" />Update:</span>
                  <span className="text-gray-700">{src.updateFrequency}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-gray-600 w-20 flex-shrink-0 flex items-center gap-0.5"><RefreshCw className="w-3 h-3" />Rate-Limit:</span>
                  <span className="text-gray-700">{src.rateLimit}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-gray-600 w-20 flex-shrink-0">Beschreibung:</span>
                  <span className="text-gray-700">{src.description}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}