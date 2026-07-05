import React, { useState, useEffect } from "react";
import { X, FileDown, Plus, Trash2, NotebookPen } from "lucide-react";
import { base44 } from "@/api/base44Client";

const BANDS = ["2m", "70cm", "23cm", "6m", "10m", "12m", "15m", "17m", "20m", "30m", "40m", "60m", "80m", "160m"];
const MODES = ["FM", "SSB", "CW", "FT8", "FT4", "RTTY", "PSK31", "AM", "DIGI"];
const REF_TYPES = ["SOTA", "POTA", "HBFF", "WWBOTA", "WCA", "COTA", "IOTA", "WLOTA", "ILLW"];

const emptyForm = (settings) => ({
  qso_date: new Date().toISOString().slice(0, 10),
  time_on: new Date().toISOString().slice(11, 16).replace(":", ""),
  time_off: "",
  callsign_contact: "",
  frequency: 145.5,
  band: "2m",
  mode: settings?.defaultMode || "FM",
  rst_sent: "59",
  rst_recv: "59",
  operator: settings?.callsign || "",
  tx_power: settings?.defaultPower || 5,
  reference: "",
  reference_type: "SOTA",
  my_lat: null,
  my_lng: null,
  comment: ""
});

export default function LogDialog({ open, onClose, settings, gpsPosition }) {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm(settings));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) loadEntries();
  }, [open]);

  useEffect(() => {
    if (gpsPosition) {
      setForm(f => ({ ...f, my_lat: gpsPosition.lat, my_lng: gpsPosition.lng }));
    }
  }, [gpsPosition]);

  const loadEntries = async () => {
    try {
      const res = await base44.entities.LogEntry.list("-qso_date", 100);
      setEntries(res.data || res || []);
    } catch (e) {
      setError(e.message);
    }
  };

  if (!open) return null;

  const handleAdd = async () => {
    if (!form.callsign_contact || !form.operator) {
      setError("Rufzeichen und Operator sind Pflichtfelder");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await base44.entities.LogEntry.create({ ...form });
      setForm(emptyForm(settings));
      if (gpsPosition) setForm(f => ({ ...f, my_lat: gpsPosition.lat, my_lng: gpsPosition.lng }));
      await loadEntries();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.LogEntry.delete(id);
      await loadEntries();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("exportADIF", {});
      const adifText = res.data?.adif || res.data;
      const blob = new Blob([adifText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hb9om_log_${new Date().toISOString().slice(0, 10)}.adi`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-gray-900">QSO-Logbuch & ADIF-Export</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* New entry form */}
          <section className="border border-gray-100 rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Neues QSO erfassen</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Datum</label>
                <input type="date" value={form.qso_date} onChange={e => setForm({ ...form, qso_date: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Zeit UTC (HHMM)</label>
                <input type="text" value={form.time_on} onChange={e => setForm({ ...form, time_on: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Rufzeichen Gegenstation</label>
                <input type="text" value={form.callsign_contact} onChange={e => setForm({ ...form, callsign_contact: e.target.value.toUpperCase() })}
                  placeholder="z.B. HB9ABC"
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Frequenz (MHz)</label>
                <input type="number" step="0.001" value={form.frequency} onChange={e => setForm({ ...form, frequency: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Band</label>
                <select value={form.band} onChange={e => setForm({ ...form, band: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                  {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Mode</label>
                <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                  {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sendeleistung (W)</label>
                <input type="number" step="0.1" value={form.tx_power} onChange={e => setForm({ ...form, tx_power: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">RST gegeben</label>
                <input type="text" value={form.rst_sent} onChange={e => setForm({ ...form, rst_sent: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">RST erhalten</label>
                <input type="text" value={form.rst_recv} onChange={e => setForm({ ...form, rst_recv: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Operator (eigenes Rufz.)</label>
                <input type="text" value={form.operator} onChange={e => setForm({ ...form, operator: e.target.value.toUpperCase() })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Referenz-Typ</label>
                <select value={form.reference_type} onChange={e => setForm({ ...form, reference_type: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300">
                  {REF_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Referenz (z.B. HB/AG-001)</label>
                <input type="text" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value.toUpperCase() })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <label className="text-xs text-gray-500 mb-1 block">Kommentar</label>
                <input type="text" value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
              </div>
            </div>
            <button onClick={handleAdd} disabled={loading}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50">
              <Plus className="w-4 h-4" /> QSO hinzufügen
            </button>
          </section>

          {/* Existing entries */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Logeinträge ({entries.length})
              </h3>
              <button onClick={handleExport} disabled={loading || entries.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                <FileDown className="w-4 h-4" /> ADIF exportieren
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl">
              {entries.length === 0 ? (
                <p className="text-sm text-gray-400 p-4 text-center">Noch keine QSOs erfasst</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-2 font-medium text-gray-500">Datum</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-500">Zeit</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-500">Call</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-500">Freq</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-500">Mode</th>
                      <th className="text-left px-2 py-2 font-medium text-gray-500">Ref</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(e => (
                      <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1.5">{e.qso_date}</td>
                        <td className="px-2 py-1.5">{e.time_on}</td>
                        <td className="px-2 py-1.5 font-mono">{e.callsign_contact}</td>
                        <td className="px-2 py-1.5">{e.frequency}</td>
                        <td className="px-2 py-1.5">{e.mode}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{e.reference_type}: {e.reference}</td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}