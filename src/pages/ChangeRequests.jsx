import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Clock, Check, X, Trash2, Loader2, MessageSquare, ArrowRight } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
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
  pending: { label: "In Prüfung", color: "amber", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Clock },
  approved: { label: "Genehmigt", color: "green", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: Check },
  rejected: { label: "Abgelehnt", color: "red", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: X },
  withdrawn: { label: "Zurückgezogen", color: "gray", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", icon: Trash2 },
};

export default function ChangeRequests() {
  const { toast } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.ReferenceChangeRequest.list("-created_date", 100);
      setRequests(data || []);
    } catch (e) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    const unsubscribe = base44.entities.ReferenceChangeRequest.subscribe(() => {
      loadRequests();
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const handleWithdraw = async (id) => {
    setWithdrawingId(id);
    try {
      await base44.entities.ReferenceChangeRequest.update(id, { status: "withdrawn" });
      loadRequests();
    } catch (e) {
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Diesen zurückgezogenen Antrag endgültig löschen?")) return;
    setDeletingId(id);
    try {
      const res = await base44.functions.invoke("manageChangeRequests", { action: "delete", requestId: id });
      toast({ title: "Gelöscht", description: res.data?.message || "Antrag gelöscht" });
      loadRequests();
    } catch (e) {
      toast({ title: "Fehler", description: e?.response?.data?.error || e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Meine Anträge"
        icon={MapPin}
        titleExtra={pendingCount > 0 ? (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            {pendingCount} offen
          </span>
        ) : null}
      />

      <PullToRefresh onRefresh={loadRequests} className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Noch keine Änderungsanträge eingereicht</p>
            <p className="text-xs text-gray-400 mt-1">
              Auf der Karte den "Punkte verschieben"-Modus aktivieren, um eine Position zu korrigieren.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const StatusIcon = status.icon;
              const typeColor = TYPE_COLORS[r.reference_type] || "#666";
              return (
                <div key={r.id} className={`bg-white rounded-xl border-2 p-4 ${status.border}`}>
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

                  <div className="bg-gray-50 rounded-lg p-2.5 space-y-1 mb-2">
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

                  {r.submitter_comment && (
                    <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-2">
                      <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{r.submitter_comment}</span>
                    </div>
                  )}

                  {r.admin_comment && (
                    <div className={`flex items-start gap-1.5 text-xs p-2 rounded-lg mb-2 ${r.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                      <MessageSquare className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span><strong>Admin:</strong> {r.admin_comment}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      {new Date(r.created_date).toLocaleString('de-CH')}
                      {r.reviewed_by_name && r.status !== 'pending' && r.status !== 'withdrawn' && ` · ${r.reviewed_by_name}`}
                    </span>
                    {r.status === "pending" && (
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
                </div>
              );
            })}
          </div>
        )}
      </PullToRefresh>

      <BottomNavigation />
    </div>
  );
}