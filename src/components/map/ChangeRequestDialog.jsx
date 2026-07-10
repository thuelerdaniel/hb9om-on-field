import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Loader2, MapPin, ArrowRight, Check, MessageSquare, WifiOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
  castle: "Burg/Schloss", lighthouse: "Leuchtturm", iota: "IOTA"
};

const TYPE_COLORS = {
  sota: "#e74c3c", pota: "#27ae60", hbff: "#8e44ad", wwbota: "#795548",
  castle: "#e67e22", lighthouse: "#f39c12", iota: "#3498db"
};

export default function ChangeRequestDialog({ marker, newPosition, onClose, onSubmit }) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const code = marker.code || marker.reference || "";
  const typeLabel = TYPE_LABELS[marker.layerType] || marker.layerType;
  const typeColor = TYPE_COLORS[marker.layerType] || "#666";

  const isOffline = typeof navigator !== "undefined" && (!navigator.onLine || localStorage.getItem("hb9om_force_offline") === "true");

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const myCallsign = localStorage.getItem("hb9om_my_callsign") || "";
      await base44.entities.ReferenceChangeRequest.create({
        reference_type: marker.layerType,
        original_code: code,
        original_name: marker.name || "",
        original_lat: marker.lat,
        original_lng: marker.lng,
        proposed_lat: newPosition[0],
        proposed_lng: newPosition[1],
        status: "pending",
        submitter_comment: comment,
        submitted_by_name: myCallsign
      });
      toast({
        title: "Antrag eingereicht",
        description: `Positionsänderung für ${code} wurde zur Prüfung gesendet.`
      });
      onSubmit();
    } catch (e) {
      toast({
        title: "Fehler beim Einreichen",
        description: e.message || "Unbekannter Fehler",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10002] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: typeColor + "20" }}>
              <MapPin className="w-4 h-4" style={{ color: typeColor }} />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Position ändern</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: typeColor }}>
              {typeLabel}
            </span>
            <span className="font-mono font-bold text-sm text-gray-900">{code}</span>
          </div>
          {marker.name && <p className="text-sm text-gray-600">{marker.name}</p>}

          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 w-16">Aktuell:</span>
              <span className="font-mono text-gray-700">{marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ArrowRight className="w-3 h-3 text-gray-400" />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 w-16">Neu:</span>
              <span className="font-mono text-blue-600 font-semibold">{newPosition[0].toFixed(5)}, {newPosition[1].toFixed(5)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Kommentar (optional)
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              placeholder="z.B. Position war ungenau, Marker zu weit westlich..."
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>

          <div className="bg-amber-50 rounded-lg p-2.5 text-xs text-amber-700 flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Die Änderung wird an einen Admin gesendet und nach Prüfung freigegeben. Du kannst den Status unter "Meine Anträge" verfolgen.</span>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Abbrechen
          </button>
          {isOffline ? (
            <div className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg flex items-center justify-center gap-1.5 border border-gray-200 cursor-not-allowed">
              <WifiOff className="w-4 h-4" /> Nur online möglich
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Einreichen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}