import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, Navigation, Clock, Radio, X, Eye, Loader2, Plus } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon, haversine, bearing } from "@/lib/geoUtilsFrontend";
import { isQRT, getFlagImg, getReferenceUrl } from "@/lib/spotUtils";

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

// Great Circle intermediate points — gekrümmte Polyline entlang des Grosskreises.
// 64 Segmente für korrekte Krümmung. Handhabt Datumsgrenze korrekt.
function greatCirclePoints(lat1, lon1, lat2, lon2, segments = 64) {
  const pts = [];
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  let lam1 = lon1 * Math.PI / 180;
  let lam2 = lon2 * Math.PI / 180;
  // Datumsgrenze: kürzesten Weg wählen
  if (Math.abs(lam2 - lam1) > Math.PI) {
    if (lam2 > lam1) lam2 -= 2 * Math.PI;
    else lam1 -= 2 * Math.PI;
  }
  const cosA = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const sinA = Math.sin(a);
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    if (sinA < 0.001) { pts.push([lat1, lon1]); continue; }
    const sinF1 = Math.sin((1 - f) * a) / sinA;
    const sinF2 = Math.sin(f * a) / sinA;
    const x = sinF1 * Math.cos(phi1) * Math.cos(lam1) + sinF2 * Math.cos(phi2) * Math.cos(lam2);
    const y = sinF1 * Math.cos(phi1) * Math.sin(lam1) + sinF2 * Math.cos(phi2) * Math.sin(lam2);
    const z = sinF1 * Math.sin(phi1) + sinF2 * Math.sin(phi2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
    let lon = Math.atan2(y, x) * 180 / Math.PI;
    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;
    pts.push([lat, lon]);
  }
  return pts;
}

// AutoFit läuft nur EINMAL beim Mount — danach nicht mehr, damit User pan/zoom frei nutzen kann
// Fix 1+2: AutoFit — userInteracted Flag verhindert auto-fitBounds nach User-Interaktion.
// 300ms setTimeout + invalidateSize für Leaflet-in-Modal Bug.
function AutoFit({ positions }) {
  const map = useMap();
  const prevSig = useRef('');
  const userInteracted = useRef(false);
  const fitting = useRef(false);

  // Fix 1: Track user interaction (drag/zoom) — ignore programmatic fitBounds
  useEffect(() => {
    if (!map) return;
    const onDragStart = () => { userInteracted.current = true; };
    const onZoomStart = () => { if (!fitting.current) userInteracted.current = true; };
    const onMoveStart = () => { if (!fitting.current) userInteracted.current = true; };
    map.on('dragstart', onDragStart);
    map.on('zoomstart', onZoomStart);
    map.on('movestart', onMoveStart);
    return () => {
      map.off('dragstart', onDragStart);
      map.off('zoomstart', onZoomStart);
      map.off('movestart', onMoveStart);
    };
  }, [map]);

  useEffect(() => {
    const sig = positions.map(p => p.join(',')).join('|');
    // Fix 1: Don't re-fit if user has interacted or positions unchanged
    if (sig === prevSig.current || userInteracted.current) return;
    prevSig.current = sig;

    // Fix 2: 300ms timeout for invalidateSize (Leaflet in modal needs time to compute size)
    fitting.current = true;
    setTimeout(() => {
      try { if (map._panes && map._mapPane) map.invalidateSize(); } catch (e) {}

      // Datumsgrenze erkennen: abs(lon1-lon2) > 180
      const crossesDateline = positions.length === 2 && Math.abs(positions[0][1] - positions[1][1]) > 180;
      const maxZoomVal = crossesDateline ? 3 : 5;
      let boundsPositions = positions;
      if (crossesDateline) {
        boundsPositions = [
          positions[0],
          [positions[1][0], positions[1][1] > 0 ? positions[1][1] - 360 : positions[1][1] + 360],
        ];
      }

      if (positions.length >= 2) {
        const bounds = L.latLngBounds(boundsPositions.map(p => [p[0], p[1]]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: maxZoomVal });
      } else if (positions.length === 1) {
        map.setView(positions[0], 4);
      }

      // Reset fitting flag after animation completes
      setTimeout(() => { fitting.current = false; }, 500);
    }, 300);
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

  // Effective distance/azimuth: use spot values, or fall back to QRZ grid
  const qrzPos = qrzData?.grid ? maidenheadToLatLon(qrzData.grid) : null;
  const hasSpotDist = spot?.distance != null && spot.distance > 0;
  const hasSpotAz = spot?.azimuth != null && spot.azimuth > 0;
  const effectiveDistance = hasSpotDist
    ? spot.distance
    : (qrzPos && stationPos ? haversine(stationPos.lat, stationPos.lon, qrzPos.lat, qrzPos.lon) : null);
  const effectiveAzimuth = hasSpotAz
    ? spot.azimuth
    : (qrzPos && stationPos ? bearing(stationPos.lat, stationPos.lon, qrzPos.lat, qrzPos.lon) : null);
  const isApprox = !hasSpotDist && effectiveDistance != null;

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
          {/* Fix 6: + QSO Loggen Button zuoberst — vollbreit, grün, immer sichtbar */}
          <button
            onClick={() => { onLogQso?.({ ...spot, _qrzData: qrzData }); onClose(); }}
            className="w-full py-2.5 bg-[#1a9c7c] text-white rounded-lg text-sm font-bold hover:bg-[#158665] transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> QSO loggen
          </button>

          {/* Call + Activity */}
          <div className="flex items-center gap-2">
            {(() => { const flag = getFlagImg(spot?.call); return flag ? <img src={flag.url} alt={flag.code} className="w-5 h-3.5 flex-shrink-0" loading="lazy" /> : (spot?.countryCode ? <span className="text-xl leading-none">{spot.countryCode}</span> : null); })()}
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
            {(() => {
              const ref = spot?.activity_ref || spot?.reference;
              if (!ref) return null;
              // Fix 7 + 9: Referenz-URL via shared utility (WWFF → wwff.co/directory/, WWBOTA → scheme-basiert)
              const actType = spot?.activity_type || spot?.activity;
              const refUrl = getReferenceUrl(actType, ref);
              if (refUrl) {
                return (
                  <a href={refUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-[#00e5ff] hover:underline font-bold">
                    {ref} ↗
                  </a>
                );
              }
              return <span className="text-[10px] text-muted-foreground">{ref}</span>;
            })()}
            {spot?.country && <span className="text-xs text-muted-foreground">{spot.country}</span>}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <InfoRow icon={<Radio className="w-3 h-3" />} label="Frequenz" value={spot?.frequency ? `${(spot.frequency / 1000).toFixed(3)} MHz` : '—'} />
            <InfoRow icon={<MapPin className="w-3 h-3" />} label="Band" value={spot?.band || '—'} />
            <InfoRow icon={<Radio className="w-3 h-3" />} label="Mode" value={spot?.mode || '—'} />
            <InfoRow icon={<Navigation className="w-3 h-3" />} label="Distanz" value={effectiveDistance != null ? `${isApprox ? 'ca. ' : ''}${effectiveDistance} km` : '—'} />
            <InfoRow icon={<Navigation className="w-3 h-3" />} label="Azimuth" value={effectiveAzimuth != null ? `${isApprox ? 'ca. ' : ''}${effectiveAzimuth}°` : '—'} />
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
                {commentList.map((c, i) => <div key={i} className="text-xs text-foreground break-words">{c}</div>)}
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

          {/* Leaflet Map — sofort rendern mit verfuegbaren Koordinaten */}
          {positions.length > 0 ? (
            <div className="rounded-lg overflow-hidden border border-border" style={{ height: 200 }}>
              <MapContainer
                key="spot-details-map"
                center={positions[0]}
                zoom={8}
                className="w-full h-full"
                zoomControl={false}
                scrollWheelZoom={true}
                touchZoom={true}
                doubleClickZoom={true}
                dragging={true}
                minZoom={3}
                maxZoom={18}
                zoomSnap={0.5}
                zoomDelta={0.5}
                zoomAnimation={false}
                bounceAtZoomLimits={true}
                style={{ background: '#0d1720' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
                {stationPos && <Marker position={[stationPos.lat, stationPos.lon]} icon={stationIcon}><Tooltip direction="top" offset={[0, -10]} permanent>Mein Standort</Tooltip></Marker>}
                {dxPos && <Marker position={[dxPos.lat, dxPos.lon]} icon={dxIcon}><Tooltip direction="top" offset={[0, -10]} permanent>{spot?.call}{spot?.activity_ref ? ` · ${spot.activity_ref}` : ''}</Tooltip></Marker>}
                {positions.length === 2 && stationPos && dxPos && (() => {
                  const gcPts = greatCirclePoints(stationPos.lat, stationPos.lon, dxPos.lat, dxPos.lon, 64);
                  // Am Datumsgrenze in Segmente aufteilen
                  const segments = [];
                  let currentSeg = [gcPts[0]];
                  for (let i = 1; i < gcPts.length; i++) {
                    if (Math.abs(gcPts[i][1] - gcPts[i - 1][1]) > 180) {
                      segments.push(currentSeg);
                      currentSeg = [gcPts[i]];
                    } else {
                      currentSeg.push(gcPts[i]);
                    }
                  }
                  segments.push(currentSeg);
                  return segments.map((seg, i) => (
                    <Polyline key={i} positions={seg} pathOptions={{ color: '#00e5ff', dashArray: '5,5' }} />
                  ));
                })()}
                <AutoFit positions={positions} />
              </MapContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center text-xs text-muted-foreground py-8 bg-background rounded-lg border border-border">
              Keine Koordinaten für diese Station verfügbar
            </div>
          )}

          {/* QRZ Button — separat vom QSO-Log-Button (Fix 6: QSO-Button ist zuoberst) */}
          {qrzData && (
            <button
              onClick={() => window.open(`https://www.qrz.com/db/${spot?.call}`, '_blank')}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
              title="QRZ.com Detail-Seite öffnen"
            >
              <Eye className="w-4 h-4" /> QRZ.com öffnen
            </button>
          )}
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