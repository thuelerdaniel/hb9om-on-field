import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, X, Search, Info } from "lucide-react";
import CountryContinentFilter from "@/components/map/CountryContinentFilter";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { safeSetItem, safeGetItem } from "@/lib/safeStorage";

// UnifiedFilterShell — PUNKT 8: Shared filter component for all reference layers.
// Provides a consistent UI structure: search field, country dropdown, layer-specific
// filters (passed as children), count display.
//
// Props:
// - icon: Lucide icon component
// - iconColor: tailwind/text color for icon
// - title: filter title (e.g. "WCA – Burgen & Schlösser")
// - layerKey: unique key for localStorage (e.g. "wca", "wwbota")
// - searchQuery, onSearchQueryChange: search field state
// - pointCount, visibleCount: counts for display
// - points: array of point objects (for country extraction)
// - filterCountries, onFilterCountriesChange: country filter state
// - accentColor: tailwind color name for accents (e.g. "orange", "brown")
// - children: layer-specific filter sections (rendered between search and country filter)
// - extractCountryCode: function(point) → ISO2 code (defaults to code prefix extraction)
// - extractCountryName: function(point) → country name (defaults to code prefix)
// - infoText: description text for the info section
// - leftPx, bottomPx: position for fixed layout
// - leftOffsetClass: alternative position class for absolute layout
// - positionMode: "fixed" (default) or "absolute"

export default function UnifiedFilterShell({
  icon: Icon,
  iconColor = "text-gray-600",
  title,
  layerKey,
  searchQuery,
  onSearchQueryChange,
  pointCount = 0,
  visibleCount = 0,
  points = [],
  filterCountries = [],
  onFilterCountriesChange,
  accentColor = "blue",
  children,
  extractCountryCode,
  extractCountryName,
  infoText = "",
  leftPx = 12,
  bottomPx = 230,
  leftOffsetClass = null,
  positionMode = "fixed",
  defaultOpen = true,
  badgeCount = null,
}) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = safeGetItem(`hb9om_filter_open_${layerKey}`);
    if (saved !== null) return saved === "true";
    return defaultOpen;
  });
  const { containerRef } = useDraggablePosition(`drag-${layerKey}-filter`);

  useEffect(() => { safeSetItem(`hb9om_filter_open_${layerKey}`, String(isOpen)); }, [isOpen, layerKey]);

  const countries = useMemo(() => {
    const counts = {};
    for (const p of points) {
      const cc = extractCountryCode
        ? extractCountryCode(p)
        : (p.country_code || p.code?.split(/[/ -]/)[0] || "?");
      const name = extractCountryName
        ? extractCountryName(p)
        : (p.country || cc);
      counts[cc] = counts[cc] || { code: cc, name, count: 0 };
      counts[cc].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [points, extractCountryCode, extractCountryName]);

  const containerClass = positionMode === "absolute"
    ? `absolute top-16 ${leftOffsetClass} z-[1005]`
    : "fixed z-[1000]";
  const containerStyle = positionMode === "fixed"
    ? { left: `${leftPx}px`, bottom: `${bottomPx}px`, touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }
    : { touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" };

  const accentBorderClass = {
    blue: "border-blue-400", red: "border-red-400", green: "border-green-400",
    purple: "border-purple-400", orange: "border-orange-400", brown: "border-amber-700",
  }[accentColor] || "border-gray-400";

  return (
    <div ref={containerRef} className={containerClass} style={containerStyle}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`bg-white shadow-lg rounded-lg p-2.5 transition-colors border flex items-center gap-1.5 ${
          isOpen ? accentBorderClass : "border-gray-200 hover:bg-gray-50"
        }`}
        title={`${title} Filter`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <span className="text-xs font-medium text-gray-700 hidden sm:inline">{layerKey.toUpperCase()}</span>
        <span className="text-[10px] font-mono text-gray-400">{visibleCount}</span>
        {badgeCount != null && badgeCount > 0 && (
          <span className={`px-1 py-0.5 rounded-full text-[9px] font-bold ${
            accentColor === "orange" ? "bg-orange-100 text-orange-700"
            : accentColor === "brown" ? "bg-amber-100 text-amber-800"
            : accentColor === "red" ? "bg-red-100 text-red-700"
            : accentColor === "green" ? "bg-green-100 text-green-700"
            : accentColor === "purple" ? "bg-purple-100 text-purple-700"
            : "bg-blue-100 text-blue-700"
          }`}>
            {badgeCount}
          </span>
        )}
        {filterCountries.length > 0 && (
          <span className={`px-1 py-0.5 rounded-full text-[9px] font-bold ${
            accentColor === "orange" ? "bg-orange-100 text-orange-700"
            : accentColor === "brown" ? "bg-amber-100 text-amber-800"
            : accentColor === "red" ? "bg-red-100 text-red-700"
            : accentColor === "green" ? "bg-green-100 text-green-700"
            : accentColor === "purple" ? "bg-purple-100 text-purple-700"
            : "bg-blue-100 text-blue-700"
          }`}>
            {filterCountries.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-12 left-0 z-[1010] bg-white rounded-xl shadow-2xl border border-gray-100 w-72 max-w-[calc(100vw-1.5rem)] max-h-[85vh] overflow-y-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1.5">
              <Icon className={`w-4 h-4 ${iconColor}`} /> {title}
            </h3>
            <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-gray-100 rounded text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Referenz, Name..."
                className={`w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 ${
                  accentColor === "orange" ? "focus:ring-orange-300"
                  : accentColor === "brown" ? "focus:ring-amber-300"
                  : accentColor === "red" ? "focus:ring-red-300"
                  : accentColor === "green" ? "focus:ring-green-300"
                  : accentColor === "purple" ? "focus:ring-purple-300"
                  : "focus:ring-blue-300"
                }`}
              />
              {searchQuery && (
                <button onClick={() => onSearchQueryChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded text-gray-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {children}

          <CountryContinentFilter
            countries={countries}
            selectedCountries={filterCountries}
            onCountriesChange={onFilterCountriesChange}
            accentColor={accentColor === "brown" ? "orange" : accentColor}
          />

          {infoText && (
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Info className="w-3.5 h-3.5 text-gray-400" />
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Über {layerKey.toUpperCase()}</h4>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">{infoText}</p>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2">
                <span>{visibleCount} von {pointCount} Punkten</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}