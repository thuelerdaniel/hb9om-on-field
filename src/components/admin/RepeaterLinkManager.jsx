import React, { useState, useEffect, useCallback } from "react";
import { Link2, Trash2, Check, X, Plus, Loader2, Edit3, Palette } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const LINE_STYLES = [
  { id: "solid", label: "Durchgezogen" },
  { id: "dashed", label: "Gestrichelt" },
  { id: "dotted", label: "Gepunktet" },
];

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#6b7280"];

export default function RepeaterLinkManager() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    from_callsign: "",
    from_frequency: "",
    from_lat: "",
    from_lng: "",
    to_callsign: "",
    to_frequency: "",
    to_lat: "",
    to_lng: "",
    link_type: "permanent",
    color: "#3b82f6",
    line_style: "dashed",
    description: "",
    network: "",
  });

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageRepeaterLinks", { action: "listAll" });
      setLinks(res.data?.links || []);
    } catch (e) {
      toast({ title: "Fehler beim Laden", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const handleApprove = async (id) => {
    try {
      await base44.functions.invoke("manageRepeaterLinks", { action: "approve", id });
      toast({ title: "Verlinkung genehmigt" });
      loadLinks();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async (id) => {
    try {
      await base44.functions.invoke("manageRepeaterLinks", { action: "reject", id });
      toast({ title: "Verlinkung abgelehnt" });
      loadLinks();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Verlinkung wirklich löschen?")) return;
    try {
      await base44.functions.invoke("manageRepeaterLinks", { action: "delete", id });
      toast({ title: "Verlinkung gelöscht" });
      loadLinks();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        from_frequency: form.from_frequency ? parseFloat(form.from_frequency) : null,
        from_lat: form.from_lat ? parseFloat(form.from_lat) : null,
        from_lng: form.from_lng ? parseFloat(form.from_lng) : null,
        to_frequency: form.to_frequency ? parseFloat(form.to_frequency) : null,
        to_lat: form.to_lat ? parseFloat(form.to_lat) : null,
        to_lng: form.to_lng ? parseFloat(form.to_lng) : null,
      };
      if (editingId) {
        await base44.functions.invoke("manageRepeaterLinks", { action: "update", id: editingId, ...payload, status: "approved" });
        toast({ title: "Verlinkung aktualisiert" });
      } else {
        await base44.functions.invoke("manageRepeaterLinks", { action: "suggest", ...payload });
        toast({ title: "Verlinkung erstellt (als genehmigt)" });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ from_callsign: "", from_frequency: "", from_lat: "", from_lng: "", to_callsign: "", to_frequency: "", to_lat: "", to_lng: "", link_type: "permanent", color: "#3b82f6", line_style: "dashed", description: "", network: "" });
      loadLinks();
    } catch (e) {
      toast({ title: "Fehler beim Speichern", description: e.message, variant: "destructive" });
    }
  };

  const handleEdit = (link) => {
    setEditingId(link.id);
    setForm({
      from_callsign: link.from_callsign || "",
      from_frequency: link.from_frequency || "",
      from_lat: link.from_lat || "",
      from_lng: link.from_lng || "",
      to_callsign: link.to_callsign || "",
      to_frequency: link.to_frequency || "",
      to_lat: link.to_lat || "",
      to_lng: link.to_lng || "",
      link_type: link.link_type || "permanent",
      color: link.color || "#3b82f6",
      line_style: link.line_style || "dashed",
      description: link.description || "",
      network: link.network || "",
    });
    setShowForm(true);
  };

  const pendingLinks = links.filter(l => l.status === "pending");
  const approvedLinks = links.filter(l => l.status === "approved");

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-blue-600" /> Relais-Verlinkungen
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Permanente Verlinkungen zwischen Relais verwalten — {pendingLinks.length} offen, {approvedLinks.length} aktiv
          </p>
        </div>
        <button
          onClick={() => { setEditingId(null); setShowForm(!showForm); }}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Neue Verlinkung
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h4 className="text-xs font-bold text-gray-700 mb-1">Quell-Relais</h4>
              <input value={form.from_callsign} onChange={e => setForm({...form, from_callsign: e.target.value})} placeholder="Rufzeichen" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mb-1" required />
              <input value={form.from_frequency} onChange={e => setForm({...form, from_frequency: e.target.value})} placeholder="Freq MHz" type="number" step="0.001" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mb-1" />
              <div className="flex gap-1">
                <input value={form.from_lat} onChange={e => setForm({...form, from_lat: e.target.value})} placeholder="Lat" type="number" step="0.0001" className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded" />
                <input value={form.from_lng} onChange={e => setForm({...form, from_lng: e.target.value})} placeholder="Lng" type="number" step="0.0001" className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-700 mb-1">Ziel-Relais</h4>
              <input value={form.to_callsign} onChange={e => setForm({...form, to_callsign: e.target.value})} placeholder="Rufzeichen" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mb-1" required />
              <input value={form.to_frequency} onChange={e => setForm({...form, to_frequency: e.target.value})} placeholder="Freq MHz" type="number" step="0.001" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mb-1" />
              <div className="flex gap-1">
                <input value={form.to_lat} onChange={e => setForm({...form, to_lat: e.target.value})} placeholder="Lat" type="number" step="0.0001" className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded" />
                <input value={form.to_lng} onChange={e => setForm({...form, to_lng: e.target.value})} placeholder="Lng" type="number" step="0.0001" className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select value={form.link_type} onChange={e => setForm({...form, link_type: e.target.value})} className="px-2 py-1.5 text-xs border border-gray-200 rounded">
              <option value="permanent">Permanent</option>
              <option value="temporary">Temporär</option>
            </select>
            <select value={form.line_style} onChange={e => setForm({...form, line_style: e.target.value})} className="px-2 py-1.5 text-xs border border-gray-200 rounded">
              {LINE_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input value={form.network} onChange={e => setForm({...form, network: e.target.value})} placeholder="Netzwerk (Brandmeister, XLX...)" className="px-2 py-1.5 text-xs border border-gray-200 rounded" />
          </div>

          <div className="flex items-center gap-2">
            <Palette className="w-3.5 h-3.5 text-gray-400" />
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm({...form, color: c})}
                className={`w-6 h-6 rounded-full border-2 ${form.color === c ? "border-gray-900 scale-110" : "border-white"} transition-transform`}
                style={{ backgroundColor: c }} />
            ))}
          </div>

          <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Beschreibung (z.B. Crosslink 2m/70cm, EchoLink, Brandmeister TG...)" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded" />

          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800">
              {editingId ? "Aktualisieren" : "Verlinkung erstellen"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : links.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          <Link2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          Noch keine Verlinkungen erfasst
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {pendingLinks.length > 0 && (
            <>
              <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wide mt-2">Wartend ({pendingLinks.length})</h4>
              {pendingLinks.map(link => (
                <div key={link.id} className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: link.color || "#3b82f6" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {link.from_callsign} → {link.to_callsign}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {link.network || link.description || "Keine Beschreibung"} · von {link.submitted_by_name || "Unbekannt"}
                    </div>
                  </div>
                  <button onClick={() => handleApprove(link.id)} className="p-1 hover:bg-green-100 rounded text-green-600" title="Genehmigen"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleReject(link.id)} className="p-1 hover:bg-red-100 rounded text-red-600" title="Ablehnen"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </>
          )}
          <h4 className="text-xs font-bold text-green-600 uppercase tracking-wide mt-2">Aktiv ({approvedLinks.length})</h4>
          {approvedLinks.map(link => (
            <div key={link.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <svg width="20" height="4" className="flex-shrink-0">
                <line x1="0" y1="2" x2="20" y2="2" stroke={link.color || "#3b82f6"} strokeWidth="2"
                  strokeDasharray={link.line_style === "dashed" ? "4 2" : link.line_style === "dotted" ? "1 2" : "none"} />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {link.from_callsign}{link.from_frequency ? ` ${link.from_frequency.toFixed(4)}` : ""} → {link.to_callsign}{link.to_frequency ? ` ${link.to_frequency.toFixed(4)}` : ""}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {link.link_type === "permanent" ? "Permanent" : "Temporär"} · {link.network || link.description || "Keine Beschreibung"}
                </div>
              </div>
              <button onClick={() => handleEdit(link)} className="p-1 hover:bg-gray-200 rounded text-gray-600" title="Bearbeiten"><Edit3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(link.id)} className="p-1 hover:bg-red-100 rounded text-red-600" title="Löschen"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}