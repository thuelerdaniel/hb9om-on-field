import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Lightbulb, Send, Loader2, Clock, CheckCircle2, XCircle, Trash2, MessageSquare, Eye, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CATEGORY_LABELS = {
  karte: "Karte",
  logbuch: "Logbuch",
  einstellungen: "Einstellungen",
  neue_funktion: "Neue Funktion",
  bug: "Fehler/Bug",
  verbesserung: "Verbesserung",
  other: "Sonstiges"
};

const STATUS_CONFIG = {
  pending: { label: "In Prüfung", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Clock },
  in_review: { label: "Wird geprüft", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: Eye },
  planned: { label: "Geplant", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: Sparkles },
  implemented: { label: "Umgesetzt", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: CheckCircle2 },
  rejected: { label: "Abgelehnt", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: XCircle },
  withdrawn: { label: "Zurückgezogen", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", icon: Trash2 },
};

export default function FeatureSuggestion() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("neue_funktion");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.FeatureRequest.list("-created_date", 100);
      setRequests(data || []);
    } catch (e) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    const unsubscribe = base44.entities.FeatureRequest.subscribe(() => {
      loadRequests();
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: "Titel fehlt", description: "Bitte geben Sie einen Titel ein.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let submitterName = localStorage.getItem("hb9om_my_callsign") || "";
      if (!submitterName) {
        try {
          const me = await base44.auth.me();
          submitterName = me?.full_name || me?.email || "";
        } catch (e) {}
      }
      await base44.entities.FeatureRequest.create({
        title: title.trim(),
        description: description.trim(),
        category,
        submitter_comment: comment.trim(),
        submitted_by_name: submitterName,
        status: "pending"
      });
      toast({ title: "Vorschlag eingereicht", description: "Danke! Ihr Vorschlag wurde gesendet." });
      setTitle("");
      setDescription("");
      setComment("");
      setCategory("neue_funktion");
      setShowForm(false);
      loadRequests();
    } catch (e) {
      toast({ title: "Fehler", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async (id) => {
    setWithdrawingId(id);
    try {
      await base44.entities.FeatureRequest.update(id, { status: "withdrawn" });
      loadRequests();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Diesen zurückgezogenen Vorschlag endgültig löschen?")) return;
    setDeletingId(id);
    try {
      const res = await base44.functions.invoke("manageFeatureRequests", { action: "delete", requestId: id });
      toast({ title: "Gelöscht", description: res.data?.message || "Vorschlag gelöscht" });
      loadRequests();
    } catch (e) {
      toast({ title: "Fehler", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending" || r.status === "in_review" || r.status === "planned").length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-yellow-50">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Funktionsvorschläge</h2>
              <p className="text-xs text-gray-500">Schlagen Sie neue Funktionen vor und verfolgen Sie den Status</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {pendingCount} aktiv
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="mt-3 w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors"
        >
          <Lightbulb className="w-4 h-4" />
          {showForm ? "Abbrechen" : "Neuen Vorschlag machen"}
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-gray-50 border-b border-gray-100 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Titel *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="z.B. Dunkelmodus für die Karte"
              maxLength={120}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategorie</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Beschreibung</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Beschreiben Sie Ihren Vorschlag möglichst detailliert..."
              rows={4}
              maxLength={2000}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zusätzlicher Kommentar</label>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Optional..."
              maxLength={500}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Vorschlag einreichen
          </button>
        </div>
      )}

      {/* List of user's own requests */}
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-6">
            <Lightbulb className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Noch keine Vorschläge eingereicht</p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map(r => {
              const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const isExpanded = expandedId === r.id;
              const canWithdraw = r.status === "pending" || r.status === "in_review";
              return (
                <div key={r.id} className={`rounded-lg border-2 p-3 ${status.border}`}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="w-full flex items-start justify-between gap-2 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {CATEGORY_LABELS[r.category] || r.category}
                        </span>
                        <span className={`flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.title}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(r.created_date).toLocaleString('de-CH')}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      {r.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">{r.description}</p>
                      )}
                      {r.submitter_comment && (
                        <div className="flex items-start gap-1.5 text-xs text-gray-500 p-2 bg-gray-50 rounded-lg">
                          <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>{r.submitter_comment}</span>
                        </div>
                      )}
                      {r.admin_comment && (
                        <div className="flex items-start gap-1.5 text-xs p-2 rounded-lg bg-blue-50 text-blue-600">
                          <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span><strong>Admin:</strong> {r.admin_comment}</span>
                        </div>
                      )}
                      {r.reviewed_by_name && r.status !== 'pending' && r.status !== 'withdrawn' && (
                        <p className="text-[10px] text-gray-400">Geprüft von: {r.reviewed_by_name}</p>
                      )}
                      {canWithdraw && (
                        <button
                          onClick={() => handleWithdraw(r.id)}
                          disabled={withdrawingId === r.id}
                          className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 flex items-center gap-1"
                        >
                          {withdrawingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Zurückziehen
                        </button>
                      )}
                      {r.status === "withdrawn" && (
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 flex items-center gap-1"
                        >
                          {deletingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Löschen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}