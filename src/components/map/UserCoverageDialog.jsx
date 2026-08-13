import React, { useState, useEffect } from "react";
import { X, MapPin, Car, Home, Smartphone, Radio, Loader2, Satellite, Crosshair } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DEVICE_TYPES = [
  { value: "mobil", label: "Mobil", icon: Car, defaultPower: 50, defaultHeight: 1.7 },
  { value: "fix", label: "Fix", icon: Home, defaultPower: 100, defaultHeight: 10 },
  { value: "portabel", label: "Portabel", icon: Smartphone, defaultPower: 5, defaultHeight: 1.5 },
];

const BANDS = [
  { value: "2m", label: "2m (144-148 MHz)", freq: 145.0 },
  { value: "70cm", label: "70cm (430-450 MHz)", freq: 435.0 },
  { value: "6m", label: "6m (50-54 MHz)", freq: 50.5 },
  { value: "10m", label: "10m (28-29.7 MHz)", freq: 28.5 },
  { value: "23cm", label: "23cm (1240-1300 MHz)", freq: 1270.0 },
  { value: "1.25m", label: "1.25m (216-225 MHz)", freq: 220.0 },
  { value: "33cm", label: "33cm (902-928 MHz)", freq: 915.0 },
];

const MODES = ["FM", "DMR", "D-STAR", "Fusion", "SSB", "CW"];

export default function UserCoverageDialog({ onClose, onCoverageResult, mapCenter, onMapClickMode, externalPosition }) {
  const [deviceType, setDeviceType] = useState(() => localStorage.getItem("hb9om_cov_device") || "mobil");
  const [powerWatts, setPowerWatts] = useState(() => {
    const saved = localStorage.getItem("hb9om_cov_power");
    if (saved) return parseFloat(saved);
    const dev = DEVICE_TYPES.find(d => d.value === (localStorage.getItem("hb9om_cov_device") || "mobil"));
    return dev?.defaultPower || 50;
  });
  const [band, setBand] = useState(() => localStorage.getItem("hb9om_cov_band") || "2m");
  const [frequency, setFrequency] = useState(() => {
    const saved = localStorage.getItem("hb9om_cov_freq");
    if (saved) return parseFloat(saved);
    const b = BANDS.find(b => b.value === (localStorage.getItem("hb9om_cov_band") || "2m"));
    return b?.freq || 145.0;
  });
  const [mode, setMode] = useState(() => localStorage.getItem("hb9om_cov_mode") || "FM");
  const [antennaHeight, setAntennaHeight] = useState(() => {
    const saved = localStorage.getItem("hb9om_cov_height");
    if (saved) return parseFloat(saved);
    const dev = DEVICE_TYPES.find(d => d.value === (localStorage.getItem("hb9om_cov_device") || "mobil"));
    return dev?.defaultHeight || 1.7;
  });
  const [position, setPosition] = useState(null);
  const [qthLocator, setQthLocator] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mapCenter && !position) setPosition(mapCenter);
  }, [mapCenter]);

  // Sync external position (from map click) into dialog
  useEffect(() => {
    if (externalPosition) setPosition(externalPosition);
  }, [externalPosition]);

  const handleDeviceChange = (val) => {
    setDeviceType(val);
    const dev = DEVICE_TYPES.find(d => d.value === val);
    if (dev) { setPowerWatts(dev.defaultPower); setAntennaHeight(dev.defaultHeight); }
    localStorage.setItem("hb9om_cov_device", val);
  };

  const handleGps = () => {
    if (!navigator.geolocation) { setError("GPS nicht verfügbar"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPosition([pos.coords.latitude, pos.coords.longitude]); setError(null); },
      () => setError("GPS-Position konnte nicht ermittelt werden"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleQthLookup = () => {
    if (!qthLocator || qthLocator.length < 4) { setError("QTH-Locator mindestens 4 Stellen (z.B. JN47)"); return; }
    const loc = qthLocator.toUpperCase().trim();
    const A = 'A'.charCodeAt(0);
    const lng = (loc.charCodeAt(0) - A) * 20 - 180;
    const lat = (loc.charCodeAt(1) - A) * 10 - 90;
    const lng2 = (loc.charCodeAt(2) - '0'.charCodeAt(0)) * 2;
    const lat2 = (loc.charCodeAt(3) - '0'.charCodeAt(0));
    let resultLng = lng + lng2 + 1;
    let resultLat = lat + lat2 + 0.5;
    if (loc.length >= 6) {
      resultLng += (loc.charCodeAt(4) - A) * (2 / 24) - (1 / 24);
      resultLat += (loc.charCodeAt(5) - A) * (1 / 24) - (1 / 48);
    }
    setPosition([resultLat, resultLng]);
    setError(null);
  };

  const handleCalculate = async () => {
    if (!position) { setError("Bitte Position setzen (GPS, QTH-Locator oder Karte)"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("calculateUserCoverage", {
        lat: position[0], lng: position[1],
        device_type: deviceType, power_watts: powerWatts,
        frequency_mhz: frequency, mode, antenna_height_m: antennaHeight, radials: 36,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      onCoverageResult({ ...data, _position: position, _device: deviceType });
      localStorage.setItem("hb9om_cov_power", String(powerWatts));
      localStorage.setItem("hb9om_cov_band", band);
      localStorage.setItem("hb9om_cov_freq", String(frequency));
      localStorage.setItem("hb9om_cov_mode", mode);
      localStorage.setItem("hb9om_cov_height", String(antennaHeight));
      onClose();
    } catch (e) {
      setError(e.message || "Fehler bei der Berechnung");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-5 py-3 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-orange-500" /> Meine Abdeckung berechnen
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Position</label>
            <div className="flex gap-2">
              <button onClick={handleGps} className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5" /> GPS
              </button>
              <button onClick={onMapClickMode} className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Karte
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" value={qthLocator} onChange={e => setQthLocator(e.target.value)}
                placeholder="QTH-Locator (z.B. JN47CK)"
                className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 font-mono" />
              <button onClick={handleQthLookup} className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200">OK</button>
            </div>
            {position && <p className="text-[10px] text-gray-500 mt-1">{position[0].toFixed(5)}, {position[1].toFixed(5)}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Geräteart</label>
            <div className="grid grid-cols-3 gap-2">
              {DEVICE_TYPES.map(d => {
                const Icon = d.icon;
                return (
                  <button key={d.value} onClick={() => handleDeviceChange(d.value)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-colors ${deviceType === d.value ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300"}`}>
                    <Icon className="w-4 h-4" /> {d.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">
              Sendeleistung: <span className="text-orange-600 font-bold">{powerWatts} W</span>
            </label>
            <input type="range" min="1" max="1000" step="1" value={powerWatts} onChange={e => setPowerWatts(parseFloat(e.target.value))} className="w-full accent-orange-500" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>1 W</span><span>100 W</span><span>1000 W</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Band</label>
              <select value={band} onChange={e => { setBand(e.target.value); const b = BANDS.find(b => b.value === e.target.value); if (b) setFrequency(b.freq); }}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                {BANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Frequenz (MHz)</label>
              <input type="number" step="0.001" value={frequency} onChange={e => setFrequency(parseFloat(e.target.value) || 145.0)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Modus</label>
              <select value={mode} onChange={e => setMode(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                {MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Antennenhöhe (m)</label>
              <input type="number" step="0.1" value={antennaHeight} onChange={e => setAntennaHeight(parseFloat(e.target.value) || 1.5)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg" />
            </div>
          </div>
          {error && <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-300">{error}</div>}
          <button onClick={handleCalculate} disabled={loading || !position}
            className="w-full px-4 py-3 text-sm font-bold text-white bg-orange-500 rounded-xl hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Satellite className="w-4 h-4" />}
            {loading ? "Berechnet (SRTM-Daten)..." : "Abdeckung berechnen"}
          </button>
          <p className="text-[10px] text-gray-400 text-center">Berechnung mit SRTM 30m Höhendaten, LOS & Link-Budget. Dauer ca. 5-15 Sekunden.</p>
        </div>
      </div>
    </div>
  );
}