import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, MapPin, Clock, Check, X, Trash2, Loader2, MessageSquare, ArrowRight, User } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import { useToast } from "@/components/ui/use-toast";

const TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
  castle: "Burg/Schloss", lighthouse: "Leuchtturm", iota: "IOTA"
};

const TYPE_COLORS = {
  sota: "#e74c3c", pota: "#27ae60", hbff: "#8e44ad", wwbota: "#795548",
  castle: "#e67e22", lighthouse: "#f39c12", iota: "#3498db"
};

const STATUS_CONFIG = {
  pending: { label: "In Prüfung", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-400", cardBorder: "border-amber-300", icon: Clock, cardBg: "bg-amber-50" },
  approved: { label: "Genehmigt", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", cardBorder: "border-gray-200", icon: Check, cardBg: "bg-white" },
  rejected: { label: "Abgelehnt", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", cardBorder: "border-gray-200", icon: X, cardBg: "bg-white" },
  withdrawn: { label: "Zurückgezogen", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", cardBorder: "border-gray-200", icon: Trash2, cardBg: "bg-white" },
};

const FILTERS = [
  { value: "pending", label: "Ausstehend" },
  { value: "all", label: "Alle" },
  { value: "approved", label: "Genehmigt" },
  { value: "rejected", label: "Abgelehnt" },
];

export default function AdminChangeRequests() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [actionId, setActionId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageChangeRequests", { action: "listAll" });
      setRequests(res.data?.requests || []);
    } catch (e) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // Realtime subscription — fires on entity changes
    const unsubscribe = base44.entities.ReferenceChangeRequest.subscribe(() => {
      loadRequests();
    });
    // Polling fallback every 30s (RLS may block subscription for other users' requests)
    const pollInterval = setInterval(() => {
      loadRequests();
    }, 30000);
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  const handleApprove = async (id) => {
    setActionId(id);
    try {
      const res = await base44.functions.invoke("manageChangeRequests", {
        action: "approve",
        requestId: id,
        adminComment: commentInputs[id] || ""
      });
      toast({ title: "Genehmigt", description: res.data?.message || "Antrag genehmigt" });
      setCommentInputs(prev => ({ ...prev, [id]: "" }));
      loadRequests();
    } catch (e) {
      toast({ title: "Fehler", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id) => {
    setActionId(id);
    try {
      const res = await base44.functions.invoke("manageChangeRequests", {
        action: "reject",
        requestId: id,
        adminComment: commentInputs[id] || ""
      });
      toast({ title: "Abgelehnt", description: res.data?.message || "Antrag abgelehnt" });
      setCommentInputs(prev => ({ ...prev, [id]: "" }));
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
          <button onClick={() => navigate("/settings")} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <MapPin className="w-5 h-5 text-gray-700" />
            <h1 className="text-sm font-bold text-gray-900">Anträge prüfen</h1>
            {pendingCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
                {pendingCount} offen
              </span>
            )}
          </div>
        </div>
        {/* Filter tabs */}
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
            <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {filter === "pending" ? "Keine ausstehenden Anträge" : "Keine Anträge in dieser Kategorie"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const typeColor = TYPE_COLORS[r.reference_type] || "#666";
              const isPending = r.status === "pending";
              return (
                <div key={r.id} className={`rounded-xl border-2 p-4 ${status.cardBorder} ${status.cardBg} ${isPending ? "shadow-md" : ""}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: typeColor }}>
                        {TYPE_LABELS[r.reference_type] || r.reference_type}
                      </span>
                      <span className="font-mono font-bold text-sm text-gray-900">{r.original_code}</span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${status.bg} ${status.text}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </div>
                  </div>

                  {r.original_name && <p className="text-sm text-gray-600 mb-2">{r.original_name}</p>}

                  <div className="bg-white/70 rounded-lg p-2.5 space-y-1 mb-2 border border-gray-100">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-14">Aktuell:</span>
                      <span className="font-mono text-gray-700">{r.original_lat?.toFixed(5)}, {r.original_lng?.toFixed(5)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <ArrowRight className="w-3 h-3 text-gray-400 ml-[58px]" />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-14">Vorschlag:</span>
                      <span className="font-mono text-blue-600 font-semibold">{r.proposed_lat?.toFixed(5)}, {r.proposed_lng?.toFixed(5)}</span>
                    </div>
                  </div>

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

                  {isPending && (
                    <>
                      <input
                        type="text"
                        value={commentInputs[r.id] || ""}
                        onChange={e => setCommentInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Kommentar (optional)..."
                        className="w-full mb-2 px-3 py-1.5 text-sm border border-gray-200 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(r.id)}
                          disabled={actionId === r.id}
                          className="flex-1 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
                        >
                          {actionId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          Ablehnen
                        </button>
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={actionId === r.id}
                          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-1.5"
                        >
                          {actionId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Genehmigen
                        </button>
                      </div>
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