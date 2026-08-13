import React from "react";
import { Link } from "react-router-dom";
import { Search, Menu, X, HelpCircle } from "lucide-react";

export default function MapHeader({ searchQuery, onSearchChange, onToggleSidebar, sidebarOpen, showSearch = true }) {
  return (
    <header className="absolute top-0 left-0 right-0 z-[1001] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-slate-700 shadow-sm" style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px))" }}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button onClick={onToggleSidebar} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <img
            src="https://files.designer.hoststar.ch/f7/57/f75700fb-91da-4797-8c19-551f569930d2.png"
            alt="HB9OM"
            className="w-7 h-7 rounded object-contain"
          />
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight">HB9OM On Field</h1>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-tight">Amateurfunk Referenzkarte</p>
          </div>
        </div>

        {showSearch && (
          <div className="flex-1 max-w-md ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Referenz oder Ort suchen..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
              />
            </div>
          </div>
        )}
        {!showSearch && <div className="flex-1" />}

        <Link
          to="/help"
          className="p-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="Hilfe"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}