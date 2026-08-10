import React, { useState } from "react";
import { AlertTriangle, X, Loader2, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const FIELD_OPTIONS = [
  { value: "frequency", label: "Frequenz" },
  { value: "offset_mhz", label: "Offset" },
  { value: "tone", label: "Zugang (Tone/CTCSS)" },
  { value: "location_name", label: "Standort-Name" },
  { value: "lat_lng", label: "Koordinaten (Lat, Lng)" },
  { value: "status", label: "Betriebsstatus" },
  { value: "modes", label: "Modi (kommasepariert)" },
  { value: "band", label: "Band" },
  { value: "country", label: "Land" },
  { value: "web_url", label: "Web-URL" },
  { value: "other", label: "Sonstiges" },
];

export default function RepeaterCorrectionDialog({ repeater, onClose }) {
  const [fieldName, setFieldName] = useState("other");
  const [currentValue, setCurrentValue] = useState("");
  const [correctedValue, setCorrectedValue] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Pre-fill current value based on selected field
  const getCurrentValue = (field) => {
    const r = repeater;
    if (field === "frequency") return r.frequency ? `${r.frequency.toFixed(4)} MHz` : "";
    if (field === "offset_mhz") return r.offset_mhz != null ? `${r.offset_mhz > 0 ? "+" : ""}${r.offset_mhz.toFixed(2)} MHz` : "";
    if (field === "tone") return r.tone || "";
    if (field === "location_name") return r.location_name || "";
    if (field === "lat_lng") return r.lat != null && r.lng != null ? `${r.lat}, ${r.lng}` : "";
    if (field === "status") return r.status || "";
    if (field === "modes") return (r.modes || []).join(", ");
    if (field === "band") return r.band || "";
    if (field === "country") return r.country || "";
    if (field === "web_url") return r.web_url || "";
    return "";
  };

  const handleFieldChange = (field) => {
    setFieldName(field);
    setCurrentValue(getCurrentValue(field));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!correctedValue.trim() && fieldName !== "other") {
      toast({ title: "Bitte korrekten Wert eingeben", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await base44.functions.invoke("manageRepeaterCorrections", {
        action: "report",
        repeater_id: repeater.id,
        callsign: repeater.callsign,
        field_name: fieldName,
        current_value: currentValue,
        corrected_value: correctedValue,
        description,
      });
      toast({
        title: "Meldung eingereicht",
        description: "Ein Admin prüft Ihre Korrektur und wendet sie an, sobald sie bestätigt ist.",
      });
      onClose();
    } catch (err) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Falsche Angaben melden
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="bg-amber-50 rounded-lg p-2 text-xs text-gray-700">
            <span className="font-medium">Relais:</span> {repeater.callsign} {repeater.frequency?.toFixed(4)} MHz
            {repeater.location_name && ` · ${repeater.location_name}`}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Was ist falsch?</label>
            <select
              value={fieldName}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded"
            >
              {FIELD_OPTIONS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {currentValue && (
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Aktueller Wert</label>
              <div className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600 font-mono">
                {currentValue}
              </div>
            </div>
          )}

          {fieldName !== "other" && (
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Korrekter Wert</label>
              <input
                value={correctedValue}
                onChange={(e) => setCorrectedValue(e.target.value)}
                placeholder={fieldName === "lat_lng" ? "47.1234, 8.5678" : "Neuer Wert..."}
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded font-mono"
              />
              {fieldName === "lat_lng" && (
                <p className="text-[10px] text-gray-400 mt-0.5">Format: Breitengrad, Längengrad (z.B. 47.3769, 8.5417)</p>
              )}
              {fieldName === "modes" && (
                <p className="text-[10px] text-gray-400 mt-0.5">Mehrere Modi mit Komma trennen (z.B. FM, DMR, Fusion)</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Beschreibung / Begründung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Erklären Sie, was falsch ist und woher Sie die richtigen Informationen haben..."
              rows={3}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded resize-none"
            />
          </div>

          <div className="text-[10px] text-gray-400">
            Ihre Meldung wird als <span className="font-medium text-gray-600">ausstehend</span> gespeichert.
            Ein Admin prüft und bestätigt die Korrektur, bevor sie aktiv wird.
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Meldung einreichen
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}