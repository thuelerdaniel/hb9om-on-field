import React, { useMemo } from "react";
import { BarChart3, Radio, MapPin, Globe, Building, Calendar, TrendingUp } from "lucide-react";

const REF_TYPE_LABELS = {
  sota: "SOTA", pota: "POTA", hbff: "WWFF", wwbota: "WWBOTA",
  castle: "Burg/Schloss", iota: "IOTA", lighthouse: "Leuchtturm",
  swiss_protected: "Bundesinventar", generell: "Generell", custom: "Eigenes"
};

const REF_COLORS = {
  sota: "#ef4444", pota: "#f97316", hbff: "#22c55e", wwbota: "#3b82f6",
  castle: "#a855f7", iota: "#06b6d4", lighthouse: "#eab308",
  swiss_protected: "#14b8a6", generell: "#6b7280", custom: "#94a3b8"
};

export default function LogStats({ entries }) {
  const stats = useMemo(() => {
    const total = entries.length;
    const byBand = {};
    const byMode = {};
    const byRefType = {};
    const byMonth = {};
    const uniqueCallsigns = new Set();
    const uniqueRefs = new Set();
    let clubstationCount = 0;

    entries.forEach(e => {
      byBand[e.band || "Other"] = (byBand[e.band || "Other"] || 0) + 1;
      byMode[e.mode || "Other"] = (byMode[e.mode || "Other"] || 0) + 1;
      const rt = e.my_reference_type || "custom";
      byRefType[rt] = (byRefType[rt] || 0) + 1;
      if (e.is_clubstation) clubstationCount++;
      if (e.callsign) uniqueCallsigns.add(e.callsign.toUpperCase());
      if (e.my_reference) uniqueRefs.add(e.my_reference);
      if (e.qso_date) {
        const month = e.qso_date.slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
      }
    });

    const sortByCount = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

    return {
      total,
      byBand: sortByCount(byBand),
      byMode: sortByCount(byMode),
      byRefType: sortByCount(byRefType),
      byMonth: months,
      uniqueCallsigns: uniqueCallsigns.size,
      uniqueRefs: uniqueRefs.size,
      clubstationCount
    };
  }, [entries]);

  const maxBand = stats.byBand[0]?.[1] || 1;
  const maxMode = stats.byMode[0]?.[1] || 1;
  const maxRef = stats.byRefType[0]?.[1] || 1;
  const maxMonth = Math.max(...stats.byMonth.map(m => m[1]), 1);

  const Bar = ({ label, count, max, color }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 w-20 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${(count / max) * 100}%`, backgroundColor: color }}
        />
        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-gray-900">
          {count}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <Radio className="w-4 h-4 text-gray-400 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-[10px] text-gray-500">QSOs gesamt</p>
        </div>
        <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <Globe className="w-4 h-4 text-gray-400 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{stats.uniqueCallsigns}</p>
          <p className="text-[10px] text-gray-500">einzelne Rufzeichen</p>
        </div>
        <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <MapPin className="w-4 h-4 text-gray-400 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{stats.uniqueRefs}</p>
          <p className="text-[10px] text-gray-500">Referenzen aktiviert</p>
        </div>
        <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
          <Building className="w-4 h-4 text-gray-400 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{stats.clubstationCount}</p>
          <p className="text-[10px] text-gray-500">Clubstations-QSOs</p>
        </div>
      </div>

      {/* By Band */}
      <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4" /> QSOs pro Band
        </h2>
        {stats.byBand.length === 0 ? (
          <p className="text-xs text-gray-400">Keine Daten</p>
        ) : (
          <div className="space-y-1.5">
            {stats.byBand.map(([band, count]) => (
              <Bar key={band} label={band} count={count} max={maxBand} color="#3b82f6" />
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By Mode */}
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
            <Radio className="w-4 h-4" /> QSOs pro Mode
          </h2>
          {stats.byMode.length === 0 ? (
            <p className="text-xs text-gray-400">Keine Daten</p>
          ) : (
            <div className="space-y-1.5">
              {stats.byMode.map(([mode, count]) => (
                <Bar key={mode} label={mode} count={count} max={maxMode} color="#22c55e" />
              ))}
            </div>
          )}
        </section>

        {/* By Reference Type */}
        <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> QSOs pro Referenz
          </h2>
          {stats.byRefType.length === 0 ? (
            <p className="text-xs text-gray-400">Keine Daten</p>
          ) : (
            <div className="space-y-1.5">
              {stats.byRefType.map(([type, count]) => (
                <Bar
                  key={type}
                  label={REF_TYPE_LABELS[type] || type}
                  count={count}
                  max={maxRef}
                  color={REF_COLORS[type] || "#94a3b8"}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* By Month */}
      <section className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> QSOs pro Monat
        </h2>
        {stats.byMonth.length === 0 ? (
          <p className="text-xs text-gray-400">Keine Daten</p>
        ) : (
          <div className="flex items-end justify-between gap-2 h-32">
            {stats.byMonth.map(([month, count]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-gray-700">{count}</span>
                <div
                  className="w-full bg-blue-500 rounded-t-md transition-all min-h-[4px]"
                  style={{ height: `${(count / maxMonth) * 80}px` }}
                />
                <span className="text-[10px] text-gray-400">{month.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}