import React from "react";
import { X, Moon } from "lucide-react";
import { getMoonPosition } from "@/lib/moonPosition";

// Mond-Info-Popup — öffnet beim Klick auf den Mond.
// Zeigt Mondphase, Beleuchtungsgrad, ekliptische Koordinaten und Distanz.
// Dark theme mit teal-border (#4fd1c5), z-index 10000.

function getPhaseName(phase) {
  if (phase < 0.03 || phase > 0.97) return "Neumond 🌑";
  if (phase < 0.22) return "Zunehmende Sichel 🌒";
  if (phase < 0.28) return "Erstes Viertel 🌓";
  if (phase < 0.47) return "Zunehmender Mond 🌔";
  if (phase < 0.53) return "Vollmond 🌕";
  if (phase < 0.72) return "Abnehmender Mond 🌖";
  if (phase < 0.78) return "Letztes Viertel 🌗";
  return "Abnehmende Sichel 🌘";
}

function getMoonriseSet(lat, eclipticLon) {
  // Vereinfachte Berechnung: Mondaufgang ca. 50 Min später pro Tag nach Sonnenuntergang
  // Für Visualisierung — nicht astronomisch exakt
  const now = new Date();
  const hour = now.getHours();
  const moonHour = (eclipticLon / 15) % 24; // Grobe Näherung
  const riseHour = Math.round(moonHour);
  const setHour = Math.round((moonHour + 12) % 24);
  const fmt = (h) => `${String(h).padStart(2, '0')}:${String(Math.round((eclipticLon % 1) * 60)).padStart(2, '0')}`;
  return { rise: fmt(riseHour), set: fmt(setHour) };
}

export default function MoonInfoPopup({ onClose }) {
  const moon = getMoonPosition(new Date());
  const illuminationPct = Math.round(moon.illumination * 100);
  const phaseName = getPhaseName(moon.phase);
  const riseSet = getMoonriseSet(47.37, moon.eclipticLon);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="rounded-2xl shadow-2xl max-w-sm w-full border-2"
        style={{ backgroundColor: "#0d1b2e", borderColor: "#4fd1c5" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#4fd1c5" }}>
          <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#4fd1c5" }}>
            <Moon className="w-4 h-4" /> Mond-Information
          </h3>
          <button onClick={onClose} className="hover:opacity-70" style={{ color: "#4fd1c5" }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs" style={{ color: "#e0e0e0" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8ab4c7" }}>Phase</span>
            <span className="font-bold" style={{ color: "#4fd1c5" }}>{phaseName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8ab4c7" }}>Beleuchtung</span>
            <span className="font-bold">{illuminationPct}%</span>
          </div>
          {/* Visual illumination bar */}
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#1a2a3e" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${illuminationPct}%`, backgroundColor: "#4fd1c5" }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8ab4c7" }}>Ekliptische Länge</span>
            <span>{moon.eclipticLon.toFixed(1)}°</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8ab4c7" }}>Ekliptische Breite</span>
            <span>{moon.eclipticLat.toFixed(1)}°</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8ab4c7" }}>Distanz</span>
            <span>{moon.distance.toFixed(1)} Erdradien</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8ab4c7" }}>Mondaufgang (ca.)</span>
            <span>{riseSet.rise} UTC</span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "#8ab4c7" }}>Monduntergang (ca.)</span>
            <span>{riseSet.set} UTC</span>
          </div>
          <p className="text-[10px] pt-2 border-t" style={{ color: "#5a7a8a", borderColor: "#1a2a3e" }}>
            Position nach Meeus (vereinfacht). Auf-/Untergang sind Näherungswerte.
          </p>
        </div>
      </div>
    </div>
  );
}