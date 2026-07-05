import React from "react";
import { MapPin, X } from "lucide-react";

export default function SearchResults({ results, onSelect, onClose }) {
  if (!results || results.length === 0) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1002] bg-white rounded-xl shadow-2xl border border-gray-100 w-[90%] max-w-md max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase">{results.length} Ergebnis{results.length !== 1 ? 'se' : ''}</span>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
      </div>
      <div className="divide-y divide-gray-50">
        {results.slice(0, 50).map((r, i) => (
          <button
            key={i}
            onClick={() => onSelect(r)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
          >
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color || '#6b7280' }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{r.name || r.code || r.reference}</p>
              <p className="text-xs text-gray-400 truncate">{r.layerLabel} · {r.code || r.reference}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}