import React, { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Check, X, Loader2, Radio } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const FIELD_LABELS = {
  frequency: "Frequenz",
  offset_mhz: "Offset",
  tone: "Zugang (Tone/CTCSS)",
  location_name: "Standort-Name",
  lat_lng: "Koordinaten",
  status: "Betriebsstatus",
  modes: "Modi",
  band: "Band",
  country: "Land",
  web_url: "Web-URL",
  other: "Sonstiges",
};

export default function RepeaterCorrectionManager() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [adminComment, setAdminComment] = useState("");
  const { toast } = useToast();

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("manageRepeaterCorrections", { action: "listAll" });
      setReports(res.data?.reports || res.reports || []);
    } catch (e) {
      toast({ title: "Fehler beim Laden", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleApprove = async (id) => {
    try {
      await base44.functions.invoke("manageRepeaterCorrections", {
        action: "approve",
        id,
        adminComment: adminComment,
      });
      toast({ title: "Korrektur genehmigt und angewendet", description: "Der korrekte Wert wurde auf das Relais angewendet." });
      setExpandedId(null);
      setAdminComment("");
      loadReports();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const handleReject = async (id) => {
    try {
      await base44.functions.invoke("manageRepeaterCorrections", {
        action: "reject",
        id,
        adminComment: adminComment,
      });
      toast({ title: "Korrektur abgelehnt" });
      setExpandedId(null);
      setAdminComment("");
      loadReports();
    } catch (e) {
      toast({ title: "Fehler", description: e.message, variant: "destructive" });
    }
  };

  const pendingReports = reports.filter(r => r.status === "pending");
  const reviewedReports = reports.filter(r => r.status === "approved" || r.status === "rejected");

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Relais-Korrektur-Meldungen
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Benutzer melden falsche Relais-Daten — {pendingReports.length} offen, {reviewedReports.length} bearbeitet
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400">
          <AlertTriangle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          Noch keine Korrektur-Meldungen
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {pendingReports.length > 0 && (
            <>
              <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wide mt-2">Offen ({pendingReports.length})</h4>
              {pendingReports.map(report => (
                <div key={report.id} className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900">
                        {report.callsign} · {FIELD_LABELS[report.field_name] || report.field_name}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">
                        von {report.submitted_by_name || "Unbekannt"} · {new Date(report.created_date).toLocaleDateString('de-CH')}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setExpandedId(expandedId === report.id ? null : report.id);
                        setAdminComment("");
                      }}
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      {expandedId === report.id ? "Schliessen" : "Prüfen"}
                    </button>
                  </div>
                  {expandedId === report.id && (
                    <div className="mt-2 pt-2 border-t border-amber-200 space-y-1.5">
                      {report.current_value && (
                        <div className="text-[10px] text-gray-500">
                          <span className="font-medium">Aktuell:</span> <span className="font-mono">{report.current_value}</span>
                        </div>
                      )}
                      {report.corrected_value && (
                        <div className="text-[10px] text-green-700 bg-green-50 rounded px-1.5 py-1">
                          <span className="font-medium">Korrektur:</span> <span className="font-mono">{report.corrected_value}</span>
                        </div>
                      )}
                      {report.description && (
                        <div className="text-[10px] text-gray-600 bg-gray-50 rounded px-1.5 py-1">
                          {report.description}
                        </div>
                      )}
                      <input
                        value={adminComment}
                        onChange={(e) => setAdminComment(e.target.value)}
                        placeholder="Admin-Kommentar (optional)"
                        className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApprove(report.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-green-600 rounded hover:bg-green-700"
                        >
                          <Check className="w-3 h-3" /> Genehmigen & Anwenden
                        </button>
                        <button
                          onClick={() => handleReject(report.id)}
                          className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                        >
                          <X className="w-3 h-3" /> Ablehnen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          {reviewedReports.length > 0 && (
            <>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-2">Bearbeitet ({reviewedReports.length})</h4>
              {reviewedReports.slice(0, 20).map(report => (
                <div key={report.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${report.status === 'approved' ? 'bg-green-500' : 'bg-red-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {report.callsign} · {FIELD_LABELS[report.field_name] || report.field_name}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {report.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'} von {report.reviewed_by_name || "—"}
                      {report.admin_comment && ` · ${report.admin_comment}`}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}