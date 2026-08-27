import React, { useState, useEffect, useCallback } from "react";
import { X, User, MapPin, Mail, Grid3x3, Loader2, Search, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";

// QRZ Lookup Modal — Theme-aware.
// Prüft zuerst QrzLookup Entity, dann fetchQRZ.
// Fix 3: "QSO loggen" Button — schliesst QRZ-Popup, öffnet QSO-Formular mit Prefill.

export default function QrzLookupModal({ callsign, spot, onLogQso, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lookup = useCallback(async (call) => {
    if (!call) return;
    setLoading(true); setError(null); setData(null);
    try {
      let existing = null;
      try {
        const results = await base44.entities.QrzLookup.filter({ callsign: call });
        existing = Array.isArray(results) && results.length > 0 ? results[0] : null;
      } catch {}
      if (existing && existing.name) { setData(existing); setLoading(false); return; }

      const res = await base44.functions.invoke("fetchQRZ", { callsign: call });
      const qrzData = res?.data || res;
      if (qrzData?.error) { setError(qrzData.error); setLoading(false); return; }
      if (qrzData?.callsign) {
        setData(qrzData);
        try {
          if (existing) {
            await base44.entities.QrzLookup.update(existing.id, {
              name: qrzData.name, address: qrzData.address, country: qrzData.country,
              grid: qrzData.grid, email: qrzData.email, lat: qrzData.lat, lng: qrzData.lng,
              lookup_status: 'success',
            });
          } else {
            await base44.entities.QrzLookup.create({
              callsign: qrzData.callsign, name: qrzData.name, address: qrzData.address,
              country: qrzData.country, grid: qrzData.grid, email: qrzData.email,
              lat: qrzData.lat, lng: qrzData.lng, lookup_status: 'success',
            });
          }
        } catch {}
      } else { setError('Keine Daten von QRZ.com erhalten'); }
    } catch { setError('QRZ-Abfrage fehlgeschlagen'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { lookup(callsign); }, [callsign, lookup]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Search className="w-4 h-4 text-[#00e5ff]" /> QRZ-Lookup
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Rufzeichen</div>
            <div className="text-xl font-bold text-[#00e5ff]">{callsign}</div>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">QRZ.com wird abgefragt…</span>
            </div>
          )}
          {error && !loading && <div className="text-sm text-[#ff5252] py-2">{error}</div>}
          {data && !loading && (
            <div className="space-y-3">
              {data.name && <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Name" value={data.name} />}
              {data.address && <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Adresse" value={data.address} />}
              {data.country && <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Land" value={data.country} />}
              {data.grid && <InfoRow icon={<Grid3x3 className="w-3.5 h-3.5" />} label="Grid" value={data.grid} />}
              {data.email && <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="E-Mail" value={data.email} />}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={() => { onClose?.(); onLogQso?.(spot); }}
            className="w-full py-2.5 bg-[#1a9c7c] text-white rounded-lg text-sm font-bold hover:bg-[#178570] transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> QSO loggen
          </button>
          <button onClick={onClose} className="w-full py-2 bg-background hover:bg-muted text-muted-foreground rounded-lg text-sm font-medium border border-border">Schliessen</button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm text-foreground break-words">{value}</div>
      </div>
    </div>
  );
}