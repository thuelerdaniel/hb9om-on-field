import React, { useState, useEffect, useMemo } from "react";
import {
  X, Download, Loader2, Search, ChevronLeft, ChevronRight, Table, AlertCircle, Info,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

// CacheDetailView — modal showing tabular data for a specific cache layer.
// Supports search, pagination, CSV export, and paginated loading beyond the
// platform's 5000-record filter cap via ID-based cursor pagination.
// Props: layerKey, layerLabel, onClose

const PAGE_SIZE = 50;
const LOAD_BATCH = 5000;
const MAX_RECORDS = 50000; // Safety limit to avoid excessive loading

const LAYER_CONFIG = {
  sota: { entity: "SotaPoint", refType: "sota", columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "altitude_m", label: "Höhe (m)" },
    { key: "points", label: "Punkte" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  pota: { entity: "PotaPoint", refType: "pota", columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "parkType", label: "Typ" },
    { key: "active", label: "Aktiv" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  hbff: { entity: "WwffPoint", refType: "hbff", columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "link", label: "Link" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  wwbota: { entity: "ReferenceData", filter: { type: "wwbota" }, columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  castle: { entity: "ReferenceData", filter: { type: "castle" }, columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  lighthouse: { entity: "ReferenceData", filter: { type: "lighthouse" }, columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  iota: { entity: "ReferenceData", filter: { type: "iota" }, columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  repeater: { entity: "Repeater", columns: [
    { key: "callsign", label: "Rufzeichen" },
    { key: "frequency", label: "Freq (MHz)" },
    { key: "band", label: "Band" },
    { key: "primary_mode", label: "Modus" },
    { key: "country", label: "Land" },
    { key: "status", label: "Status" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  aprs: { entity: "PrivateNode", columns: [
    { key: "callsign", label: "Rufzeichen" },
    { key: "node_type", label: "Typ" },
    { key: "network", label: "Netzwerk" },
    { key: "country", label: "Land" },
    { key: "status", label: "Status" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  tota: { entity: "TotaPoint", columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "type", label: "Typ" },
    { key: "country", label: "Land" },
    { key: "height_m", label: "Höhe (m)" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  repeaterLinks: { entity: "RepeaterLink", filter: { status: "approved" }, columns: [
    { key: "from_callsign", label: "Von" },
    { key: "from_frequency", label: "Von Freq" },
    { key: "to_callsign", label: "Nach" },
    { key: "to_frequency", label: "Nach Freq" },
    { key: "network", label: "Netzwerk" },
    { key: "link_type", label: "Typ" },
  ]},
};

function exportCsv(data, columns, filename) {
  const header = columns.map(c => `"${c.label}"`).join(",");
  const rows = data.map(row =>
    columns.map(c => {
      let val = row[c.key];
      if (val == null) val = "";
      if (typeof val === "string") val = val.replace(/"/g, '""');
      return `"${val}"`;
    }).join(",")
  );
  const csv = "\uFEFF" + [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Paginated loader: loads ALL records from an entity, bypassing the 5000-record
// platform cap via ID-based cursor pagination. Sorts by _id ascending and uses
// $gt on the last seen _id to fetch the next batch.
async function loadAllRecords(entityName, filter, onProgress) {
  const allRecords = [];
  let lastId = null;

  while (allRecords.length < MAX_RECORDS) {
    let query;
    if (filter) {
      query = lastId ? { ...filter, _id: { $gt: lastId } } : filter;
    } else {
      query = lastId ? { _id: { $gt: lastId } } : {};
    }

    let batch;
    try {
      batch = await base44.entities[entityName].filter(query, "_id", LOAD_BATCH);
    } catch (e) {
      break;
    }

    if (!batch || batch.length === 0) break;
    allRecords.push(...batch);
    lastId = batch[batch.length - 1].id;

    if (onProgress) onProgress(allRecords.length);
    if (batch.length < LOAD_BATCH) break;
  }

  return allRecords;
}

export default function CacheDetailView({ layerKey, layerLabel, onClose }) {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [refTotalCount, setRefTotalCount] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const config = LAYER_CONFIG[layerKey];

  useEffect(() => {
    if (!config) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      setLoadProgress(0);
      try {
        let data;

        if (config.entity === "ReferenceData" && config.filter) {
          // ReferenceData layers: data is in the references array of a single record
          data = await base44.entities.ReferenceData.filter(config.filter);
          if (data?.length > 0 && data[0].references) {
            data = data[0].references;
          } else {
            data = [];
          }
        } else if (config.filter) {
          // Entity with a filter (e.g. RepeaterLink approved) — use paginated loader
          data = await loadAllRecords(config.entity, config.filter, (count) => {
            setLoadProgress(count);
          });
        } else {
          // Entity without filter — use paginated loader to bypass 5000 cap
          data = await loadAllRecords(config.entity, null, (count) => {
            setLoadProgress(count);
          });
        }

        setAllData(data || []);
      } catch (e) {
        setAllData([]);
      } finally {
        setLoading(false);
      }

      // Fetch ReferenceData total_count for comparison (if this layer has a refType)
      if (config.refType) {
        try {
          const refData = await base44.entities.ReferenceData.filter({ type: config.refType });
          if (refData?.length > 0) {
            setRefTotalCount(refData[0].total_count || 0);
          }
        } catch (e) {
          // ignore
        }
      }
    })();
  }, [layerKey]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allData;
    const q = search.toLowerCase();
    return allData.filter(row =>
      config.columns.some(c => {
        const val = row[c.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [allData, search, config]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExport = async () => {
    setExporting(true);
    try {
      exportCsv(filtered, config.columns, layerKey);
    } finally {
      setExporting(false);
    }
  };

  if (!config) return null;

  // Determine if data is capped (loaded less than ReferenceData total_count)
  const isCapped = refTotalCount != null && refTotalCount > allData.length;
  const hasNoRecords = allData.length === 0 && !loading;

  return (
    <div className="fixed inset-0 z-[10005] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <Table className="w-5 h-5 text-gray-600 dark:text-slate-300 flex-shrink-0" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
              {layerLabel} – {filtered.length.toLocaleString("de-CH")} Einträge
            </h2>
            {refTotalCount != null && refTotalCount !== allData.length && (
              <span
                className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5 flex-shrink-0"
                title={`ReferenceData.total_count meldet ${refTotalCount.toLocaleString("de-CH")} Einträge. Geladen: ${allData.length.toLocaleString("de-CH")}. Die Differenz entsteht, weil die Daten nur als Zählwert (total_count) gespeichert wurden, nicht als einzelne Entity-Records. Die Detail-Tabelle zeigt nur die tatsächlich gespeicherten Records.`}
              >
                <AlertCircle className="w-3 h-3" />
                von {refTotalCount.toLocaleString("de-CH")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleExport}
              disabled={exporting || filtered.length === 0}
              className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-40 flex items-center gap-1.5"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              CSV Export
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Loading progress indicator */}
        {loading && loadProgress > 0 && (
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800/50">
            <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Lade Datensätze... {loadProgress.toLocaleString("de-CH")} geladen
            </div>
          </div>
        )}

        {/* Cap warning */}
        {isCapped && !loading && (
          <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50">
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Geladen: {allData.length.toLocaleString("de-CH")} von {refTotalCount.toLocaleString("de-CH")} (ReferenceData.total_count).
                Die fehlenden Einträge wurden nur als Zählwert gespeichert, nicht als einzelne Datensätze.
                Der CSV-Export enthält nur die geladenen {allData.length.toLocaleString("de-CH")} Datensätze.
              </span>
            </div>
          </div>
        )}

        {/* No records message */}
        {hasNoRecords && refTotalCount != null && refTotalCount > 0 && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50">
            <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Keine einzelnen Datensätze in der Entity vorhanden. ReferenceData meldet {refTotalCount.toLocaleString("de-CH")} Einträge,
                aber diese wurden nur als Zählwert (total_count) gespeichert. Die Detail-Tabelle ist daher leer.
                Eine Aktualisierung der Datenquelle ist erforderlich, um einzelne Datensätze zu laden.
              </span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-3 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Suchen nach Code, Name, Rufzeichen..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {loadProgress > 0 ? `${loadProgress.toLocaleString("de-CH")} Datensätze geladen...` : "Lade Daten..."}
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 dark:text-slate-500">
              {hasNoRecords && refTotalCount != null && refTotalCount > 0
                ? "Keine einzelnen Datensätze vorhanden – siehe Hinweis oben"
                : "Keine Einträge gefunden"}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-900 z-10">
                <tr>
                  {config.columns.map(c => (
                    <th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-400 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map((row, i) => (
                  <tr key={row.id || i} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-900">
                    {config.columns.map(c => (
                      <td key={c.key} className="px-3 py-1.5 text-gray-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] truncate" title={String(row[c.key] ?? "")}>
                        {row[c.key] == null ? "—" : String(row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-slate-700">
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Seite {page + 1} / {totalPages} · {filtered.length.toLocaleString("de-CH")} Einträge
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-2 py-1 text-xs border border-gray-200 dark:border-slate-700 rounded-lg disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Zurück
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-xs border border-gray-200 dark:border-slate-700 rounded-lg disabled:opacity-40 flex items-center gap-1"
              >
                Weiter <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}