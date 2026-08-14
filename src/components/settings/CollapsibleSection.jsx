import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Collapsible section wrapper for settings menus.
 * Points 5, 6, 7: collapsible menus with default-closed state.
 * Point 8: optional help link to corresponding help section.
 */
export default function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  helpAnchor = null,   // e.g. "#karte-anzeige" — appended to /help URL
  helpLabel = "Hilfe zu diesem Bereich",
  children,
  rightContent = null, // optional content on the right side of header (e.g. status badge)
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 dark:text-slate-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />}
          <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{title}</h3>
          {rightContent}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {helpAnchor && (
            <Link
              to={`/help${helpAnchor}`}
              onClick={e => e.stopPropagation()}
              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-gray-400 hover:text-blue-500"
              title={helpLabel}
            >
              <HelpCircle className="w-4 h-4" />
            </Link>
          )}
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}