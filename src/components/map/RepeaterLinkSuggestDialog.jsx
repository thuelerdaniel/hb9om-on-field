import React, { useState } from "react";
import { Link2, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6"];
const LINE_STYLES = [
  { id: "dashed", label: "Gestrichelt" },
  { id: "solid", label: "Durchgezogen" },
  { id: "dotted", label: "Gepunktet" },
];

export default function RepeaterLinkSuggestDialog({ fromRepeater, allRepeaters, onClose }) {
  const [toRepeaterId, setToRepeaterId] = useState("");
  const [linkType, setLinkType] = useState("permanent");
  const [color, setColor] = useState("#3b82f6");
  const [lineStyle, setLineStyle] = useState("dashed");
  const [network, setNetwork] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const toRepeater = allRepeaters.find(r => r.id === toRepeaterId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!toRepeater) {
      toast({ title: "Bitte Ziel-Relais wählen", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await base44.functions.invoke("manageRepeaterLinks", {
        action: "suggest",
        from_callsign: fromRepeater.callsign,
        from_frequency: fromRepeater.frequency,
        from_lat: fromRepeater.lat,
        from_lng: fromRepeater.lng,
        to_callsign: toRepeater.callsign,
        to_frequency: toRepeater.frequency,
        to_lat: toRepeater.lat,
        to_lng: toRepeater.lng,
        link_type: linkType,
        color,
        line_style: lineStyle,
        network,
        description,
      });
      toast({ title: "Vorschlag eingereicht", description: "Ein Admin prüft Ihre Verlinkung." });
      onClose();
    } catch (err) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  // Nearby repeaters (same country, with coords, not the same repeater)
  const candidates = allRepeaters
    .filter(r => r.id !== fromRepeater.id && r.lat != null && r.lng != null)
    .sort((a, b) => {
      // Sort by distance to fromRepeater
      const da = Math.hypot(a.lat - fromRepeater.lat, a.lng - fromRepeater.lng);
      const db = Math.hypot(b.lat - fromRepeater.lat, b.lng - fromRepeater.lng);
      return da - db;
    })
    .slice(0, 50);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-blue-600" /> Verlinkung vorschlagen
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="bg-blue-50 rounded-lg p-2 text-xs text-gray-700">
            <span className="font-medium">Von:</span> {fromRepeater.callsign} {fromRepeater.frequency?.toFixed(4)} MHz
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Ziel-Relais (nach Distanz)</label>
            <select value={toRepeaterId} onChange={e => setToRepeaterId(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" required>
              <option value="">— Relais wählen —</option>
              {candidates.map(r => (
                <option key={r.id} value={r.id}>
                  {r.callsign} {r.frequency?.toFixed(4)} MHz — {r.location_name || r.country || ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Verlinkungsart</label>
              <select value={linkType} onChange={e => setLinkType(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded">
                <option value="permanent">Permanent</option>
                <option value="temporary">Temporär</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Strichart</label>
              <select value={lineStyle} onChange={e => setLineStyle(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded">
                {LINE_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Farbe</label>
            <div className="flex gap-1.5">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 ${color === c ? "border-gray-900 scale-110" : "border-white"} transition-transform`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <input value={network} onChange={e => setNetwork(e.target.value)} placeholder="Netzwerk (Brandmeister, XLX, EchoLink...)" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Beschreibung / Kommentar" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />

          <div className="text-[10px] text-gray-400">
            Ihr Vorschlag wird als «ausstehend» gespeichert und von einem Admin geprüft.
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={submitting} className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Vorschlag einreichen
            </button>
            <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Abbrechen</button>
          </div>
        </form>
      </div>
    </div>
  );
}