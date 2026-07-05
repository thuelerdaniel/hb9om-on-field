import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MapPin, BookOpen, Settings as SettingsIcon } from "lucide-react";

const NAV_ITEMS = [
  { path: "/", label: "Karte", icon: MapPin },
  { path: "/log", label: "Logbuch", icon: BookOpen },
  { path: "/settings", label: "Einstell.", icon: SettingsIcon },
];

export default function BottomNavigation() {
  const location = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[999] bg-white border-t border-gray-200 flex items-center justify-around"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_ITEMS.map(item => {
        const active = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center gap-0.5 px-5 py-2 transition-colors ${active ? "text-gray-900" : "text-gray-400"}`}
          >
            <Icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}