import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Wifi, Download, Database, Radio, MapPin, Settings as SettingsIcon, CheckCircle2, Circle, ArrowRight, HardDrive, Cloud, User, Loader2, Check } from "lucide-react";
import { getOfflineReadiness, getLocalCacheStats } from "@/lib/offlineDataCache";
import { getOfflineAreas } from "@/lib/offlineMapStore";

const STORAGE_KEY = "hb9om_offline_checklist";

// Schritte fuer 100% Offline-Betrieb
// Jeder Schritt hat: id, title, description, icon, link (wo in der App), linkLabel
const STEPS = [
  {
    id: "profile",
    title: "Rufzeichen im Profil erfassen",
    description: "Ohne Rufzeichen kann die App nicht vollständig genutzt werden (QSO-Formular, Clubstation).",
    icon: User,
    link: "/settings",
    linkLabel: "Zu den Einstellungen",
    check: (readiness) => true, // immer erfuellt wenn eingeloggt — FirstTimeSetup erzwingt es
  },
  {
    id: "refs_all",
    title: "Alle Referenz-Layer herunterladen",
    description: "SOTA, POTA, WWFF, WWBOTA, Burgen, IOTA und Leuchttürme lokal speichern. In den Einstellungen unter «Offline-Modus & lokaler Speicher» den Button «Alle laden» antippen.",
    icon: Database,
    link: "/settings",
    linkLabel: "Zu Offline & Speicher",
    check: (readiness) => readiness.allRefs,
  },
  {
    id: "repeaters",
    title: "Relais-Daten herunterladen",
    description: "Amateurfunk-Relais lokal speichern für Offline-Nutzung. In den Einstellungen unter «Offline-Modus» bei «Amateurfunk-Relais» den Download-Button antippen.",
    icon: Radio,
    link: "/settings",
    linkLabel: "Zu Offline & Speicher",
    check: (readiness) => readiness.repeater,
  },
  {
    id: "aprs",
    title: "APRS-Nodes herunterladen",
    description: "Private APRS-Nodes (Hotspots, Digipeater, Wetterstationen) lokal speichern. In den Einstellungen unter «Offline-Modus» bei «APRS – Private Nodes» den Download-Button antippen.",
    icon: Wifi,
    link: "/settings",
    linkLabel: "Zu Offline & Speicher",
    check: (readiness) => readiness.private_nodes,
  },
  {
    id: "qrz",
    title: "QRZ.com-Abfragen zwischenspeichern",
    description: "Bereits abgefragte QRZ-Daten lokal speichern, damit Operator-Info auch offline verfügbar ist. In den Einstellungen unter «Offline-Modus» bei «QRZ.com Abfragen» den Download-Button antippen.",
    icon: User,
    link: "/settings",
    linkLabel: "Zu Offline & Speicher",
    check: (readiness) => readiness.qrz,
  },
  {
    id: "map_tiles",
    title: "Offline-Karten herunterladen",
    description: "Kacheln für Ihr Einsatzgebiet herunterladen, damit die Hintergrundkarte offline angezeigt wird. Auf der Karte den Download-Button (links) antippen und Gebiet + Zoom-Stufen wählen.",
    icon: MapPin,
    link: "/",
    linkLabel: "Zur Karte",
    check: (readiness, offlineAreas) => readiness.mapTiles || (offlineAreas && offlineAreas.length > 0),
  },
  {
    id: "backup",
    title: "Backup erstellen",
    description: "Ein lokales Backup (JSON-Datei) sichert Ihr Logbuch und alle Einstellungen. In den Einstellungen unter «Datensicherung» den Button «Backup» antippen.",
    icon: Cloud,
    link: "/settings",
    linkLabel: "Zu Datensicherung",
    check: () => false, // wird manuell abgehakt
  },
  {
    id: "offline_mode",
    title: "Offline-Modus testen",
    description: "Aktivieren Sie den Offline-Modus (Wifi-Icon auf der Karte oder Schalter in den Einstellungen) und prüfen Sie, ob alle Daten und die Karte korrekt angezeigt werden.",
    icon: Wifi,
    link: "/",
    linkLabel: "Zur Karte",
    check: () => false, // wird manuell abgehakt
  },
];

export default function OfflineChecklist() {
  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [readiness, setReadiness] = useState(() => getOfflineReadiness());
  const [stats, setStats] = useState(() => getLocalCacheStats());
  const [offlineAreas, setOfflineAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lade Offline-Bereiche und aktualisiere Readiness
  useEffect(() => {
    getOfflineAreas().then(areas => {
      setOfflineAreas(areas || []);
      setReadiness(prev => ({ ...prev, mapTiles: (areas && areas.length > 0) }));
      setLoading(false);
    }).catch(() => setLoading(false));

    // Aktualisiere Stats periodisch (falls in anderen Tab Daten geladen werden)
    const interval = setInterval(() => {
      setReadiness(getOfflineReadiness());
      setStats(getLocalCacheStats());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleStep = (id) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Berechne Fortschritt
  const completedCount = STEPS.filter(s => checked[s.id] || s.check(readiness, offlineAreas)).length;
  const totalCount = STEPS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const isComplete = completedCount === totalCount;

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 ${isComplete ? 'bg-green-50' : 'bg-blue-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}>
            {isComplete ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Wifi className="w-5 h-5 text-white" />}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-gray-900">
              {isComplete ? "100% Offline bereit! ✓" : "Offline-Checkliste – Schritt für Schritt"}
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {isComplete
                ? "Alle Schritte erledigt – die App funktioniert vollständig offline."
                : `${completedCount} von ${totalCount} Schritten erledigt – ${progressPct}%`}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-gray-900">{progressPct}%</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Storage overview */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-500 flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5" /> Lokaler Speicher
        </span>
        <span className="font-semibold text-gray-900">
          {formatSize(stats.size)} · {stats.count.toLocaleString("de-CH")} Referenzen
        </span>
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-100">
        {STEPS.map((step, idx) => {
          const isAutoChecked = step.check(readiness, offlineAreas);
          const isChecked = checked[step.id] || isAutoChecked;
          const Icon = step.icon;

          return (
            <div key={step.id} className={`px-5 py-3 ${isChecked ? 'bg-green-50/50' : ''}`}>
              <div className="flex items-start gap-3">
                {/* Checkbox / step number */}
                <button
                  onClick={() => toggleStep(step.id)}
                  className="flex-shrink-0 mt-0.5"
                  title={isChecked ? "Erledigt – klick um zurückzusetzen" : "Als erledigt markieren"}
                >
                  {isChecked ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isAutoChecked ? 'border-green-300' : 'border-gray-300'}`}>
                      <span className="text-[10px] font-bold text-gray-400">{idx + 1}</span>
                    </div>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isChecked ? 'text-green-500' : 'text-gray-400'}`} />
                    <h3 className={`text-sm font-semibold ${isChecked ? 'text-green-700' : 'text-gray-900'}`}>
                      {step.title}
                    </h3>
                    {isAutoChecked && !checked[step.id] && (
                      <span className="px-1.5 py-0.5 text-[9px] bg-green-100 text-green-700 rounded-full font-medium flex-shrink-0">
                        automatisch erkannt
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {step.description}
                  </p>
                  {/* Direct link */}
                  <Link
                    to={step.link}
                    className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {step.linkLabel}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
        <p className="text-[11px] text-amber-700 leading-relaxed">
          💡 Tipp: Die Schritte 1–6 werden automatisch erkannt, sobald die entsprechenden Daten lokal gespeichert sind. Die Schritte 7 (Backup) und 8 (Offline-Modus testen) müssen manuell abgehakt werden.
        </p>
      </div>
    </div>
  );
}