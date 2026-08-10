import React from "react";
import { Server, ExternalLink, Radio, Zap, Battery, Sun, Mountain, Activity, Headphones, Hash, Phone, MapPin, Wifi, Globe, Cpu } from "lucide-react";
import { findSwissArtgRepeater } from "@/data/swissArtgRepeaters";

// SWISS-ARTG info section for the repeater popup.
// Shows curated data from swiss-artg.ch when the repeater callsign+frequency matches.
export default function SwissArtgInfo({ repeater }) {
  const artg = findSwissArtgRepeater(repeater.callsign, repeater.frequency);
  if (!artg) return null;

  return (
    <div className="mb-2 border-t border-gray-100 pt-2">
      <div className="flex items-center gap-1 mb-1.5">
        <div className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Server className="w-3 h-3 text-amber-700" />
        </div>
        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">SWISS-ARTG</span>
        <span className="text-[10px] text-gray-400 truncate">· {artg.artgCallsign}</span>
      </div>

      <p className="text-[11px] text-gray-700 font-medium mb-1">{artg.description}</p>

      {artg.elevation != null && (
        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
          <Mountain className="w-2.5 h-2.5" />
          <span>{artg.elevation} m ü.M.</span>
          {artg.locator && <span className="text-gray-400">· {artg.locator}</span>}
        </div>
      )}

      {artg.ctcss && (
        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
          <Radio className="w-2.5 h-2.5" />
          <span>CTCSS: <span className="font-mono font-medium text-gray-700">{artg.ctcss}</span></span>
        </div>
      )}

      {/* DMR Talkgroups */}
      {artg.talkgroups && artg.talkgroups.length > 0 && (
        <div className="mb-1.5">
          <div className="text-[10px] text-gray-400 uppercase mb-1 flex items-center gap-1">
            <Hash className="w-2.5 h-2.5" /> DMR Talkgruppen
          </div>
          <div className="space-y-0.5">
            {artg.talkgroups.map((tg, i) => (
              <div key={i} className="text-[10px] bg-amber-50 rounded px-1.5 py-0.5 border border-amber-100 flex items-center gap-1">
                <span className="font-mono font-bold text-amber-700">TS{tg.ts} {tg.tg}</span>
                <span className="text-gray-600 truncate">{tg.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FM-Funknetz Talkgroups (static from SWISS-ARTG, shown if entity has no live TGs) */}
      {artg.fmFunknetz && artg.fmFunknetzTgs && artg.fmFunknetzTgs.length > 0 &&
       (!repeater.fm_funknetz_tgs || repeater.fm_funknetz_tgs.length === 0) && (
        <div className="mb-1.5">
          <div className="text-[10px] text-gray-400 uppercase mb-1 flex items-center gap-1">
            <Headphones className="w-2.5 h-2.5" /> FM-Funknetz TGs (statisch)
          </div>
          <div className="space-y-0.5">
            {artg.fmFunknetzTgs.map((tg, i) => (
              <div key={i} className="text-[10px] bg-green-50 rounded px-1.5 py-0.5 border border-green-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="font-mono font-bold text-green-700">TG {tg.tg}</span>
                <span className="text-gray-600 truncate">{tg.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DMR Dashboard link */}
      {artg.dashboardUrl && (
        <a
          href={artg.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-amber-700 hover:underline mb-1"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          Brandmeister Dashboard (DMR-ID {artg.dmrId})
        </a>
      )}

      {/* D-STAR Reflector link */}
      {artg.reflectorUrl && (
        <a
          href={artg.reflectorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-amber-700 hover:underline mb-1"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          Reflector {artg.reflector}
        </a>
      )}

      {artg.alsoConnectedTo && (
        <div className="text-[10px] text-gray-500 mb-1">
          Auch verbunden: <span className="font-medium text-gray-700">{artg.alsoConnectedTo}</span>
        </div>
      )}

      {/* Echolink ID */}
      {artg.echolinkId && (
        <div className="flex items-center gap-1 text-[10px] text-indigo-600 mb-1 bg-indigo-50 rounded px-1.5 py-0.5">
          <Phone className="w-2.5 h-2.5" />
          <span>EchoLink: <span className="font-mono font-bold">#{artg.echolinkId}</span></span>
        </div>
      )}

      {/* DTMF codes for SVXLink repeaters */}
      {artg.dtmf && artg.dtmf.length > 0 && (
        <div className="mb-1.5">
          <div className="text-[10px] text-gray-400 uppercase mb-0.5">DTMF-Steuerung</div>
          <div className="flex flex-wrap gap-1">
            {artg.dtmf.map((d, i) => (
              <span key={i} className="text-[9px] font-mono bg-gray-100 rounded px-1 py-0.5 text-gray-600">
                {d.code} {d.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Coverage */}
      {artg.coverage && (
        <div className="flex items-start gap-1 text-[10px] text-gray-500 mb-1">
          <MapPin className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
          <span>Abdeckung: {artg.coverage}</span>
        </div>
      )}

      {/* Additional services at the site */}
      {artg.services && artg.services.length > 0 && (
        <div className="mb-1.5">
          <div className="text-[10px] text-gray-400 uppercase mb-0.5 flex items-center gap-1">
            <Wifi className="w-2.5 h-2.5" /> Weitere Anlagen am Standort
          </div>
          <div className="space-y-0.5">
            {artg.services.map((s, i) => (
              <div key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Power indicators */}
      <div className="flex flex-wrap gap-1.5 mb-1">
        {artg.emergencyPower && (
          <span className="flex items-center gap-0.5 text-[10px] text-green-700 bg-green-50 rounded px-1.5 py-0.5">
            <Battery className="w-2.5 h-2.5" />
            Notstrom
          </span>
        )}
        {artg.solarPower && (
          <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
            <Sun className="w-2.5 h-2.5" />
            Solar
          </span>
        )}
        {artg.outputPower && (
          <span className="flex items-center gap-0.5 text-[10px] text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
            <Zap className="w-2.5 h-2.5" />
            {artg.outputPower}
          </span>
        )}
      </div>

      {/* Sysop */}
      {artg.sysop && (
        <div className="text-[10px] text-gray-500 mb-1">
          Sysop: <span className="font-medium text-gray-700">{artg.sysop}</span>
        </div>
      )}

      {/* Link to SWISS-ARTG page */}
      <a
        href={artg.pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-[10px] text-amber-700 hover:underline font-medium"
      >
        <Globe className="w-2.5 h-2.5" />
        Details auf swiss-artg.ch
        <ExternalLink className="w-2.5 h-2.5" />
      </a>
    </div>
  );
}