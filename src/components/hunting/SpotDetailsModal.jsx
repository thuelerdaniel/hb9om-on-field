import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, Navigation, Clock, Radio, X, Eye, Loader2 } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon } from "@/lib/geoUtilsFrontend";

// Spot Details Modal — zeigt Spot-Details mit Leaflet-Karte.
// Verwendet spot.lat/lng (DXCC-Koordinaten) oder Locator für DX-Marker.
// Theme-aware: bg-card, border-border, text-foreground.

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Station-Marker (blau) — eigene Position
const stationIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#00e5ff;border:3px solid #0d1720;box-shadow:0 0 6px #00e5ff;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// DX-Marker (grün) — gespotete Station
const dxIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#8cff00;border:3px solid #0d1720;box-shadow:0 0 6px #8cff00;"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// AutoFit läuft nur EINMAL beim Mount — danach nicht mehr, damit User pan/zoom frei nutzen kann
function AutoFit({ positions }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    // invalidateSize: Modal-Container hat beim ersten Render oft falsche Grösse
    map.invalidateSize();
    if (positions.length >= 2) {
      const bounds = L.latLngBounds(positions.map(p => [p[0], p[1]]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      done.current = true;
    } else if (positions.length === 1) {
      map.setView(positions[0], 10);
      done.current = true;
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

export default function SpotDetailsModal({ spot, stationInfo, gpsPos, onClose, onLogQso }) {
  const [qrzData, setQrzData] = useState(null);
  const [qrzLoading, setQrzLoading] = useState(false);

  // Station-Position: GPS voranstellen, Fallback auf Locator
  const stationPos = gpsPos
    ? { lat: gpsPos.lat, lon: gpsPos.lng }
    : (stationInfo?.locator ? maidenheadToLatLon(stationInfo.locator) : null);

  // DX-Position: Fallback-Reihenfolge: spot.lat/lng → spot.locator/grid6 → QRZ grid
  // Erst nach QRZ-Lookup ist die finale Position bekannt — Karte wird entsprechend verzögert gerendert
  const dxLat = spot?.latitude ?? spot?.lat;
  const dxLng = spot?.longitude ?? spot?.lng;
  const dxPos = useMemo(() => {
    if (dxLat != null && dxLng != null) return { lat: dxLat, lon: dxLng, source: 'Cluster' };
    if (spot?.locator || spot?.grid6) {
      const p = maidenheadToLatLon(spot.locator || spot.grid6);
      return p ? { ...p, source: 'Locator' } : null;
    }
    if (qrzData?.grid) {
      const p = maidenheadToLatLon(qrzData.grid);
      return p ? { ...p, source: 'QRZ' } : null;
    }
    return null;
  }, [dxLat, dxLng, spot?.locator, spot?.grid6, qrzData]);

  const positions = useMemo(() => {
    const arr = [];
    if (stationPos) arr.push([stationPos.lat, stationPos.lon]);
    if (dxPos) arr.push([dxPos.lat, dxPos.lon]);
    return arr;
  }, [stationPos?.lat, stationPos?.lon, dxPos?.lat, dxPos?.lon]);

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
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-[#00e5ff]" /> Spot Details
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Call + Activity */}
          <div className="flex items-center gap-2">
            {spot?.countryCode && <span className="text-xl leading-none">{spot.countryCode}</span>}
            <span className="text-xl font-bold text-[#00e5ff]">{spot?.call}</span>
            {(spot?.activity || spot?.activity_type) && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: (spot.activity_type || spot.activity) === 'SOTA' ? '#ff980020' : '#8cff0020',
                  color: (spot.activity_type || spot.activity) === 'SOTA' ? '#ff9800' : '#8cff00',
                }}
              >{spot.activity_type || spot.activity}</span>
            )}
            {(spot?.activity_ref || spot?.reference) && (
              <span className="text-[10px] text-muted-foreground">{spot.activity_ref || spot.reference}</span>
            )}
            {spot?.country && <span className="text-xs text-muted-foreground">{spot.country}</span>}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <InfoRow icon={<Radio className="w-3 h-3" />} label="Frequenz" value={spot?.frequency ? `${(spot.frequency / 1000).toFixed(3)} MHz` : '—'} />
            <InfoRow icon={<MapPin className="w-3 h-3" />} label="Band" value={spot?.band || '—'} />
            <InfoRow icon={<Radio className="w-3 h-3" />} label="Mode" value={spot?.mode || '—'} />
            <InfoRow icon={<Navigation className="w-3 h-3" />} label="Distanz" value={spot?.distance > 0 ? `${spot.distance} km` : '—'} />
            <InfoRow icon={<Navigation className="w-3 h-3" />} label="Azimuth" value={spot?.azimuth > 0 ? `${spot.azimuth}°` : '—'} />
            <InfoRow icon={<MapPin className="w-3 h-3" />} label="Locator" value={spot?.locator || spot?.grid6 || '—'} />
            <InfoRow icon={<MapPin className="w-3 h-3" />} label="Koordinaten" value={dxLat != null ? `${dxLat.toFixed(2)}°, ${dxLng.toFixed(2)}°` : '—'} />
            <InfoRow icon={<Clock className="w-3 h-3" />} label="Alter" value={ageText(spot?.age_seconds)} />
            <InfoRow icon={<Radio className="w-3 h-3" />} label="Confidence" value={spot?.confidence ? `${spot.confidence}/100` : '—'} />
          </div>

          {/* Source + Spotter */}
          <div className="text-[10px] text-muted-foreground">
            Quelle: {spot?.source || '—'} · Spotter: {spot?.spotter || '—'}
          </div>

          {/* Comments — DxSpot: array, ActivitySpot: string */}
          {(() => {
            const commentList = Array.isArray(spot?.comments)
              ? spot.comments
              : (spot?.comments ? [spot.comments] : []);
            if (commentList.length === 0) return null;
            return (
              <div className="bg-background rounded-lg p-2 border border-border">
                <div className="text-[9px] text-muted-foreground uppercase mb-1">Kommentare</div>
                {commentList.map((c, i) => <div key={i} className="text-xs text-foreground">{c}</div>)}
              </div>
            );
          })()}

          {/* QRZ Info */}
          {qrzLoading && <div className="text-xs text-muted-foreground">QRZ-Lookup…</div>}
          {qrzData && (
            <div className="bg-background rounded-lg p-2 border border-border space-y-1">
              <div className="text-[9px] text-muted-foreground uppercase">QRZ.com</div>
              {qrzData.name && <div className="text-xs text-foreground">{qrzData.name}</div>}
              {qrzData.country && <div className="text-xs text-muted-foreground">{qrzData.country}</div>}
              {qrzData.grid && <div className="text-xs text-muted-foreground">Grid: {qrzData.grid}</div>}
            </div>
          )}

          {/* Coordinate source indicator */}
          {dxPos?.source && (
            <div className="text-[9px] text-muted-foreground">
              DX-Koordinaten aus: {dxPos.source}
            </div>
          )}

          {/* Leaflet Map — erst nach QRZ-Lookup rendern, damit alle Koordinaten-Quellen genutzt werden */}
          {qrzLoading ? (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-8 bg-background rounded-lg border border-border">
              <Loader2 className="w-3 h-3 animate-spin" /> Koordinaten werden ermittelt…
            </div>
          ) : positions.length > 0 ? (
            <div className="rounded-lg overflow-hidden border border-border" style={{ height: 200 }}>
              <MapContainer
                key="spot-details-map"
                center={positions[0]}
                zoom={8}
                className="w-full h-full"
                scrollWheelZoom={true}
                touchZoom={true}
                doubleClickZoom={true}
                dragging={true}
                minZoom={3}
                maxZoom={18}
                zoomSnap={1}
                zoomDelta={1}
                zoomAnimation={false}
                bounceAtZoomLimits={true}
                style={{ background: '#0d1720' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
                {stationPos && <Marker position={[stationPos.lat, stationPos.lon]} icon={stationIcon} />}
                {dxPos && <Marker position={[dxPos.lat, dxPos.lon]} icon={dxIcon} />}
                {positions.length === 2 && (
                  <Polyline positions={positions} pathOptions={{ color: '#00e5ff', dashArray: '5,5' }} />
                )}
                <AutoFit positions={positions} />
              </MapContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center text-xs text-muted-foreground py-8 bg-background rounded-lg border border-border">
              Keine Koordinaten für diese Station verfügbar
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
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
        <div className="text-xs text-foreground">{value}</div>
      </div>
    </div>
  );
}