import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { X, Search, Loader2, MapPin, Plus, Radio } from "lucide-react";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const REF_TYPES = [
  { value: "sota", label: "SOTA" },
  { value: "pota", label: "POTA" },
  { value: "hbff", label: "HBFF" },
  { value: "wwbota", label: "WWBOTA" },
  { value: "castle", label: "Burg/Schloss" },
  { value: "iota", label: "IOTA" },
  { value: "lighthouse", label: "Leuchtturm" },
  { value: "swiss_protected", label: "Bundesinventar" },
  { value: "custom", label: "Eigenes Referenz" },
];

const BANDS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "4m", "2m", "70cm", "23cm", "Other"];
const MODES = ["SSB", "CW", "FM", "FT8", "FT4", "PSK", "RTTY", "AM", "Other"];

export default function LogEntryForm({ mapCenter, allMarkers, onClose, onSaved }) {
  const [callsign, setCallsign] = useState("");
  const [qrzLoading, setQrzLoading] = useState(false);
  const [qrzError, setQrzError] = useState("");
  const [operator, setOperator] = useState({ name: "", address: "", country: "", grid: "", email: "" });

  const today = new Date().toISOString().slice(0, 10);
  const nowUTC = new Date().toISOString().slice(11, 16);

  const [qsoDate, setQsoDate] = useState(today);
  const [timeStart, setTimeStart] = useState(nowUTC);
  const [timeEnd, setTimeEnd] = useState("");
  const [frequency, setFrequency] = useState("");
  const [band, setBand] = useState("2m");
  const [mode, setMode] = useState("FM");
  const [rstSent, setRstSent] = useState("59");
  const [rstReceived, setRstReceived] = useState("59");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Reference selection
  const [refType, setRefType] = useState("custom");
  const [refCode, setRefCode] = useState("");
  const [refName, setRefName] = useState("");
  const [showRefDropdown, setShowRefDropdown] = useState(false);

  // Compute nearby references from map center
  const nearbyRefs = React.useMemo(() => {
    if (!mapCenter || !allMarkers || allMarkers.length === 0) return [];
    const [clat, clng] = mapCenter;
    return allMarkers
      .map(m => ({
        ...m,
        distance: haversine(clat, clng, m.lat, m.lng)
      }))
      .filter(m => m.distance < 25)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);
  }, [mapCenter, allMarkers]);

  // Auto-select nearest reference if only one is very close
  useEffect(() => {
    if (nearbyRefs.length === 1 && nearbyRefs[0].distance < 2 && !refCode) {
      const r = nearbyRefs[0];
      setRefType(r.layerType || "custom");
      setRefCode(r.code || r.reference || "");
      setRefName(r.name || "");
    }
  }, [nearbyRefs]);

  const handleQRZLookup = async () => {
    if (!callsign || callsign.length < 3) return;
    setQrzLoading(true);
    setQrzError("");
    try {
      const res = await base44.functions.invoke("fetchQRZ", { callsign: callsign.toUpperCase().trim() });
      if (res.data?.error) {
        setQrzError(res.data.error);
      } else if (res.data?.callsign) {
        const d = res.data;
        setOperator({
          name: d.name || "",
          address: d.address || "",
          country: d.country || "",
          grid: d.grid || "",
          email: d.email || ""
        });
      }
    } catch (e) {
      setQrzError("QRZ.com Abfrage nicht verfügbar – Daten manuell eingeben");
    } finally {
      setQrzLoading(false);
    }
  };

  const selectRef = (r) => {
    setRefType(r.layerType || "custom");
    setRefCode(r.code || r.reference || "");
    setRefName(r.name || "");
    setShowRefDropdown(false);
  };

  const handleSave = async () => {
    if (!callsign || !qsoDate || !frequency) return;
    setSaving(true);
    try {
      await base44.entities.Log.create({
        callsign: callsign.toUpperCase().trim(),
        qso_date: qsoDate,
        time_start: timeStart,
        time_end: timeEnd,
        frequency: parseFloat(frequency),
        band,
        mode,
        rst_sent: rstSent,
        rst_received: rstReceived,
        operator_name: operator.name,
        operator_address: operator.address,
        operator_country: operator.country,
        operator_grid: operator.grid,
        operator_email: operator.email,
        my_reference: refCode,
        my_reference_type: refType,
        my_reference_name: refName,
        notes,
        status: "active"
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (e) {
      setQrzError("Fehler beim Speichern: " + (e.message || "unbekannt"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-gray-900">Neues QSO-Log</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Callsign with QRZ lookup */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rufzeichen (QSO-Partner)</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={callsign}
                onChange={e => setCallsign(e.target.value)}
                onBlur={handleQRZLookup}
                onKeyDown={e => e.key === "Enter" && handleQRZLookup()}
                placeholder="z.B. HB9XYZ"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono uppercase"
              />
              <button
                onClick={handleQRZLookup}
                disabled={qrzLoading || !callsign}
                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1.5"
              >
                {qrzLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                QRZ
              </button>
            </div>
            {qrzError && <p className="text-xs text-amber-600 mt-1">{qrzError}</p>}
            {operator.name && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs space-y-0.5">
                <p className="font-medium text-gray-900">{operator.name}</p>
                {operator.address && <p className="text-gray-600">{operator.address}</p>}
                <div className="flex gap-3">
                  {operator.country && <span className="text-gray-500">{operator.country}</span>}
                  {operator.grid && <span className="text-gray-500 font-mono">Grid: {operator.grid}</span>}
                </div>
                {operator.email && <p className="text-gray-500">{operator.email}</p>}
                <p className="text-blue-500 mt-1">✓ Daten von QRZ.com übernommen</p>
              </div>
            )}
          </div>

          {/* QSO Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Datum</label>
              <input type="date" value={qsoDate} onChange={e => setQsoDate(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Startzeit UTC</label>
              <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Frequenz (MHz)</label>
              <input type="number" step="0.001" value={frequency} onChange={e => setFrequency(e.target.value)} placeholder="z.B. 144.500" className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Band</label>
              <select value={band} onChange={e => setBand(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300">
                {BANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Mode</label>
              <select value={mode} onChange={e => setMode(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300">
                {MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">RST S</label>
                <input type="text" value={rstSent} onChange={e => setRstSent(e.target.value)} className="w-full mt-1 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">RST R</label>
                <input type="text" value={rstReceived} onChange={e => setRstReceived(e.target.value)} className="w-full mt-1 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          </div>

          {/* My Reference */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Mein Standort / Referenz
              </label>
              {nearbyRefs.length > 0 && (
                <button
                  onClick={() => setShowRefDropdown(!showRefDropdown)}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  {nearbyRefs.length} Referenz{nearbyRefs.length !== 1 ? 'en' : ''} in der Nähe
                </button>
              )}
            </div>

            {showRefDropdown && nearbyRefs.length > 0 && (
              <div className="mb-2 max-h-40 overflow-y-auto bg-white rounded-lg border border-gray-200 divide-y divide-gray-50">
                {nearbyRefs.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectRef(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left text-xs"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                    <span className="font-mono font-semibold text-gray-900">{r.code || r.reference}</span>
                    <span className="flex-1 truncate text-gray-500">{r.name}</span>
                    <span className="text-gray-400">{r.distance.toFixed(1)} km</span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <select
                value={refType}
                onChange={e => setRefType(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {REF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input
                type="text"
                value={refCode}
                onChange={e => setRefCode(e.target.value)}
                placeholder="Referenz-Code (z.B. HB/AG-001)"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <input
              type="text"
              value={refName}
              onChange={e => setRefName(e.target.value)}
              placeholder="Name der Referenz"
              className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            {mapCenter && (
              <p className="text-[10px] text-gray-400 mt-1.5">
                📍 Karte zentriert auf: {mapCenter[0].toFixed(4)}, {mapCenter[1].toFixed(4)}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Notizen</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Zusätzliche Informationen..."
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !callsign || !frequency}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            QSO speichern
          </button>
        </div>
      </div>
    </div>
  );
}