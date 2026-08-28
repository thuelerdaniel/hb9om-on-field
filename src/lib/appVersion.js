// App version and build number — compiled into the APK at build time.
// Version follows semantic versioning (Major.Minor.Patch).
// Build is a timestamp-based unique identifier (YYYYMMDDHHMM) generated at build.
//
// To create a new release build:
// 1. Increment VERSION below
// 2. Update BUILD to the current timestamp (YYYYMMDDHHMM format)
// 3. Add a changelog entry to CHANGELOG below
// 4. The menu drawer displays these values automatically (offline-readable)

export const APP_VERSION = "0.9019";

// Build number — timestamp-based, unique per build.
// Format: YYYYMMDDHHMM (e.g. 202608132237)
// Update this before each APK build to the current timestamp.
export const APP_BUILD = "202608281657";

// Changelog — short list of changes for the current version.
// Displayed in the hamburger menu under the version number.
export const APP_CHANGELOG = [
  "Hunting: 6-Tabs-Struktur (SOTA, POTA, WWFF, WWBOTA, Live Spot Activity, Alerts)",
  "Hunting: Keine Spot-Limits mehr — alle SOTA/POTA/WWFF/WWBOTA/DX-Spots werden angezeigt",
  "Hunting: SOTA API mit 200 Spots (3-Segment-URL /api/spots/200/all/all)",
  "Hunting: DX-Cluster speichert alle Spots (355 statt 100) — keine Slice-Limits",
  "Hunting: Spothole SIG-Spots limit=500 (war 100)",
  "Hunting: DxSpot Entity limit=500 (war 50) — merged ohne Slice",
  "Hunting: SOTA QRT/RBNHOLE-Filter aktiv (Backend + Frontend)",
  "Hunting: Alerts-Tab kombiniert SOTA-Alerts + WWFF-Agendas (260 geplante Aktivierungen)",
  "Hunting: POTA/WWBOTA-Hinweis im Alerts-Tab (keine geplante API verfügbar)",
  "UI: Gerätespezifische QSO-Button-Position (desktop/tablet/mobile getrennt)",
  "UI: Feldbreiten pro Gerät konfigurierbar (Settings → Feldbreiten pro Gerät)",
  "UI: UserHuntingSettings.ui_settings Entity-Feld für server-side Sync",
  "Karten-Fix: Stabile Container-Keys verhindern _leaflet_pos-Fehler bei View-Wechseln",
  "Zoom-Animation deaktiviert: Keine Abstürze mehr beim Schliessen von Modalen",
  "QSO-Weltkarte: Sauberes Umschalten zwischen Globus und 2D-Karte",
  "Hunting-Modul: Live DX-Spots mit GPS-basierter Distanz- und Azimuth-Berechnung",
  "Hunting-Modul: Propagation-Dashboard mit Solar Flux, K-Index und Band-Conditions",
  "Hunting-Modul: Fox Hunting mit Peilung, Triangulation und GPS-Position",
  "Hunting-Modul: QSO direkt aus Spot loggen — Formular automatisch vorausgefüllt",
  "Hunting-Modul: QRZ-Lookup direkt aus der Spot-Tabelle per Klick auf Rufzeichen",
  "GPS-Tracking: Live-Position vom Gerät überschreibt statischen Stations-Locator",
  "Build-Optimierung: Vendor-Chunks aufgeteilt für schnelleres Laden",
];

// Data sources reference — used by Help page and menu.
export const DATA_SOURCES = [
  { name: "SOTA", url: "api2.sota.org.uk", count: "~181.658 Gipfel", schedule: "täglich 03:00 UTC" },
  { name: "POTA", url: "api.pota.app", count: "~89.650 Parks", schedule: "täglich 03:30 UTC" },
  { name: "WWFF", url: "wwff.co/wwff-data/wwff_directory.csv", count: ">1.000 Gebiete", schedule: "täglich 04:00 UTC" },
  { name: "IOTA", url: "iota-world.org", count: "1.178 Gruppen", schedule: "täglich 03:00 UTC" },
  { name: "WWBOTA", url: "api.wwbota.net", count: "Bunker weltweit", schedule: "täglich 04:30 UTC" },
  { name: "Burgen/Schlösser", url: "OSM + Wikidata", count: "weltweit", schedule: "täglich 04:30 UTC" },
  { name: "Repeater", url: "RepeaterBook + hearham.com", count: ">22.000 Relais", schedule: "täglich 05:00 UTC" },
  { name: "Leuchttürme", url: "Wikidata SPARQL + Fallback", count: "weltweit", schedule: "täglich 05:30 UTC" },
  { name: "APRS", url: "aprs.fi API (API-Key)", count: "Stationen weltweit", schedule: "täglich 06:00 UTC" },
  { name: "TOTA", url: "swiss_csv + wwtota.com", count: "Antennen/Türme", schedule: "täglich 06:30 UTC" },
  { name: "FM-Funknetz", url: "fm-funknetz.de", count: "Talkgruppen", schedule: "täglich 06:30 UTC" },
];

// Privacy notice — short text shown in menu and help.
export const PRIVACY_NOTICE =
  "Diese App verarbeitet Standortdaten zur Kartenanzeige und speichert Cache-Daten lokal auf dem Gerät. Es werden keine personenbezogenen Daten an Server übertragen ausser den für die Daten-Synchronisation nötigen API-Abfragen.";