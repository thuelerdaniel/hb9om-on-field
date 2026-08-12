import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from "react-leaflet";
import { base44 } from "@/api/base44Client";
import { Mountain, TreePine, Flower, Loader2 } from "lucide-react";

// Layer definitions — color + icon per reference type
const LAYERS = [
  { key: "sota", label: "SOTA", color: "#ef4444", icon: Mountain },
  { key: "pota", label: "POTA", color: "#22c55e", icon: TreePine },
  { key: "wwff", label: "WWFF", color: "#a855f7", icon: Flower },
];

const LAYER_ENTITY = { sota: "SotaPoint", pota: "PotaPoint", wwff: "WwffPoint" };

export default function Home() {
  const [data, setData] = useState({ sota: [], pota: [], wwff: [] });
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState({ sota: true, pota: true, wwff: true });

  // Load all three reference types from the database
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        LAYERS.map(async (l) => {
          try {
            // filter({}, undefined, limit) — no sort, much faster than list() on large datasets
            const items = await base44.entities[LAYER_ENTITY[l.key]].filter({}, undefined, 5000);
            return [l.key, items.filter(r => r.lat != null && r.lng != null)];
          } catch {
            return [l.key, []];
          }
        })
      );
      if (cancelled) return;
      const next = { sota: [], pota: [], wwff: [] };
      for (const [k, v] of results) next[k] = v;
      setData(next);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => ({
    sota: data.sota.length,
    pota: data.pota.length,
    wwff: data.wwff.length,
  }), [data]);

  return (
    <div className="relative w-full h-screen">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between">
        <h1 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
          <span className="text-base">📻</span> HB9OM On Field
        </h1>
        <div className="flex items-center gap-1">
          {LAYERS.map(l => {
            const Icon = l.icon;
            const isActive = visible[l.key];
            return (
              <button
                key={l.key}
                onClick={() => setVisible(v => ({ ...v, [l.key]: !v[l.key] }))}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100"
                    : "bg-transparent text-gray-400 dark:text-slate-600"
                }`}
                title={`${l.label} (${counts[l.key]})`}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? l.color : undefined }} />
                <span>{l.label}</span>
                <span className="text-[10px] text-gray-400 ml-0.5">{counts[l.key]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-white/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
            <Loader2 className="w-5 h-5 animate-spin" /> Daten werden geladen…
          </div>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={[46.8, 8.2]}
        zoom={8}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        <ZoomControl position="bottomright" />

        {LAYERS.map(l => {
          if (!visible[l.key]) return null;
          return data[l.key].map((r, i) => (
            <CircleMarker
              key={`${l.key}-${r.id || i}`}
              center={[r.lat, r.lng]}
              radius={5}
              pathOptions={{
                color: "#ffffff",
                weight: 1.5,
                fillColor: l.color,
                fillOpacity: 0.8,
              }}
            >
              <Popup>
                <div className="min-w-[160px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: l.color }}>
                      {l.label}
                    </span>
                    <span className="text-xs font-mono font-semibold">{r.code}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">{r.name}</div>
                  {r.altitude_m && <div className="text-xs text-gray-500 mt-0.5">{r.altitude_m} m ü.M.</div>}
                  {r.points && <div className="text-xs text-gray-500">{r.points} Punkte</div>}
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                      Details →
                    </a>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ));
        })}
      </MapContainer>
    </div>
  );
}