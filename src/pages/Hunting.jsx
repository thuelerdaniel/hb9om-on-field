import React, { useState, useEffect, useCallback, useRef } from "react";
import { Crosshair, MapPin, HelpCircle, WifiOff, RefreshCw, Map as MapIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useHuntingSettings } from "@/hooks/useHuntingSettings";
import DraggableQsoButton from "@/components/hunting/DraggableQsoButton";
import PropagationBar from "@/components/hunting/PropagationBar";
import LiveSpotActivity from "@/components/hunting/LiveSpotActivity";
import SpotDetailsModal from "@/components/hunting/SpotDetailsModal";
import QsoLogModal from "@/components/hunting/QsoLogModal";
import QrzLookupModal from "@/components/hunting/QrzLookupModal";
import ActivityPanel from "@/components/hunting/ActivityPanel";
import BottomNavigation from "@/components/BottomNavigation";

// Hunting-Seite — v0.9010 Major Overhaul:
// - Kein 3D Globe, kein CommandStrip, kein PriorityDx, kein Fox-Button im Header
// - GPS-Standort als Referenz fuer Distanz/Azimut
// - User-spezifische Settings (UserHuntingSettings)

const DEFAULT_STATION = { station: "HB9OM", callsign: "HB3YNF", name: "Dani", club: "HB9OM", locator: "JN36FL" };

export default function Hunting() {
  const [stationInfo, setStationInfo] = useState(DEFAULT_STATION);
  const [spotDetails, setSpotDetails] = useState(null);
  const [qsoSpot, setQsoSpot] = useState(null);
  const [qrzCall, setQrzCall] = useState(null);
  const [showBlankQso, setShowBlankQso] = useState(false);
  const [gpsPos, setGpsPos] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle');
  const watchIdRef = useRef(null);
  const { settings, updateGpsPosition } = useHuntingSettings();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Fix 8: Offline-Erkennung
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // GPS-Tracking: Live-Position vom Gerät — Fix 5: GPS als Referenz
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    setGpsStatus('locating');
    const onSuccess = (pos) => {
      const newGps = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      setGpsPos(newGps);
      setGpsStatus('ok');
      // Fix 5: GPS-Position in UserHuntingSettings speichern
      updateGpsPosition(newGps.lat, newGps.lng);
    };
    const onError = () => setGpsStatus('error');
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true, maximumAge: 15000, timeout: 20000,
    });
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [updateGpsPosition]);

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

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header — Fix 1c: Fox-Button entfernt, nur noch Hunting-Label + Hilfe */}
      <header
        className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-foreground text-background">
            <Crosshair className="w-3.5 h-3.5" />Hunting
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

      {/* Fix 8: Offline-Warnung */}
      {!isOnline && (
        <div className="fixed inset-0 z-[9999] bg-[#0a0e17] flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#1a1e2e] flex items-center justify-center mx-auto">
              <WifiOff className="w-8 h-8 text-[#ff5252]" />
            </div>
            <h2 className="text-lg font-bold text-white">Du bist offline</h2>
            <p className="text-sm text-[#a0aec0]">
              Der Hunting-Bereich benötigt eine Netzwerkverbindung um Live-Spots abzurufen.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 bg-[#2e7d32] text-white rounded-lg text-sm font-bold hover:bg-[#1b5e20] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Erneut versuchen
              </button>
              <Link
                to="/"
                className="px-4 py-2.5 bg-[#1a1e2e] text-[#cbd5e0] rounded-lg text-sm font-medium hover:bg-[#252a3d] transition-colors flex items-center justify-center gap-2"
              >
                <MapIcon className="w-4 h-4" /> Zur Karte (Offline-Karten verfügbar)
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Content — Fix 11: Live Spot Activity VOR Active Activation */}
      <main className="max-w-2xl mx-auto px-3 py-3 pb-24 space-y-3">
        {/* GPS Status Banner */}
        {gpsStatus === 'locating' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0ea5e9]/10 border border-[#0ea5e9]/20 rounded-lg text-[10px] text-[#0284c7]">
            <MapPin className="w-3 h-3 animate-pulse" /> GPS wird lokalisiert…
          </div>
        )}
        {gpsStatus === 'error' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg text-[10px] text-[#d97706]">
            <MapPin className="w-3 h-3" /> GPS aktivieren für Distanzberechnung — verwende Stations-Locator
          </div>
        )}

        {/* Propagation Bar */}
        <PropagationBar stationInfo={stationInfo} />

        {/* Fix 11: Live Spot Activity ERST (aktive Spots) */}
        <LiveSpotActivity
          onSpotDetails={setSpotDetails}
          onLogQso={setQsoSpot}
          onCallClick={setQrzCall}
          gpsPos={gpsPos}
          stationInfo={stationInfo}
        />

        {/* Fix 11: Active Activation DANN (geplante/aktive Aktivierungen) */}
        <ActivityPanel
          onLogQso={setQsoSpot}
          onSpotDetails={setSpotDetails}
          gpsPos={gpsPos}
        />
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

      {/* QSO Log Modal */}
      {(qsoSpot || showBlankQso) && (
        <QsoLogModal spot={qsoSpot} onClose={() => { setQsoSpot(null); setShowBlankQso(false); }} />
      )}

      {/* QRZ Lookup Modal */}
      {qrzCall && (
        <QrzLookupModal
          callsign={qrzCall?.call || qrzCall}
          spot={qrzCall}
          onLogQso={setQsoSpot}
          onClose={() => setQrzCall(null)}
        />
      )}

      {/* Verschiebbarer QSO-Loggen Button */}
      <DraggableQsoButton onClick={() => setShowBlankQso(true)} />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}