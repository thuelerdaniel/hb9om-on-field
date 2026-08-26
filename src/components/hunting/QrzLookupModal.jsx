import React, { useState, useEffect, useCallback } from "react";
import { X, User, MapPin, Mail, Grid3x3, Loader2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";

// QRZ Lookup Modal — prüft zuerst QrzLookup Entity, falls nicht vorhanden
// starte QRZ-Abfrage via fetchQRZ und speichere in QrzLookup.

export default function QrzLookupModal({ callsign, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const lookup = useCallback(async (call) => {
    if (!call) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // 1. Prüfe QrzLookup Entity ob Eintrag existiert
      let existing = null;
      try {
        const results = await base44.entities.QrzLookup.filter({ callsign: call });
        existing = Array.isArray(results) && results.length > 0 ? results[0] : null;
      } catch {}

      if (existing && existing.name) {
        setData(existing);
        setLoading(false);
        return;
      }

      // 2. QRZ-Abfrage via fetchQRZ
      const res = await base44.functions.invoke("fetchQRZ", { callsign: call });
      const qrzData = res?.data || res;

      if (qrzData?.error) {
        setError(qrzData.error);
        setLoading(false);
        return;
      }

      if (qrzData?.callsign) {
        setData(qrzData);
        // In QrzLookup Entity speichern (für zukünftige Lookups)
        try {
          // Falls bereits ein Eintrag existiert (ohne name), update; sonst create
          if (existing) {
            await base44.entities.QrzLookup.update(existing.id, {
              name: qrzData.name,
              address: qrzData.address,
              country: qrzData.country,
              grid: qrzData.grid,
              email: qrzData.email,
              lat: qrzData.lat,
              lng: qrzData.lng,
              lookup_status: 'success',
            });
          } else {
            await base44.entities.QrzLookup.create({
              callsign: qrzData.callsign,
              name: qrzData.name,
              address: qrzData.address,
              country: qrzData.country,
              grid: qrzData.grid,
              email: qrzData.email,
              lat: qrzData.lat,
              lng: qrzData.lng,
              lookup_status: 'success',
            });
          }
        } catch {}
      } else {
        setError('Keine Daten von QRZ.com erhalten');
      }
    } catch (e) {
      setError('QRZ-Abfrage fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    lookup(callsign);
  }, [callsign, lookup]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl max-w-sm w-full border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
            <Search className="w-4 h-4 text-green-400" /> QRZ-Lookup
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Callsign */}
          <div className="mb-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Rufzeichen</div>
            <div className="text-xl font-bold text-green-400">{callsign}</div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">QRZ.com wird abgefragt…</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-sm text-red-400 py-2">{error}</div>
          )}

          {data && !loading && (
            <div className="space-y-3">
              {data.name && (
                <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Name" value={data.name} />
              )}
              {data.address && (
                <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Adresse" value={data.address} />
              )}
              {data.country && (
                <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Land" value={data.country} />
              )}
              {data.grid && (
                <InfoRow icon={<Grid3x3 className="w-3.5 h-3.5" />} label="Grid" value={data.grid} />
              )}
              {data.email && (
                <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="E-Mail" value={data.email} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-500 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
        <div className="text-sm text-gray-200 break-words">{value}</div>
      </div>
    </div>
  );
}