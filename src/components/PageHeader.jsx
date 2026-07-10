import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/**
 * Standard unified page header with a native-like back button (ChevronLeft)
 * positioned inside a safe-area-aware sticky header.
 */
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  iconBg = "bg-gray-900",
  iconColor = "text-white",
  maxWidthClass = "max-w-4xl",
  children,
  titleExtra,
}) {
  const navigate = useNavigate();

  return (
    <header
      className="bg-white border-b border-gray-200 sticky top-0 z-10"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className={`${maxWidthClass} mx-auto px-4 py-3 flex items-center gap-2`}>
        <button
          onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")}
          className="p-1.5 hover:bg-gray-100 rounded-lg active:bg-gray-200 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-gray-900 truncate">{title}</h1>
            {titleExtra}
          </div>
          {subtitle && <p className="text-[10px] text-gray-400 truncate">{subtitle}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}