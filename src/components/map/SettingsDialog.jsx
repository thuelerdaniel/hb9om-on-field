import React, { useState, useEffect } from "react";
import { X, Settings, ExternalLink, Radio, Map, BookOpen } from "lucide-react";

const PROGRAM_REFERENCES = [
  {
    id: "sota",
    label: "SOTA – Summits on the Air",
    website: "https://www.sotadata.org.uk/",
    regulations: "https://www.sota.org.uk/SOTA_Info/Summit_info/Operating_rules",
    referenceList: "https://www.sotlas.org/ or https://api2.sota.org.uk/api/summits/HB",
    description: "Gipfel-Aktivierungen mit Punkten je nach Höhe"
  },
  {
    id: "pota",
    label: "POTA – Parks on the Air",
    website: "https://parksontheair.com/",
    regulations: "https://parksontheair.com/pota-activate-rules.html",
    referenceList: "https://pota.app/#/map",
    description: "Naturparks und Schutzgebiete"
  },
  {
    id: "hbff",
    label: "HBFF – HFF Flora & Fauna",
    website: "https://hbff.ch/",
    regulations: "https://hbff.ch/reglement.htm",
    referenceList: "https://hbff.ch/referenzen.htm",
    description: "Schweizer Naturschutzgebiete"
  },
  {
    id: "wwbota",
    label: "WWBOTA – World Wide Bunkers on the Air",
    website: "https://wwbota.net/",
    regulations: "https://wwbota.net/rules/",
    referenceList: "https://wwbota.net/map/",
    description: "Bunker und Festungswerke"
  },
  {
    id: "wca",
    label: "WCA – World Castles Award",
    website: "https://wcagroup.com/",
    regulations: "https://wcagroup.com/wca-rules/",
    referenceList: "https://castle-map.infs.ch/",
    description: "Burgen und Schlösser weltweit"
  },
  {
    id: "cota",
    label: "COTA – Castles/Cities on the Air",
    website: "https://cota.org.uk/",
    regulations: "https://cota.org.uk/rules/",
    referenceList: "https://cota.org.uk/references/",
    description: "Burgen und historische Stätten"
  },
  {
    id: "iota",
    label: "IOTA – Islands on the Air",
    website: "https://www.iota-world.org/",
    regulations: "https://www.iota-world.org/iota-rules.html",
    referenceList: "https://www.iotamaps.com/",
    description: "Insel-Referenzen weltweit"
  },
  {
    id: "wlota",
    label: "WLOTA – World Lighthouses on the Air",
    website: "https://wlota.org/",
    regulations: "https://wlota.org/rules/",
    referenceList: "https://wlota.org/lighthouse-list/",
    description: "Leuchttürme weltweit"
  },
  {
    id: "illw",
    label: "ILLW – International Lighthouse Lightship Weekend",
    website: "https://illw.net/",
    regulations: "https://illw.net/index.php?option=com_content&view=article&id=12",
    referenceList: "https://illw.net/index.php?option=com_content&view=category&id=34",
    description: "Internationales Leuchtturm-Wochenende"
  }
];

const SCALE_OPTIONS = [
  { value: "auto", label: "Automatisch (zoom-abhängig)" },
  { value: 10000, label: "1:10'000" },
  { value: 25000, label: "1:25'000" },
  { value: 50000, label: "1:50'000" },
  { value: 100000, label: "1:100'000" }
];

const DEFAULT_SETTINGS = {
  callsign: "",
  operatorName: "",
  defaultPower: 5,
  defaultMode: "FM",
  scaleMode: "auto",
  scaleValue: 25000
};

export default function SettingsDialog({ open, onClose, settings, onSave }) {
  const [local, setLocal] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    if (settings) setLocal({ ...DEFAULT_SETTINGS, ...settings });
  }, [settings, open]);

  if (!open) return null;

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-gray-900">Grundeinstellungen</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* Operator settings */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" /> Operator / Station
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Rufzeichen (eigenes)</label>
                <input
                  type="text"
                  value={local.callsign}
                  onChange={(e) => setLocal({ ...local, callsign: e.target.value.toUpperCase() })}
                  placeholder="z.B. HB9OM"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Operator-Name</label>
                <input
                  type="text"
                  value={local.operatorName}
                  onChange={(e) => setLocal({ ...local, operatorName: e.target.value })}
                  placeholder="Name"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Standard Sendeleistung (W)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={local.defaultPower}
                  onChange={(e) => setLocal({ ...local, defaultPower: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Standard Betriebsart</label>
                <select
                  value={local.defaultMode}
                  onChange={(e) => setLocal({ ...local, defaultMode: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                >
                  {["FM", "SSB", "CW", "FT8", "FT4", "RTTY", "PSK31", "AM", "DIGI"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Scale default */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-1.5">
              <Map className="w-3.5 h-3.5" /> Standard Kartenmassstab
            </h3>
            <select
              value={local.scaleMode === "auto" ? "auto" : local.scaleValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "auto") setLocal({ ...local, scaleMode: "auto" });
                else setLocal({ ...local, scaleMode: "manual", scaleValue: parseInt(v) });
              }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
            >
              {SCALE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </section>

          {/* Program references */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> On-The-Air Programme – Referenzen, Websites & Reglemente
            </h3>
            <div className="space-y-2">
              {PROGRAM_REFERENCES.map(p => (
                <div key={p.id} className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{p.label}</p>
                      <p className="text-xs text-gray-500">{p.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <a href={p.website} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100">
                      <ExternalLink className="w-3 h-3" /> Website
                    </a>
                    <a href={p.regulations} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-md hover:bg-amber-100">
                      <ExternalLink className="w-3 h-3" /> Reglement
                    </a>
                    <a href={p.referenceList} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md hover:bg-green-100">
                      <ExternalLink className="w-3 h-3" /> Referenzliste
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Abbrechen
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

export { PROGRAM_REFERENCES, SCALE_OPTIONS, DEFAULT_SETTINGS };