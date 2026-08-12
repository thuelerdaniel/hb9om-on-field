import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MapPin, BookOpen, Settings as SettingsIcon, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";

const NAV_ITEMS = [
  { path: "/", label: "Karte", icon: MapPin },
  { path: "/log", label: "Logbuch", icon: BookOpen },
  { path: "/settings", label: "Einstell.", icon: SettingsIcon },
];

export default function BottomNavigation() {
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await base44.auth.logout("/login");
    } catch (e) {
      window.location.href = "/login";
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[999] bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-center justify-around gap-1"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_ITEMS.map(item => {
        const active = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 px-2 sm:px-4 py-1.5 transition-colors ${active ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"}`}
          >
            <Icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center gap-0.5 px-2 sm:px-4 py-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        title="Abmelden"
      >
        <LogOut className="w-5 h-5" />
        <span className="text-[10px] font-medium">Abmelden</span>
      </button>
    </nav>
  );
}