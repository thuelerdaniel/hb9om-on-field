import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export default function PageHeader({ title, subtitle, icon: Icon, iconBg, iconColor, children, maxWidth = "max-w-5xl" }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <header
      className="bg-white border-b border-gray-200 sticky top-0 z-10 flex-shrink-0"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className={`${maxWidth} mx-auto px-4 py-3 flex items-center gap-2`}>
        <button
          onClick={handleBack}
          className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-lg active:scale-90 transition-transform flex-shrink-0"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {Icon && (
            <div className={`w-8 h-8 ${iconBg || "bg-gray-900"} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${iconColor || "text-white"}`} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">{title}</h1>
            {subtitle != null && <div className="text-[10px] text-gray-400 truncate">{subtitle}</div>}
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}