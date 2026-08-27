import React from "react";
import { X, Moon, Heart } from "lucide-react";

// Moon SOTA Popup — öffnet beim Klick auf den SOTA-Marker auf dem Mond.
// Spenden-Aufruf für HB9OM.online mit PayPal-Link (identisch wie in Hilfe/DonationPopup).

const PAYPAL_URL = "https://paypal.me/Thueler";

export default function MoonSotaPopup({ onClose }) {
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Moon className="w-4 h-4 text-[#3b82f6]" /> Willkommen bei der HB9OM.online App!
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 text-xs text-foreground">
          <p>Du hast den Mond-SOTA-Punkt entdeckt! 🌙</p>
          <p>HB9OM.online ist ein kostenloses Tool für Funkamateure.</p>
          <p>Unterstütze die Weiterentwicklung mit einer Spende:</p>
          <a
            href={PAYPAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[#00e5ff] hover:underline font-bold"
          >
            <Heart className="w-3 h-3" /> PayPal Spende
          </a>
          <p className="text-muted-foreground">Danke dass du HB9OM On Field nutzt!</p>
        </div>
      </div>
    </div>
  );
}