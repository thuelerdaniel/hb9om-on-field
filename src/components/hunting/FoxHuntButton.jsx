import React from "react";
import { Crosshair } from "lucide-react";

// Fox Hunting Button — gross, grün #8cff00, schwarzer Text, full-width.
// Öffnet das FoxHuntModal beim Klick.

export default function FoxHuntButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 bg-[#8cff00] text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#7aee00] active:scale-[0.98] transition-all shadow-lg shadow-[#8cff00]/20"
    >
      <Crosshair className="w-5 h-5" />
      🦊 FOX HUNTING — Fuchsjagd starten
    </button>
  );
}