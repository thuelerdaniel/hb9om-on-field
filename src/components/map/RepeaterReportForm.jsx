import React, { useState } from "react";
import { AlertTriangle, X, Loader2, Send, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

const ERROR_TYPES = [
  { value: "wrong_frequency", label: "Falsche Frequenz" },
  { value: "wrong_location", label: "Falscher Standort" },
  { value: "offline_defect", label: "Offline / Defekt" },
  { value: "wrong_info", label: "Falsche Angaben" },
  { value: "other", label: "Sonstiges" },
];

export default function RepeaterReportForm({ repeater, onClose }) {
  const [errorType, setErrorType] = useState("wrong_frequency");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("reportRepeaterError", {
        repeater_callsign: repeater.callsign,
        repeater_id: repeater.id,
        repeater_frequency: repeater.frequency,
        error_type: errorType,
        description: description.trim(),
      });
      setSubmitted(true);
      setTimeout(() => onClose(), 2000);
    } catch (e) {
      setError(e.message || "Fehler beim Senden der Meldung");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
        <Check className="w-5 h-5 text-green-600 mx-auto mb-1" />
        <p className="text-xs font-medium text-green-700">
          Fehlermeldung erhalten. Vielen Dank!
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-bold text-amber-800">Relais melden</span>
        </div>
        <button
          onClick={onClose}
          className="text-amber-500 hover:text-amber-700"
          style={{ pointerEvents: 'auto' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Repeater callsign — read only */}
      <div className="mb-2">
        <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Relais</label>
        <div className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold text-gray-700">
          {repeater.callsign}
          {repeater.frequency != null && (
            <span className="ml-1.5 font-normal text-gray-500">{repeater.frequency.toFixed(4)} MHz</span>
          )}
        </div>
      </div>

      {/* Error type dropdown */}
      <div className="mb-2">
        <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Fehlertyp</label>
        <select
          value={errorType}
          onChange={(e) => setErrorType(e.target.value)}
          className="w-full text-xs px-2 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500"
          style={{ pointerEvents: 'auto' }}
        >
          {ERROR_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Description textarea */}
      <div className="mb-2">
        <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Beschreibung (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Zusätzliche Details zum Fehler..."
          rows={2}
          maxLength={500}
          className="w-full text-xs px-2 py-1.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
          style={{ pointerEvents: 'auto' }}
        />
      </div>

      {error && (
        <p className="text-[10px] text-red-600 mb-1.5">{error}</p>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      >
        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        {submitting ? "Wird gesendet..." : "Meldung senden"}
      </button>
    </div>
  );
}