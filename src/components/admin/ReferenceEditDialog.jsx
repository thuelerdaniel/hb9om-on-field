import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { X, Loader2, Check, Trash2 } from "lucide-react";

export default function ReferenceEditDialog({ referenceType, originalCode, originalName, originalLocation, onClose, onSaved }) {
  const [adjustedName, setAdjustedName] = useState("");
  const [adjustedLocation, setAdjustedLocation] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [webReference, setWebReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadExisting();
  }, []);

  const loadExisting = async () => {
    try {
      const overrides = await base44.entities.ReferenceOverride.filter({
        reference_type: referenceType,
        original_code: originalCode
      });
      if (overrides && overrides.length > 0) {
        const ov = overrides[0];
        setExistingId(ov.id);
        setAdjustedName(ov.adjusted_name || "");
        setAdjustedLocation(ov.adjusted_location || "");
        setManualLat(ov.manual_lat != null ? String(ov.manual_lat) : "");
        setManualLng(ov.manual_lng != null ? String(ov.manual_lng) : "");
        setWebReference(ov.web_reference || "");
      }
    } catch (e) {
      setError("Override konnte nicht geladen werden: " + (e.message || ""));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const data = {
        reference_type: referenceType,
        original_code: originalCode,
        original_name: originalName,
        adjusted_name: adjustedName.trim() || null,
        adjusted_location: adjustedLocation.trim() || null,
        manual_lat: manualLat ? parseFloat(manualLat) : null,
        manual_lng: manualLng ? parseFloat(manualLng) : null,
        web_reference: webReference.trim() || null
      };
      if (existingId) {
        await base44.entities.ReferenceOverride.update(existingId, data);
      } else {
        const created = await base44.entities.ReferenceOverride.create(data);
        setExistingId(created.id);
      }
      setSaved(true);
      setTimeout(() => {
        if (onSaved) onSaved();
        onClose();
      }, 800);
    } catch (e) {
      setError("Fehler beim Speichern: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingId) return;
    setSaving(true);
    try {
      await base44.entities.ReferenceOverride.delete(existingId);
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      setError("Fehler beim Löschen: " + (e.message || ""));
    }
    setSaving(false);
  };

  const dialog = (
    <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Referenz anpassen</h3>
            <p className="text-xs text-gray-500 font-mono">{originalCode}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="p-2.5 bg-gray-50 rounded-lg text-xs text-gray-600">
              <span className="font-semibold">Original:</span> {originalName}
              {originalLocation && <span> ({originalLocation})</span>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Angepasster Name</label>
              <input type="text" value={adjustedName} onChange={e => setAdjustedName(e.target.value)}
                placeholder={originalName}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <p className="text-[10px] text-gray-400 mt-0.5">Wird beim nächsten Update für die Georeferenzierung verwendet</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Angepasster Ort</label>
              <input type="text" value={adjustedLocation} onChange={e => setAdjustedLocation(e.target.value)}
                placeholder={originalLocation || "z.B. AARAU"}
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lat (manuell)</label>
                <input type="number" step="any" value={manualLat} onChange={e => setManualLat(e.target.value)}
                  placeholder="47.3919"
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lng (manuell)</label>
                <input type="number" step="any" value={manualLng} onChange={e => setManualLng(e.target.value)}
                  placeholder="8.0420"
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400">Manuelle Koordinaten überschreiben alle automatischen Matcher</p>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Web-Referenz (URL)</label>
              <input type="text" value={webReference} onChange={e => setWebReference(e.target.value)}
                placeholder="https://..."
                className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2 pt-2">
              {existingId && (
                <button onClick={handleDelete} disabled={saving}
                  className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Zurücksetzen
                </button>
              )}
              <div className="flex-1" />
              <button onClick={onClose} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1.5">
                {saved ? <Check className="w-4 h-4" /> : saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saved ? "Gespeichert" : "Speichern"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}