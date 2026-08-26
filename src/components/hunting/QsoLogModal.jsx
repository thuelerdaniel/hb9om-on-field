import React, { useState, useEffect } from "react";
import { X, Save, Loader2, Building2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

// QSO Log Modal — Theme-aware. Vorausgefüllt aus DX-Spot.
// Speichert in Log Entity. QRZ-Lookup via QrzLookup Entity.

export default function QsoLogModal({ spot, onClose }) {
  const [form, setForm] = useState({
    callsign: '', frequency: null, band: '', mode: '',
    qso_date: new Date().toISOString().split('T')[0], time_start: '',
    rst_sent: '59', rst_received: '59', operator_name: '', notes: '',
    is_clubstation: false, club_callsign: '', club_operator_callsign: '',
    my_reference: '', my_reference_type: 'custom',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [qrzLoading, setQrzLoading] = useState(false);

  useEffect(() => {
    if (spot) {
      const now = new Date();
      const utcTime = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
      // ActivitySpot hat activity_type + reference; DxSpot hat activity + activity_ref
      const actType = (spot.activity_type || spot.activity || '').toUpperCase();
      const refCode = spot.reference || spot.activity_ref || '';
      const refType = actType === 'SOTA' ? 'sota' : actType === 'POTA' ? 'pota' : 'custom';
      setForm(prev => ({
        ...prev,
        callsign: spot.call || '',
        frequency: spot.frequency ? spot.frequency / 1000 : null,
        band: spot.band || '',
        mode: spot.mode && spot.mode !== 'Unknown' ? spot.mode : 'FT8',
        time_start: utcTime,
        my_reference: refType !== 'custom' ? refCode : '',
        my_reference_type: refType,
      }));
      // QRZ-Lookup
      if (spot.call) {
        setQrzLoading(true);
        (async () => {
          try {
            const res = await base44.functions.invoke("fetchQRZ", { callsign: spot.call });
            const data = res?.data || res;
            if (data?.name) setForm(prev => ({ ...prev, operator_name: data.name }));
          } catch {} finally { setQrzLoading(false); }
        })();
      }
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
      await base44.entities.Log.create({
        ...form,
        status: 'active',
      });
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError('Speichern fehlgeschlagen: ' + (e.message || 'unbekannt'));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-2 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-[#00e5ff] outline-none";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Save className="w-4 h-4 text-[#8cff00]" /> QSO loggen
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#8cff00]/20 mb-3">
              <Save className="w-7 h-7 text-[#8cff00]" />
            </div>
            <p className="text-sm text-[#8cff00] font-medium">QSO erfolgreich gespeichert!</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rufzeichen">
                <input type="text" value={form.callsign} onChange={e => update('callsign', e.target.value.toUpperCase())} className={inputClass} />
              </Field>
              <Field label="Mode">
                <select value={form.mode} onChange={e => update('mode', e.target.value)} className={inputClass}>
                  {['SSB','CW','FM','FT8','FT4','PSK','RTTY','AM','Other'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequenz (MHz)">
                <input type="number" step="0.001" value={form.frequency || ''} onChange={e => update('frequency', parseFloat(e.target.value))} className={inputClass} />
              </Field>
              <Field label="Band">
                <select value={form.band} onChange={e => update('band', e.target.value)} className={inputClass}>
                  {['160m','80m','60m','40m','30m','20m','17m','15m','12m','10m','6m','2m','70cm','23cm','Other'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Datum">
                <input type="date" value={form.qso_date} onChange={e => update('qso_date', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Startzeit UTC">
                <input type="text" value={form.time_start} onChange={e => update('time_start', e.target.value)} placeholder="HH:MM" className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RST gesendet">
                <input type="text" value={form.rst_sent} onChange={e => update('rst_sent', e.target.value)} className={inputClass} />
              </Field>
              <Field label="RST erhalten">
                <input type="text" value={form.rst_received} onChange={e => update('rst_received', e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label={`Operator Name${qrzLoading ? ' (QRZ…)' : ''}`}>
              <input type="text" value={form.operator_name} onChange={e => update('operator_name', e.target.value)} className={inputClass} />
            </Field>
            {(spot?.activity || form.my_reference) && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Referenz">
                  <input type="text" value={form.my_reference} onChange={e => update('my_reference', e.target.value)} className={inputClass} />
                </Field>
                <Field label="Referenz-Typ">
                  <select value={form.my_reference_type} onChange={e => update('my_reference_type', e.target.value)} className={inputClass}>
                    <option value="custom">Generell</option>
                    <option value="sota">SOTA</option>
                    <option value="pota">POTA</option>
                  </select>
                </Field>
              </div>
            )}
            <button
              onClick={() => update('is_clubstation', !form.is_clubstation)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                form.is_clubstation ? "bg-[#8cff00]/10 text-[#8cff00] border border-[#8cff00]/30" : "bg-background text-muted-foreground border border-border"
              }`}
            >
              <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Club-Station</span>
              <span className={`relative w-9 h-5 rounded-full transition-colors ${form.is_clubstation ? "bg-[#8cff00]" : "bg-muted"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.is_clubstation ? "translate-x-4" : ""}`} />
              </span>
            </button>
            {form.is_clubstation && (
              <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-[#8cff00]/30">
                <Field label="Club-Rufzeichen">
                  <input type="text" value={form.club_callsign} onChange={e => update('club_callsign', e.target.value.toUpperCase())} className={inputClass} />
                </Field>
                <Field label="Operator-Rufzeichen">
                  <input type="text" value={form.club_operator_callsign} onChange={e => update('club_operator_callsign', e.target.value.toUpperCase())} className={inputClass} />
                </Field>
              </div>
            )}
            <Field label="Notizen">
              <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
            </Field>
            {error && <div className="text-xs text-[#ff5252] px-1">{error}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 bg-background hover:bg-muted text-muted-foreground rounded-lg text-sm font-medium border border-border">Abbrechen</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-[#8cff00] hover:bg-[#7aee00] text-black rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
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
      <label className="block text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}