import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { X, MapPin, Car, Home, Radio, Loader2, Satellite, Crosshair, Sun, Sunrise, Moon, Save, Trash2, RefreshCw, History, ChevronDown, ChevronUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const DEVICE_TYPES = [
  { value: "mobil", label: "Mobil", icon: Car, defaultPower: 50, defaultHeight: 1.7 },
  { value: "fix", label: "Fix", icon: Home, defaultPower: 100, defaultHeight: 10 },
  { value: "portabel", label: "Portabel", icon: Radio, defaultPower: 5, defaultHeight: 1.5 },
];

const KW_BANDS = [
  { value: "160m", label: "160m (1.8 MHz)", freq: 1.85 },
  { value: "80m", label: "80m (3.5 MHz)", freq: 3.65 },
  { value: "60m", label: "60m (5.0 MHz)", freq: 5.3 },
  { value: "40m", label: "40m (7.0 MHz)", freq: 7.1 },
  { value: "30m", label: "30m (10.1 MHz)", freq: 10.1 },
  { value: "20m", label: "20m (14.0 MHz)", freq: 14.1 },
  { value: "17m", label: "17m (18.1 MHz)", freq: 18.1 },
  { value: "15m", label: "15m (21.0 MHz)", freq: 21.2 },
  { value: "12m", label: "12m (24.9 MHz)", freq: 24.9 },
  { value: "10m", label: "10m (28 MHz)", freq: 28.5 },
];

const VHF_BANDS = [
  { value: "6m", label: "6m (50 MHz)", freq: 50.5 },
  { value: "2m", label: "2m (144-148 MHz)", freq: 145.0 },
  { value: "1.25m", label: "1.25m (216-225 MHz)", freq: 220.0 },
  { value: "70cm", label: "70cm (430-450 MHz)", freq: 435.0 },
  { value: "33cm", label: "33cm (902-928 MHz)", freq: 915.0 },
  { value: "23cm", label: "23cm (1240-1300 MHz)", freq: 1270.0 },
];

const ALL_BANDS = [...KW_BANDS, ...VHF_BANDS];

const MODES = ["FM", "DMR", "D-STAR", "Fusion", "SSB", "CW", "AM", "FT8"];
const HF_MODES = ["SSB", "CW", "AM", "FT8"];

function isHFBand(band) {
  return KW_BANDS.some(b => b.value === band);
}

function getSolarElevation(lat, lng) {
  const now = new Date();
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const declination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365) * rad;
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const localHours = utcHours + lng / 15;
  const hourAngle = (localHours - 12) * 15 * rad;
  const latRad = lat * rad;
  const elev = Math.asin(Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle));
  return elev * 180 / Math.PI;
}

// --- Coverage history (localStorage) ---
const HISTORY_KEY = "hb9om_coverage_history";
const MAX_HISTORY = 20;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))); } catch {}
}

export default function UserCoverageDialog({ onClose, onCoverageResult, mapCenter, onMapClickMode, externalPosition }) {
  const { toast } = useToast();
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
    const b = ALL_BANDS.find(b => b.value === (localStorage.getItem("hb9om_cov_band") || "2m"));
    return b?.freq || 145.0;
  });
  const [mode, setMode] = useState(() => localStorage.getItem("hb9om_cov_mode") || "FM");
  const [antennaHeight, setAntennaHeight] = useState(() => {
    const saved = localStorage.getItem("hb9om_cov_height");
    if (saved) return parseFloat(saved);
    const dev = DEVICE_TYPES.find(d => d.value === (localStorage.getItem("hb9om_cov_device") || "mobil"));
    return dev?.defaultHeight || 1.7;
  });
  const [nvisMode, setNvisMode] = useState(() => localStorage.getItem("hb9om_cov_nvis") === "true");
  const [solarActivity, setSolarActivity] = useState(() => {
    const saved = localStorage.getItem("hb9om_cov_solar");
    return saved ? parseFloat(saved) : 1.0;
  });
  const [position, setPosition] = useState(null);
  const [qthLocator, setQthLocator] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // --- Dragging ---
  const panelRef = useRef(null);
  const dragState = useRef({ dragging: false, offsetX: 0, offsetY: 0 });

  const handleHeaderPointerDown = useCallback((e) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragState.current = {
      dragging: true,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    panel.style.position = "fixed";
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.margin = "0";
    panel.style.transform = "none";
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState.current.dragging) return;
      const panel = panelRef.current;
      if (!panel) return;
      const newLeft = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, e.clientX - dragState.current.offsetX));
      const newTop = Math.max(8, Math.min(window.innerHeight - 40, e.clientY - dragState.current.offsetY));
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    };
    const onUp = () => { dragState.current.dragging = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const isHF = isHFBand(band);
  const nvisAvailable = isHF && frequency >= 3 && frequency <= 10;
  const availableModes = isHF ? HF_MODES : MODES;

  useEffect(() => {
    if (mapCenter && !position) setPosition(mapCenter);
  }, [mapCenter]);

  useEffect(() => {
    if (externalPosition) setPosition(externalPosition);
  }, [externalPosition]);

  const handleBandChange = (newBand) => {
    setBand(newBand);
    const b = ALL_BANDS.find(b => b.value === newBand);
    if (b) setFrequency(b.freq);
    const newIsHF = isHFBand(newBand);
    if (newIsHF) {
      if (deviceType === "portabel" && powerWatts > 10) setPowerWatts(10);
      else if ((deviceType === "mobil" || deviceType === "fix") && powerWatts < 50) setPowerWatts(100);
      if (mode === "FM") setMode("SSB");
    } else {
      if (deviceType === "portabel" && powerWatts > 50) setPowerWatts(5);
      else if (deviceType === "mobil" && powerWatts > 100) setPowerWatts(50);
      if (mode === "SSB") setMode("FM");
    }
  };

  const handleDeviceChange = (val) => {
    setDeviceType(val);
    const dev = DEVICE_TYPES.find(d => d.value === val);
    if (dev) {
      if (isHF) {
        setPowerWatts(dev.value === "portabel" ? 10 : 100);
      } else {
        setPowerWatts(dev.defaultPower);
      }
      // Only set default height if user hasn't manually changed it OR NVIS is active
      if (nvisMode) {
        setAntennaHeight(2);
      } else {
        setAntennaHeight(dev.defaultHeight);
      }
    }
    localStorage.setItem("hb9om_cov_device", val);
  };

  const handleNvisToggle = (val) => {
    setNvisMode(val);
    if (val) {
      setAntennaHeight(2);
    } else {
      const dev = DEVICE_TYPES.find(d => d.value === deviceType);
      if (dev) setAntennaHeight(dev.defaultHeight);
    }
    localStorage.setItem("hb9om_cov_nvis", String(val));
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

  const ionoInfo = useMemo(() => {
    if (!isHF || !position) return null;
    const lat = position[0], lng = position[1];
    const now = new Date();
    const rad = Math.PI / 180;
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const declination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365) * rad;
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    const localHours = utcHours + lng / 15;
    const hourAngle = (localHours - 12) * 15 * rad;
    const latRad = lat * rad;
    const elev = Math.asin(Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle));
    const elevDeg = elev * 180 / Math.PI;
    const sunFactor = Math.max(0, Math.sin(elev * Math.PI / 180));
    const foF2 = (1.5 + 4.5 * sunFactor) * solarActivity;
    const muf = foF2 * 3.5;
    const luf = sunFactor > 0.1 ? 5 * solarActivity : 2 * solarActivity;
    let timeOfDay = "Tag";
    if (elevDeg < -6) timeOfDay = "Nacht";
    else if (elevDeg < 6) timeOfDay = "Dämmerung";
    const bandClosed = frequency > muf || frequency < luf;
    return { muf: muf.toFixed(1), luf: luf.toFixed(1), foF2: foF2.toFixed(1), timeOfDay, bandClosed, elevDeg: elevDeg.toFixed(1) };
  }, [isHF, position, solarActivity, frequency]);

  // --- Save result to history ---
  const saveToHistory = useCallback((result) => {
    const item = {
      id: `cov-${Date.now()}`,
      timestamp: new Date().toISOString(),
      position: result._position,
      device: result._device,
      band,
      frequency,
      mode,
      power: powerWatts,
      height: antennaHeight,
      coverage: {
        avg_range_km: result.avg_range_km,
        max_range_km: result.max_range_km,
        min_range_km: result.min_range_km,
        max_direction: result.max_direction,
        min_direction: result.min_direction,
        is_hf: result.is_hf,
        polygon: result.polygon,
        mode_polygons: result.mode_polygons,
        skip_zone: result.skip_zone,
        elevation_m: result.elevation_m,
        los_km: result.los_km,
        diffraction_km: result.diffraction_km,
        troposcatter_km: result.troposcatter_km,
        terrain_blocked_count: result.terrain_blocked_count,
        muf_mhz: result.muf_mhz,
        luf_mhz: result.luf_mhz,
        time_of_day: result.time_of_day,
      },
    };
    const newHistory = [item, ...history];
    saveHistory(newHistory);
    setHistory(newHistory);
    return item;
  }, [history, band, frequency, mode, powerWatts, antennaHeight]);

  const handleCalculate = async () => {
    if (!position) { setError("Bitte Position setzen (GPS, QTH-Locator oder Karte)"); return; }
    setLoading(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke("calculateUserCoverage", {
        lat: position[0], lng: position[1],
        device_type: deviceType, power_watts: powerWatts,
        frequency_mhz: frequency, mode, antenna_height_m: antennaHeight, radials: 36,
        nvis_mode: nvisMode, solar_activity: solarActivity,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      const result = { ...data, _position: position, _device: deviceType };
      setLastResult(result);
      onCoverageResult(result);
      localStorage.setItem("hb9om_cov_power", String(powerWatts));
      localStorage.setItem("hb9om_cov_band", band);
      localStorage.setItem("hb9om_cov_freq", String(frequency));
      localStorage.setItem("hb9om_cov_mode", mode);
      localStorage.setItem("hb9om_cov_height", String(antennaHeight));
      localStorage.setItem("hb9om_cov_solar", String(solarActivity));
      // Save to history and link the history id to the current result
      const histItem = saveToHistory(result);
      result._historyId = histItem.id;
      setLastResult(result);
      toast({ title: "Abdeckung berechnet", description: `${result.avg_range_km || 0} km Ø Reichweite` });
    } catch (e) {
      setError(e.message || "Fehler bei der Berechnung");
    } finally {
      setLoading(false);
    }
  };

  // --- Delete a history item ---
  const handleDeleteHistory = (id) => {
    const newHistory = history.filter(h => h.id !== id);
    saveHistory(newHistory);
    setHistory(newHistory);
    // If the deleted item is the one currently shown on the map, clear it
    if (lastResult?._historyId === id) {
      setLastResult(null);
      onCoverageResult(null);
    }
    toast({ title: "Berechnung gelöscht" });
  };

  // --- Load a history item as current result ---
  const handleLoadHistory = (item) => {
    const loaded = { ...item.coverage, _position: item.position, _device: item.device, _historyId: item.id };
    setLastResult(loaded);
    onCoverageResult(loaded);
    setPosition(item.position);
    setDeviceType(item.device);
    setBand(item.band);
    setFrequency(item.frequency);
    setMode(item.mode);
    setPowerWatts(item.power);
    setAntennaHeight(item.height);
    setShowHistory(false);
  };

  // --- Clear all history ---
  const handleClearHistory = () => {
    saveHistory([]);
    setHistory([]);
    // Also remove coverage from map if the current result came from history
    if (lastResult?._historyId) {
      setLastResult(null);
      onCoverageResult(null);
    }
    toast({ title: "Verlauf geleert" });
  };

  // --- Recalculate with history retention prompt ---
  const handleRecalculate = () => {
    // Ask how many previous calculations to keep
    const keepStr = window.prompt(
      `Wie viele der ${history.length} vorgängigen Berechnungen behalten?\n\n(0 = alle löschen, ${history.length} = alle behalten, oder eine Zahl dazwischen)`,
      String(Math.min(history.length, 5))
    );
    if (keepStr === null) return; // cancelled
    const keep = parseInt(keepStr);
    if (isNaN(keep) || keep < 0 || keep > history.length) {
      toast({ title: "Ungültige Eingabe", variant: "destructive" });
      return;
    }
    // Keep only the last N items (most recent)
    const kept = history.slice(0, keep);
    saveHistory(kept);
    setHistory(kept);
    // Now run calculation
    handleCalculate();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={panelRef}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header — drag handle */}
        <div
          onPointerDown={handleHeaderPointerDown}
          style={{ touchAction: "none" }}
          className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-5 py-3 flex items-center justify-between rounded-t-2xl z-10 cursor-grab active:cursor-grabbing select-none"
          title="Zum Verschieben ziehen"
        >
          <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-orange-500" /> Meine Abdeckung berechnen
            {isHF && <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded font-mono">KW</span>}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Position */}
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

          {/* KW: Tageszeit & MUF Anzeige */}
          {isHF && ionoInfo && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5" /> {ionoInfo.timeOfDay}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-mono"> Sonnenhöhe: {ionoInfo.elevDeg}°</span>
              </div>
              <div className="flex justify-between text-[11px] text-blue-600 dark:text-blue-400">
                <span>MUF: <strong>{ionoInfo.muf} MHz</strong></span>
                <span>LUF: <strong>{ionoInfo.luf} MHz</strong></span>
                <span>foF2: <strong>{ionoInfo.foF2} MHz</strong></span>
              </div>
              {ionoInfo.bandClosed && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-1 border-t border-blue-200 dark:border-blue-800">
                  ⚠ Band wahrscheinlich geschlossen ({frequency > parseFloat(ionoInfo.muf) ? "f > MUF" : "f < LUF"})
                </div>
              )}
            </div>
          )}

          {/* Geräteart */}
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

          {/* Sendeleistung */}
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">
              Sendeleistung: <span className="text-orange-600 font-bold">{powerWatts} W</span>
            </label>
            <input type="range" min="1" max="1000" step="1" value={powerWatts} onChange={e => setPowerWatts(parseFloat(e.target.value))} className="w-full accent-orange-500" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>1 W</span><span>100 W</span><span>1000 W</span></div>
          </div>

          {/* Band — grouped KW / VHF */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Band</label>
              <select value={band} onChange={e => handleBandChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                <optgroup label="Kurzwelle (HF)">
                  {KW_BANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </optgroup>
                <optgroup label="VHF / UHF">
                  {VHF_BANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Frequenz (MHz)</label>
              <input type="number" step="0.001" value={frequency} onChange={e => setFrequency(parseFloat(e.target.value) || 145.0)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg" />
            </div>
          </div>

          {/* Modus & Antennenhöhe — height now has slider + number input */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Modus</label>
              <select value={mode} onChange={e => setMode(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                {availableModes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">
                Antennenhöhe: <span className="text-orange-600 font-bold">{antennaHeight.toFixed(1)} m</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="50"
                step="0.1"
                value={antennaHeight}
                onChange={e => setAntennaHeight(parseFloat(e.target.value))}
                className="w-full accent-orange-500"
              />
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={antennaHeight}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) setAntennaHeight(v);
                }}
                className="w-full px-2 py-1 mt-1 text-xs border border-gray-200 dark:border-slate-700 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* NVIS Toggle — only for KW 3-10 MHz */}
          {nvisAvailable && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">NVIS-Modus</span>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">Antenne niedrig (2m), 0-500 km ohne Skip-Zone</p>
                </div>
                <button onClick={() => handleNvisToggle(!nvisMode)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${nvisMode ? "bg-purple-500" : "bg-gray-300 dark:bg-slate-600"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${nvisMode ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            </div>
          )}

          {/* Solar Activity — only for KW */}
          {isHF && (
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">
                Sonnenaktivität: <span className="text-orange-600 font-bold">
                  {solarActivity < 0.85 ? "Niedrig (Solar Min)" : solarActivity > 1.15 ? "Hoch (Solar Max)" : "Mittel"}
                </span>
              </label>
              <input type="range" min="0.7" max="1.3" step="0.05" value={solarActivity} onChange={e => setSolarActivity(parseFloat(e.target.value))} className="w-full accent-orange-500" />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>Min (0.7)</span><span>Mittel (1.0)</span><span>Max (1.3)</span></div>
            </div>
          )}

          {error && <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-300">{error}</div>}

          {/* Result panel — shown after calculation */}
          {lastResult && !loading && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-green-700 dark:text-green-300 flex items-center gap-1.5">
                  <Satellite className="w-3.5 h-3.5" /> Berechnung fertig
                </span>
                <span className="text-[10px] text-green-600 dark:text-green-400 font-mono">
                  {new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div className="bg-white dark:bg-slate-800 rounded p-1.5">
                  <div className="text-[9px] text-gray-400 uppercase">Ø Reichweite</div>
                  <div className="text-sm font-bold text-green-700 dark:text-green-300">{lastResult.avg_range_km || 0} km</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded p-1.5">
                  <div className="text-[9px] text-gray-400 uppercase">Max</div>
                  <div className="text-sm font-bold text-gray-700 dark:text-slate-300">{lastResult.max_range_km || 0} km</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded p-1.5">
                  <div className="text-[9px] text-gray-400 uppercase">Min</div>
                  <div className="text-sm font-bold text-gray-700 dark:text-slate-300">{lastResult.min_range_km || 0} km</div>
                </div>
              </div>
              {lastResult.elevation_m != null && (
                <div className="text-[10px] text-gray-500 dark:text-slate-400 text-center">
                  Standorthöhe: {Math.round(lastResult.elevation_m)} m ü.M.
                </div>
              )}
              {/* Action buttons */}
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => { onCoverageResult(lastResult); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  <Save className="w-3 h-3" /> Auf Karte zeigen
                </button>
                <button
                  onClick={handleRecalculate}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-medium text-orange-700 border border-orange-300 rounded-lg hover:bg-orange-50"
                >
                  <RefreshCw className="w-3 h-3" /> Neu berechnen
                </button>
                <button
                  onClick={() => { setLastResult(null); onCoverageResult(null); }}
                  className="flex items-center justify-center px-2 py-1.5 text-[11px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  title="Löschen"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* History — collapsible */}
          {history.length > 0 && (
            <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Verlauf ({history.length})
                </span>
                {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showHistory && (
                <div className="border-t border-gray-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                  {history.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <button
                        onClick={() => handleLoadHistory(item)}
                        className="flex-1 text-left"
                      >
                        <div className="text-[11px] font-medium text-gray-700 dark:text-slate-300">
                          {item.band} · {item.mode} · {item.power}W · {item.height}m
                        </div>
                        <div className="text-[9px] text-gray-400">
                          {new Date(item.timestamp).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}
                          {item.coverage?.avg_range_km != null && ` · Ø ${item.coverage.avg_range_km} km`}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(item.id)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Löschen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleClearHistory}
                    className="w-full px-3 py-2 text-[10px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-gray-200 dark:border-slate-700"
                  >
                    Alle löschen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Calculate button — hidden when result is shown */}
          {!lastResult && (
            <button onClick={handleCalculate} disabled={loading || !position}
              className="w-full px-4 py-3 text-sm font-bold text-white bg-orange-500 rounded-xl hover:bg-orange-600 disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Satellite className="w-4 h-4" />}
              {loading ? "Berechnet (SRTM-Daten)..." : "Abdeckung berechnen"}
            </button>
          )}
          <p className="text-[10px] text-gray-400 text-center">
            {isHF
              ? "KW-Modell: Bodenwelle + Raumwelle (MUF/LUF) + NVIS. Dauer ca. 5-15 Sek."
              : "ITM+: LOS + Beugung + Troposcatter + Reflexion. Dauer ca. 5-15 Sek."}
          </p>
        </div>
      </div>
    </div>
  );
}