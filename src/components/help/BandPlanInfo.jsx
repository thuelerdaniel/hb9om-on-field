import React, { useState } from "react";
import { ChevronDown, ChevronUp, Radio } from "lucide-react";

const BAND_DATA = [
  {
    band: "160m (1.8 MHz)",
    range: "1.810 – 2.000 MHz",
    segments: [
      { freq: "1.810–1.838", mode: "CW" },
      { freq: "1.838–1.843", mode: "DATA" },
      { freq: "1.843–2.000", mode: "LSB-Voice" },
    ],
  },
  {
    band: "80m (3.5 MHz)",
    range: "3.500 – 3.800 MHz",
    segments: [
      { freq: "3.500–3.570", mode: "CW" },
      { freq: "3.570–3.620", mode: "DATA" },
      { freq: "3.620–3.800", mode: "LSB-Voice" },
    ],
  },
  {
    band: "60m (5 MHz)",
    range: "5.3515 – 5.3665 MHz",
    segments: [
      { freq: "5.3515–5.3540", mode: "CW" },
      { freq: "5.3540–5.3665", mode: "Voice/All Modes (USB)" },
    ],
  },
  {
    band: "40m (7 MHz)",
    range: "7.000 – 7.200 MHz",
    segments: [
      { freq: "7.000–7.040", mode: "CW" },
      { freq: "7.040–7.053", mode: "DATA" },
      { freq: "7.053–7.200", mode: "LSB-Voice" },
    ],
  },
  {
    band: "30m (10 MHz)",
    range: "10.100 – 10.150 MHz",
    segments: [
      { freq: "10.100–10.130", mode: "CW" },
      { freq: "10.130–10.150", mode: "DATA" },
    ],
  },
  {
    band: "20m (14 MHz)",
    range: "14.000 – 14.350 MHz",
    segments: [
      { freq: "14.000–14.070", mode: "CW" },
      { freq: "14.070–14.099", mode: "DATA" },
      { freq: "14.099–14.112", mode: "DATA/BAKEN" },
      { freq: "14.112–14.350", mode: "USB-Voice" },
    ],
  },
  {
    band: "17m (18 MHz)",
    range: "18.068 – 18.168 MHz",
    segments: [
      { freq: "18.068–18.095", mode: "CW" },
      { freq: "18.095–18.109", mode: "DATA/BAKEN" },
      { freq: "18.109–18.168", mode: "USB-Voice" },
    ],
  },
  {
    band: "15m (21 MHz)",
    range: "21.000 – 21.450 MHz",
    segments: [
      { freq: "21.000–21.070", mode: "CW" },
      { freq: "21.070–21.150", mode: "DATA" },
      { freq: "21.150–21.450", mode: "USB-Voice" },
    ],
  },
  {
    band: "12m (24 MHz)",
    range: "24.890 – 24.990 MHz",
    segments: [
      { freq: "24.890–24.920", mode: "CW" },
      { freq: "24.920–24.940", mode: "DATA" },
      { freq: "24.940–24.990", mode: "USB-Voice" },
    ],
  },
  {
    band: "10m (28 MHz)",
    range: "28.000 – 29.700 MHz",
    segments: [
      { freq: "28.000–28.070", mode: "CW" },
      { freq: "28.070–28.190", mode: "DATA" },
      { freq: "28.190–28.500", mode: "BAKEN" },
      { freq: "28.500–29.700", mode: "USB-Voice/FM" },
    ],
  },
  {
    band: "6m (50 MHz)",
    range: "50.000 – 52.000 MHz",
    segments: [
      { freq: "50.000–50.100", mode: "CW" },
      { freq: "50.100–50.500", mode: "SSB/DATA" },
      { freq: "50.500–52.000", mode: "FM/Voice" },
    ],
  },
  {
    band: "4m (70 MHz)",
    range: "70.000 – 70.500 MHz",
    segments: [
      { freq: "70.000–70.100", mode: "CW" },
      { freq: "70.100–70.250", mode: "SSB/DATA" },
      { freq: "70.250–70.500", mode: "FM/Voice" },
    ],
  },
  {
    band: "2m (144 MHz)",
    range: "144.000 – 146.000 MHz",
    segments: [
      { freq: "144.000–144.100", mode: "CW" },
      { freq: "144.100–144.400", mode: "SSB/DATA" },
      { freq: "144.400–144.975", mode: "FM-Voice (Simplex & Relais)" },
      { freq: "144.975–145.806", mode: "FM Relais-Eingang" },
      { freq: "145.806–146.000", mode: "Satellit/BAKEN" },
    ],
  },
  {
    band: "70cm (430 MHz)",
    range: "430.000 – 440.000 MHz",
    segments: [
      { freq: "430.000–432.000", mode: "Relais-Eingang" },
      { freq: "432.000–432.500", mode: "CW" },
      { freq: "432.500–433.400", mode: "SSB/DATA" },
      { freq: "433.400–433.575", mode: "FM Simplex" },
      { freq: "433.575–434.000", mode: "DATA" },
      { freq: "434.000–440.000", mode: "FM Relais/ATV" },
    ],
  },
  {
    band: "23cm (1240 MHz)",
    range: "1240.000 – 1300.000 MHz",
    segments: [
      { freq: "1240–1255", mode: "SAT/DATA" },
      { freq: "1255–1260", mode: "ATV/DATA" },
      { freq: "1260–1270", mode: "Relais-Eingang" },
      { freq: "1270–1300", mode: "FM/ATV/DATA" },
    ],
  },
];

const MODE_COLORS = {
  "CW": "#ef4444",
  "DATA": "#8b5cf6",
  "LSB-Voice": "#3b82f6",
  "USB-Voice": "#3b82f6",
  "FM-Voice": "#10b981",
  "FM": "#10b981",
  "BAKEN": "#f59e0b",
  "DATA/BAKEN": "#f59e0b",
  "SSB/DATA": "#6366f1",
  "FM/Voice": "#10b981",
  "FM Simplex": "#10b981",
  "DATA": "#8b5cf6",
  "Relais-Eingang": "#ec4899",
  "FM Relais/ATV": "#14b8a6",
  "FM Relais-Eingang": "#ec4899",
  "FM/Voice/FM": "#10b981",
  "SAT/DATA": "#f97316",
  "ATV/DATA": "#a855f7",
  "FM/ATV/DATA": "#14b8a6",
  "Voice/All Modes (USB)": "#3b82f6",
  "Satellit/BAKEN": "#f59e0b",
  "SSB/DATA": "#6366f1",
};

function getModeColor(mode) {
  for (const key of Object.keys(MODE_COLORS)) {
    if (mode.includes(key)) return MODE_COLORS[key];
  }
  return "#6b7280";
}

export default function BandPlanInfo() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-50">
          <Radio className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-sm font-bold text-gray-900">IARU Bandplan (Region 1 / USKA)</h2>
          <p className="text-xs text-gray-500">Frequenzbereiche und Modi für alle Amateurfunk-Bänder</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <div className="mb-3 p-3 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-100">
            <p className="font-semibold mb-0.5">⚠️ Hinweis</p>
            <p>
              Diese Tabelle ist eine vereinfachte Zusammenfassung des IARU Region 1 Bandplans (USKA v1.4).
              Massgeblich ist stets der offizielle Bandplan auf{" "}
              <a href="https://www.uska.ch" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-medium">uska.ch</a>.
            </p>
          </div>

          <div className="space-y-2.5">
            {BAND_DATA.map((b, i) => (
              <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">{b.band}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{b.range}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {b.segments.map((s, j) => (
                    <div key={j} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getModeColor(s.mode) }} />
                      <span className="font-mono text-gray-600 w-28 flex-shrink-0">{s.freq}</span>
                      <span className="text-gray-700">{s.mode}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            {["CW", "DATA", "USB/LSB-Voice", "FM-Voice", "BAKEN", "Relais"].map(m => (
              <span key={m} className="flex items-center gap-1 px-2 py-1 bg-gray-50 rounded">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getModeColor(m) }} />
                <span className="text-gray-600">{m}</span>
              </span>
            ))}
          </div>

          <a
            href="https://www.uska.ch/wp-content/uploads/2023/07/IARU-Bandplan-Reg-1_USKA-v1.4.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-xs text-indigo-600 hover:underline"
          >
            Original-PDF auf uska.ch öffnen →
          </a>
        </div>
      )}
    </div>
  );
}