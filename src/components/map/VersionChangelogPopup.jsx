import React, { useState, useEffect } from "react";
import { X, Gift, Check, Eye, AlertTriangle } from "lucide-react";
import { APP_VERSION } from "@/lib/constants";

const STORAGE_KEY = "hb9om_changelog_seen";
const DISMISS_KEY = "hb9om_changelog_dismissed";

export const VERSION_CHANGELOG = [
  {
    version: "0.9010",
    title: "Mobil-Tab — High-Schwelle, Touch-Ziele, Auto-Zoom, Offset-Fix, Blinken",
    changes: [
      "High-Badge Schwelle auf 1500m ü.M. erhöht (vorher 1000m)",
      "Stop + Coverage-Toggle Buttons vergrößert (min 44x44px Touch-Ziel)",
      "Auto-Zoom Button auf Karte (unten-rechts) — fitBounds(GPS + Repeater + Route)",
      "Offset-Normalisierung — fehlerhafte offset_mhz Werte in Anzeige korrigiert",
      "Empfangsfrequenz (Input) im Detail-Panel — klein, grau, mit Pfeil",
      "Selektierter Repeater blinkt auf Karte (rot umrandet, fillOpacity toggle)",
      "normalizeRepeaterOffsets Backend-Function — korrigiert alle Offsets in DB (Admin)",
    ],
  },
  {
    version: "0.9009",
    title: "Mobil-Tab — Liste nach unten, Repeater-Auswahl, High-Badge",
    changes: [
      "Repeater-Liste nach unten verschoben (unter die Karte) — Layout: Panel → Karte → Liste",
      "Repeater aus Liste antippen → wird aktiver Repeater (Detail-Panel + Abdeckung + Marker-Highlight)",
      "Repeater-Liste begrenzt — 15 nächste + High-Repeater (elevation_m > 1000m) mit 🏔 Badge",
    ],
  },
  {
    version: "0.9008",
    title: "Mobil-Tab Fixes — Google Maps Import, Layout, Abdeckung",
    changes: [
      "resolveGoogleMapsLink: Extrahiert jetzt ALLE Waypoints (Start + Zwischenhalt + Ziel) aus Google Maps Links",
      "Layout getauscht: Repeater-Panel OBEN, Repeater-Liste MITTE, Karte UNTEN (~40%) im Start-Modus",
      "Repeater-Abdeckung zeigt Terrain-Polygon (coverage_polygon) statt nur Kreis — grün/orange nach Reichweite",
      "Eigene Reichweite Polygon-Extraktion repariert (GeoJSON coordinates[0] statt ganzes Objekt)",
    ],
  },
  {
    version: "0.9007",
    title: "Mobil-Tab Komplett-Neuimplementierung",
    changes: [
      "Start-Modus: 'Start' Button versteckt alle Konfiguration, zeigt nur Header + Karte + Repeater",
      "Equipment-Typ Auswahl: Mobil (Auto, 50W) oder Portable (Handheld, 5W) statt festem Slider",
      "Dynamische Reichweitenberechnung: 2m Mobil 80km, 70cm 50km, 10m 150km / Portable entsprechend weniger",
      "Empfohlener Repeater = nächster erreichbarer Repeater (Distanz <= Reichweite UND Modus passt)",
      "Fallback: nächstgelegener Repeater mit 'außerhalb Reichweite' Warnung falls keiner erreichbar",
      "Repeater-Abdeckung Toggle: Kreis um empfohlenen Repeater (Radius = berechnete Reichweite)",
      "Eigene Reichweite Toggle: Polygon von calculateUserCoverage, Auto-Update alle 60s mit Countdown",
      "resolveGoogleMapsLink Backend-Function: löst Short-Links (maps.app.goo.gl) serverseitig auf",
      "Einklappbare Modulations-Filter (Chevron-Pfeil) — FM, DMR, D-STAR, C4FM, System Fusion",
      "Aktiver Repeater Panel: Callsign/Frequenz groß, Offset/Tone/Mode/Band, Distanz+Richtung",
      "Repeater-Liste: scrollbar, Tippen zeigt Marker-Popup auf Karte",
      "Wake Lock aktiv solange Mobil-Tab offen, GPS watchPosition mit High-Accuracy",
    ],
  },
  {
    version: "0.9006",
    title: "Unteres Menüband — Button-Abstand reduziert",
    changes: [
      "Button-Abstand im unteren Menüband reduziert — alle Menüpunkte passen auf einen Screen",
      "Gleichbreite Buttons (flex-1) mit min. 44px Touch-Target für gute Tappbarkeit",
      "Horizontaler Scroll als Fallback falls Bildschirm zu schmal für alle Buttons",
      "Auch für Admin-User: alle Admin-Menüpunkte + Standard-Menüpunkte sichtbar ohne Scrollen",
    ],
  },
  {
    version: "0.9005",
    title: "Mobil-Tab — Routing & Live-Repeater-Modul",
    changes: [
      "Neuer Menüpunkt 'Mobil' im unteren Menüband (zwischen Logbuch und Einstellungen)",
      "Routenplanung: OSRM-Routing mit Reichweite-Korridor, Nominatim-Ortssuche, GPX-Import, Google Maps Link-Import",
      "Wegpunkte per Drag-and-Drop umordnen, Routen speichern/laden (pro User)",
      "Repeater-Filter nach Betriebsmodus (FM, DMR, D-STAR, C4FM, etc.), Band und Reichweite (5-100 km)",
      "Repeater-Liste sortiert nach Streckenabschnitt mit PDF-Export zum Funkgerät-Programmieren",
      "Live-Modus: Empfohlener Repeater prominent angezeigt (Callsign/Frequenz/Offset/Tone groß)",
      "GPS watchPosition mit High-Accuracy, pulsierender GPS-Marker, Accuracy-Kreis, Auto-Zentrierung",
      "Wake Lock aktiv solange Mobil-Tab offen, GPS-Aktualisierung im Hintergrund",
    ],
  },
  {
    version: "0.9004",
    title: "Logbuch Bugfixes — Löschen, Dedup & Duplikat-Bereinigung",
    changes: [
      "Logbuch Löschen: Bestätigungs-Dialog pro Eintrag mit Rufzeichen + Datum + Club-Warnung",
      "Batch-Löschung: 'Select All / Delete Selected' Modus für mehrere Einträge gleichzeitig",
      "Wavelog Voll-Import: Normalisierter Dedup-Key (Suffix-Stripping /P/M/PM/MM + Zeit HH:MM)",
      "Wavelog Voll-Import: Progress-Tracking in AppSetting nach jeder Seite",
      "QRZ Club-Log: Normalisierter Dedup-Key verhindert Duplikate durch Format-Unterschiede",
      "cleanupLogDuplicates: Backend-Function zum Bereinigen existierender Duplikate (Admin)",
    ],
  },
  {
    version: "0.9003",
    title: "LLOTA-Integration, SwissTopo-Grenzen & Hunting-Fixes",
    changes: [
      "LLOTA-Integration: 8.357 Seen und Lagunen in 54 Ländern weltweit (llota.app)",
      "Neue Karten-Ebene 'LLOTA' mit Wassertropfen-Markern, Aktivierungs-Status und Länder-Filter",
      "Live-Spots: Merge von llota.app API + Spothole (mit Koordinaten-Anreicherung)",
      "Hunting-Tab 'LLOTA' mit Live-Spot-Aktivitäten, Auto-Refresh 60s, Sortierung nach Zeit/Score",
      "QSO-Logger: my_reference_type 'llota' — ADIF-Export mit MY_SIG=LLOTA, MY_SIG_INFO=LLXX-0001",
      "SwissTopo BLN-Grenzen für POTA-Parks in der Schweiz (offizielles Bundesinventar-Polygon)",
      "POTA-Filter: Alle-Grenzen-Schalter und Grenzen-Entfernen-Button",
      "Grenz-Polygone blockieren keine Marker-Klicks mehr (interactive: false)",
      "Spot-Konsolidierung: Gleicher Call + Frequenz = ein Eintrag mit 'Nx' Badge — keine Duplikate mehr",
      "Mobile Tabelle: 6 Spalten ohne horizontales Scrollen (CALL, FREQ, MODE, DIST, SCORE, ACTIONS)",
      "DX Opportunity klickbar: Klick scrollt zum Spot in der Tabelle mit gelbem Highlight",
      "QSO loggen aus Spot-Detail: Grüner Button mit QRZ-Daten-Vorausfüllung + QRZ.com-Link",
      "Priority DX: Konsolidiert nach Call + Frequenz — max. 5 einzigartige Einträge",
      "Hear-Score differenziert: Kontinuierliche Distanz, Alter, Confidence, Band — nicht mehr alle 100",
      "SOTA API: Mehrere Endpunkte + CORS-Proxy Fallback — zuverlässigere Spot-Ladung",
      "DX-Spot-Backend: Löscht alle Spots vor Neuladen — keine Duplikat-Akkumulation mehr",
      "Fox-Modus QSO-Button: Verschiebbar wie im Hunting-Modus (gleiche grüne Komponente)",
    ],
  },
  {
    version: "0.9002",
    title: "Karten-Stabilität & Zoom-Fix",
    changes: [
      "Karten-Fix: Stabile Container-Keys verhindern _leaflet_pos-Fehler bei View-Wechseln",
      "Zoom-Animation deaktiviert: Keine Abstürze mehr beim Schliessen von Modalen oder Seitenwechsel während Zoom",
      "QSO-Weltkarte: Sauberes Umschalten zwischen Globus und 2D-Karte ohne Karten-Neuaufbau",
      "Spot-Details und Fox-Hunt-Modal: Karte bleibt stabil beim Zoomen und sofortigen Schliessen",
    ],
  },
  {
    version: "0.9001",
    title: "Hunting-Modul, Live SOTA/POTA-Aktivierungen & GPS-Tracking",
    changes: [
      "Hunting-Modul: Live DX-Spots mit GPS-basierter Distanz- und Azimuth-Berechnung",
      "Activity Panel: Live SOTA- und POTA-Aktivierungen mit Auto-Refresh (60 Sekunden)",
      "Propagation-Dashboard: Solar Flux, K-Index, MUF und Band-Conditions von NOAA SWPC",
      "Fox Hunting: Peilung mit Azimuth-Slider, Feldstärke und Triangulation auf der Karte",
      "QSO loggen: Direkt aus DX-Spot oder Activity-Spot — Formular wird vorausgefüllt",
      "QRZ-Lookup: Klick auf Rufzeichen in der Spot-Tabelle öffnet Operator-Details",
      "Priority DX: Top 5 weiteste DX-Spots nach Distanz sortiert",
      "GPS-Tracking: Live-Position vom Gerät überschreibt statischen Stations-Locator",
      "GPS-Tracking: Alle Distanz- und Azimuth-Berechnungen nutzen echte GPS-Koordinaten",
      "ActivitySpot: Neue Datenstruktur für SOTA/POTA-Aktivierungen mit API-Fetchern",
      "POTA/SOTA API: Live-Aktivierungen von api.pota.app und api2.sota.org.uk",
      "Frequenz-Korrektur: POTA API gibt Hz zurück — korrekte kHz-Konvertierung",
      "SpotDetailsModal: Unterstützt DxSpot und ActivitySpot mit Karte und Peillinie",
      "Theme-aware: Hunting-Komponenten folgen globalem Dark/Light-Mode",
      "Build-Optimierung: Vendor-Chunks aufgeteilt für schnelleres Laden und Caching",
    ],
  },
  {
    version: "0.87",
    title: "Abdeckungs-Dialog verschiebbar, Verlauf & Öffentliche Position",
    changes: [
      "Abdeckungs-Dialog: Fenster frei verschiebbar — Header ziehen zum Neu positionieren",
      "Antennenhöhe: Slider + Zahleneingabe für präzise Anpassung der Antennenhöhe",
      "Berechnungs-Verlauf: Mehrere Berechnungen werden gespeichert — einzeln ladbar und löschbar",
      "Neu berechnen: Abfrage wie viele der vorgängigen Berechnungen behalten werden sollen",
      "Öffentliche Position: GPS-Standort als öffentlich markieren — alle Benutzer sehen die Position auf der Karte",
      "Öffentliche Position: Automatischer Refresh gemäss GPS-Intervall-Einstellung in den Settings",
      "Karte: Öffentliche Positionen aller Benutzer mit Rufzeichen-Popup und Zeitstempel",
    ],
  },
  {
    version: "0.86",
    title: "Passwort-Sicherheit, Demo-Beschränkungen & Konfigurations-Status",
    changes: [
      "Passwort-Sichtbarkeit: Alle Passwort-Felder mit Augen-Button zum Ein-/Ausblenden",
      "Verbindungs-Tests: APRS.fi, RepeaterBook, BrandMeister und QRZ direkt in den Einstellungen testbar",
      "BrandMeister-Login: Persönliche oder Club-Zugangsdaten für DMR-Daten konfigurierbar",
      "Zugangsdaten-Priorität: Auswahl ob persönliche oder Club-Daten für App-Abfragen verwendet werden",
      "Demo-Konto: Eingabefelder gesperrt, Backup/Restore und QRZ-Upload ausgegraut mit Hinweis",
      "Konfigurations-Status: Fortschrittsbalken zeigt fehlende Konfigurationen mit direkten Links",
      "Einklappbare Menüs: Offline-Modus, Karte & Anzeige und Datensicherung per Default zugeklappt",
      "Hilfe-Links: Jeder Einstellungs-Bereich hat direkten Link zur entsprechenden Hilfe-Sektion",
      "Hilfe-Erweiterung: Konfigurations-Beispiele mit Links zu QRZ, APRS.fi, RepeaterBook und BrandMeister",
    ],
  },
  {
    version: "0.85",
    title: "Terrain-Abdeckung, Meine Abdeckung & Relais-Performance",
    changes: [
      "Terrain-LOS Abdeckung: SRTM 30m Höhendaten, Fresnel-Zone & Link-Budget für Relais-Abdeckung",
      "Meine Abdeckung berechnen: GPS, QTH-Locator oder Kartenklick → asymmetrisches Polygon mit 36 Radialen",
      "Position auf Karte setzen: Kartenklick-Modus im Abdeckungs-Dialog (Dialog wird ausgeblendet)",
      "Positionskorrektur: Position-Marker im Verschiebe-Modus dragbar",
      "Relais-Performance: Automatischer Wechsel auf CircleMarker bei >500 Stationen — keine weissen Screens mehr",
      "Admin: Weltweite Abdeckungs-Stats mit %-Angabe und Fortschrittsbalken",
      "Admin: Einzelne Relais-Abdeckung direkt im Popup berechnen oder neu berechnen",
      "Admin: Cron-Job-View für Abdeckungs-Berechnung mit inkrementeller Konfiguration",
      "Popup: 'Noch nicht berechnet' Hinweis wenn keine Abdeckung vorhanden",
    ],
  },
  {
    version: "0.82",
    title: "TOTA weltweit, IOTA erweitert & Multi-Filter",
    changes: [
      "TOTA weltweit: 5315 Türme & Antennen von wwtota.com importiert — Aussichtstürme und Sendetürme in aller Welt",
      "IOTA erweitert: 326 Inselgruppen (vorher 228) — Afrika, Asien, Nord- und Südamerika, Ozeanien ergänzt via KI-Geocodierung",
      "Multi-Select Länder-Filter: TOTA, APRS und BrandMeister jetzt mit mehrfacher Länder- und Kontinent-Auswahl (wie SOTA/POTA)",
      "Leuchttürme laden sofort: Alle 9753 Leuchttürme aus ReferenceData statt auf Hintergrund-Fetch zu warten",
      "Stabile Zähler: ReferenceData.total_count als autoritative Gesamtzahl — keine springenden Zähler mehr zwischen Paginierungsläufen",
      "Paginierung repariert: id-basierte Sortierung für Relais (31000+) und APRS-Nodes — deterministisch, keine Duplikate oder fehlende Datensätze",
      "Legende bereinigt: Irreführende Referenz-Anzahl aus der Legende entfernt",
    ],
  },
  {
    version: "0.81",
    title: "Leuchtturm-Scraper sequenziell, Relais-Länder-Filter & Daten-Zähler",
    changes: [
      "Leuchtturm-Scraper auf 15 sequenzielle Regionen aufgeteilt — keine Timeouts mehr, einzelne Regionen im Aktualisierungsplan triggerbar",
      "Relais-Länder-Filter repariert: Alle 31000+ Relais werden geladen (vorher nur 10000) — alle Länder wieder auswählbar",
      "Daten-Zähler konsistent: Layer-Auswahl, Filter und Daten-Cache Übersicht zeigen jetzt die gleiche Gesamtzahl",
      "Auto-Geocodierung: Relais ohne Koordinaten können aus Ortsnamen via OpenStreetMap Nominatim geocodiert werden (markiert als 'ungenaue Position')",
      "Splash-Screen zeigt Datenbank-Zähler: 'Momentan pflegen wir XXXXX Datensätze in der App'",
      "Leuchttürme: Mehr als 6 auf der Karte — sequenzieller Scraper pro Region löst das Timeout-Problem",
    ],
  },
  {
    version: "0.8",
    title: "Weltweite Referenzen, Nordamerika-Relais & Performance",
    changes: [
      "SOTA, POTA, WWFF, WWBOTA und Burgen jetzt weltweit — keine Schweizer-Begrenzung mehr",
      "WWFF ersetzt HBFF: 40'000+ Flora-Fauna-Referenzen weltweit mit Koordinaten von wwff.co",
      "WWBOTA weltweit: Alle Bunker-Schemata (HBBOTA, DFBOTA, GBBOTA etc.) geladen",
      "RepeaterBook jetzt mit USA (50 Bundesstaaten + DC) und Kanada (13 Provinzen) — eigene Nordamerika-URL-Struktur",
      "Relais-Symbol aktualisiert: Turm mit Blitz — farbig nach Modulation",
      "IOTA-Inseln weltweit integriert",
      "Kontinent-Filter um Länder erweitert — einzelne Länder oder Mix auswählbar",
      "Marker-Sortierung nach Distanz: Schweizer Gipfel werden zuverlässig angezeigt auch bei 180'000+ weltweiten Referenzen",
      "Lade-Indikator mit Abbrechen-Button: Datenladung kann jederzeit abgebrochen werden",
      "Admin: Pro-Relais Web-Link ergänzen und Abdeckungsberechnung anstossen (Button im Popup)",
      "Admin: Abdeckungs-Berechnung um USA, Kanada, Japan, Australien, Brasilien erweitert",
      "Admin: Externe Datenquellen-Liste mit PDF-Export",
      "Pro-Benutzer APRS.fi API-Key in den Einstellungen konfigurierbar",
      "RepeaterBook-Daten für 68+ Länder (Spanien, Italien, UK, Irland u.v.m.)",
      "POTA: Inkrementelles Speichern nach jedem Batch — keine Datenverluste mehr bei Timeout",
      "Splash-Screen und Hilfe aktualisiert für weltweite Abdeckung",
      "Sicherheits-Audit: Auth-Checks für alle Backend-Funktionen",
      "Restore-Point-System: Admins können Wiederherstellungspunkte erstellen und zurückspielen",
      "Relais-Datenquelle erweitert: ukrepeater.net (751 UK-Relais mit Koordinaten via Maidenhead-Locator)",
      "Relais-Refresh optimiert: Timeout-Fehler behoben, mehr Länder mit Koordinaten",
      "Admin: API-Key-Verwaltung — globale Keys (QRZ, APRS.fi, BrandMeister) für Admins & Demo, persönliche Keys pro Admin mit Lösch-Warnung",
      "Admin: BrandMeister API-Key Support für DMR-Relais, Talkgroups und Crosslinks",
      "Admin: Pro-Admin E-Mail-Report Einstellungen — separater Report pro Admin, separate E-Mail-Adresse mit Verifikation, Test-Report auslösbar",
      "Admin: Club-Rufzeichen-Verwaltung — zentraler Reiter für Club-Konfiguration (HB9OM), QRZ-API-Key für Club-Rufzeichen",
      "Admin: Toggle zwischen globalen und persönlichen API-Keys (QRZ, APRS.fi, BrandMeister) — nur für Admins, normale User behalten eigene Angaben",
      "Admin: Daten-Cache-Zähler korrigiert — direkte Entity-Zählung für SOTA, POTA, WWFF und Leuchttürme (statt veralteter total_count)",
      "Admin: Relais-Update-Fehlermeldungen detaillierter — Schritt-Information, SyncLog-Eintrag bei Fehlern, klarere deutsche Texte",
      "Admin: Terminologie harmonisiert — einheitlich 'Relais' statt 'Repeater' in allen Admin-Anzeigen und Fehlermeldungen",
    ],
  },
];

export function hasSeenCurrentChangelog() {
  try {
    return localStorage.getItem(STORAGE_KEY) === APP_VERSION;
  } catch { return false; }
}

export function markChangelogSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, APP_VERSION);
  } catch {}
}

export function isChangelogPermanentlyDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch { return false; }
}

export function setChangelogPermanentlyDismissed(value) {
  try {
    localStorage.setItem(DISMISS_KEY, String(value));
  } catch {}
}

export function resetChangelog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DISMISS_KEY);
  } catch {}
}

export default function VersionChangelogPopup({ onClose }) {
  const [visible, setVisible] = useState(true);

  const handleClose = () => {
    setVisible(false);
    markChangelogSeen();
    setTimeout(() => onClose && onClose(), 300);
  };

  const handleDontShowAgain = () => {
    setChangelogPermanentlyDismissed(true);
    handleClose();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Was ist neu in v{APP_VERSION}?</h2>
              <p className="text-slate-400 text-xs">Massgebliche Anpassungen seit v0.75</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {VERSION_CHANGELOG.map((entry, idx) => (
            <div key={idx}>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold">
                  v{entry.version}
                </span>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{entry.title}</h3>
              </div>
              <ul className="space-y-2">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Data sources note */}
        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              <strong>Hinweis:</strong> Es sind noch nicht alle Datenquellen eingefügt und abgefragt. Es ist möglich, dass für bestimmte Kontinente oder Länder noch keine Informationen verfügbar sind. Die Datenbank wird laufend erweitert.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col gap-2">
          <button
            onClick={handleClose}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg py-2.5 font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Verstanden
          </button>
          <button
            onClick={handleDontShowAgain}
            className="w-full text-slate-500 dark:text-slate-400 text-xs hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            Nicht mehr anzeigen (in Hilfe reaktivierbar)
          </button>
        </div>
      </div>
    </div>
  );
}