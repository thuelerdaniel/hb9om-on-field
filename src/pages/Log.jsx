import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Radio, Plus, Download, Archive, Trash2, Filter, Loader2, CheckCircle2, ArchiveRestore, Pencil, Building, HelpCircle, BarChart3, List, Cloud, CloudOff } from "lucide-react";
import LogEntryForm from "@/components/map/LogEntryForm";
import PullToRefresh from "@/components/PullToRefresh";
import PageHeader from "@/components/PageHeader";
import MobileSelect from "@/components/ui/MobileSelect";
import BottomNavigation from "@/components/BottomNavigation";
import LogStats from "@/components/log/LogStats";
import { loadLocal, syncFromServer, createEntry, updateEntry, deleteEntry, deleteMany, getLastSync, syncPending, getPendingCount } from "@/lib/localLogStore";

const REF_TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "HBFF", wwbota: "WWBOTA",
  castle: "Burg/Schloss", iota: "IOTA", lighthouse: "Leuchtturm",
  swiss_protected: "Bundesinventar", generell: "Generell",   custom: "Eigene"
};

export default function Log() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showConfirmArchive, setShowConfirmArchive] = useState(null);
  const [sortBy, setSortBy] = useState("date_desc");
  const [showQsoForm, setShowQsoForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [view, setView] = useState("list");
  const [lastSync, setLastSync] = useState(getLastSync());
  const [pendingCount, setPendingCount] = useState(getPendingCount());

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    const local = loadLocal();
    if (local.length > 0) {
      setEntries(local);
      setLoading(false);
    }
    await syncPending();
    const data = await syncFromServer();
    setEntries(data || []);
    setLastSync(getLastSync());
    setPendingCount(getPendingCount());
    setLoading(false);
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
      const fullCall = (e.callsign || "") + (e.callsign_suffix || "");
      const fields = [
        `<call:${fullCall.length}>${fullCall}`,
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
        e.my_grid ? `<my_gridsquare:${(e.my_grid).length}>${e.my_grid}` : "",
        e.is_clubstation && e.club_callsign ? `<station_callsign:${(e.club_callsign).length}>${e.club_callsign}` : "",
        e.is_clubstation && e.club_operator_callsign ? `<operator:${(e.club_operator_callsign).length}>${e.club_operator_callsign}` : "",
        e.notes ? `<notes:${(e.notes).length}>${e.notes}` : "",
        e.power != null ? `<tx_pwr:${String(e.power).length}>${e.power}` : "",
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
      await updateEntry(id, { status: "archived" });
      setShowConfirmArchive(null);
      loadEntries();
    } catch (e) { }
  };

  const handleDeleteAll = async () => {
    try {
      const toDelete = filtered.map(e => e.id);
      await deleteMany(toDelete);
      setShowConfirmDelete(false);
      loadEntries();
    } catch (e) { }
  };

  const handleDeleteSingle = async (id) => {
    try {
      await deleteEntry(id);
      loadEntries();
    } catch (e) { }
  };

  const handleUnarchive = async (id) => {
    try {
      await updateEntry(id, { status: "active" });
      loadEntries();
    } catch (e) { }
  };

  const handleEdit = (entry) => {
    setEditEntry(entry);
    setShowQsoForm(true);
  };

  const handleCloseForm = () => {
    setShowQsoForm(false);
    setEditEntry(null);
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
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <PageHeader
        title="QSO-Logbuch"
        icon={Radio}
        iconBg="bg-gray-900"
        subtitle={
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">{entries.length} Einträge</span>
            {pendingCount > 0 ? (
              <span className="flex items-center gap-0.5 text-amber-500" title={`${pendingCount} Eintrag${pendingCount !== 1 ? 'en' : ''} wartet auf Synchronisation`}>
                <CloudOff className="w-2.5 h-2.5" /> {pendingCount} ausstehend
              </span>
            ) : lastSync ? (
              <span className="flex items-center gap-0.5 text-green-500" title={`Zuletzt synchronisiert: ${new Date(lastSync).toLocaleString('de-CH')}`}>
                <Cloud className="w-2.5 h-2.5" /> synchronisiert
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-gray-400">
                <CloudOff className="w-2.5 h-2.5" /> lokal
              </span>
            )}
          </div>
        }
      >
        <button
          onClick={() => setView(view === "list" ? "stats" : "list")}
          className={`p-1.5 rounded-lg ${view === "stats" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
          title={view === "list" ? "Statistik anzeigen" : "Liste anzeigen"}
        >
          {view === "list" ? <BarChart3 className="w-5 h-5" /> : <List className="w-5 h-5" />}
        </button>
        <Link to="/help" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Hilfe">
          <HelpCircle className="w-5 h-5" />
        </Link>
      </PageHeader>

      <PullToRefresh onRefresh={loadEntries} className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-4 pb-24">
        {view === "stats" && <LogStats entries={entries} />}
        {/* Toolbar */}
        <div className={`bg-white rounded-xl border border-gray-200 p-3 mb-4 ${view === "stats" ? "hidden" : "flex flex-wrap items-center gap-2"}`}>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          <MobileSelect
            value={filterType}
            onValueChange={setFilterType}
            triggerClassName="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
            options={[
              { value: "all", label: "Alle Typen" },
              ...Object.entries(REF_TYPE_LABELS).map(([v, l]) => ({ value: v, label: `${l} (${typeCounts[v] || 0})` }))
            ]}
          />
          <MobileSelect
            value={filterStatus}
            onValueChange={setFilterStatus}
            triggerClassName="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
            options={[
              { value: "active", label: "Aktiv" },
              { value: "archived", label: "Archiviert" },
              { value: "all", label: "Alle" }
            ]}
          />
          <MobileSelect
            value={sortBy}
            onValueChange={setSortBy}
            triggerClassName="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 h-9"
            options={[
              { value: "date_desc", label: "Datum (neueste zuerst)" },
              { value: "date_asc", label: "Datum (älteste zuerst)" },
              { value: "callsign", label: "Rufzeichen (A-Z)" }
            ]}
          />

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
        {view === "stats" ? null : loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Radio className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Keine Log-Einträge gefunden</p>
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
                      <span className="font-mono font-bold text-gray-900 text-sm">{entry.callsign}{entry.callsign_suffix}</span>
                      {entry.operator_name && <span className="text-xs text-gray-500">{entry.operator_name}</span>}
                      {entry.is_clubstation && entry.club_callsign && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1">
                          <Building className="w-2.5 h-2.5" /> {entry.club_callsign}
                          {entry.club_operator_callsign && ` · Op: ${entry.club_operator_callsign}`}
                        </span>
                      )}
                      {entry.is_clubstation && !entry.club_callsign && entry.club_operator_callsign && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">Op: {entry.club_operator_callsign}{entry.club_operator_name && ` · ${entry.club_operator_name}`}</span>
                      )}
                      {entry.status === "archived" && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">Archiviert</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>{entry.qso_date} {entry.time_start && `· ${entry.time_start} UTC`}</span>
                      <span className="font-medium">{entry.band} {entry.mode}</span>
                      {entry.frequency && <span>{entry.frequency} MHz</span>}
                      <span>RST {entry.rst_sent}/{entry.rst_received}</span>
                      {entry.my_suffix && <span className="text-blue-600 font-medium">{entry.my_suffix}</span>}
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
                    {!entry.my_reference && entry.my_grid && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs">
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-medium">Locator</span>
                        <span className="font-mono text-gray-700">{entry.my_grid}</span>
                      </div>
                    )}
                    {(entry.operator_address || entry.operator_country || entry.operator_email) && (
                      <div className="text-xs text-gray-400 mt-0.5 space-y-0.5">
                        {entry.operator_address && <p>{entry.operator_address}</p>}
                        <p>{entry.operator_country}{entry.operator_grid && ` · Grid: ${entry.operator_grid}`}{entry.operator_email && ` · ${entry.operator_email}`}</p>
                      </div>
                    )}
                    {entry.notes && <p className="text-xs text-gray-400 mt-1 italic">{entry.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {entry.status !== "archived" && (
                      <button
                        onClick={() => handleEdit(entry)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                        title="Bearbeiten"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
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
      </PullToRefresh>

      {showQsoForm && (
        <LogEntryForm
          mapCenter={null}
          allMarkers={[]}
          editEntry={editEntry}
          onClose={handleCloseForm}
          onSaved={loadEntries}
        />
      )}

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

      <BottomNavigation />
    </div>
  );
}