// App version and build number — compiled into the APK at build time.
// Version follows semantic versioning (Major.Minor.Patch).
// Build is a timestamp-based unique identifier (YYYYMMDDHHMM) generated at build.
//
// To create a new release build:
// 1. Increment VERSION below
// 2. Update BUILD to the current timestamp (YYYYMMDDHHMM format)
// 3. Add a changelog entry to CHANGELOG below
// 4. The menu drawer displays these values automatically (offline-readable)

export const APP_VERSION = "0.9002";

// Build number — timestamp-based, unique per build.
// Format: YYYYMMDDHHMM (e.g. 202608132237)
// Update this before each APK build to the current timestamp.
export const APP_BUILD = "202608270124";

// Changelog — short list of changes for the current version.
// Displayed in the hamburger menu under the version number.
export const APP_CHANGELOG = [
  "Karten-Fix: Stabile Container-Keys verhindern _leaflet_pos-Fehler bei View-Wechseln",
  "Zoom-Animation deaktiviert: Keine Abstürze mehr beim Schliessen von Modalen oder Seitenwechsel während Zoom",
  "QSO-Weltkarte: Sauberes Umschalten zwischen Globus und 2D-Karte ohne Karten-Neuaufbau",
  "Spot-Details und Fox-Hunt-Modal: Karte bleibt stabil beim Zoomen und sofortigen Schliessen",
  "Hunting-Modul: Live DX-Spots mit GPS-basierter Distanz- und Azimuth-Berechnung",
  "Hunting-Modul: Activity Panel mit Live SOTA- und POTA-Aktivierungen (Auto-Refresh 60s)",
  "Hunting-Modul: Propagation-Dashboard mit Solar Flux, K-Index und Band-Conditions",
  "Hunting-Modul: Fox Hunting mit Peilung, Triangulation und GPS-Position",
  "Hunting-Modul: QSO direkt aus Spot loggen — Formular wird automatisch vorausgefüllt",
  "Hunting-Modul: QRZ-Lookup direkt aus der Spot-Tabelle per Klick auf Rufzeichen",
  "Hunting-Modul: Priority DX — Top 5 weiteste Spots nach Distanz sortiert",
  "Hunting-Modul: Theme-aware (Dark/Light Mode) — alle Komponenten folgen dem globalen Theme",
  "GPS-Tracking: Live-Position vom Gerät überschreibt statischen Stations-Locator",
  "GPS-Tracking: Distanz- und Azimuth-Berechnungen nutzen echte GPS-Koordinaten",
  "ActivitySpot: Neue Entity für SOTA/POTA-Aktivierungen mit API-Fetchern",
  "ActivitySpot: POTA API (api.pota.app) und SOTA API (api2.sota.org.uk) Integration",
  "ActivitySpot: Frequenz-Konvertierung korrigiert (POTA API gibt Hz zurück, nicht MHz)",
  "SpotDetailsModal: Unterstützt sowohl DxSpot als auch ActivitySpot Datenstrukturen",
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