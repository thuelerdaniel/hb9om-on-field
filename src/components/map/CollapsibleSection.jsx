import React from "react";
import { ChevronDown } from "lucide-react";
import { useUISettings } from "@/lib/UISettingsContext";

// CollapsibleSection — Accordion-Sektion für Filter-/Layer-Popups.
// Per Default EINGEKLAPPT, damit nur die wichtigsten Optionen sichtbar sind.
// Der auf-/zugeklappte Zustand wird pro User in UserHuntingSettings.ui_settings
// persistiert (Schlüssel: sections[<id>]) und beim erneuten Öffnen wiederhergestellt.
//
// Min. 44px Touch-Ziel auf dem Header, Dark/Light-fähig.

export default function CollapsibleSection({
  id,
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  className = "",
  headerClassName = "",
  contentClassName = "",
  activeIndicator = false,
  titleClassName = "",
}) {
  const { ui, updateUI } = useUISettings();
  const sections = (ui && ui.sections) || {};
  const isOpen = sections[id] !== undefined ? sections[id] === true : defaultOpen;

  const toggle = () => updateUI({ sections: { ...sections, [id]: !isOpen } });

  return (
    <div className={`border-b border-gray-100 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
          isOpen ? "bg-gray-50 text-gray-800" : "text-gray-600 hover:bg-gray-50"
        } ${headerClassName}`}
      >
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          <span className={titleClassName}>{title}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {activeIndicator && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>
      {isOpen && <div className={contentClassName}>{children}</div>}
    </div>
  );
}