import React, { useState, useEffect } from "react";
import { Radio, Check, AlertCircle, AlertTriangle, KeyRound, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { DEMO_EMAIL } from "@/lib/constants";

export default function FirstTimeSetup() {
  const [show, setShow] = useState(false);
  const [myCallsign, setMyCallsign] = useState("");
  const [qrzEnabled, setQrzEnabled] = useState(true);
  const [qrzUsername, setQrzUsername] = useState("");
  const [qrzPassword, setQrzPassword] = useState("");
  const [aprsApiKey, setAprsApiKey] = useState("");
  const [usesClubCredentials, setUsesClubCredentials] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showWarning, setShowWarning] = useState(false);
  const [missingFields, setMissingFields] = useState([]);

  useEffect(() => {
    const done = localStorage.getItem("hb9om_setup_complete");
    if (!done) {
      setShow(true);
      loadUserInfo();
    } else {
      loadSaved();
    }
  }, []);

  const loadUserInfo = async () => {
    try {
      const me = await base44.auth.me();
      const isDemo = me?.email === DEMO_EMAIL;
      const clubCreds = me?.role === "admin" || isDemo;
      setUsesClubCredentials(clubCreds);
      if (!clubCreds) {
        setQrzUsername(me?.qrz_username || "");
        setQrzPassword(me?.qrz_password || "");
        setAprsApiKey(me?.aprs_fi_api_key || "");
      }
    } catch {}
  };

  const loadSaved = () => {
    setMyCallsign(localStorage.getItem("hb9om_my_callsign") || "");
    setQrzEnabled(localStorage.getItem("hb9om_qrz_enabled") !== "false");
  };

  const handleSave = async (skipWarning = false) => {
    setError("");
    if (!myCallsign || myCallsign.length < 3) {
      setError("Bitte geben Sie Ihr Rufzeichen ein (mind. 3 Zeichen)");
      return;
    }

    // Check for missing optional fields (only for non-club users)
    const missing = [];
    if (!usesClubCredentials) {
      if (qrzEnabled && (!qrzUsername.trim() || !qrzPassword.trim())) {
        missing.push("QRZ.com Zugangsdaten – automatische Rufzeichen-Abfrage nicht verfügbar");
      }
      if (!aprsApiKey.trim()) {
        missing.push("APRS.fi API-Key – APRS-Relais und Private Nodes nicht auf der Karte sichtbar");
      }
    }

    if (missing.length > 0 && !skipWarning) {
      setMissingFields(missing);
      setShowWarning(true);
      return;
    }

    setSaving(true);
    localStorage.setItem("hb9om_my_callsign", myCallsign.toUpperCase().trim());
    localStorage.setItem("hb9om_qrz_enabled", String(qrzEnabled));
    localStorage.setItem("hb9om_setup_complete", "true");

    // Save user profile data for non-club users
    if (!usesClubCredentials) {
      try {
        await base44.auth.updateMe({
          qrz_username: qrzUsername.trim(),
          qrz_password: qrzPassword,
          aprs_fi_api_key: aprsApiKey.trim()
        });
      } catch {}
    }

    setTimeout(() => {
      setSaving(false);
      setShow(false);
      setShowWarning(false);
    }, 500);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[10002] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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

        {!showWarning ? (
          <div className="p-5 space-y-4">
            {/* My Callsign */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Mein Rufzeichen *</label>
              <input
                type="text"
                value={myCallsign}
                onChange={e => setMyCallsign(e.target.value)}
                placeholder="z.B. HB9XYZ"
                className="w-full mt-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
              />
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Dies ist Ihr eigenes Amateurfunk-Rufzeichen</p>
            </div>

            {/* QRZ.com */}
            <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl">
              {usesClubCredentials ? (
                <>
                  <label className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Search className="w-4 h-4" /> QRZ.com Abfrage
                  </label>
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    QRZ.com XML-Subscription des Clubs ist hinterlegt und einsatzbereit
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-semibold text-gray-900 dark:text-slate-100">QRZ.com Abfrage</label>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Rufzeichen-Daten automatisch abrufen</p>
                    </div>
                    <button
                      onClick={() => setQrzEnabled(!qrzEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${qrzEnabled ? 'bg-gray-900' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${qrzEnabled ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>
                  {qrzEnabled && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">QRZ-Benutzername</label>
                        <input
                          type="text"
                          value={qrzUsername}
                          onChange={e => setQrzUsername(e.target.value)}
                          placeholder="Ihr QRZ.com-Benutzername"
                          className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">QRZ-Passwort</label>
                        <input
                          type="password"
                          value={qrzPassword}
                          onChange={e => setQrzPassword(e.target.value)}
                          placeholder="Ihr QRZ.com-Passwort"
                          className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
                        Erfordert eine QRZ.com-XML-Subscription. Ohne Angaben können keine Rufzeichen-Daten automatisch abgerufen werden.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* APRS.fi API Key */}
            {!usesClubCredentials && (
              <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl">
                <label className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> APRS.fi API-Key
                </label>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Für APRS-Relais und Private Nodes auf der Karte</p>
                <input
                  type="password"
                  value={aprsApiKey}
                  onChange={e => setAprsApiKey(e.target.value)}
                  placeholder="Ihr persönlicher APRS.fi API-Key"
                  className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 leading-relaxed">
                  Kostenloser Key unter <a href="https://aprs.fi/page/api" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">aprs.fi/page/api</a>. Ohne Key sind APRS-Relais und Private Nodes nicht verfügbar.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Footer */}
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Konfiguration speichern
            </button>
          </div>
        ) : (
          /* Warning dialog for missing optional fields */
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-slate-100">Einschränkungen beachten</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Folgende Module sind ohne diese Angaben eingeschränkt nutzbar:</p>
              </div>
            </div>
            <div className="space-y-2">
              {missingFields.map((field, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{field}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Sie können diese Angaben jederzeit in den Einstellungen nachtragen.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Zurück
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? <Radio className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Trotzdem fortfahren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}