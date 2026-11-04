import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MapPin, BookOpen, Settings as SettingsIcon, LogOut, Shield, Crosshair, Navigation, Layers } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAppFeatures } from "@/lib/appFeatures";
import { requestLayerMenu } from "@/lib/layerMenuBus";
import { Z } from "@/lib/zLayers";

// Untere Menüleiste (v1.0).
//
// Neu in v1.0: Das Ebenen-Menü hat hier seinen Platz — zwischen «Karte» und
// «Hunting». Es ist damit auf jeder Seite erreichbar. Die Leiste bleibt auch bei
// 390 px Breite vollständig bedienbar: kompakte Icons, 9-px-Beschriftungen,
// gleichbreite Segmente, kein Abschneiden.
export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { features: rawFeatures } = useAppFeatures();
  const features = rawFeatures || { tools: {}, layers: {}, bands: {} };
  const tools = features.tools || {};
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        setIsAdmin(me?.role === "admin");
      } catch {}
    })();
  }, []);

  const handleLogout = async () => {
    try {
      await base44.auth.logout("/login");
    } catch (e) {
      window.location.href = "/login";
    }
  };

  // Ebenen-Menü: auf der Karte direkt öffnen, von jeder anderen Seite zur Karte
  // wechseln und dort öffnen (die Karte holt die Anfrage beim Aufbau ab).
  const handleOpenLayers = () => {
    requestLayerMenu();
    if (location.pathname !== "/") navigate("/");
  };

  const itemClass = (active, extra = "") =>
    `flex-1 min-w-0 basis-0 min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition-colors touch-manipulation select-none ${
      active ? "text-gray-900 dark:text-slate-100" : "text-gray-400 dark:text-slate-500"
    } ${extra}`;

  const labelClass = "text-[9px] font-medium leading-none whitespace-nowrap";
  const iconClass = (active) => `w-[18px] h-[18px] ${active ? "scale-110" : ""} transition-transform`;

  // Feste Reihenfolge: Karte · Ebenen · Hunting · Logbuch · Mobil · Einstellungen
  const items = [
    { path: "/", label: "Karte", icon: MapPin },
    { action: "layers", label: "Ebenen", icon: Layers },
    { path: "/hunting", label: "Hunting", icon: Crosshair },
  ];
  if (tools.logbook !== false) items.push({ path: "/log", label: "Logbuch", icon: BookOpen });
  items.push({ path: "/mobil", label: "Mobil", icon: Navigation });
  items.push({ path: "/settings", label: "Einstell.", icon: SettingsIcon });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-stretch gap-0"
      style={{
        zIndex: Z.BOTTOM_NAV,
        paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
        minHeight: "48px",
        touchAction: "manipulation",
      }}
    >
      {items.map(item => {
        const Icon = item.icon;

        if (item.action === "layers") {
          return (
            <button
              key="layers"
              onClick={handleOpenLayers}
              className={itemClass(false, "hover:text-blue-600 dark:hover:text-blue-400")}
              title="Ebenen-Menü öffnen"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <Icon className={iconClass(false)} />
              <span className={labelClass}>{item.label}</span>
            </button>
          );
        }

        const active = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={itemClass(active)}
            title={item.label}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <Icon className={iconClass(active)} />
            <span className={labelClass}>{item.label}</span>
          </Link>
        );
      })}

      {/* Admin-Link — rot, nur für Admins */}
      {isAdmin && (
        <Link
          to="/settings"
          className={itemClass(
            location.pathname.startsWith("/admin"),
            location.pathname.startsWith("/admin") ? "text-red-600 dark:text-red-400" : "text-red-500 dark:text-red-400"
          )}
          title="Admin-Menü"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Shield className={iconClass(location.pathname.startsWith("/admin"))} />
          <span className="text-[9px] font-bold leading-none text-red-500 dark:text-red-400">Admin</span>
        </Link>
      )}

      <button
        onClick={handleLogout}
        className={itemClass(false, "hover:text-red-500 dark:hover:text-red-400")}
        title="Abmelden"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <LogOut className={iconClass(false)} />
        <span className={labelClass}>Abmelden</span>
      </button>
    </nav>
  );
}