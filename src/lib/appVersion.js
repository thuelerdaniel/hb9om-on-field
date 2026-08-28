// App version and build number — compiled into the APK at build time.
// Version follows semantic versioning (Major.Minor.Patch).
// Build is a timestamp-based unique identifier (YYYYMMDDHHMM) generated at build.
//
// To create a new release build:
// 1. Increment VERSION below
// 2. Update BUILD to the current timestamp (YYYYMMDDHHMM format)
// 3. Add a changelog entry to CHANGELOG below
// 4. The menu drawer displays these values automatically (offline-readable)

export const APP_VERSION = "0.9031";

// Build number — timestamp-based, unique per build.
// Format: YYYYMMDDHHMM (e.g. 202608132237)
// Update this before each APK build to the current timestamp.
export const APP_BUILD = "202608282003";

// Changelog — short list of changes for the current version.
// Displayed in the hamburger menu under the version number.
export const APP_CHANGELOG = [
  "Fix v0.9031: Wavelog Import — ADIF-Parser split case-insensitiv (<EOR> vs <eor>), Header-Entfernung, Batch-Import (100 QSOs pro Batch)",
  "Fix v0.9031: Wavelog Import — Dedup-Prüfung mit Frequency (callsign + qso_date + time_start + frequency)",
  "Fix v0.9031: Wavelog Import — bulkCreate statt einzelne create-Calls (2130 QSOs in 21 Batches statt 2130 Einzelaufrufen)",
  "Fix v0.9030: Live Spot Activity als eigenständiges Widget wiederhergestellt — zwischen Propagation Overview und SOTA Live-Spots",
  "Fix v0.9030: Auto-Refresh 30s, max 50 Spots angezeigt, Sortierung nach Zeit/Score/Distanz",
  "Fix v0.9029: DX-Cluster Spots im 'Live Spot Activity' Tab — Fallback auf DxSpot Entity wenn fetchDxSpots keine Spots zurückgibt",
  "Fix v0.9029: Layer-Panel OVERLAY-EBENEN — alle Layer sichtbar (Feature-Flag-Filter entfernt, Eye-Toggle steuert Karten-Sichtbarkeit)",
  "Rollback v0.9028: Zurück auf publizierten Stand — parallele fetch-Calls entfernt, refreshHuntingData Orchestrator wiederhergestellt",
  "Rollback v0.9028: Originales useEffect — nur loadData (DB) beim Mount, kein refreshFromApis im Hintergrund",
  "Rollback v0.9028: WWBOTA-Tab wiederhergestellt (6-Tabs-Struktur wie publiziert)",
  "Rollback v0.9028: DataSourceStatusSection nutzt wieder refreshHuntingData (keine parallelen Sub-Function-Calls)",
  "Fix v0.9034: Hunting-Seite hängt nicht mehr — loadData (schnell, DB) getrennt von refreshFromApis (langsam, API-Calls)",
  "Fix v0.9034: Mount + Auto-Refresh lesen nur aus DB (sofort sichtbar) — Refresh-Button triggert API-Calls",
  "Fix v0.9034: Kein Endlos-Loop, keine weisse Seite — Layer-Panel rendert sofort",
  "Fix v0.9033: refreshHuntingData Orchestrator umgangen — Frontend ruft Sub-Functions direkt per base44.functions.invoke() auf (kein 403 mehr)",
  "Fix v0.9033: ActivityPanel + DataSourceStatusSection rufen fetchSotaSpots/fetchPotaSpots/fetchWwffSpots/fetchDxSpots/fetchPropagation parallel auf",
  "Fix v0.9033: SOTA-Alerts via fetchSotaSpots({ alerts: true }) — keine separate Function nötig",
  "Fix v0.9033: Auto-Refresh (60s) ruft ebenfalls die einzelnen Functions auf, nicht mehr refreshHuntingData",
  "Fix v0.9032: refreshHuntingData nutzt base44.functions.invoke() (wie runDailySyncBatch) — kein 403 mehr",
  "Fix v0.9032: Sub-Functions erhalten { scheduled: true, internal_secret } im Body — Auth-Check wird übersprungen",
  "Fix v0.9032: Response-Parsing korrigiert (data-Wrapper bei functions.invoke)",
  "Fix v0.9031: refreshHuntingData ruft Sub-Functions direkt auf (keine 403 Fehler mehr)",
  "Fix v0.9031: SOTA-Alerts Endpoint korrigiert (/api/alerts/100/all/all statt /api/alerts)",
  "Fix v0.9031: QRT-Stationen werden als is_active: false gespeichert (SOTA, POTA, WWFF, GMA)",
  "Fix v0.9031: WWBOTA-Tab entfernt (Domain wwbota.ch tot, keine Spots mehr)",
  "Fix v0.9031: ActivitySpot Cleanup — Records >30min werden bei jedem Refresh gelöscht",
  "SOTA-Spots: RBNHOLE-Filter entfernt — jetzt 200 Spots (NORMAL + RBNHole) statt 50",
  "SOTA-Spots: RBNHole-Spots mit SNR/WPM-Info in den Kommentaren sichtbar",
  "APK-Download: downloadApk Backend-Function mit korrektem Content-Type (application/vnd.android.package-archive)",
  "APK-Upload: uploadApk Backend-Function mit Base64-Encoding umgeht Base44 Dateityp-Beschränkung",
  "Layer-Control: touchAction:none nur noch am Button — Panel scrollt wieder auf Mobile!",
  "Layer-Control: Outside-Click prüft containerRef statt panelRef — kein Flicker mehr beim Button-Klick",
  "Layer-Control: overscroll-contain verhindert Scroll-Bubbling zur Karte",
  "Error-Boundary: Per-Page Boundaries (Karte, Hunting, Logbuch, Einstellungen, Hilfe)",
  "Error-Boundary: name-Prop für gezielte Fehleranzeige + Neu-laden-Button pro Seite",
  "Karten-Fix: Layer verschwinden nicht mehr nach Aktivierung (eachLayer redraw entfernt)",
  "Karten-Fix: invalidateSize nur noch einmal pro Layer-Wechsel — keine Tile-Neuladung mehr",
  "Layer-Control: Aussenklick schliesst das Panel (Outside-Click Handler)",
  "Layer-Control: Panel bleibt stabil beim Drag-and-Drop (touchAction: none)",
  "Setup-Wizard: Dual-Flag-Check (setup_complete + wizard_completed) — erscheint nicht mehr erneut",
  "Setup-Wizard: safeStorage Wrapper verhindert Crash bei Private Browsing",
  "Stabilität: Global Error Handler (window.error + unhandledrejection) — kein White-Screen mehr",
  "Stabilität: ErrorBoundary bereits vorhanden um alle Hauptkomponenten",
  "Performance: Viewport-basiertes Laden bereits implementiert (ViewportDataLoader)",
  "Performance: Memoization bereits aktiv (useMemo für gefilterte Marker)",
  "Wavelog Fix: URLs (LAN+WAN) werden jetzt zuverlässig gespeichert (Debounce-Akkumulation)",
  "Wavelog Fix: onBlur Auto-Save beim Verlassen der Eingabefelder",
  "Wavelog Fix: station_info Fallback auf Station ID '1' (Wavelog 3.1.0 Bug Workaround)",
  "Wavelog Fix: Manuelle Station-ID Eingabe wenn station_info nicht verfügbar",
  "Wavelog Fix: Wahlschalter versteckt QRZ-Personal-Button wenn Backend = 'wavelog'",
  "Wavelog Fix: Club-QRZ-Button bleibt sichtbar (Ausnahme bei Club-Log-Filter)",
  "Wavelog Fix: Auto-Station-ID '1' wenn Settings geladen und keine Station-ID gesetzt",
  "Wavelog Fix: QSO-Save respektiert Wahlschalter (Wavelog Auto-Sync nach QSO-Save)",
  "Wavelog-Integration: Pro-User Settings (LAN+WAN URL, API Key, Station)",
  "Wavelog: Wahlschalter QRZ.com ODER Wavelog (nicht beides gleichzeitig)",
  "Wavelog: Ausnahme Club-QRZ bei Club-Log-Filter immer möglich",
  "Wavelog: Upload Button — alle nicht gesendeten QSOs an Wavelog senden",
  "Wavelog: Import Button — Delta-Sync mit lastfetchedid von Wavelog",
  "Wavelog: Permanent Sync — QSOs sofort an Wavelog senden (Auto-Sync)",
  "Wavelog: Offline Queue — QSOs offline loggen, automatisch bei Online gesendet",
  "Wavelog: Logbuch-Sync beim Öffnen — automatischer Delta-Import",
  "Wavelog: ADIF Konvertierung (QSO → ADIF → Wavelog API)",
  "Wavelog: Backend-Proxy vermeidet Mixed-Content Blocking (HTTP Server)",
  "Wavelog: Duplikat-Check beim Import (callsign + date + time)",
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