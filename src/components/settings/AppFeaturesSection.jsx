import React, { useState } from "react";
import { ChevronDown, SlidersHorizontal, RotateCcw, Layers, Radio, Wrench, WifiOff, Settings2, Check } from "lucide-react";
import { useAppFeatures, DEFAULT_FEATURES, QUICK_PRESETS, applyToolDependencies } from "@/lib/appFeatures";

// Toggle definitions per category
const LAYER_TOGGLES = [
  { group: "Referenz-Punkte", items: [
    { key: "sota", label: "SOTA – Summits on the Air", desc: "Berggipfel-Referenzen" },
    { key: "pota", label: "POTA – Parks on the Air", desc: "Nationalparks und Schutzgebiete" },
    { key: "wwff", label: "WWFF / HBFF – Flora & Fauna", desc: "Naturreservate" },
    { key: "wca", label: "WCA – Burgen & Schlösser", desc: "Burgen-Referenzen" },
    { key: "bota", label: "WWBOTA – Bunkers", desc: "Militärische Bunker" },
    { key: "tota", label: "TOTA – Towers", desc: "Aussichtstürme und Antennen" },
    { key: "iota", label: "IOTA – Islands", desc: "Insel-Referenzen" },
    { key: "lighthouse", label: "Leuchttürme", desc: "WLOTA/ARLHS" },
    { key: "naturzonen", label: "Naturzonen (CH)", desc: "BLN, Moore, Vogelreservate" },
  ]},
  { group: "Relais / Repeater", items: [
    { key: "fm_funknetz", label: "FM-Funknetz (CH)", desc: "FM-Funknetz.de Talkgruppen" },
    { key: "ch_repeater_links", label: "CH-Repeater-Links", desc: "Permanente Crosslinks" },
    { key: "repeater", label: "Repeater (weltweit)", desc: "FM, DMR, D-STAR, Fusion" },
    { key: "aprs", label: "APRS – Stationen", desc: "Digipeater, IGates, Wetter" },
    { key: "brandmeister", label: "Brandmeister (DMR)", desc: "DMR-Netzwerk" },
  ]},
];

const BAND_GROUPS = [
  { group: "Kurzwelle (HF)", items: [
    { key: "160m", label: "160m", freq: "1.8 MHz" },
    { key: "80m", label: "80m", freq: "3.5 MHz" },
    { key: "60m", label: "60m", freq: "5.0 MHz" },
    { key: "40m", label: "40m", freq: "7.0 MHz" },
    { key: "30m", label: "30m", freq: "10.1 MHz" },
    { key: "20m", label: "20m", freq: "14.0 MHz" },
    { key: "17m", label: "17m", freq: "18.1 MHz" },
    { key: "15m", label: "15m", freq: "21.0 MHz" },
    { key: "12m", label: "12m", freq: "24.9 MHz" },
    { key: "10m", label: "10m", freq: "28.0 MHz" },
  ]},
  { group: "VHF / UHF", items: [
    { key: "6m", label: "6m", freq: "50 MHz" },
    { key: "2m", label: "2m", freq: "145 MHz" },
    { key: "1.25m", label: "1.25m", freq: "220 MHz" },
    { key: "70cm", label: "70cm", freq: "438 MHz" },
    { key: "33cm", label: "33cm", freq: "902 MHz" },
    { key: "23cm", label: "23cm", freq: "1297 MHz" },
  ]},
];

const TOOL_TOGGLES = [
  { group: "Karten-Werkzeuge", items: [
    { key: "fox_hunt", label: "Fox / Hunting", desc: "Fuchsjagd-Modus Umschalter" },
    { key: "legende", label: "Legende", desc: "Karten-Legende Button" },
    { key: "filter", label: "Filter-Panel", desc: "Layer-Filter Buttons" },
    { key: "zoom", label: "Zoom-Controls", desc: "Zoom-Buttons auf Karte" },
    { key: "search", label: "Suche", desc: "Referenz/Ort-Suchleiste" },
    { key: "coords", label: "Koordinaten-Anzeige", desc: "Koordinaten im Popup" },
  ]},
  { group: "Abdeckung", items: [
    { key: "repeater_coverage", label: "Repeater-Abdeckung", desc: "Abdeckungspolygone für Relais" },
    { key: "own_coverage", label: "Eigene Abdeckung", desc: "Meine Abdeckung berechnen", dependsOn: "gps" },
    { key: "gps", label: "GPS-Positionsermittlung", desc: "GPS-Button und Standort" },
    { key: "qth_locator", label: "QTH-Locator Eingabe", desc: "Locator-Feld in Abdeckung" },
    { key: "height_profile", label: "Höhenprofil", desc: "Pfad zu Repeater", dependsOn: "repeater_coverage" },
  ]},
  { group: "Funk-Betrieb", items: [
    { key: "logbook", label: "Logbuch", desc: "Logbuch-Seite und Tab" },
    { key: "statistics", label: "Statistik", desc: "QSO-Statistik" },
    { key: "qso_add", label: "QSO erfassen", desc: "Log QSO Button", dependsOn: "logbook" },
    { key: "dxcc", label: "DXCC-Tracker", desc: "DXCC-Länder-Tracker" },
  ]},
  { group: "Admin", items: [
    { key: "admin", label: "Admin-Bereich", desc: "Admin-Panel (nur Admins)" },
    { key: "json_import", label: "JSON-Import", desc: "Repeater JSON Import", dependsOn: "admin" },
    { key: "sync_status", label: "Sync-Status", desc: "Synchronisierungs-Logs", dependsOn: "admin" },
  ]},
  { group: "Anträge & Feedback", items: [
    { key: "change_requests", label: "Änderungsanträge", desc: "Meine Änderungsanträge" },
    { key: "feature_requests", label: "Funktionsvorschläge", desc: "Feature-Requests einreichen" },
  ]},
];

const OFFLINE_TOGGLES = [
  { key: "offline_mode", label: "Offline-Modus", desc: "App offline nutzbar" },
  { key: "map_download", label: "Karten-Download", desc: "Tile-Cache Download", dependsOn: "offline_mode" },
  { key: "data_download", label: "Daten-Download", desc: "Layer offline verfügbar", dependsOn: "offline_mode" },
  { key: "auto_cache", label: "Auto-Cache-Update", desc: "Automatischer Cache-Update", dependsOn: "offline_mode" },
];

// --- Toggle Switch Component ---
function ToggleSwitch({ enabled, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        disabled ? "bg-gray-200 dark:bg-slate-700 cursor-not-allowed opacity-50" :
        enabled ? "bg-green-500" : "bg-gray-300 dark:bg-slate-600"
      }`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled ? "translate-x-5" : ""}`} />
    </button>
  );
}

// --- Toggle Row ---
function ToggleRow({ label, desc, enabled, onChange, disabled, dependsOn, parentEnabled }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${disabled ? "text-gray-400 dark:text-slate-500" : "text-gray-900 dark:text-slate-100"}`}>
          {label}
        </p>
        {desc && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{desc}</p>}
        {dependsOn && !parentEnabled && (
          <p className="text-[10px] text-amber-500 mt-0.5">⚠ Erfordert "{dependsOn}" aktiv</p>
        )}
      </div>
      <ToggleSwitch enabled={enabled} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// --- Accordion Category ---
function AccordionCategory({ icon: Icon, title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Icon className="w-4 h-4 text-gray-600 dark:text-slate-400 flex-shrink-0" />
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{subtitle}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-3 space-y-0.5">{children}</div>}
    </div>
  );
}

export default function AppFeaturesSection({ isAdmin = false }) {
  const { features, setFeatures } = useAppFeatures();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [presetApplied, setPresetApplied] = useState(null);

  const updateCategory = (category, key, value) => {
    let newCategory = { ...features[category], [key]: value };
    if (category === "tools") {
      newCategory = applyToolDependencies(newCategory);
    }
    setFeatures({ ...features, [category]: newCategory });
  };

  const applyPreset = (presetName) => {
    const preset = QUICK_PRESETS[presetName];
    if (!preset) return;
    // Admin can't disable admin tools
    if (isAdmin) {
      preset.tools = { ...preset.tools, admin: true };
    }
    setFeatures(JSON.parse(JSON.stringify(preset)));
    setPresetApplied(presetName);
    setTimeout(() => setPresetApplied(null), 2000);
  };

  const handleReset = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      setTimeout(() => setResetConfirm(false), 3000);
      return;
    }
    const defaults = JSON.parse(JSON.stringify(DEFAULT_FEATURES));
    if (isAdmin) defaults.tools.admin = true;
    setFeatures(defaults);
    setResetConfirm(false);
  };

  const isToolDisabled = (tool) => {
    // Admin tools always visible for admins
    if (isAdmin && tool.key === "admin") return true;
    // Check parent dependency
    if (tool.dependsOn && !features.tools[tool.dependsOn]) return true;
    return false;
  };

  const isOfflineDisabled = (item) => {
    if (item.dependsOn && !features.offline[item.dependsOn]) return true;
    return false;
  };

  return (
    <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-700">
        <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4" /> App-Funktionen anpassen
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Blende Funktionen aus die du nicht brauchst</p>
      </div>

      {/* Quick-Buttons */}
      <div className="p-4 border-b border-gray-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-2">Schnell-Vorlagen</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "minimal", label: "Minimal", desc: "2m/70cm + Logbuch" },
            { id: "standard", label: "Standard", desc: "Alle Funktionen" },
            { id: "kw", label: "KW-Modus", desc: "Nur KW-Bänder + NVIS" },
            { id: "vhf_uhf", label: "VHF/UHF", desc: "Nur VHF/UHF-Bänder" },
            { id: "two_seventy", label: "2m/70cm", desc: "Nur 2m + 70cm" },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex flex-col items-start gap-0.5 ${
                presetApplied === p.id
                  ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                  : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className="font-semibold">{presetApplied === p.id ? "✓ " : ""}{p.label}</span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="p-4 space-y-3">
        {/* A: Karten-Layer */}
        <AccordionCategory icon={Layers} title="Karten-Layer" subtitle="Welche Layer auf der Karte sichtbar sind" defaultOpen>
          {LAYER_TOGGLES.map(cat => (
            <div key={cat.group}>
              <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mt-2 mb-1">{cat.group}</p>
              {cat.items.map(item => (
                <ToggleRow
                  key={item.key}
                  label={item.label}
                  desc={item.desc}
                  enabled={features.layers[item.key] !== false}
                  onChange={(v) => updateCategory("layers", item.key, v)}
                />
              ))}
            </div>
          ))}
        </AccordionCategory>

        {/* B: Bänder und Frequenzen */}
        <AccordionCategory icon={Radio} title="Bänder und Frequenzen" subtitle="Welche Bänder relevant sind">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button onClick={() => { const b = {}; Object.keys(DEFAULT_FEATURES.bands).forEach(k => b[k] = true); setFeatures({ ...features, bands: b }); }} className="px-2 py-1 rounded text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200">Alle Bänder</button>
            <button onClick={() => { const b = {}; Object.keys(DEFAULT_FEATURES.bands).forEach(k => b[k] = !["6m","2m","1.25m","70cm","33cm","23cm"].includes(k)); setFeatures({ ...features, bands: b }); }} className="px-2 py-1 rounded text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200">Nur VHF/UHF</button>
            <button onClick={() => { const b = {}; Object.keys(DEFAULT_FEATURES.bands).forEach(k => b[k] = ["160m","80m","60m","40m","30m","20m","17m","15m","12m","10m"].includes(k)); setFeatures({ ...features, bands: b }); }} className="px-2 py-1 rounded text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200">Nur KW</button>
            <button onClick={() => { const b = {}; Object.keys(DEFAULT_FEATURES.bands).forEach(k => b[k] = ["2m","70cm"].includes(k)); setFeatures({ ...features, bands: b }); }} className="px-2 py-1 rounded text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200">Nur 2m+70cm</button>
          </div>
          {BAND_GROUPS.map(cat => (
            <div key={cat.group}>
              <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mt-2 mb-1">{cat.group}</p>
              <div className="grid grid-cols-2 gap-x-3">
                {cat.items.map(item => (
                  <ToggleRow
                    key={item.key}
                    label={`${item.label} (${item.freq})`}
                    enabled={features.bands[item.key] !== false}
                    onChange={(v) => updateCategory("bands", item.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </AccordionCategory>

        {/* C: Werkzeuge und Funktionen */}
        <AccordionCategory icon={Wrench} title="Werkzeuge und Funktionen" subtitle="Blende Werkzeuge aus die du nicht brauchst">
          {TOOL_TOGGLES.map(cat => {
            // Hide admin category for non-admins
            if (cat.group === "Admin" && !isAdmin) return null;
            return (
              <div key={cat.group}>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mt-2 mb-1">{cat.group}</p>
                {cat.items.map(item => {
                  const disabled = isToolDisabled(item);
                  const parentEnabled = item.dependsOn ? features.tools[item.dependsOn] !== false : true;
                  return (
                    <ToggleRow
                      key={item.key}
                      label={item.label}
                      desc={item.desc}
                      enabled={features.tools[item.key] !== false}
                      onChange={(v) => updateCategory("tools", item.key, v)}
                      disabled={disabled}
                      dependsOn={item.dependsOn}
                      parentEnabled={parentEnabled}
                    />
                  );
                })}
              </div>
            );
          })}
        </AccordionCategory>

        {/* D: Offline-Funktionen */}
        <AccordionCategory icon={WifiOff} title="Offline-Funktionen" subtitle="Karten-Download und Offline-Modus">
          {OFFLINE_TOGGLES.map(item => {
            const disabled = isOfflineDisabled(item);
            const parentEnabled = item.dependsOn ? features.offline[item.dependsOn] !== false : true;
            return (
              <ToggleRow
                key={item.key}
                label={item.label}
                desc={item.desc}
                enabled={features.offline[item.key] !== false}
                onChange={(v) => updateCategory("offline", item.key, v)}
                disabled={disabled}
                dependsOn={item.dependsOn}
                parentEnabled={parentEnabled}
              />
            );
          })}
        </AccordionCategory>

        {/* E: Erweiterte Optionen */}
        <AccordionCategory icon={Settings2} title="Erweiterte Optionen" subtitle="Feintuning für erfahrene Nutzer">
          <ToggleRow label="Erweiterte Ausbreitung (Beugung + Troposcatter)" desc="ITM+ Modell" enabled={features.advanced.advanced_propagation !== false} onChange={(v) => setFeatures({ ...features, advanced: { ...features.advanced, advanced_propagation: v } })} />
          <ToggleRow label="KW-Ausbreitung (Ionosphäre / NVIS)" desc="KW-Modell aktiviert" enabled={features.advanced.kw_propagation !== false} onChange={(v) => setFeatures({ ...features, advanced: { ...features.advanced, kw_propagation: v } })} />
          <div className="py-2">
            <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Sonnenaktivität</label>
            <div className="flex gap-2 mt-1">
              {[{ v: "low", l: "Niedrig" }, { v: "medium", l: "Mittel" }, { v: "high", l: "Hoch" }].map(opt => (
                <button key={opt.v} onClick={() => setFeatures({ ...features, advanced: { ...features.advanced, solar_activity: opt.v } })} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium ${features.advanced.solar_activity === opt.v ? "bg-gray-900 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"}`}>{opt.l}</button>
              ))}
            </div>
          </div>
          <ToggleRow label="Tageszeit automatisch ermitteln" desc="Aus GPS + Systemzeit" enabled={features.advanced.auto_time !== false} onChange={(v) => setFeatures({ ...features, advanced: { ...features.advanced, auto_time: v } })} />
          <div className="py-2">
            <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Marker-Dichte</label>
            <div className="flex gap-2 mt-1">
              {[{ v: "low", l: "Niedrig" }, { v: "medium", l: "Mittel" }, { v: "high", l: "Hoch" }].map(opt => (
                <button key={opt.v} onClick={() => setFeatures({ ...features, advanced: { ...features.advanced, marker_density: opt.v } })} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium ${features.advanced.marker_density === opt.v ? "bg-gray-900 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"}`}>{opt.l}</button>
              ))}
            </div>
          </div>
          <ToggleRow label="Imperiale Einheiten" desc="Meilen/Fuss statt km/m" enabled={features.advanced.imperial === true} onChange={(v) => setFeatures({ ...features, advanced: { ...features.advanced, imperial: v } })} />
        </AccordionCategory>
      </div>

      {/* Reset Button */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-700">
        <button
          onClick={handleReset}
          className={`w-full px-4 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
            resetConfirm
              ? "bg-red-500 text-white hover:bg-red-600"
              : "border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          }`}
        >
          {resetConfirm ? <Check className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
          {resetConfirm ? "Wirklich alle einblenden?" : "Alle Funktionen einblenden"}
        </button>
      </div>
    </div>
  );
}