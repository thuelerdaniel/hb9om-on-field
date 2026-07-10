import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Lightbulb, Clock, CheckCircle2, XCircle, Trash2, Loader2, MessageSquare, Eye, Sparkles, User, LightbulbIcon } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useToast } from "@/components/ui/use-toast";

const CATEGORY_LABELS = {
  karte: "Karte", logbuch: "Logbuch", einstellungen: "Einstellungen",
  neue_funktion: "Neue Funktion", bug: "Fehler/Bug", verbesserung: "Verbesserung", other: "Sonstiges"
};

const STATUS_CONFIG = {
  pending: { label: "In Prüfung", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", cardBg: "bg-amber-50", icon: Clock },
  in_review: { label: "Wird geprüft", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300", cardBg: "bg-blue-50", icon: Eye },
  planned: { label: "Geplant", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300", cardBg: "bg-purple-50", icon: Sparkles },
  implemented: { label: "Umgesetzt", bg: "bg-green-50", text: "text-green-700", border: "border-gray-200", cardBg: "bg-white", icon: CheckCircle2 },
  rejected: { label: "Abgelehnt", bg: "bg-red-50", text: "text-red-700", border: "border-gray-200", cardBg: "bg-white", icon: XCircle },
  withdrawn: { label: "Zurückgezogen", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", cardBg: "bg-white", icon: Trash2 },
};

const STATUS_OPTIONS = [
  { value: "pending", label: "In Prüfung" },
  { value: "in_review", label: "Wird geprüft" },
  { value: "planned", label: "Geplant" },
  { value: "implemented", label: "Umgesetzt" },
  { value: "rejected", label: "Abgelehnt" },
];

const FILTERS = [
  { value: "pending", label: "Ausstehend" },
  { value: "all", label: "Alle" },
  { value: "planned", label: "Geplant" },
  { value: "implemented", label: "Umgesetzt" },
  { value: "rejected", label: "Abgelehnt" },
];

export default function AdminFeatureRequests() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [actionId, setActionId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [statusSelects, setStatusSelects] = useState({});

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageFeatureRequests", { action: "listAll" });
      setRequests(res.data?.requests || []);
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
    const pollInterval = setInterval(() => {
      loadRequests();
    }, 30000);
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  const handleRespond = async (id) => {
    setActionId(id);
    try {
      const newStatus = statusSelects[id] || "pending";
      const comment = commentInputs[id] || "";
      const res = await base44.functions.invoke("manageFeatureRequests", {
        action: "respond",
        requestId: id,
        status: newStatus,
        adminComment: comment
      });
      toast({ title: "Aktualisiert", description: res.data?.message || "Vorschlag aktualisiert" });
      setCommentInputs(prev => ({ ...prev, [id]: "" }));
      setStatusSelects(prev => ({ ...prev, [id]: undefined }));
      loadRequests();
    } catch (e) {
      toast({ title: "Fehler", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Diesen zurückgezogenen Vorschlag endgültig löschen?")) return;
    setActionId(id);
    try {
      const res = await base44.functions.invoke("manageFeatureRequests", { action: "delete", requestId: id });
      toast({ title: "Gelöscht", description: res.data?.message || "Vorschlag gelöscht" });
      loadRequests();
    } catch (e) {
      toast({ title: "Fehler", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Lightbulb className="w-5 h-5 text-gray-700" />
            <h1 className="text-sm font-bold text-gray-900">Vorschläge prüfen</h1>
            {pendingCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
                {pendingCount} offen
              </span>
            )}
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 pb-2 flex gap-1.5 overflow-x-auto">
          {FILTERS.map(f => {
            const count = f.value === "all" ? requests.length : requests.filter(r => r.status === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  filter === f.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Lightbulb className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {filter === "pending" ? "Keine ausstehenden Vorschläge" : "Keine Vorschläge in dieser Kategorie"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const isPending = r.status === "pending";
              return (
                <div key={r.id} className={`rounded-xl border-2 p-4 ${status.border} ${status.cardBg} ${isPending ? "shadow-md" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {CATEGORY_LABELS[r.category] || r.category}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${status.bg} ${status.text}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-gray-900 mb-1">{r.title}</h3>
                  {r.description && <p className="text-sm text-gray-600 mb-2 leading-relaxed">{r.description}</p>}

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2 flex-wrap">
                    {r.submitted_by_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {r.submitted_by_name}
                      </span>
                    )}
                    <span>{new Date(r.created_date).toLocaleString('de-CH')}</span>
                    {r.reviewed_by_name && !isPending && r.status !== 'withdrawn' && (
                      <span>· {r.reviewed_by_name}</span>
                    )}
                  </div>

                  {r.submitter_comment && (
                    <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-2 p-2 bg-gray-50 rounded-lg">
                      <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{r.submitter_comment}</span>
                    </div>
                  )}

                  {r.admin_comment && !isPending && (
                    <div className="flex items-start gap-1.5 text-xs p-2 rounded-lg mb-2 bg-blue-50 text-blue-600">
                      <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span><strong>Admin:</strong> {r.admin_comment}</span>
                    </div>
                  )}

                  {r.status === "withdrawn" && (
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={actionId === r.id}
                      className="w-full px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      {actionId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Endgültig löschen
                    </button>
                  )}

                  {r.status !== "withdrawn" && (
                    <>
                      <select
                        value={statusSelects[r.id] || r.status}
                        onChange={e => setStatusSelects(prev => ({ ...prev, [r.id]: e.target.value }))}
                        className="w-full mb-2 px-3 py-1.5 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={commentInputs[r.id] || ""}
                        onChange={e => setCommentInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Antwort/Kommentar an den Benutzer..."
                        className="w-full mb-2 px-3 py-1.5 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <button
                        onClick={() => handleRespond(r.id)}
                        disabled={actionId === r.id}
                        className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        {actionId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Speichern
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}