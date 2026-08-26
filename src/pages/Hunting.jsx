import React, { useState, useEffect, useCallback } from "react";
import { Crosshair } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CommandStrip from "@/components/hunting/CommandStrip";
import PropagationBar from "@/components/hunting/PropagationBar";
import FoxHuntButton from "@/components/hunting/FoxHuntButton";
import FoxHuntModal from "@/components/hunting/FoxHuntModal";
import LiveSpotActivity from "@/components/hunting/LiveSpotActivity";
import SpotDetailsModal from "@/components/hunting/SpotDetailsModal";
import QsoLogModal from "@/components/hunting/QsoLogModal";
import QrzLookupModal from "@/components/hunting/QrzLookupModal";
import PriorityDx from "@/components/hunting/PriorityDx";
import BottomNavigation from "@/components/BottomNavigation";

// Hunting-Seite — SHACK-SERVER Style Dashboard.
// Command Strip + Propagation Bar + Fox Hunting + Live Spots + Details + QSO + Priority DX.
// Hintergrund #050b10, Panels #0d1720, Border #1d3442, Cyan #00e5ff, Grün #8cff00.

const DEFAULT_STATION = { station: "HB9OM", callsign: "HB3YNF", name: "Dani", club: "HB9OM", locator: "JN36FL" };

export default function Hunting() {
  const [spots, setSpots] = useState([]);
  const [propagation, setPropagation] = useState(null);
  const [stationInfo, setStationInfo] = useState(DEFAULT_STATION);
  const [showFoxHunt, setShowFoxHunt] = useState(false);
  const [spotDetails, setSpotDetails] = useState(null);
  const [qsoSpot, setQsoSpot] = useState(null);
  const [qrzCall, setQrzCall] = useState(null);

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
    <div className="min-h-screen bg-[#050b10] text-white" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 bg-[#050b10]/95 backdrop-blur-md border-b border-[#1d3442]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-[#00e5ff]" />
          <h1 className="text-lg font-bold text-white">Hunting</h1>
          <span className="text-[10px] text-[#9aa7b0] ml-auto">SHACK-SERVER Style</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-3 py-3 pb-24 space-y-3">
        {/* 3.1 Command Strip */}
        <CommandStrip spots={spots} propagation={propagation} stationInfo={stationInfo} />

        {/* 3.2 Propagation Bar */}
        <PropagationBar stationInfo={stationInfo} />

        {/* 3.3 Fox Hunting Button */}
        <FoxHuntButton onClick={() => setShowFoxHunt(true)} />

        {/* 3.7 Priority DX */}
        <PriorityDx spots={spots} onSpotDetails={setSpotDetails} />

        {/* 3.4 Live Spot Activity */}
        <LiveSpotActivity
          onSpotDetails={setSpotDetails}
          onLogQso={setQsoSpot}
          onCallClick={setQrzCall}
        />
      </main>

      {/* 3.3 Fox Hunt Modal */}
      {showFoxHunt && (
        <FoxHuntModal stationInfo={stationInfo} onClose={() => setShowFoxHunt(false)} />
      )}

      {/* 3.5 Spot Details Modal */}
      {spotDetails && (
        <SpotDetailsModal
          spot={spotDetails}
          stationInfo={stationInfo}
          onClose={() => setSpotDetails(null)}
          onLogQso={setQsoSpot}
        />
      )}

      {/* 3.6 QSO Log Modal */}
      {qsoSpot && (
        <QsoLogModal spot={qsoSpot} onClose={() => setQsoSpot(null)} />
      )}

      {/* QRZ Lookup Modal */}
      {qrzCall && (
        <QrzLookupModal callsign={qrzCall} onClose={() => setQrzCall(null)} />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}