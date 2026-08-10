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
    name: "HBFF – Flora & Fauna",
    type: "Referenz-Daten",
    url: "https://hbff.ch/",
    modality: "Web-Scraping (HTML + KMZ)",
    scope: "Schweiz (~500 Referenzen)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData)",
    rateLimit: "Manuell (30 parallel)",
    description: "HBFF-Referenzliste wird als HTML gescraped. Koordinaten werden aus KMZ-Dateien (KML-Grenzen) extrahiert.",
    status: "Aktiv",
  },
  {
    name: "WWBOTA – Bunkers on the Air",
    type: "Referenz-Daten",
    url: "https://api.wwbota.org/bunkers/",
    modality: "API (CSV)",
    scope: "Schweiz (HBBOTA)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData)",
    rateLimit: "Keine bekannt",
    description: "Bunker-Referenzen werden als CSV von der WWBOTA-API geladen. Nur HBBOTA-Einträge werden gefiltert.",
    status: "Aktiv",
  },
  {
    name: "Burgen / Schlösser (WCA)",
    type: "Referenz-Daten",
    url: "https://wcagroup.org/FORMS/WCALIST.ods",
    modality: "ODS-Datei + OSM Overpass + Wikidata SPARQL + map.admin.ch + Nominatim",
    scope: "Schweiz (~940 Burgen)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData)",
    rateLimit: "Overpass: 30s Timeout; Nominatim: 1s/Request; Wikipedia: 0.3s/Request",
    description: "WCA-Liste wird als ODS-Datei heruntergeladen und geparst. Geokoordinierung über OSM Overpass, Wikidata SPARQL, map.admin.ch, Wikipedia und Nominatim (Fallback-Kaskade).",
    status: "Aktiv (Schweiz nur)",
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
    name: "Amateurfunk-Relais (RepeaterBook)",
    type: "Relais-Daten",
    url: "https://www.repeaterbook.com/",
    modality: "Web-Scraping (HTML, 80+ Länder inkl. US-Bundesstaaten & Kanada-Provinzen)",
    scope: "Weltweit (~3000 Relais: Europa, Asien, Nordamerika, Ozeanien)",
    auth: "Keine (öffentlich)",
    updateFrequency: "Geplant (refreshAllData) + On-Demand (Admin)",
    rateLimit: "Manuell (5 parallel, 500ms/Request)",
    description: "Relais-Daten werden von RepeaterBook.com gescraped. Europa/Asien/Ozeanien über row_repeaters-URL, Nordamerika (USA 50 Bundesstaaten + DC, Kanada 13 Provinzen) über repeater_repeaters-URL mit separaten state-IDs. Umfasst FM, C4FM, DMR, D-STAR, P-25, NXDN, M17, EchoLink. Permanente Crosslinks werden extrahiert. Admin kann pro Relais Web-Link ergänzen und Abdeckungsberechnung anstossen.",
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
    scope: "Weltweit (Schweiz gefiltert)",
    auth: "Keine (öffentlich)",
    updateFrequency: "On-Demand (refreshAllData)",
    rateLimit: "Keine bekannt",
    description: "Wikidata SPARQL für Schweizer Burgen/Schlösser (Q23413, Q57821, etc.). Koordinaten als WKT-Point. Filter auf Q39 (Schweiz).",
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
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" /> Externe Datenquellen & Abrufmodalitäten
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
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
                  <span className="text-sm font-medium text-gray-900">{src.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    src.status.startsWith("Aktiv") ? "bg-green-100 text-green-700" :
                    src.status.includes("Verfügbar") ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {src.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{src.modality} · {src.scope}</div>
              </div>
              {expanded === idx ? (
                <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
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