import React, { useState } from "react";
import { X, MapPin, Check } from "lucide-react";

// Station Locator Dialog — öffnet beim Klick auf "Station Ready" in der CommandStrip.
// Validiert Maidenhead-Locator (4-6 Zeichen: BBddbb oder BBdd).
// Speichert in localStorage "station_locator" UND in User-Entity.

const LOCATOR_REGEX = /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i;

export default function StationLocatorDialog({ currentLocator, onSave, onClose }) {
  const [locator, setLocator] = useState(currentLocator || '');
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = locator.trim().toUpperCase();
    if (!trimmed) { setError('Locator darf nicht leer sein'); return; }
    if (!LOCATOR_REGEX.test(trimmed)) {
      setError('Format: 2 Buchstaben + 2 Zahlen + optional 2 Buchstaben (z.B. JN58LK)');
      return;
    }
    onSave(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#8cff00]" /> Station bereit?
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-1 block">Ihr Maidenhead-Locator (z.B. JN58LK):</label>
            <input
              type="text"
              value={locator}
              onChange={e => { setLocator(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="JN58LK"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-[#00e5ff] outline-none uppercase font-mono"
              maxLength={6}
              autoFocus
            />
            {error && <p className="text-[10px] text-[#ef4444] mt-1">{error}</p>}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Der Locator wird als Fallback verwendet wenn kein GPS-Empfang verfügbar ist.
            Reihenfolge: 1. GPS 2. gespeicherter Locator 3. Standard (JN47OQ).
          </div>
          <button
            onClick={handleSave}
            className="w-full py-2.5 bg-[#8cff00] text-black rounded-lg text-sm font-bold hover:bg-[#7aee00] transition-colors flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Speichern
          </button>
        </div>
      </div>
    </div>
  );
}