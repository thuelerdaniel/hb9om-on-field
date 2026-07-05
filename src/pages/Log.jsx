import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Radio, Plus, Download, Archive, Trash2, ArrowLeft, Filter, Loader2, ChevronDown, ChevronUp, CheckCircle2, ArchiveRestore } from "lucide-react";

const REF_TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
  castle: "Burg/Schloss", iota: "IOTA", lighthouse: "Leuchtturm",
  swiss_protected: "Bundesinventar", custom: "Eigenes"
};

export default function Log() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmArchive, setShowConfirmArchive] = useState(null);
  const [sortBy, setSortBy] = useState("date_desc");

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Log.list("-qso_date", 500);
      setEntries(data || []);
    } catch (e) {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...entries];
    if (filterType !== "all") result = result.filter(e => e.my_reference_type === filterType);
    if (filterStatus !== "all") result = result.filter(e => e.status === filterStatus);
    if (sortBy === "date_desc") result.sort((a, b) => (b.qso_date || "").localeCompare(a.qso_date || ""));
    if (sortBy === "date_asc") result.sort((a, b) => (a.qso_date || "").localeCompare(b.qso_date || ""));
    if (sortBy === "callsign") result.sort((a, b) => (a.callsign || "").localeCompare(b.callsign || ""));
    return result;
  }, [entries, filterType, filterStatus, sortBy]);

  const handleExport = () => {
    const header = "HB9OM On Field - ADIF Export\n<adif_ver:5>3.1.4\n<programid:14>HB9OM On Field\n<eoh>\n\n";
    const records = filtered.map(e => {
      const fields = [
        `<call:${(e.callsign || "").length}>${e.callsign || ""}`,
        `<qso_date:8>${(e.qso_date || "").replace(/-/g, "")}`,
        `<time_on:4>${(e.time_start || "").replace(":", "")}`,
        `<band:${(e.band || "").length}>${e.band || ""}`,
        `<mode:${(e.mode || "").length}>${e.mode || ""}`,
        e.frequency ? `<freq:${String(e.frequency).length}>${e.frequency}` : "",
        `<rst_sent:${(e.rst_sent || "").length}>${e.rst_sent || ""}`,
        `<rst_rcvd:${(e.rst_received || "").length}>${e.rst_received || ""}`,
        e.my_reference ? `<my_sig_info:${(e.my_reference).length}>${e.my_reference}` : "",
        e.operator_name ? `<name:${(e.operator_name).length}>${e.operator_name}` : "",
        e.operator_grid ? `<gridsquare:${(e.operator_grid).length}>${e.operator_grid}` : "",
        e.operator_country ? `<country:${(e.operator_country).length}>${e.operator_country}` : "",
        e.notes ? `<notes:${(e.notes).length}>${e.notes}` : "",
      ].filter(Boolean).join(" ");
      return fields + " <eor>";
    }).join("\n");

    const blob = new Blob([header + records], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hb9om_log_${new Date().toISOString().slice(0, 10)}.adi`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleArchive = async (id) => {
    try {
      await base44.entities.Log.update(id, { status: "archived" });
      setShowConfirmArchive(null);
      loadEntries();
    } catch (e) { }
  };

  const handleDeleteAll = async () => {
    try {
      const toDelete = filtered.map(e => e.id);
      for (const id of toDelete) {
        await base44.entities.Log.delete(id);
      }
      setShowConfirmDelete(false);
      loadEntries();
    } catch (e) { }
  };

  const handleDeleteSingle = async (id) => {
    try {
      await base44.entities.Log.delete(id);
      loadEntries();
    } catch (e) { }
  };

  const handleUnarchive = async (id) => {
    try {
      await base44.entities.Log.update(id, { status: "active" });
      loadEntries();
    } catch (e) { }
  };

  const typeCounts = useMemo(() => {
    const counts = {};
    entries.forEach(e => {
      const t = e.my_reference_type || "custom";
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [entries]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-1.5 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">QSO-Logbuch</h1>
              <p className="text-[10px] text-gray-400">{entries.length} Einträge gesamt</p>
            </div>
          </div>
          <Link
            to="/"
            className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Neues QSO
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">Alle Typen</option>
            {Object.entries(REF_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l} ({typeCounts[v] || 0})</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="active">Aktiv</option>
            <option value="archived">Archiviert</option>
            <option value="all">Alle</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="date_desc">Datum (neueste zuerst)</option>
            <option value="date_asc">Datum (älteste zuerst)</option>
            <option value="callsign">Rufzeichen (A-Z)</option>
          </select>

          <div className="flex-1" />

          <span className="text-xs text-gray-400">{filtered.length} Einträge</span>

          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export (ADIF)
          </button>

          {filtered.length > 0 && filterStatus !== "archived" && (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Löschen
            </button>
          )}
        </div>

        {/* Entries */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Radio className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Keine Log-Einträge gefunden</p>
            <Link to="/" className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
              <Plus className="w-4 h-4" /> Neues QSO erfassen
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className={`bg-white rounded-xl border p-4 ${entry.status === "archived" ? "border-gray-100 opacity-60" : "border-gray-200"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-gray-900 text-sm">{entry.callsign}</span>
                      {entry.operator_name && <span className="text-xs text-gray-500">{entry.operator_name}</span>}
                      {entry.status === "archived" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">Archiviert</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>{entry.qso_date} {entry.time_start && `· ${entry.time_start} UTC`}</span>
                      <span className="font-medium">{entry.band} {entry.mode}</span>
                      {entry.frequency && <span>{entry.frequency} MHz</span>}
                      <span>RST {entry.rst_sent}/{entry.rst_received}</span>
                    </div>
                    {entry.my_reference && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs">
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                          {REF_TYPE_LABELS[entry.my_reference_type] || entry.my_reference_type}
                        </span>
                        <span className="font-mono text-gray-700">{entry.my_reference}</span>
                        {entry.my_reference_name && <span className="text-gray-400">· {entry.my_reference_name}</span>}
                      </div>
                    )}
                    {entry.operator_country && (
                      <p className="text-xs text-gray-400 mt-0.5">{entry.operator_country}{entry.operator_grid && ` · Grid: ${entry.operator_grid}`}</p>
                    )}
                    {entry.notes && <p className="text-xs text-gray-400 mt-1 italic">{entry.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {entry.status === "archived" ? (
                      <button
                        onClick={() => handleUnarchive(entry.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                        title="Wiederherstellen"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowConfirmArchive(entry.id)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                        title="Archivieren"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSingle(entry.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Delete All Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900">Log-Einträge löschen?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              Möchten Sie wirklich <strong>{filtered.length}</strong> gefilterte{filterType !== "all" ? ` (${REF_TYPE_LABELS[filterType]})` : ""} Einträge unwiderruflich löschen?
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowConfirmDelete(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={handleDeleteAll} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Archive Modal */}
      {showConfirmArchive && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowConfirmArchive(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900">Eintrag archivieren?</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              Der Eintrag wird archiviert und kann jederzeit wiederhergestellt werden.
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowConfirmArchive(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button onClick={() => handleArchive(showConfirmArchive)} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600">
                Archivieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}