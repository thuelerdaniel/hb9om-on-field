import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Save, MapPin, History, Trash2, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon, destinationPoint, signalToDistance } from "@/lib/geoUtilsFrontend";

// Fox Hunt Modal — Peilung erfassen, Karte mit Triangulation, Verlauf.
// SHACK-SERVER Style: #050b10 bg, #0d1720 panels, #8cff00 green.

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// 🦊 Icon für Fuchs-Marker
const foxIcon = L.divIcon({
  html: '<div style="font-size: 24px; text-align: center;">🦊</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
});

// QTH Icon
const qthIcon = L.divIcon({
  html: '<div style="font-size: 20px; text-align: center;">🏠</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: '',
});

function AutoFit({ positions }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || positions.length === 0) return;
    map.invalidateSize();
    if (positions.length === 1) { map.setView(positions[0], 12); done.current = true; return; }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    done.current = true;
  }, [positions, map]);
  return null;
}

export default function FoxHuntModal({ stationInfo, gpsPosition, onClose }) {
  const [azimuth, setAzimuth] = useState(0);
  const [signal, setSignal] = useState(5);
  const [frequency, setFrequency] = useState('');
  const [note, setNote] = useState('');
  const [bearings, setBearings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const stationPos = gpsPosition
    ? { lat: gpsPosition[0], lon: gpsPosition[1] }
    : (stationInfo?.locator ? maidenheadToLatLon(stationInfo.locator) : { lat: 46.5, lon: 6.5 });
  const posSourceLabel = gpsPosition ? 'GPS' : 'Station';

  const loadBearings = useCallback(async () => {
    try {
      const list = await base44.entities.FoxHuntLog.list('-timestamp', 100);
      setBearings(list || []);
    } catch {}
  }, []);

  useEffect(() => { loadBearings(); }, [loadBearings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const dist = signalToDistance(signal);
      const dest = destinationPoint(stationPos.lat, stationPos.lon, azimuth, dist);
      const payload = {
        azimuth,
        signal_strength: signal,
        frequency: frequency ? parseInt(frequency) : undefined,
        note,
        timestamp: new Date().toISOString(),
        lat: dest.lat,
        lng: dest.lon,
      };
      await base44.entities.FoxHuntLog.create(payload);
      setNote('');
      await loadBearings();
      setShowMap(true);
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.FoxHuntLog.delete(id);
      await loadBearings();
    } catch {}
  };

  // Map positions: QTH + all bearing endpoints
  const mapPositions = [[stationPos.lat, stationPos.lon]];
  const bearingLines = [];
  for (const b of bearings) {
    mapPositions.push([b.lat, b.lng]);
    bearingLines.push({
      positions: [[stationPos.lat, stationPos.lon], [b.lat, b.lng]],
      color: '#8cff00',
    });
  }

  // Triangulation: average of all bearing endpoints
  const foxPos = bearings.length > 0
    ? [bearings.reduce((s, b) => s + b.lat, 0) / bearings.length,
       bearings.reduce((s, b) => s + b.lng, 0) / bearings.length]
    : null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1720] border border-[#1d3442] rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1d3442] sticky top-0 bg-[#0d1720] z-10">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            🦊 Fox Hunting
          </h3>
          <button onClick={onClose} className="text-[#9aa7b0] hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Position Source Label */}
        <div className="px-4 pt-2 text-[9px] text-[#9aa7b0] flex items-center gap-1">
          {gpsPosition ? '📍 GPS-Position' : '🏠 Station-Locator'} — {stationPos.lat.toFixed(4)}°, {stationPos.lon.toFixed(4)}°
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Azimuth Slider */}
          <div>
            <label className="text-[10px] text-[#9aa7b0] uppercase tracking-wide mb-1 flex justify-between">
              <span>Peilrichtung (Azimuth)</span>
              <span className="text-[#00e5ff] font-bold text-sm">{azimuth}°</span>
            </label>
            <input
              type="range" min="0" max="360" value={azimuth}
              onChange={e => setAzimuth(parseInt(e.target.value))}
              className="w-full accent-[#8cff00]"
            />
            <div className="flex justify-between text-[8px] text-[#9aa7b0] mt-0.5">
              <span>N(0°)</span><span>E(90°)</span><span>S(180°)</span><span>W(270°)</span><span>N(360°)</span>
            </div>
          </div>

          {/* Signal Strength Slider */}
          <div>
            <label className="text-[10px] text-[#9aa7b0] uppercase tracking-wide mb-1 flex justify-between">
              <span>Feldstärke (S-Meter)</span>
              <span className="text-[#8cff00] font-bold text-sm">S{signal}</span>
            </label>
            <input
              type="range" min="1" max="9" value={signal}
              onChange={e => setSignal(parseInt(e.target.value))}
              className="w-full accent-[#8cff00]"
            />
            <div className="text-[9px] text-[#9aa7b0] mt-0.5">
              Geschätzte Distanz: ~{signalToDistance(signal)} km
            </div>
          </div>

          {/* Frequency + Note */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#9aa7b0] uppercase tracking-wide mb-1 block">Frequenz (kHz)</label>
              <input
                type="number"
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                placeholder="optional"
                className="w-full px-2 py-1.5 text-xs bg-[#050b10] border border-[#1d3442] rounded-lg text-white placeholder-[#9aa7b0] focus:border-[#00e5ff] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#9aa7b0] uppercase tracking-wide mb-1 block">Notiz</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="optional"
                className="w-full px-2 py-1.5 text-xs bg-[#050b10] border border-[#1d3442] rounded-lg text-white placeholder-[#9aa7b0] focus:border-[#00e5ff] outline-none"
              />
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-[#8cff00] text-black rounded-lg text-sm font-bold hover:bg-[#7aee00] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Peilung speichern
          </button>

          {/* Map + History Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowMap(!showMap); setShowHistory(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                showMap ? "bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/50" : "bg-[#050b10] text-[#9aa7b0] border border-[#1d3442]"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" /> Karte
            </button>
            <button
              onClick={() => { setShowHistory(!showHistory); setShowMap(false); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                showHistory ? "bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/50" : "bg-[#050b10] text-[#9aa7b0] border border-[#1d3442]"
              }`}
            >
              <History className="w-3.5 h-3.5" /> Verlauf ({bearings.length})
            </button>
          </div>

          {/* Map */}
          {showMap && (
            <div className="rounded-lg overflow-hidden border border-[#1d3442]" style={{ height: 250 }}>
              <MapContainer
                center={[stationPos.lat, stationPos.lon]}
                zoom={12}
                className="w-full h-full"
                scrollWheelZoom={true}
                touchZoom={true}
                doubleClickZoom={true}
                dragging={true}
                minZoom={3}
                maxZoom={18}
                zoomSnap={1}
                zoomDelta={1}
                bounceAtZoomLimits={true}
                style={{ background: '#050b10' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
                <Marker position={[stationPos.lat, stationPos.lon]} icon={qthIcon} />
                {bearingLines.map((line, i) => (
                  <Polyline key={i} positions={line.positions} pathOptions={{ color: line.color, dashArray: '5,5' }} />
                ))}
                {bearings.map((b, i) => (
                  <Circle key={i} center={[b.lat, b.lng]} radius={100} pathOptions={{ color: '#ffc400' }} />
                ))}
                {foxPos && <Marker position={foxPos} icon={foxIcon} />}
                <AutoFit positions={mapPositions} />
              </MapContainer>
            </div>
          )}

          {/* History */}
          {showHistory && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {bearings.length === 0 ? (
                <div className="text-xs text-[#9aa7b0] text-center py-4">Keine Peilungen vorhanden.</div>
              ) : (
                bearings.map((b, i) => (
                  <div key={b.id || i} className="flex items-center gap-2 px-2 py-1.5 bg-[#050b10] rounded-lg border border-[#1d3442] text-xs">
                    <span className="text-[#8cff00] font-bold">S{b.signal_strength}</span>
                    <span className="text-[#00e5ff] font-mono">{b.azimuth}°</span>
                    {b.frequency && <span className="text-[#9aa7b0] font-mono">{b.frequency} kHz</span>}
                    {b.note && <span className="text-[#9aa7b0] truncate flex-1">{b.note}</span>}
                    <span className="text-[9px] text-[#9aa7b0] ml-auto">
                      {new Date(b.timestamp).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button onClick={() => handleDelete(b.id)} className="text-[#ff5252] hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}