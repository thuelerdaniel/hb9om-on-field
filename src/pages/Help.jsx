import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Radio, BookOpen, Settings as SettingsIcon, HelpCircle, Search, Layers, Plus, Download, Archive, Pencil, Building, ChevronDown, ChevronUp, ExternalLink, Mountain, Trees, Castle, Anchor, Navigation, Filter, Wifi } from "lucide-react";

const SECTIONS = [
  {
    id: "karte",
    icon: MapPin,
    title: "Karte & Referenzen",
    color: "#3b82f6",
    description: "Die interaktive Karte zeigt Amateurfunk-Referenzpunkte in der ganzen Schweiz und Umgebung.",
    items: [
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
        body: "Über das Seitenmenü (links oben, drei Striche) können Sie verschiedene Referenz-Typen ein- und ausschalten: SOTA, POTA, HBFF, WWBOTA, Burgen, IOTA, Leuchttürme und Bundesinventare. Ausserdem können Sie die Hintergrundkarte wechseln (Strassenkarte, Satellit, SwissTopo).",
        example: "Nur SOTA-Gipfel anzeigen: Alle anderen Layer ausschalten, nur SOTA aktiv lassen."
      },
      {
        title: "Marker anklicken",
        body: "Klicken Sie auf einen Marker, um Details zu sehen: Referenz-Code, Name, Höhe, Punkte, Aktivierungsanzahl und einen externen Link zum jeweiligen Programm (SOTA, POTA, etc.).",
        example: "Klick auf einen SOTA-Gipfel → Popup zeigt Name, Höhe, Punkte und Link zu sotl.as."
      },
      {
        title: "Referenz-Typen",
        body: "Folgende Referenz-Typen werden unterstützt:",
        list: [
          { icon: Mountain, color: "#e74c3c", name: "SOTA", desc: "Summits on the Air – Berggipfel ab 150m Prominenz" },
          { icon: Trees, color: "#27ae60", name: "POTA", desc: "Parks on the Air – Nationalparks und Schutzgebiete" },
          { icon: Trees, color: "#8e44ad", name: "HBFF", desc: "Flora & Fauna Schweiz – Naturreservate" },
          { icon: Building, color: "#795548", name: "WWBOTA", desc: "Bunkers on the Air – Militärische Bunker" },
          { icon: Castle, color: "#e67e22", name: "WCA/COTA", desc: "Castles on the Air – Burgen und Schlösser" },
          { icon: Navigation, color: "#3498db", name: "IOTA", desc: "Islands on the Air – Inseln" },
          { icon: Anchor, color: "#f39c12", name: "WLOTA", desc: "Lighthouses on the Air – Leuchttürme" },
          { icon: Trees, color: "#16a085", name: "BLN/Moor", desc: "Bundesinventare – Auengebiete, Moore etc." }
        ]
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
        body: "Klicken Sie auf den schwarzen Button «Neues QSO» unten rechts. Im Formular geben Sie Rufzeichen, Datum, Zeit, Frequenz, Band, Mode und RST-Werte ein. Optionale Felder: Notizen, Standort/Referenz, Suffix. Nach dem Speichern bleibt das Formular offen, damit Sie direkt das nächste QSO erfassen können. Rufzeichen, Operator-Daten und Notizen werden zurückgesetzt, häufige Werte (Frequenz, Band, Mode, RST, Referenz) bleiben erhalten. Schliessen Sie das Formular mit «Abbrechen» oder dem X-Icon, wenn Sie fertig sind.",
        example: "Rufzeichen HB9XYZ eingeben → QRZ-Abfrage füllt Name, Adresse und Grid aus → «QSO speichern & weiter» → Formular bleibt offen für das nächste QSO."
      },
      {
        title: "QRZ.com-Abfrage",
        body: "Wenn Sie ein Rufzeichen eingeben und die QRZ-Abfrage aktiviert ist (in den Einstellungen), werden automatisch Name, Adresse, Land, Grid-Locator und E-Mail des Operators von QRZ.com geladen. Klicken Sie auf den «QRZ»-Button, um die Abfrage manuell auszulösen.",
        example: "Eingabe «HB9XYZ» + Tab-Taste oder QRZ-Button → Daten werden geladen und im blauen Kasten angezeigt."
      },
      {
        title: "Standort / Referenz erfassen",
        body: "Im Formular können Sie Ihren eigenen Standort erfassen: Wählen Sie den Referenz-Typ (SOTA, POTA, etc.), geben Sie den Referenz-Code ein oder wählen Sie aus den in der Nähe befindlichen Referenzen (wenn die Karte geöffnet ist). Für generelle Standorte ohne Referenz wählen Sie «Generell» und geben nur Ihren Maidenhead-Locator ein.",
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
        title: "Einträge löschen",
        body: "Einzelne Einträge können über das Mülleimer-Symbol gelöscht werden. Über den Button «Löschen» oben können alle aktuell gefilterten Einträge auf einmal gelöscht werden (mit Bestätigungsdialog).",
        example: "Vorsicht: Das Löschen ist unwiderruflich – besser zuerst archivieren."
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
        body: "Die QRZ.com-Abfrage ist mit einer XML-Subscription des Clubs vorkonfiguriert. Aktivieren oder deaktivieren Sie die Abfrage mit dem Schalter. Klicken Sie auf «QRZ-Verbindung testen», um zu prüfen, ob die Anmeldung funktioniert. Beim Erfassen eines QSOs werden Name, Adresse, Land, Grid-Locator und E-Mail des Operators automatisch von QRZ.com geladen.",
        example: "QRZ aktivieren → «Verbindung testen» → grünes Häkchen = funktioniert."
      },
      {
        title: "Daten aktualisieren",
        body: "Über «Alle Daten aktualisieren» werden alle Referenz-Daten (SOTA, POTA, HBFF, WWBOTA, Burgen, Leuchttürme) neu von den jeweiligen Quellen geladen. Das kann einige Minuten dauern. Der Status wird unten im Sync-Protokoll angezeigt.",
        example: "Neue SOTA-Gipfel verfügbar: «Alle Daten aktualisieren» klicken → warten bis Status «Erfolgreich»."
      },
      {
        title: "Cache-Status",
        body: "Zeigt, wie viele Referenzen pro Typ zwischengespeichert sind und wann die letzte Aktualisierung stattfand.",
        example: "SOTA: 542 Referenzen, zuletzt aktualisiert 03.07.2026."
      },
      {
        title: "QRZ-Abfrageverlauf",
        body: "Zeigt die letzten 10 QRZ-Abfragen mit Status (Erfolg/Fehler) und Uhrzeit.",
        example: "HB9XYZ – Erfolg – 14:32 Uhr"
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

function HelpSection({ section }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = section.icon;

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
            <div key={i} className="border-l-2 pl-4" style={{ borderColor: section.color + '30' }}>
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
                          <span className="font-medium text-gray-900">{entry.name}:</span>{" "}
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
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
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

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
          <p className="font-semibold mb-1">Willkommen bei HB9OM On Field!</p>
          <p className="text-blue-700 text-xs leading-relaxed">
            Diese App unterstützt Sie beim Aktivieren von Amateurfunk-Referenzen (SOTA, POTA, HBFF, etc.) 
            in der Schweiz. Sie können Referenzen auf der Karte finden, QSOs loggen und als ADIF exportieren.
            Unten finden Sie alle Funktionen mit Erklärungen und Beispielen.
          </p>
        </div>

        {/* Quick Navigation */}
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
            >
              <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              {s.title}
            </a>
          ))}
        </div>

        {SECTIONS.map(section => (
          <div key={section.id} id={section.id}>
            <HelpSection section={section} />
          </div>
        ))}

        <div className="bg-gray-100 rounded-xl p-4 text-center text-xs text-gray-500">
          <p>HB9OM On Field · Amateurfunk Referenzkarte & QSO-Logbuch</p>
          <p className="mt-1">Bei Fragen oder Problemen wenden Sie sich an den Club HB9OM.</p>
        </div>
      </div>
    </div>
  );
}