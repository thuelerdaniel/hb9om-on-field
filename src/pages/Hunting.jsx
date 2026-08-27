import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair, MapPin, Radio, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import DraggableQsoButton from "@/components/hunting/DraggableQsoButton";
import CommandStrip from "@/components/hunting/CommandStrip";
import PropagationBar from "@/components/hunting/PropagationBar";
import LiveSpotActivity from "@/components/hunting/LiveSpotActivity";
import SpotDetailsModal from "@/components/hunting/SpotDetailsModal";
import QsoLogModal from "@/components/hunting/QsoLogModal";
import QrzLookupModal from "@/components/hunting/QrzLookupModal";
import PriorityDx from "@/components/hunting/PriorityDx";
import ActivityPanel from "@/components/hunting/ActivityPanel";
import HuntingGlobe from "@/components/hunting/HuntingGlobe";
import BottomNavigation from "@/components/BottomNavigation";

// Hunting-Seite — DX-Spots, Propagation, QSO-Logging.
// Theme-aware: verwendet bg-background, bg-card, text-foreground etc.

const DEFAULT_STATION = { station: "HB9OM", callsign: "HB3YNF", name: "Dani", club: "HB9OM", locator: "JN36FL" };

export default function Hunting() {
  const navigate = useNavigate();
  const [spots, setSpots] = useState([]);
  const [propagation, setPropagation] = useState(null);
  const [stationInfo, setStationInfo] = useState(DEFAULT_STATION);
  const [spotDetails, setSpotDetails] = useState(null);
  const [qsoSpot, setQsoSpot] = useState(null);
  const [qrzCall, setQrzCall] = useState(null);
  const [showBlankQso, setShowBlankQso] = useState(false);
  const [highlightSpot, setHighlightSpot] = useState(null);
  const [gpsPos, setGpsPos] = useState(null); // { lat, lng, accuracy }
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | locating | ok | error
  const watchIdRef = useRef(null);

  // GPS-Tracking: Live-Position vom Gerät
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    setGpsStatus('locating');
    const onSuccess = (pos) => {
      setGpsPos({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      setGpsStatus('ok');
    };
    const onError = () => setGpsStatus('error');
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true, maximumAge: 15000, timeout: 20000,
    });
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Station Info aus AppSetting laden
  useEffect(() => {
    (async () => {
      try {
        const results = await base44.entities.AppSetting.filter({ key: "station_info" });
        if (results && results.length > 0) {
          const info = JSON.parse(results[0].value || '{}');
          setStationInfo({ ...DEFAULT_STATION, ...info });
        }
      } catch {}
    })();
  }, []);

  // Spots laden (für CommandStrip + PriorityDx) — mit GPS-Position falls verfügbar
  const loadSpots = useCallback(async () => {
    try {
      let payload = {};
      if (gpsPos) {
        payload = { station_lat: gpsPos.lat, station_lng: gpsPos.lng };
      } else {
        // Fallback: gespeicherter Stations-Locator aus localStorage
        const savedLocator = typeof localStorage !== 'undefined' ? localStorage.getItem('station_locator') : null;
        if (savedLocator) {
          const { maidenheadToLatLon } = await import('@/lib/geoUtilsFrontend');
          const p = maidenheadToLatLon(savedLocator);
          if (p) payload = { station_lat: p.lat, station_lng: p.lon };
        }
      }
      const res = await base44.functions.invoke("fetchDxSpots", payload);
      const data = res?.data || res;
      if (data?.spots) setSpots(data.spots);
    } catch {
      try {
        const list = await base44.entities.DxSpot.list('-spot_time', 50);
        setSpots(list || []);
      } catch {}
    }
  }, [gpsPos]);

  // Propagation laden (für CommandStrip)
  const loadProp = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("fetchPropagation", {});
      const data = res?.data || res;
      if (data?.propagation) setPropagation(data.propagation);
    } catch {}
  }, []);

  useEffect(() => {
    loadSpots();
    loadProp();
    const interval = setInterval(() => { loadSpots(); loadProp(); }, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadSpots, loadProp]);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
            <button onClick={() => navigate('/')} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors" title="Fox-Modus: Referenzkarte">
              <Radio className="w-3.5 h-3.5" />Fox
            </button>
            <button className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#00e5ff] text-black" title="Hunting-Modus (aktiv)">
              <Crosshair className="w-3.5 h-3.5" />Hunting
            </button>
          </div>
          <Link
            to="/help#hunting"
            className="ml-auto p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Hilfe: Hunting"
          >
            <HelpCircle className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-3 py-3 pb-24 space-y-3">
        {/* GPS Status Banner */}
        {gpsStatus === 'locating' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00e5ff]/10 border border-[#00e5ff]/20 rounded-lg text-[10px] text-[#00e5ff]">
            <MapPin className="w-3 h-3 animate-pulse" /> GPS wird lokalisiert…
          </div>
        )}
        {gpsStatus === 'error' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ff9800]/10 border border-[#ff9800]/20 rounded-lg text-[10px] text-[#ff9800]">
            <MapPin className="w-3 h-3" /> GPS nicht verfügbar — verwende Stations-Locator
          </div>
        )}

        {/* Command Strip */}
        <CommandStrip
          spots={spots}
          propagation={propagation}
          stationInfo={stationInfo}
          gpsPos={gpsPos}
          onLocatorSave={(locator) => setStationInfo(prev => ({ ...prev, locator }))}
          onDxClick={setHighlightSpot}
        />

        {/* Propagation Bar */}
        <PropagationBar stationInfo={stationInfo} />

        {/* Hunting Globe — 3D drehbare Weltkugel mit allen Spots */}
        <HuntingGlobe
          gpsPos={gpsPos}
          stationInfo={stationInfo}
          onSpotClick={setSpotDetails}
        />

        {/* Activity Panel — SOTA + POTA Aktivierungen */}
        <ActivityPanel
          onLogQso={setQsoSpot}
          onSpotDetails={setSpotDetails}
          gpsPos={gpsPos}
        />

        {/* Live Spot Activity */}
        <LiveSpotActivity
          onSpotDetails={setSpotDetails}
          onLogQso={setQsoSpot}
          onCallClick={setQrzCall}
          gpsPos={gpsPos}
          stationInfo={stationInfo}
          highlightSpot={highlightSpot}
        />

        {/* Priority DX */}
        <PriorityDx spots={spots} onSpotDetails={setSpotDetails} />
      </main>

      {/* Spot Details Modal */}
      {spotDetails && (
        <SpotDetailsModal
          spot={spotDetails}
          stationInfo={stationInfo}
          gpsPos={gpsPos}
          onClose={() => setSpotDetails(null)}
          onLogQso={setQsoSpot}
        />
      )}

      {/* QSO Log Modal — aus Spot oder leer (blankQso) */}
      {(qsoSpot || showBlankQso) && (
        <QsoLogModal spot={qsoSpot} onClose={() => { setQsoSpot(null); setShowBlankQso(false); }} />
      )}

      {/* QRZ Lookup Modal */}
      {qrzCall && (
        <QrzLookupModal callsign={qrzCall} onClose={() => setQrzCall(null)} />
      )}

      {/* Fix 2: Verschiebbarer QSO-Loggen Button — lang gedrückt halten zum Verschieben */}
      <DraggableQsoButton onClick={() => setShowBlankQso(true)} />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}