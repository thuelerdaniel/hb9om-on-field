import React from "react";
import { Mountain, Trees, Castle, Building, MapPin, Anchor, ExternalLink } from "lucide-react";

const LAYER_META = {
  sota: { icon: Mountain, color: "#e74c3c", label: "SOTA", program: "Summits on the Air", linkBase: "https://www.sotl.as/summits/" },
  pota: { icon: Trees, color: "#27ae60", label: "POTA", program: "Parks on the Air", linkBase: "https://pota.app/#/park/" },
  hbff: { icon: Trees, color: "#8e44ad", label: "HBFF", program: "Flora & Fauna Schweiz", linkBase: "" },
  wwbota: { icon: Building, color: "#795548", label: "WWBOTA", program: "Bunkers on the Air", linkBase: "https://wwbota.net/map/" },
  castle: { icon: Castle, color: "#e67e22", label: "WCA/COTA", program: "Burgen on the Air", linkBase: "" },
  iota: { icon: MapPin, color: "#3498db", label: "IOTA", program: "Islands on the Air", linkBase: "https://www.iotamaps.com/index.php" },
  lighthouse: { icon: Anchor, color: "#f39c12", label: "WLOTA", program: "Lighthouses on the Air", linkBase: "" },
  swiss_protected: { icon: Trees, color: "#16a085", label: "BLN/Moor", program: "Bundesinventar", linkBase: "https://map.geo.admin.ch/" }
};

export default function MarkerPopup({ data, layerType }) {
  const meta = LAYER_META[layerType] || {};
  const Icon = meta.icon || MapPin;

  // Build external link based on layer type and data
  const externalLink = data.link || (() => {
    if (!meta.linkBase) return null;
    if (layerType === "sota" && data.code) return meta.linkBase + data.code;
    if (layerType === "pota" && (data.reference || data.code)) return meta.linkBase + (data.reference || data.code);
    return meta.linkBase;
  })();

  return (
    <div className="min-w-[220px] max-w-[300px]">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.color + '20' }}>
          <Icon className="w-4 h-4" style={{ color: meta.color }} />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <p className="text-xs text-gray-400">{meta.program}</p>
        </div>
      </div>

      <h3 className="font-bold text-sm text-gray-900 mb-1">{data.name || data.reference || data.code}</h3>

      {data.code && <p className="text-xs text-gray-500 mb-1">Referenz: <span className="font-mono font-semibold">{data.code}</span></p>}
      {data.reference && !data.code && <p className="text-xs text-gray-500 mb-1">Referenz: <span className="font-mono font-semibold">{data.reference}</span></p>}

      {data.alt && <p className="text-xs text-gray-500">Höhe: {data.alt} m ü.M.</p>}
      {data.points && <p className="text-xs text-gray-500">Punkte: {data.points}</p>}
      {data.region && <p className="text-xs text-gray-500">Region: {data.region}</p>}
      {data.locationDesc && <p className="text-xs text-gray-500">Ort: {data.locationDesc}</p>}
      {data.parkType && <p className="text-xs text-gray-500">Typ: {data.parkType}</p>}
      {data.canton && <p className="text-xs text-gray-500">Kanton: {data.canton}</p>}
      {data.country && <p className="text-xs text-gray-500">Land: {data.country}</p>}
      {data.activationCount !== undefined && <p className="text-xs text-gray-500">Aktivierungen: {data.activationCount}</p>}

      {externalLink && (
        <a href={externalLink} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline">
          Mehr Infos <ExternalLink className="w-3 h-3" />
        </a>
      )}

      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
        {data.lat?.toFixed(5)}, {data.lng?.toFixed(5)}
      </div>
    </div>
  );
}