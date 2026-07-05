import React, { useState, useEffect } from "react";
import { Radio, Check, AlertCircle } from "lucide-react";

export default function FirstTimeSetup() {
  const [show, setShow] = useState(false);
  const [myCallsign, setMyCallsign] = useState("");
  const [qrzEnabled, setQrzEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const done = localStorage.getItem("hb9om_setup_complete");
    if (!done) {
      setShow(true);
    } else {
      loadSaved();
    }
  }, []);

  const loadSaved = () => {
    setMyCallsign(localStorage.getItem("hb9om_my_callsign") || "");
    setQrzEnabled(localStorage.getItem("hb9om_qrz_enabled") !== "false");
  };

  const handleSave = () => {
    setError("");
    if (!myCallsign || myCallsign.length < 3) {
      setError("Bitte geben Sie Ihr Rufzeichen ein (mind. 3 Zeichen)");
      return;
    }
    setSaving(true);
    localStorage.setItem("hb9om_my_callsign", myCallsign.toUpperCase().trim());
    localStorage.setItem("hb9om_qrz_enabled", String(qrzEnabled));
    localStorage.setItem("hb9om_setup_complete", "true");
    setTimeout(() => {
      setSaving(false);
      setShow(false);
    }, 500);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[10002] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-900 text-white px-5 py-4 rounded-t-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold">Willkommen bei HB9OM On Field</h2>
            <p className="text-xs text-gray-300">Ersteinrichtung – bitte konfigurieren</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* My Callsign */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mein Rufzeichen *</label>
            <input
              type="text"
              value={myCallsign}
              onChange={e => setMyCallsign(e.target.value)}
              placeholder="z.B. HB9XYZ"
              className="w-full mt-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
            />
            <p className="text-[10px] text-gray-400 mt-1">Dies ist Ihr eigenes Amateurfunk-Rufzeichen</p>
          </div>

          {/* QRZ Toggle */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-900">QRZ.com Abfrage</label>
                <p className="text-xs text-gray-500 mt-0.5">Rufzeichen-Daten automatisch abrufen</p>
              </div>
              <button
                onClick={() => setQrzEnabled(!qrzEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${qrzEnabled ? 'bg-gray-900' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${qrzEnabled ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            {qrzEnabled ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  QRZ.com XML-Subscription ist hinterlegt und einsatzbereit
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
                QRZ-Abfrage ist deaktiviert. Rufzeichen-Daten können manuell eingegeben werden.
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Konfiguration speichern
          </button>
        </div>
      </div>
    </div>
  );
}