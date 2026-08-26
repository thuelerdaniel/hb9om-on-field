import React, { useState, useEffect } from "react";
import { MapPin, Navigation, Clock, Radio, X, Eye } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon } from "@/lib/geoUtilsFrontend";



// Spot Details Modal — zeigt Spot-Details mit Leaflet-Karte.
// QTH Marker + DX Marker + Polyline (Bearing), Auto-Zoom.

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function AutoFit({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      const bounds = L.latLngBounds(positions.map(p => [p[0], p[1]]));
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (positions.length === 1) {
      map.setView(positions[0], 10);
    }
  }, [positions, map]);
  return null;
}

function ageText(age) {
  if (age == null) return '—';
  if (age < 60) return `${age}s`;
  if (age < 3600) return `${Math.floor(age / 60)}m`;
  return `${Math.floor(age / 3600)}h`;
}

export default function SpotDetailsModal({ spot, stationInfo, onClose, onLogQso }) {
  const [qrzData, setQrzData] = useState(null);
  const [qrzLoading, setQrzLoading] = useState(false);

  const stationPos = stationInfo?.locator ? maidenheadToLatLon(stationInfo.locator) : null;
  const dxPos = spot?.locator ? maidenheadToLatLon(spot.locator) : null;

  const positions = [];
  if (stationPos) positions.push([stationPos.lat, stationPos.lon]);
  if (dxPos) positions.push([dxPos.lat, dxPos.lon]);

  useEffect(() => {
    if (!spot?.call) return;
    setQrzLoading(true);
    (async () => {
      try {
        const res = await base44.functions.invoke("fetchQRZ", { callsign: spot.call });
        const data = res?.data || res;
        if (data?.callsign) setQrzData(data);
      } catch {} finally { setQrzLoading(false); }
    })();
  }, [spot?.call]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1720] border border-[#1d3442] rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1d3442] sticky top-0 bg-[#0d1720] z-10">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-[#00e5ff]" /> Spot Details
          </h3>
          <button onClick={onClose} className="text-[#9aa7b0] hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Call + Activity */}
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#00e5ff]">{spot?.call}</span>
            {spot?.activity && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8cff00]/20 text-[#8cff00] font-bold">{spot.activity}</span>
            )}
            {spot?.country && <span className="text-xs text-[#9aa7b0]">{spot.country}</span>}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <InfoRow icon={<Radio className="w-3 h-3" />} label="Frequenz" value={spot?.frequency ? `${(spot.frequency / 1000).toFixed(3)} MHz` : '—'} />
            <InfoRow icon={<MapPin className="w-3 h-3" />} label="Band" value={spot?.band || '—'} />
            <InfoRow icon={<Radio className="w-3 h-3" />} label="Mode" value={spot?.mode || '—'} />
            <InfoRow icon={<Navigation className="w-3 h-3" />} label="Distanz" value={spot?.distance > 0 ? `${spot.distance} km` : '—'} />
            <InfoRow icon={<Navigation className="w-3 h-3" />} label="Azimuth" value={spot?.azimuth > 0 ? `${spot.azimuth}°` : '—'} />
            <InfoRow icon={<MapPin className="w-3 h-3" />} label="Locator" value={spot?.locator || '—'} />
            <InfoRow icon={<Clock className="w-3 h-3" />} label="Alter" value={ageText(spot?.age_seconds)} />
            <InfoRow icon={<Radio className="w-3 h-3" />} label="Confidence" value={spot?.confidence ? `${spot.confidence}/100` : '—'} />
          </div>

          {/* Source + Spotter */}
          <div className="text-[10px] text-[#9aa7b0]">
            Quelle: {spot?.source || '—'} · Spotter: {spot?.spotter || '—'}
          </div>

          {/* Comments */}
          {spot?.comments?.length > 0 && (
            <div className="bg-[#050b10] rounded-lg p-2 border border-[#1d3442]">
              <div className="text-[9px] text-[#9aa7b0] uppercase mb-1">Kommentare</div>
              {spot.comments.map((c, i) => <div key={i} className="text-xs text-white">{c}</div>)}
            </div>
          )}

          {/* QRZ Info */}
          {qrzLoading && <div className="text-xs text-[#9aa7b0]">QRZ-Lookup…</div>}
          {qrzData && (
            <div className="bg-[#050b10] rounded-lg p-2 border border-[#1d3442] space-y-1">
              <div className="text-[9px] text-[#9aa7b0] uppercase">QRZ.com</div>
              {qrzData.name && <div className="text-xs text-white">{qrzData.name}</div>}
              {qrzData.country && <div className="text-xs text-[#9aa7b0]">{qrzData.country}</div>}
              {qrzData.grid && <div className="text-xs text-[#9aa7b0]">Grid: {qrzData.grid}</div>}
            </div>
          )}

          {/* Leaflet Map */}
          {positions.length > 0 && (
            <div className="rounded-lg overflow-hidden border border-[#1d3442]" style={{ height: 200 }}>
              <MapContainer center={positions[0]} zoom={8} className="w-full h-full" style={{ background: '#050b10' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
                {stationPos && <Marker position={[stationPos.lat, stationPos.lon]} />}
                {dxPos && <Marker position={[dxPos.lat, dxPos.lon]} />}
                {positions.length === 2 && (
                  <Polyline positions={positions} pathOptions={{ color: '#00e5ff', dashArray: '5,5' }} />
                )}
                <AutoFit positions={positions} />
              </MapContainer>
            </div>
          )}

          {/* Log QSO Button */}
          <button
            onClick={() => { onLogQso?.(spot); onClose(); }}
            className="w-full py-2.5 bg-[#8cff00] text-black rounded-lg text-sm font-bold hover:bg-[#7aee00] transition-colors"
          >
            QSO loggen
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#9aa7b0]">{icon}</span>
      <div>
        <div className="text-[9px] text-[#9aa7b0] uppercase">{label}</div>
        <div className="text-xs text-white">{value}</div>
      </div>
    </div>
  );
}