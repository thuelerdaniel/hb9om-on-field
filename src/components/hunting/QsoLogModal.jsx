import React, { useState, useEffect } from "react";
import { X, Save, Loader2, Building2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

// QSO Log Modal — vorausgefüllt aus DX-Spot, speichert in Log Entity.
// Felder: callsign, frequency, band, mode (vorausgefüllt),
// qso_date (heute), time_start (now), rst_sent, rst_received,
// operator_name, notes, is_clubstation + club_callsign/club_operator_callsign.

export default function QsoLogModal({ spot, onClose }) {
  const [form, setForm] = useState({
    callsign: '',
    frequency: null,
    band: '',
    mode: '',
    qso_date: new Date().toISOString().split('T')[0],
    time_start: '',
    rst_sent: '59',
    rst_received: '59',
    operator_name: '',
    notes: '',
    is_clubstation: false,
    club_callsign: '',
    club_operator_callsign: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (spot) {
      const now = new Date();
      const utcTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
      setForm(prev => ({
        ...prev,
        callsign: spot.call || '',
        frequency: spot.frequency ? spot.frequency / 1000 : null, // kHz → MHz
        band: spot.band || '',
        mode: spot.mode && spot.mode !== 'Unknown' ? spot.mode : 'FT8',
        time_start: utcTime,
      }));
    }
  }, [spot]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.callsign || !form.frequency || !form.mode) {
      setError('Rufzeichen, Frequenz und Mode sind erforderlich');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        callsign: form.callsign,
        qso_date: form.qso_date,
        time_start: form.time_start,
        frequency: form.frequency,
        band: form.band,
        mode: form.mode,
        rst_sent: form.rst_sent,
        rst_received: form.rst_received,
        operator_name: form.operator_name,
        notes: form.notes,
        is_clubstation: form.is_clubstation,
        club_callsign: form.is_clubstation ? form.club_callsign : '',
        club_operator_callsign: form.is_clubstation ? form.club_operator_callsign : '',
        status: 'active',
      };
      await base44.entities.Log.create(payload);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError('Speichern fehlgeschlagen: ' + (e.message || 'unbekannt'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-[#1a1a1a] z-10">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
            <Save className="w-4 h-4 text-green-400" /> QSO loggen
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {success ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-900/40 mb-3">
              <Save className="w-7 h-7 text-green-400" />
            </div>
            <p className="text-sm text-green-400 font-medium">QSO erfolgreich gespeichert!</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Callsign + Mode */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rufzeichen">
                <input
                  type="text"
                  value={form.callsign}
                  onChange={e => update('callsign', e.target.value.toUpperCase())}
                  className="input-dark"
                />
              </Field>
              <Field label="Mode">
                <select
                  value={form.mode}
                  onChange={e => update('mode', e.target.value)}
                  className="input-dark"
                >
                  {['SSB', 'CW', 'FM', 'FT8', 'FT4', 'PSK', 'RTTY', 'AM', 'Other'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Frequenz + Band */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequenz (MHz)">
                <input
                  type="number"
                  step="0.001"
                  value={form.frequency || ''}
                  onChange={e => update('frequency', parseFloat(e.target.value))}
                  className="input-dark"
                />
              </Field>
              <Field label="Band">
                <select
                  value={form.band}
                  onChange={e => update('band', e.target.value)}
                  className="input-dark"
                >
                  {['160m','80m','60m','40m','30m','20m','17m','15m','12m','10m','6m','2m','70cm','23cm','Other'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Datum + Zeit */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Datum">
                <input
                  type="date"
                  value={form.qso_date}
                  onChange={e => update('qso_date', e.target.value)}
                  className="input-dark"
                />
              </Field>
              <Field label="Startzeit UTC">
                <input
                  type="text"
                  value={form.time_start}
                  onChange={e => update('time_start', e.target.value)}
                  placeholder="HH:MM"
                  className="input-dark"
                />
              </Field>
            </div>

            {/* RST */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="RST gesendet">
                <input
                  type="text"
                  value={form.rst_sent}
                  onChange={e => update('rst_sent', e.target.value)}
                  className="input-dark"
                />
              </Field>
              <Field label="RST erhalten">
                <input
                  type="text"
                  value={form.rst_received}
                  onChange={e => update('rst_received', e.target.value)}
                  className="input-dark"
                />
              </Field>
            </div>

            {/* Operator Name */}
            <Field label="Operator Name">
              <input
                type="text"
                value={form.operator_name}
                onChange={e => update('operator_name', e.target.value)}
                className="input-dark"
              />
            </Field>

            {/* Club-Station Toggle */}
            <div>
              <button
                onClick={() => update('is_clubstation', !form.is_clubstation)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  form.is_clubstation ? "bg-green-900/30 text-green-400 border border-green-700/50" : "bg-gray-800/50 text-gray-400 border border-gray-700/50"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Club-Station
                </span>
                <span className={`relative w-9 h-5 rounded-full transition-colors ${form.is_clubstation ? "bg-green-600" : "bg-gray-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.is_clubstation ? "translate-x-4" : ""}`} />
                </span>
              </button>
            </div>

            {/* Club-Station Felder */}
            {form.is_clubstation && (
              <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-green-700/30">
                <Field label="Club-Rufzeichen">
                  <input
                    type="text"
                    value={form.club_callsign}
                    onChange={e => update('club_callsign', e.target.value.toUpperCase())}
                    className="input-dark"
                  />
                </Field>
                <Field label="Operator-Rufzeichen">
                  <input
                    type="text"
                    value={form.club_operator_callsign}
                    onChange={e => update('club_operator_callsign', e.target.value.toUpperCase())}
                    className="input-dark"
                  />
                </Field>
              </div>
            )}

            {/* Notizen */}
            <Field label="Notizen">
              <textarea
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                rows={2}
                className="input-dark resize-none"
              />
            </Field>

            {/* Error */}
            {error && (
              <div className="text-xs text-red-400 px-1">{error}</div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Speichern
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}