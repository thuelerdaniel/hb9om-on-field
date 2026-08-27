import React from "react";
import { X, Satellite } from "lucide-react";

// ISS Frequenz-Popup — öffnet beim Klick auf die ISS im Hunting Globe.
// Zeigt ISS-Frequenzen, letzte Position, Geschwindigkeit, Flughöhe und Antennen-Tipp.

export default function IssFrequencyPopup({ issData, onClose }) {
  if (!issData) return null;
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Satellite className="w-4 h-4 text-[#ffd700]" /> ISS - Internationale Raumstation
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div>
            <div className="text-[9px] text-muted-foreground uppercase mb-1">Frequenzen</div>
            <ul className="space-y-0.5 text-foreground">
              <li>• VHF Downlink: 145.800 MHz FM (Voice)</li>
              <li>• VHF Uplink: 145.990 MHz FM</li>
              <li>• UHF Downlink: 437.800 MHz (Packet)</li>
              <li>• APRS: 145.825 MHz (1200 baud AFSK)</li>
              <li>• SSTV: 145.800 MHz (gelegentlich)</li>
            </ul>
          </div>
          <div className="border-t border-border pt-2 space-y-0.5 text-muted-foreground">
            <div>Letzte Position: {issData.lat?.toFixed(2)}°, {issData.lon?.toFixed(2)}°</div>
            <div>Geschwindigkeit: ca. {issData.velocity ? Math.round(issData.velocity) : 27600} km/h</div>
            <div>Flughöhe: ca. {issData.altitude ? Math.round(issData.altitude) : 408} km</div>
          </div>
          <div className="text-[10px] text-muted-foreground italic border-t border-border pt-2">
            Tipp: Verwende eine kreuzpolare oder Eggbeater-Antenne für beste Ergebnisse.
          </div>
        </div>
      </div>
    </div>
  );
}