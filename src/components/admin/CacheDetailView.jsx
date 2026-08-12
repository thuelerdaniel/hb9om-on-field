import React, { useState, useEffect, useMemo } from "react";
import {
  X, Download, Loader2, Search, ChevronLeft, ChevronRight, Table,
} from "lucide-react";
import { base44 } from "@/api/base44Client";

// CacheDetailView — modal showing tabular data for a specific cache layer.
// Supports search, pagination, and CSV export.
// Props: layerKey, layerLabel, onClose

const PAGE_SIZE = 50;

const LAYER_CONFIG = {
  sota: { entity: "SotaPoint", columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "altitude_m", label: "Höhe (m)" },
    { key: "points", label: "Punkte" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  pota: { entity: "PotaPoint", columns: [
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "parkType", label: "Typ" },
    { key: "active", label: "Aktiv" },
    { key: "lat", label: "Lat" },
    { key: "lng", label: "Lng" },
  ]},
  hbff: { entity: "WwffPoint", columns: [
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

export default function CacheDetailView({ layerKey, layerLabel, onClose }) {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const config = LAYER_CONFIG[layerKey];

  useEffect(() => {
    if (!config) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        let data;
        if (config.filter) {
          data = await base44.entities[config.entity].filter(config.filter);
        } else {
          data = await base44.entities[config.entity].list("-created_date", 10000);
        }
        // For ReferenceData layers, extract references array
        if (config.entity === "ReferenceData" && data?.length > 0 && data[0].references) {
          data = data[0].references;
        }
        setAllData(data || []);
      } catch (e) {
        setAllData([]);
      } finally {
        setLoading(false);
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

  return (
    <div className="fixed inset-0 z-[10005] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-gray-600 dark:text-slate-300" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">
              {layerLabel} – {filtered.length.toLocaleString("de-CH")} Einträge
            </h2>
          </div>
          <div className="flex items-center gap-2">
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
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 dark:text-slate-500">
              Keine Einträge gefunden
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