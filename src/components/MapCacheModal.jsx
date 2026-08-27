import React, { useState, useMemo, useRef } from "react";
import { X, Download, Loader2, CheckCircle, AlertCircle, HardDrive } from "lucide-react";

// MapCacheModal — Offline-Karten-Cache Download über Browser Cache API.
// Berechnet Tile-Range aus GPS-Position + Radius + Zoom und lädt OSM Tiles.
// Props: gpsPos ([lat, lng]), onClose

const QUICK_RADII = [1, 2, 5, 10, 20, 50, 100];
const ZOOM_LEVELS = [11, 12, 13, 14, 15, 16];

// Speicherschätzung Tabelle (MB, < 1024 = MB, >= 1024 = GB)
const STORAGE_ESTIMATES = {
  1:   { 11: 0.1, 12: 0.2, 13: 0.5, 14: 1.5, 15: 5,    16: 18 },
  2:   { 11: 0.3, 12: 0.6, 13: 1.5, 14: 5,   15: 18,  16: 70 },
  5:   { 11: 0.5, 12: 1.5, 13: 5,   14: 18,  15: 70,  16: 280 },
  10:  { 11: 1.5, 12: 5,   13: 18,  14: 70,  15: 280, 16: 1100 },
  20:  { 11: 5,   12: 18,  13: 70,  14: 280, 15: 1100,16: 4400 },
  50:  { 11: 18,  12: 70,  13: 280, 14: 1100,15: 4400,16: 17500 },
  100: { 11: 70,  12: 280, 13: 1100,14: 4400,15: 17500, 16: 70000 },
};

function formatSize(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb % 1 === 0 ? mb : mb.toFixed(1)} MB`;
  return `${Math.round(mb * 10) / 10} MB`;
}

function lonToTileX(lon, z) { return Math.floor((lon + 180) / 360 * Math.pow(2, z)); }
function latToTileY(lat, z) {
  const rad = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z));
}

function calcTileRange(lat, lng, radiusKm, zoom) {
  const latOff = radiusKm / 111.32;
  const lngOff = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  const xMin = lonToTileX(lng - lngOff, zoom);
  const xMax = lonToTileX(lng + lngOff, zoom);
  const yMin = latToTileY(lat + latOff, zoom); // north = lower y
  const yMax = latToTileY(lat - latOff, zoom); // south = higher y
  const count = (xMax - xMin + 1) * (yMax - yMin + 1);
  return { xMin, xMax, yMin, yMax, count };
}

export default function MapCacheModal({ gpsPos, onClose }) {
  const [radius, setRadius] = useState(10);
  const [zoom, setZoom] = useState(14);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, failed: 0, total: 0 });
  const [finished, setFinished] = useState(false);
  const cancelRef = useRef(false);

  const lat = gpsPos?.[0] ?? 46.8;
  const lng = gpsPos?.[1] ?? 8.2;

  const tileRange = useMemo(() => calcTileRange(lat, lng, radius, zoom), [lat, lng, radius, zoom]);
  const estSize = useMemo(() => {
    const r = STORAGE_ESTIMATES[radius] || STORAGE_ESTIMATES[10];
    return r[zoom] || 0;
  }, [radius, zoom]);

  const handleDownload = async () => {
    if (!('caches' in window)) {
      alert('Browser Cache API wird nicht unterstützt.');
      return;
    }
    setDownloading(true);
    setFinished(false);
    cancelRef.current = false;
    setProgress({ done: 0, failed: 0, total: tileRange.count });

    try {
      const cache = await caches.open('hb9om-map-tiles');
      let done = 0, failed = 0;
      const batchSize = 4;
      const tiles = [];
      for (let x = tileRange.xMin; x <= tileRange.xMax; x++) {
        for (let y = tileRange.yMin; y <= tileRange.yMax; y++) {
          tiles.push(`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
        }
      }
      for (let i = 0; i < tiles.length; i += batchSize) {
        if (cancelRef.current) break;
        const batch = tiles.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(url => cache.add(url)));
        for (const r of results) {
          if (r.status === 'fulfilled') done++;
          else failed++;
        }
        setProgress({ done, failed, total: tiles.length });
      }
      setFinished(true);
    } catch (e) {
      console.error('[MapCache] Fehler:', e);
    } finally {
      setDownloading(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Download className="w-4 h-4 text-blue-500" /> Karten-Cache Download
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* GPS Position */}
          <div className="text-xs text-muted-foreground">
            Position: {lat.toFixed(4)}°, {lng.toFixed(4)}°
          </div>

          {/* Radius */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex justify-between">
              <span>Radius</span>
              <span className="text-blue-500 font-bold text-sm">{radius} km</span>
            </label>
            <input
              type="range" min={1} max={100} value={radius}
              onChange={e => setRadius(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {QUICK_RADII.map(r => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`px-2 py-0.5 text-[10px] rounded-md border transition-colors ${
                    radius === r
                      ? "bg-blue-500 text-white border-blue-600"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>

          {/* Zoom Level */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 block">Zoom-Level</label>
            <div className="flex flex-wrap gap-1">
              {ZOOM_LEVELS.map(z => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                    zoom === z
                      ? "bg-blue-500 text-white border-blue-600"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          {/* Estimate */}
          <div className="bg-muted rounded-lg p-3 border border-border space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tiles:</span>
              <span className="font-mono font-bold text-foreground">{tileRange.count.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Geschätzt:
              </span>
              <span className="font-mono font-bold text-foreground">{formatSize(estSize)}</span>
            </div>
          </div>

          {/* Storage Estimate Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[9px] text-center border border-border rounded-lg overflow-hidden">
              <thead className="bg-muted">
                <tr className="text-muted-foreground">
                  <th className="px-1 py-1 text-left">km\Z</th>
                  {ZOOM_LEVELS.map(z => <th key={z} className="px-1 py-1">{z}</th>)}
                </tr>
              </thead>
              <tbody>
                {QUICK_RADII.map(r => (
                  <tr key={r} className={`border-t border-border ${r === radius ? "bg-blue-500/10" : ""}`}>
                    <td className="px-1 py-1 text-left font-bold text-muted-foreground">{r}</td>
                    {ZOOM_LEVELS.map(z => (
                      <td
                        key={z}
                        className={`px-1 py-1 font-mono ${r === radius && z === zoom ? "text-blue-500 font-bold" : "text-foreground"}`}
                      >
                        {formatSize(STORAGE_ESTIMATES[r]?.[z] || 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Progress */}
          {downloading && (
            <div className="space-y-2">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{progress.done} / {progress.total} Tiles ({pct}%)</span>
                {progress.failed > 0 && <span className="text-red-500">{progress.failed} fehlgeschlagen</span>}
              </div>
            </div>
          )}

          {/* Finished */}
          {finished && !downloading && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-600">
              <CheckCircle className="w-4 h-4" />
              Download abgeschlossen: {progress.done} Tiles gecached.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            {downloading ? (
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600"
              >
                Abbrechen
              </button>
            ) : (
              <button
                onClick={handleDownload}
                disabled={tileRange.count > 50000}
                className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                {tileRange.count > 50000 ? "Zu viele Tiles (>50k)" : "Download starten"}
              </button>
            )}
          </div>

          {tileRange.count > 50000 && (
            <div className="flex items-center gap-2 text-[10px] text-orange-500">
              <AlertCircle className="w-3 h-3" />
              Reduziere Radius oder Zoom-Level — zu viele Tiles für Browser-Cache.
            </div>
          )}

          {!('caches' in window) && (
            <div className="flex items-center gap-2 text-[10px] text-red-500">
              <AlertCircle className="w-3 h-3" />
              Browser Cache API wird nicht unterstützt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}