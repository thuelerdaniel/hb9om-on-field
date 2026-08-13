import React, { useState, useEffect, useRef } from "react";
import { Coffee, X, Mail, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Donation popup — shown on view changes (Karte→Einstellungen, Karte→Logbuch, Layer-Menu auf/zu).
// Uses the same PayPal link as the Splash Screen: https://paypal.me/Thueler
// 10x/day limit with counter persisted in User entity.
// Only admins can disable (donation_hidden / donation_confirmed) via admin panel.
// User must enter email to enable "Spenden" button.

const PAYPAL_URL = "https://paypal.me/Thueler";
const DAILY_LIMIT = 10;

function isValidEmail(email) {
  return email.includes("@") && email.includes(".") && email.length >= 5;
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function DonationPopup({ triggerKey = 0 }) {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [remainingToday, setRemainingToday] = useState(DAILY_LIMIT);
  const [submitting, setSubmitting] = useState(false);
  const [showCounterHint, setShowCounterHint] = useState(false);
  const lastTriggerRef = useRef(0);

  const checkAndShow = async () => {
    try {
      const me = await base44.auth.me();
      if (!me) return;

      // Don't show if permanently hidden or donation confirmed
      if (me.donation_hidden) return;
      if (me.donation_confirmed) return;

      // Day reset
      const today = getTodayStr();
      let shownToday = me.donation_shown_today || 0;
      const lastDate = me.donation_last_show_date;

      if (lastDate !== today) {
        shownToday = 0;
      }

      // Check 10x limit
      if (shownToday >= DAILY_LIMIT) return;

      // Pre-fill email if already saved
      if (me.donation_email) setEmail(me.donation_email);

      // Show popup
      const newCount = shownToday + 1;
      setRemainingToday(DAILY_LIMIT - newCount);
      setShowCounterHint(newCount >= 8);
      setVisible(true);

      // Increment counter in User entity
      try {
        await base44.auth.updateMe({
          donation_shown_today: newCount,
          donation_last_show_date: today,
          donation_total_shown: (me.donation_total_shown || 0) + 1,
          last_donation_prompt: new Date().toISOString(),
        });
      } catch {}
    } catch {
      // Not logged in or error — don't show
    }
  };

  // Trigger on mount (page navigation) and when triggerKey changes (layer menu open/close)
  useEffect(() => {
    // Small debounce to avoid double-triggers (e.g. mount + triggerKey=1)
    const now = Date.now();
    if (triggerKey > 0 && now - lastTriggerRef.current < 500) return;
    lastTriggerRef.current = now;

    const timer = setTimeout(() => checkAndShow(), 300);
    return () => clearTimeout(timer);
  }, [triggerKey]);

  const handleDonate = async () => {
    if (!isValidEmail(email)) return;
    setSubmitting(true);
    try {
      // Save email to user entity
      await base44.auth.updateMe({ donation_email: email });
    } catch {}
    // Open PayPal
    window.open(PAYPAL_URL, "_blank", "noopener,noreferrer");
    setSubmitting(false);
    setVisible(false);
  };

  const handleLater = () => {
    setVisible(false);
  };

  if (!visible) return null;

  const emailValid = isValidEmail(email);
  const hint = remainingToday > 0 ? remainingToday : 0;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
        {/* No close-on-outside-click — modal stays until user acts */}
        <button
          onClick={handleLater}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Später"
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
            Die Entwicklung und der Betrieb der App verursachen Kosten und verbraucht viel Freizeit.
            Jede Spende hilft, das Projekt am Leben zu erhalten.
          </p>

          {/* Email input */}
          <div className="mb-3 text-left">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Deine E-Mail (App-Login)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dein@email.ch"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 text-gray-900"
                autoFocus
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
              Bitte gib die E-Mail an mit der du in der App angemeldet bist.
              Nach deiner Spende wird dein Popup von einem Admin deaktiviert.
            </p>
            {email && !emailValid && (
              <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Bitte gültige E-Mail eingeben
              </p>
            )}
          </div>

          {/* Donate button — disabled until valid email */}
          <button
            onClick={handleDonate}
            disabled={!emailValid || submitting}
            className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl font-medium text-sm transition-colors mb-3 ${
              emailValid && !submitting
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            <Coffee className="w-4 h-4" />
            Spenden
          </button>

          {/* Later button */}
          <button
            onClick={handleLater}
            className="w-full px-3 py-2 text-gray-600 bg-gray-100 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
          >
            Später
          </button>

          {/* Counter hint — shown from 8th display onwards */}
          {showCounterHint && (
            <p className="text-[10px] text-gray-400 mt-3">
              Du siehst dieses Popup heute noch {hint} mal
            </p>
          )}
        </div>
      </div>
    </div>
  );
}