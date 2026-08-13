import React, { useState, useEffect } from "react";
import { Coffee, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Donation popup — shown on view changes (Karte, Einstellungen, Logbuch).
// Uses the same PayPal link as the Splash Screen: https://paypal.me/Thueler
// User can hide it permanently (donation_hidden=true via updateMe).
// "Später" hides it for the current session (sessionStorage).

const PAYPAL_URL = "https://paypal.me/Thueler";

export default function DonationPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const me = await base44.auth.me();
        if (cancelled) return;

        // Don't show if permanently hidden
        if (me.donation_hidden) return;

        // Don't show if "Später" was clicked this session
        if (sessionStorage.getItem("hb9om_donation_later") === "true") return;

        // Show popup
        setVisible(true);

        // Update user's donation count and timestamp
        try {
          await base44.auth.updateMe({
            last_donation_prompt: new Date().toISOString(),
            donation_count: (me.donation_count || 0) + 1,
          });
        } catch {}
      } catch {
        // Not logged in or error — don't show
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDonate = () => {
    window.open(PAYPAL_URL, "_blank", "noopener,noreferrer");
    setVisible(false);
  };

  const handleLater = () => {
    sessionStorage.setItem("hb9om_donation_later", "true");
    setVisible(false);
  };

  const handleNeverShow = async () => {
    setVisible(false);
    try {
      await base44.auth.updateMe({ donation_hidden: true });
    } catch {}
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
        <button
          onClick={handleLater}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mb-4">
            <Coffee className="w-7 h-7 text-amber-600" />
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Unterstütze HB9OM On Field
          </h2>

          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            HB9OM On Field ist ein kostenloses Projekt für Funkamateure.
            Die Entwicklung und der Betrieb der App verursachen Kosten und viel Freizeit.
            Jede Spende hilft, das Projekt am Leben zu erhalten.
          </p>

          <button
            onClick={handleDonate}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm hover:bg-amber-600 transition-colors mb-3"
          >
            <Coffee className="w-4 h-4" />
            Spende doch was ☕
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleLater}
              className="flex-1 px-3 py-2 text-gray-600 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
            >
              Später
            </button>
            <button
              onClick={handleNeverShow}
              className="flex-1 px-3 py-2 text-gray-500 hover:text-gray-700 text-xs font-medium transition-colors"
            >
              Nicht mehr zeigen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}