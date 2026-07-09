import React, { useState, useEffect, useRef } from "react";
import { X, Download, Loader2, CheckCircle2, MapPin, HardDrive, Layers } from "lucide-react";
import {
  calculateTiles,
  downloadTiles,
  saveArea,
} from "@/lib/offlineMapStore";

const ZOOM_OPTIONS = [
  { value: 8, label: "8 – Übersicht" },
  { value: 10, label: "10 – Region" },
  { value: 12, label: "12 – Stadt" },
  { value: 14, label: "14 – Strassen" },
  { value: 16, label: "16 – Detail" },
];

const BASE_LAYER_LABELS = {
  osm: "OpenStreetMap",
  satellite: "Satellit",
  swisstopo: "SwissTopo",
};

export default function OfflineAreaDialog({
  mapRef,
  baseLayer,
  baseTileUrl,
  tileKeyPrefix,
  referenceData,
  onClose,
  onDownloaded,
}) {
  const [bounds, setBounds] = useState(null);
  const [selectedZooms, setSelectedZooms] = useState([10, 12, 14]);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    if (mapRef.current) {
      const b = mapRef.current.getBounds();
      setBounds({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    }
  }, [mapRef]);

  const tiles = bounds ? calculateTiles(bounds, selectedZooms) : [];
  const tileCount = tiles.length;
  const estSizeMB = (tileCount * 0.02).toFixed(1); // ~20KB avg per tile

  const toggleZoom = (z) => {
    setSelectedZooms((prev) =>
      prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z].sort((a, b) => a - b)
    );
  };

  const handleDownload = async () => {
    if (!bounds || selectedZooms.length === 0) return;
    setDownloading(true);
    setProgress({ downloaded: 0, failed: 0, total: tileCount, sizeBytes: 0 });

    // Filter reference data by bounds
    const filteredRefs = {};
    for (const [type, data] of Object.entries(referenceData || {})) {
      filteredRefs[type] = (data || []).filter(
        (r) =>
          r.lat >= bounds.south &&
          r.lat <= bounds.north &&
          r.lng >= bounds.west &&
          r.lng <= bounds.east
      );
    }

    const result = await downloadTiles(tiles, tileKeyPrefix, baseTileUrl, (p) => {
      if (mountedRef.current) setProgress(p);
    });

    if (!mountedRef.current) return;

    // Save area metadata
    const areaName = `Karte ${new Date().toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    await saveArea({
      id: `area_${Date.now()}`,
      name: areaName,
      bounds,
      zoomLevels: selectedZooms,
      baseLayer,
      tileKeyPrefix,
      tileCount: result.downloaded,
      sizeBytes: result.sizeBytes || tileCount * 20000,
      downloadDate: new Date().toISOString(),
      references: filteredRefs,
    });

    if (mountedRef.current) {
      setDownloading(false);
      setDone(true);
      setTimeout(() => {
        if (mountedRef.current) onDownloaded();
      }, 1500);
    }
  };

  const refCount = Object.values(referenceData || {}).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-3 pb-20">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-6rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-gray-900">Offline-Karte</h2>
          </div>
          {!downloading && (
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {done ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-900">Download abgeschlossen!</p>
              <p className="text-xs text-gray-500 mt-1">
                Die Karte ist nun offline verfügbar. Beim Verlust der Verbindung wird automatisch
                auf die gespeicherte Karte gewechselt.
              </p>
            </div>
          ) : downloading ? (
            <div className="py-6">
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-gray-700 animate-spin" />
              </div>
              <p className="text-sm text-center text-gray-600 mb-3">
                Lade {progress?.downloaded || 0} / {progress?.total || 0} Kacheln...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gray-900 h-full transition-all"
                  style={{
                    width: `${((progress?.downloaded || 0) / (progress?.total || 1)) * 100}%`,
                  }}
                />
              </div>
              {progress?.failed > 0 && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  {progress.failed} Kachel(n) fehlgeschlagen
                </p>
              )}
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Bitte Dialog geöffnet lassen bis der Download abgeschlossen ist.
              </p>
            </div>
          ) : (
            <>
              {/* Area info */}
              {bounds && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Gebiet (aktuelle Kartenansicht)
                  </label>
                  <p className="text-xs text-gray-600 mt-1 font-mono">
                    N: {bounds.north.toFixed(4)}° S: {bounds.south.toFixed(4)}°
                    <br />
                    W: {bounds.west.toFixed(4)}° O: {bounds.east.toFixed(4)}°
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-gray-400">
                    <Layers className="w-3 h-3" />
                    Karte: {BASE_LAYER_LABELS[baseLayer] || baseLayer}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Tipp: Karte vor dem Download verschieben/zoomen, um das Gebiet anzupassen.
                  </p>
                </div>
              )}

              {/* Zoom levels */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Zoom-Stufen</label>
                <p className="text-[10px] text-gray-400 mb-2">
                  Mehr Stufen = mehr Details, aber grösserer Download
                </p>
                <div className="space-y-1">
                  {ZOOM_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={selectedZooms.includes(opt.value)}
                        onChange={() => toggleZoom(opt.value)}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Estimate */}
              {tileCount > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{tileCount} Kacheln</p>
                      <p className="text-xs text-gray-500">~{estSizeMB} MB</p>
                    </div>
                  </div>
                </div>
              )}

              {tileCount > 3000 && (
                <p className="text-xs text-amber-600">
                  ⚠ Sehr viele Kacheln – der Download kann mehrere Minuten dauern.
                </p>
              )}

              {/* Reference points info */}
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-700">
                  ✓ {refCount} Referenzpunkte im Gebiet werden automatisch mitgespeichert
                </p>
              </div>

              <button
                onClick={handleDownload}
                disabled={tileCount === 0 || selectedZooms.length === 0}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download starten
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}