// App version and build number — compiled into the APK at build time.
// Version follows semantic versioning (Major.Minor.Patch).
// Build is a timestamp-based unique identifier (YYYYMMDDHHMM) generated at build.
//
// To create a new release build:
// 1. Increment VERSION below
// 2. Update BUILD to the current timestamp (YYYYMMDDHHMM format)
// 3. Add a changelog entry to CHANGELOG below
// 4. The menu drawer displays these values automatically (offline-readable)

export const APP_VERSION = "0.8.3";

// Build number — timestamp-based, unique per build.
// Format: YYYYMMDDHHMM (e.g. 202608130939)
// Update this before each APK build to the current timestamp.
export const APP_BUILD = "202608130939";

// Changelog — short list of changes for the current version.
// Displayed in the hamburger menu under the version number.
export const APP_CHANGELOG = [
  "IOTA: 1.178 Gruppen (vorher 28) — eigene Entity, täglicher Sync",
  "Alternative Datenquellen: Repeater (Hearham), Lighthouse (Wikidata+Fallback)",
  "Sync-Frequenz optimiert: 1x täglich 03:00–07:00 UTC",
  "Fehler-Handling verbessert — keine weissen Bildschirme mehr",
  "Build-Nummer & Changelog im Menü sichtbar",
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