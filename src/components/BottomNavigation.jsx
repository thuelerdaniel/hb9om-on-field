import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MapPin, BookOpen, Settings as SettingsIcon, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAppFeatures } from "@/lib/appFeatures";

export default function BottomNavigation() {
  const location = useLocation();
  const { features: rawFeatures } = useAppFeatures();
  const features = rawFeatures || { tools: {}, layers: {}, bands: {} };
  const tools = features.tools || {};

  const handleLogout = async () => {
    try {
      await base44.auth.logout("/login");
    } catch (e) {
      window.location.href = "/login";
    }
  };

  // Build nav items based on feature flags
  // Karte (always), Logbuch (if enabled), Einstellungen (always), Abmelden (always)
  const navItems = [
    { path: "/", label: "Karte", icon: MapPin, always: true },
  ];
  if (tools.logbook !== false) {
    navItems.push({ path: "/log", label: "Logbuch", icon: BookOpen });
  }
  navItems.push({ path: "/settings", label: "Einstell.", icon: SettingsIcon });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[1000] bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-center justify-around gap-1"
      style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}
    >
      {navItems.map(item => {
        const active = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${active ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"}`}
            title={item.label}
          >
            <Icon className={`w-4 h-4 ${active ? "scale-110" : ""} transition-transform`} />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        );
      })}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center gap-0.5 px-2 py-1 text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        title="Abmelden"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-[10px] font-medium leading-none">Abmelden</span>
      </button>
    </nav>
  );
}