import React, { useState, useEffect } from "react";
import { X, Loader2, MapPin, Award, Radio, ExternalLink, AlertCircle } from "lucide-react";

// POTA Park-Info Popup — ruft Park-Details von api.pota.app/park/{reference} ab.
// Zeigt Park-Name, Location, Koordinaten, Entity, Aktivierungen etc.

export default function PotaParkInfoPopup({ reference, onClose }) {
  const [parkInfo, setParkInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchParkInfo = async () => {
      if (!reference) return;
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`https://api.pota.app/park/${reference}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        setParkInfo(data);
      } catch (e) {
        setError(e.message || 'Park-Info nicht verfügbar');
      } finally {
        setLoading(false);
      }
    };
    fetchParkInfo();
  }, [reference]);

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-green-600 text-white px-4 py-3 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            <h2 className="text-sm font-bold">POTA Park-Info</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Park-Details werden geladen…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-red-500 gap-2">
              <AlertCircle className="w-8 h-8" />
              <span className="text-sm">{error}</span>
              <span className="text-xs text-gray-400">Referenz: {reference}</span>
            </div>
          ) : parkInfo ? (
            <>
              {/* Reference + Name */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="text-xs font-mono text-green-600 dark:text-green-400 font-bold">{reference}</div>
                <div className="text-base font-bold text-gray-900 dark:text-slate-100 mt-1">
                  {parkInfo.name || 'Unbekannter Park'}
                </div>
              </div>

              {/* Details Grid */}
              <div className="space-y-2">
                {parkInfo.entityName && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500">Entity</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{parkInfo.entityName}</span>
                  </div>
                )}
                {parkInfo.locationDesc && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500">Location</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-slate-100 text-right">{parkInfo.locationDesc}</span>
                  </div>
                )}
                {parkInfo.latitude != null && parkInfo.longitude != null && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Koordinaten</span>
                    <span className="text-sm font-mono text-gray-900 dark:text-slate-100">
                      {parkInfo.latitude.toFixed(4)}, {parkInfo.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
                {parkInfo.grid4 && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500">Grid</span>
                    <span className="text-sm font-mono text-gray-900 dark:text-slate-100">{parkInfo.grid4}{parkInfo.grid6 ? parkInfo.grid6.substring(4) : ''}</span>
                  </div>
                )}
                {parkInfo.activations != null && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Radio className="w-3 h-3" /> Aktivierungen</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{parkInfo.activations}</span>
                  </div>
                )}
                {parkInfo.firstActivationDate && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500">Erste Aktivierung</span>
                    <span className="text-sm text-gray-900 dark:text-slate-100">{new Date(parkInfo.firstActivationDate).toLocaleDateString('de-CH')}</span>
                  </div>
                )}
                {parkInfo.parktypeDesc && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500">Typ</span>
                    <span className="text-sm text-gray-900 dark:text-slate-100">{parkInfo.parktypeDesc}</span>
                  </div>
                )}
                {parkInfo.accessibility && (
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500">Zugänglichkeit</span>
                    <span className="text-sm text-gray-900 dark:text-slate-100">{parkInfo.accessibility}</span>
                  </div>
                )}
                {parkInfo.websiteUrl && (
                  <div className="py-1.5">
                    <a
                      href={parkInfo.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Park-Website
                    </a>
                  </div>
                )}
              </div>

              {/* External Links */}
              <div className="flex gap-2 pt-2">
                <a
                  href={`https://pota.app/#/park/${reference}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> POTA-Website
                </a>
                {parkInfo.latitude != null && parkInfo.longitude != null && (
                  <a
                    href={`https://www.google.com/maps?q=${parkInfo.latitude},${parkInfo.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Google Maps
                  </a>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}