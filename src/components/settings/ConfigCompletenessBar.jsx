import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

/**
 * Configuration completeness bar.
 * Point 10: Shows a progress bar indicating how many configurations are complete
 * for 100% functionality. Missing items link to the corresponding settings section.
 */
export default function ConfigCompletenessBar({
  items, // [{ label, configured, link, helpText, requiredFor }]
}) {
  const completed = items.filter(i => i.configured).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const missing = items.filter(i => !i.configured);

  const barColor = pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
          {pct === 100
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : <AlertCircle className="w-4 h-4 text-amber-500" />}
          Konfigurations-Status
        </h3>
        <span className={`text-sm font-bold ${pct === 100 ? "text-green-600" : "text-amber-600"}`}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>

      {/* Missing items */}
      {missing.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-500">Fehlende Konfigurationen:</p>
          {missing.map((item, idx) => (
            <Link
              key={idx}
              to={item.link || "/settings"}
              className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-slate-100">{item.label}</p>
                {item.helpText && (
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">{item.helpText}</p>
                )}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ))}
        </div>
      )}

      {pct === 100 && (
        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Alle Konfigurationen erfasst – volle Funktionalität verfügbar!
        </p>
      )}
    </div>
  );
}