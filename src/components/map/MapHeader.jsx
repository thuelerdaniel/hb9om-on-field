import React from "react";
import { Link } from "react-router-dom";
import { Search, Menu, X, BookOpen, Settings as SettingsIcon, HelpCircle } from "lucide-react";

export default function MapHeader({ searchQuery, onSearchChange, onToggleSidebar, sidebarOpen }) {
  return (
    <header className="absolute top-0 left-0 right-0 z-[1001] bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button onClick={onToggleSidebar} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="hidden sm:block">
          <h1 className="text-sm font-bold text-gray-900 leading-tight">HB9OM On Field</h1>
          <p className="text-[10px] text-gray-400 leading-tight">Amateurfunk Referenzkarte</p>
        </div>

        <div className="flex-1 max-w-md ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Referenz oder Ort suchen..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
            />
          </div>
        </div>

        <Link
          to="/settings"
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 transition-colors"
          title="Einstellungen"
        >
          <SettingsIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Einstellungen</span>
        </Link>
        <Link
          to="/log"
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg flex items-center gap-1.5 transition-colors"
          title="QSO-Logbuch"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Logbuch</span>
        </Link>
        <Link
          to="/help"
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Hilfe"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}