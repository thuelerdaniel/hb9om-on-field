import React, { useState } from "react";
import { ChevronDown, CheckCircle2, AlertCircle, XCircle, Circle } from "lucide-react";

// Traffic-light status indicator for a collapsible admin group.
// status: "ok" | "warning" | "error" | "neutral"
function StatusDot({ status }) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (status === "warning") return <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  if (status === "error") return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  return <Circle className="w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0" />;
}

// Reusable collapsible section for the admin panel.
// Groups multiple admin sub-sections under a single header with a traffic-light
// status indicator that summarizes the health of all contained items.
export default function AdminCollapsibleSection({
  title,
  description,
  icon: Icon,
  status = "neutral",
  statusLabel = "",
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const borderColor =
    status === "ok" ? "border-l-green-500" :
    status === "warning" ? "border-l-amber-500" :
    status === "error" ? "border-l-red-500" :
    "border-l-slate-300 dark:border-l-slate-600";

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 border-l-4 ${borderColor} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {Icon && <Icon className="w-5 h-5 text-gray-600 dark:text-slate-300 flex-shrink-0" />}
          <div className="text-left min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{title}</h3>
            {description && (
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusLabel && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full hidden sm:inline ${
              status === "ok" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
              status === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
              status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
              "bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400"
            }`}>
              {statusLabel}
            </span>
          )}
          <StatusDot status={status} />
          <ChevronDown className={`w-5 h-5 text-gray-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="space-y-4 p-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}