import React, { useState, useEffect } from "react";
import { Smartphone, Tablet, Monitor, RotateCcw, Save } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  detectDeviceType,
  DEFAULT_FIELD_WIDTHS,
  loadFieldWidth,
  saveFieldWidth,
} from "@/lib/deviceUtils";

// Feldbreiten-Einstellungen — v0.9019: pro Gerät (desktop/tablet/mobile) konfigurierbar.
// Sliders für jedes QSO-Formular-Feld, gespeichert in localStorage + UserHuntingSettings.

const DEVICE_TABS = [
  { id: "mobile", label: "Mobile", icon: Smartphone, color: "#3b82f6" },
  { id: "tablet", label: "Tablet", icon: Tablet, color: "#8b5cf6" },
  { id: "desktop", label: "Desktop", icon: Monitor, color: "#10b981" },
];

const FIELDS = [
  { id: "callsign", label: "Rufzeichen", min: 20, max: 100 },
  { id: "frequency", label: "Frequenz", min: 15, max: 100 },
  { id: "mode", label: "Modus", min: 15, max: 100 },
  { id: "band", label: "Band", min: 15, max: 100 },
  { id: "rst_sent", label: "RST gesendet", min: 15, max: 100 },
  { id: "rst_received", label: "RST erhalten", min: 15, max: 100 },
];

export default function FieldWidthSettings({ settings, onSaveSettings }) {
  const [activeDevice, setActiveDevice] = useState(detectDeviceType());
  const [widths, setWidths] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Feldbreiten für das aktive Gerät laden
  useEffect(() => {
    const loaded = {};
    for (const f of FIELDS) {
      loaded[f.id] = parseInt(loadFieldWidth(f.id)) || parseInt(DEFAULT_FIELD_WIDTHS[activeDevice]?.[f.id] || "100");
    }
    setWidths(loaded);
    setHasChanges(false);
  }, [activeDevice]);

  const handleSliderChange = (fieldId, value) => {
    const newWidth = value[0];
    setWidths(prev => ({ ...prev, [fieldId]: newWidth }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // In localStorage speichern (sofort wirksam)
    for (const f of FIELDS) {
      saveFieldWidth(f.id, `${widths[f.id]}%`);
    }
    // In UserHuntingSettings speichern (server-side Sync)
    if (onSaveSettings) {
      const fieldWidthsForDevice = {};
      for (const f of FIELDS) {
        fieldWidthsForDevice[f.id] = `${widths[f.id]}%`;
      }
      const currentUiSettings = settings?.ui_settings || {};
      const updatedFieldWidths = {
        ...(currentUiSettings.field_widths || {}),
        [activeDevice]: fieldWidthsForDevice,
      };
      onSaveSettings({
        ui_settings: {
          ...currentUiSettings,
          field_widths: updatedFieldWidths,
        },
      });
    }
    setHasChanges(false);
  };

  const handleReset = () => {
    const defaults = {};
    for (const f of FIELDS) {
      const def = parseInt(DEFAULT_FIELD_WIDTHS[activeDevice]?.[f.id] || "100");
      defaults[f.id] = def;
      saveFieldWidth(f.id, `${def}%`);
    }
    setWidths(defaults);
    setHasChanges(true);
  };

  const activeTab = DEVICE_TABS.find(t => t.id === activeDevice);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Feldbreiten pro Gerät</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            QSO-Formular Feldbreiten für jedes Gerät einzeln einstellen
          </p>
        </div>
      </div>

      {/* Device-Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {DEVICE_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveDevice(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeDevice === t.id
                  ? "bg-foreground/5 text-foreground border-b-2"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={activeDevice === t.id ? { borderBottomColor: t.color, color: t.color } : {}}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        {FIELDS.map(f => (
          <div key={f.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">{f.label}</label>
              <span className="text-xs text-muted-foreground font-mono">{widths[f.id] || 100}%</span>
            </div>
            <Slider
              value={[widths[f.id] || 100]}
              onValueChange={(v) => handleSliderChange(f.id, v)}
              min={f.min}
              max={f.max}
              step={5}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          <Save className="w-3 h-3" />
          Speichern
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Standard
        </button>
      </div>

      {/* Preview */}
      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
        <div className="text-[10px] text-muted-foreground mb-2">Vorschau ({activeTab?.label})</div>
        <div className="flex flex-wrap gap-1.5">
          {FIELDS.map(f => (
            <div
              key={f.id}
              className="px-2 py-1 text-[10px] rounded bg-background border border-border text-foreground text-center"
              style={{ width: `calc(${widths[f.id] || 100}% - 4px)`, minWidth: "40px" }}
            >
              {f.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}