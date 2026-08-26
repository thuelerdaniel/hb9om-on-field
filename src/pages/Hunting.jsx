import React, { useState } from "react";
import { Crosshair } from "lucide-react";
import PropagationDashboard from "@/components/hunting/PropagationDashboard";
import DxSpotList from "@/components/hunting/DxSpotList";
import QrzLookupModal from "@/components/hunting/QrzLookupModal";
import QsoLogModal from "@/components/hunting/QsoLogModal";
import BottomNavigation from "@/components/BottomNavigation";

// Hunting-Seite — kombiniert Propagation Dashboard, Live DX-Spots,
// QRZ-Lookup und QSO-Logging in einem dunklen, mobile-first Design.

export default function Hunting() {
  const [qrzCall, setQrzCall] = useState(null);
  const [qsoSpot, setQsoSpot] = useState(null);

  return (
    <div className="min-h-screen bg-[#121212] text-gray-200">
      {/* Header mit Safe-Area-Top */}
      <header
        className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-md border-b border-gray-800"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <Crosshair className="w-5 h-5 text-green-400" />
          <h1 className="text-lg font-bold text-gray-100">Hunting</h1>
          <span className="text-[10px] text-gray-500 ml-auto">DX-Spots · Propagation · QSO</span>
        </div>
      </header>

      {/* Content — mobile-first, max-w für Desktop */}
      <main className="max-w-2xl mx-auto px-3 py-3 pb-24 space-y-3">
        {/* Sektion 1: Propagation Dashboard (oben, kompakt) */}
        <PropagationDashboard />

        {/* Sektion 2: Live DX Spots (Mitte, scrollbar) */}
        <DxSpotList
          onCallClick={(call) => setQrzCall(call)}
          onLogQso={(spot) => setQsoSpot(spot)}
        />
      </main>

      {/* Sektion 3: QRZ Lookup Modal */}
      {qrzCall && (
        <QrzLookupModal callsign={qrzCall} onClose={() => setQrzCall(null)} />
      )}

      {/* Sektion 4: QSO Log Modal */}
      {qsoSpot && (
        <QsoLogModal spot={qsoSpot} onClose={() => setQsoSpot(null)} />
      )}

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}