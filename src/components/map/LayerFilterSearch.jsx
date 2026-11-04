import React, { useMemo, useState, useRef, useEffect } from "react";
import { Search, X, MapPin } from "lucide-react";

// Einheitliches Suchfeld für ALLE Layer-Filter (Punkt F).
//
// - filtert live beim Tippen (die Filterliste darunter reagiert auf value)
// - zeigt eine Vorschlagsliste (Code/Name) für die geladenen Punkte des Layers
// - Auswahl: setzt den Filter auf den Treffer UND springt auf der Karte dorthin
//
// `items`: [{ id, label, sub, lat, lng, searchValue }]
export default function LayerFilterSearch({
  value,
  onChange,
  items = [],
  placeholder = "Suchen...",
  accent = "green",
  onLocate,
  onSelectItem,
  maxSuggestions = 8,
}) {
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);

  // Klick ausserhalb schliesst die Vorschläge
  useEffect(() => {
    if (!focused) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [focused]);

  const query = (value || "").trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (query.length < 1) return [];
    return items
      .filter(it => {
        const label = (it.label || "").toLowerCase();
        const sub = (it.sub || "").toLowerCase();
        return label.includes(query) || sub.includes(query);
      })
      .slice(0, maxSuggestions);
  }, [items, query, maxSuggestions]);

  const accentRing = {
    green: "focus:ring-green-300",
    blue: "focus:ring-blue-300",
    orange: "focus:ring-orange-300",
    purple: "focus:ring-purple-300",
    teal: "focus:ring-teal-300",
    amber: "focus:ring-amber-300",
  }[accent] || "focus:ring-blue-300";

  const pick = (item) => {
    setFocused(false);
    // Aufrufer mit eigenem Verhalten (z.B. Relais: Popup öffnen) hat Vorrang
    if (onSelectItem) {
      onSelectItem(item);
      return;
    }
    onChange(item.searchValue || item.label || "");
    if (item.lat != null && item.lng != null) onLocate?.(item.lat, item.lng, 15);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        className={`w-full pl-8 pr-8 py-2 text-xs text-gray-900 bg-white border border-gray-300 rounded-lg placeholder:text-gray-500 focus:outline-none focus:ring-2 ${accentRing}`}
      />
      {value ? (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-500 hover:bg-gray-100"
          title="Suche löschen"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}

      {focused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[1201] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((item) => (
            <button
              key={item.id}
              onClick={() => pick(item)}
              className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gray-900 truncate">{item.label}</span>
                {item.sub && (
                  <span className="block text-[11px] text-gray-600 truncate">{item.sub}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}