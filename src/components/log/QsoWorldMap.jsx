import React, { useMemo, useRef, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { maidenheadToLatLon } from "@/lib/geoUtilsFrontend";

// 2D Weltkarte mit Leaflet — zeigt alle QSO-Positionen als Punkte mit Linien zur eigenen Position.

function MapResize() {
  const map = useMap();
  useEffect(() => {
    // invalidateSize muss beim Mount immer laufen — auch wenn keine bounds vorhanden
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function AutoFit({ bounds }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !bounds) return;
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
    done.current = true;
  }, [bounds, map]);
  return null;
}

export default function QsoWorldMap({ entries }) {
  const qsoData = useMemo(() => {
    const points = [];
    const myPositions = [];
    const lines = [];

    for (const e of entries) {
      let partnerPos = e.operator_grid ? maidenheadToLatLon(e.operator_grid) : null;
      let myPos = e.my_grid ? maidenheadToLatLon(e.my_grid) : null;

      if (partnerPos) {
        points.push({ ...partnerPos, callsign: e.callsign, band: e.band, mode: e.mode, date: e.qso_date });
        if (myPos) lines.push({ from: myPos, to: partnerPos });
      }
      if (myPos && !myPositions.some(p => Math.abs(p.lat - myPos.lat) < 0.01 && Math.abs(p.lon - myPos.lon) < 0.01)) {
        myPositions.push(myPos);
      }
    }

    return { points, myPositions, lines };
  }, [entries]);

  const bounds = useMemo(() => {
    const all = [...qsoData.points, ...qsoData.myPositions];
    if (all.length === 0) return null;
    return L.latLngBounds(all.map(p => [p.lat, p.lon]));
  }, [qsoData]);

  return (
    <MapContainer
      key="qso-world-map"
      center={[20, 0]}
      zoom={2}
      className="w-full h-full"
      zoomControl={true}
      scrollWheelZoom={true}
      touchZoom={true}
      doubleClickZoom={true}
      dragging={true}
      minZoom={2}
      maxZoom={10}
      zoomSnap={1}
      zoomDelta={1}
      zoomAnimation={false}
      worldCopyJump={true}
      style={{ height: '100%', width: '100%', background: '#0a1929' }}
    >
      <MapResize />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
      {qsoData.lines.map((line, i) => (
        <Polyline key={`line-${i}`} positions={[[line.from.lat, line.from.lon], [line.to.lat, line.to.lon]]} pathOptions={{ color: '#00e5ff', weight: 1, opacity: 0.3 }} />
      ))}
      {qsoData.myPositions.map((p, i) => (
        <CircleMarker key={`my-${i}`} center={[p.lat, p.lon]} radius={5} pathOptions={{ color: '#8cff00', fillColor: '#8cff00', fillOpacity: 0.8 }} />
      ))}
      {qsoData.points.map((p, i) => (
        <CircleMarker key={`qso-${i}`} center={[p.lat, p.lon]} radius={4} pathOptions={{ color: '#00e5ff', fillColor: '#00e5ff', fillOpacity: 0.7 }}>
          <Popup>
            <div className="text-xs">
              <div className="font-bold">{p.callsign}</div>
              <div>{p.band} · {p.mode}</div>
              {p.date && <div className="text-gray-500">{p.date}</div>}
            </div>
          </Popup>
        </CircleMarker>
      ))}
      <AutoFit bounds={bounds} />
    </MapContainer>
  );
}