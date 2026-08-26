import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair, Plus, ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CommandStrip from "@/components/hunting/CommandStrip";
import PropagationBar from "@/components/hunting/PropagationBar";
import LiveSpotActivity from "@/components/hunting/LiveSpotActivity";
import SpotDetailsModal from "@/components/hunting/SpotDetailsModal";
import QsoLogModal from "@/components/hunting/QsoLogModal";
import QrzLookupModal from "@/components/hunting/QrzLookupModal";
import PriorityDx from "@/components/hunting/PriorityDx";
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

  // Spots laden (für CommandStrip + PriorityDx)
  const loadSpots = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("fetchDxSpots", {});
      const data = res?.data || res;
      if (data?.spots) setSpots(data.spots);
    } catch {
      try {
        const list = await base44.entities.DxSpot.list('-spot_time', 50);
        setSpots(list || []);
      } catch {}
    }
  }, []);

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
    const interval = setInterval(() => { loadSpots(); loadProp(); }, 5 * 60 * 1000);
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
          <button onClick={() => navigate('/')} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="Zurück zur Karte">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <Crosshair className="w-5 h-5 text-[#00e5ff]" />
          <h1 className="text-lg font-bold text-foreground">Hunting</h1>
          <span className="text-[10px] text-muted-foreground ml-auto">DX-Spots & Propagation</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-3 py-3 pb-24 space-y-3">
        {/* Command Strip */}
        <CommandStrip spots={spots} propagation={propagation} stationInfo={stationInfo} />

        {/* Propagation Bar */}
        <PropagationBar stationInfo={stationInfo} />

        {/* Priority DX */}
        <PriorityDx spots={spots} onSpotDetails={setSpotDetails} />

        {/* Live Spot Activity */}
        <LiveSpotActivity
          onSpotDetails={setSpotDetails}
          onLogQso={setQsoSpot}
          onCallClick={setQrzCall}
        />
      </main>

      {/* Spot Details Modal */}
      {spotDetails && (
        <SpotDetailsModal
          spot={spotDetails}
          stationInfo={stationInfo}
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

      {/* Prominenter QSO-Loggen Button — gross, grün, immer sichtbar */}
      <button
        onClick={() => setShowBlankQso(true)}
        className="fixed right-4 z-[1000] h-14 px-6 rounded-full bg-[#8cff00] text-black shadow-2xl shadow-[#8cff00]/40 flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
        title="Neues QSO loggen"
      >
        <Plus className="w-6 h-6" />
        <span className="font-bold text-sm whitespace-nowrap">QSO loggen</span>
      </button>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}